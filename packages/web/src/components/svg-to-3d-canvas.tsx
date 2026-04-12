/**
 * =============================================================================
 * SVG-to-3D Canvas
 * =============================================================================
 *
 * Web editor wrapper around the 3dsvg engine's <SVG3D> component. Injects
 * web-only children: draggable light orb, background plane, and high-res
 * export capture.
 */

"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter.js";

import { SVG3D, materialPresets } from "3dsvg";
import type { AnimationType, MaterialSettings } from "3dsvg";

import { type TextureSettings } from "@/lib/types";

export type { AnimationType, MaterialSettings };
export type Export3DFormat = "stl" | "glb" | "obj" | "ply";

// ---------------------------------------------------------------------------
// Light controls — draggable orb with glow sprite (web-only)
// ---------------------------------------------------------------------------

function createGlowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, "rgba(255, 248, 200, 1)");
  gradient.addColorStop(0.1, "rgba(255, 220, 100, 0.8)");
  gradient.addColorStop(0.3, "rgba(255, 190, 50, 0.3)");
  gradient.addColorStop(0.6, "rgba(255, 170, 30, 0.08)");
  gradient.addColorStop(1, "rgba(255, 150, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

let _glowTexture: THREE.Texture | null = null;
function getGlowTexture() {
  if (!_glowTexture) _glowTexture = createGlowTexture();
  return _glowTexture;
}

function GlowSprite({ intensity }: { intensity: number }) {
  const scale = 1.5 + intensity * 0.8;
  return (
    <sprite scale={[scale, scale, 1]} renderOrder={-1}>
      <spriteMaterial
        map={getGlowTexture()}
        transparent
        opacity={Math.min(1, intensity * 0.4)}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

// ---------------------------------------------------------------------------
// DownloadCapture — high-res PNG export with content cropping (web-only)
// ---------------------------------------------------------------------------

function DownloadCapture({
  registerCapture,
  shadowRef,
  lightOrbRef,
  bgPlaneRef,
}: {
  registerCapture?: (fn: (resolution: number, withBackground: boolean, onCapture: (dataUrl: string) => void, aspectRatio?: number | null) => void) => void;
  shadowRef: React.RefObject<THREE.Group | null>;
  lightOrbRef: React.RefObject<THREE.Group | null>;
  bgPlaneRef: React.RefObject<THREE.Mesh | null>;
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    if (!registerCapture) return;
    registerCapture((resolution, withBackground, onCapture, aspectRatio) => {
      const prevBackground = scene.background;
      const shadowGroup = shadowRef.current;
      const lightOrbGroup = lightOrbRef.current;
      const bgPlane = bgPlaneRef.current;
      if (lightOrbGroup) lightOrbGroup.visible = false;
      if (!withBackground) {
        if (shadowGroup) shadowGroup.visible = false;
        if (bgPlane) bgPlane.visible = false;
        scene.background = null;
      }

      const canvas = gl.domElement;
      const prevWidth = canvas.width;
      const prevHeight = canvas.height;
      const prevStyle = canvas.style.cssText;

      const renderAspect = aspectRatio ?? (prevWidth / prevHeight);
      const w = resolution;
      const h = Math.round(resolution / renderAspect);

      canvas.style.position = "fixed";
      canvas.style.left = "-9999px";

      gl.setSize(w, h, false);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = renderAspect;
        camera.updateProjectionMatrix();
      }

      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.2;
      gl.setClearColor(0x000000, 0);
      gl.render(scene, camera);

      if (aspectRatio || withBackground) {
        const dataUrl = canvas.toDataURL("image/png");
        onCapture(dataUrl);
      } else {
        const tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = w;
        tmpCanvas.height = h;
        const tmpCtx = tmpCanvas.getContext("2d")!;
        tmpCtx.drawImage(canvas, 0, 0);
        const imageData = tmpCtx.getImageData(0, 0, w, h);
        const data = imageData.data;

        let minX = w, minY = h, maxX = 0, maxY = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const alpha = data[(y * w + x) * 4 + 3];
            if (alpha > 0) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;
        const pad = Math.max(10, Math.round(Math.max(cropW, cropH) * 0.05));

        const x0 = Math.max(0, minX - pad);
        const y0 = Math.max(0, minY - pad);
        const x1 = Math.min(w, maxX + 1 + pad);
        const y1 = Math.min(h, maxY + 1 + pad);

        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = x1 - x0;
        croppedCanvas.height = y1 - y0;
        const croppedCtx = croppedCanvas.getContext("2d")!;
        croppedCtx.drawImage(
          tmpCanvas,
          x0, y0, x1 - x0, y1 - y0,
          0, 0, x1 - x0, y1 - y0
        );

        const dataUrl = croppedCanvas.toDataURL("image/png");
        onCapture(dataUrl);
      }

      gl.setSize(prevWidth, prevHeight, false);
      canvas.style.cssText = prevStyle;
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = prevWidth / prevHeight;
        camera.updateProjectionMatrix();
      }
      scene.background = prevBackground;
      if (shadowGroup) shadowGroup.visible = true;
      if (lightOrbGroup) lightOrbGroup.visible = true;
      if (bgPlane) bgPlane.visible = true;
    });
  }, [gl, scene, camera, registerCapture, shadowRef, bgPlaneRef]);

  return null;
}

// ---------------------------------------------------------------------------
// Download3DCapture — STL / GLB / OBJ / PLY export (web-only)
// ---------------------------------------------------------------------------

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// The engine merges extruded shapes via BufferGeometryUtils.mergeGeometries,
// which yields a plain BufferGeometry (type === "BufferGeometry"). Scene
// extras — background plane, light-orb sphere, contact shadows — use
// subclasses (PlaneGeometry, SphereGeometry, etc.), so matching the base
// type isolates the user's SVG mesh.
function collectExtrudedMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (!obj.visible) return;
    if (obj.geometry?.type !== "BufferGeometry") return;
    meshes.push(obj);
  });
  return meshes;
}

// Build a detached group containing cloned meshes with world transforms baked
// into the geometry. Ensures exports look like what the user sees, regardless
// of camera/animation state.
function buildExportGroup(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  const meshes = collectExtrudedMeshes(scene);
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    const material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
    group.add(new THREE.Mesh(geometry, material));
  }
  return group;
}

function Download3DCapture({
  register3DExport,
}: {
  register3DExport?: (fn: (format: Export3DFormat, filename?: string) => void) => void;
}) {
  const { scene } = useThree();

  useEffect(() => {
    if (!register3DExport) return;
    register3DExport((format, filename = "3dsvg") => {
      const group = buildExportGroup(scene);
      if (group.children.length === 0) return;

      if (format === "stl") {
        const result = new STLExporter().parse(group, { binary: true });
        triggerDownload(new Blob([result], { type: "model/stl" }), `${filename}.stl`);
      } else if (format === "obj") {
        const text = new OBJExporter().parse(group);
        triggerDownload(new Blob([text], { type: "text/plain" }), `${filename}.obj`);
      } else if (format === "ply") {
        const result = new PLYExporter().parse(group, () => {}, { binary: true });
        if (result) {
          triggerDownload(new Blob([result], { type: "application/octet-stream" }), `${filename}.ply`);
        }
      } else if (format === "glb") {
        new GLTFExporter().parse(
          group,
          (result) => {
            const blob = result instanceof ArrayBuffer
              ? new Blob([result], { type: "model/gltf-binary" })
              : new Blob([JSON.stringify(result)], { type: "model/gltf+json" });
            triggerDownload(blob, `${filename}.glb`);
          },
          (err) => console.error("GLTF export failed", err),
          { binary: true }
        );
      }
    });
  }, [scene, register3DExport]);

  return null;
}

// ---------------------------------------------------------------------------
// SVGTo3DCanvas — main exported component
// ---------------------------------------------------------------------------

export interface LightSettings {
  keyX: number;
  keyY: number;
  keyZ: number;
  keyIntensity: number;
  ambientIntensity: number;
  shadowEnabled: boolean;
}

export const defaultLightSettings: LightSettings = {
  keyX: 2,
  keyY: 2,
  keyZ: 4,
  keyIntensity: 1.2,
  ambientIntensity: 0.3,
  shadowEnabled: true,
};

interface SVGTo3DCanvasProps {
  svg: string;
  depth: number;
  smoothness: number;
  color: string;
  bgColor: string;
  textureUrl: string | null;
  textureSettings: TextureSettings;
  materialSettings: MaterialSettings;
  cursorOrbit: boolean;
  orbitStrength: number;
  resetOnIdle: boolean;
  resetDelay: number;
  animate: AnimationType;
  animateSpeed: number;
  animateReverse: boolean;
  rotationX: number;
  rotationY: number;
  zoom: number;
  resetKey: number;
  lightSettings: LightSettings;
  showLightHelper: boolean;
  registerCapture?: (fn: (resolution: number, withBackground: boolean, onCapture: (dataUrl: string) => void, aspectRatio?: number | null) => void) => void;
  registerCanvas?: (canvas: HTMLCanvasElement) => void;
  register3DExport?: (fn: (format: Export3DFormat, filename?: string) => void) => void;
}

export function SVGTo3DCanvas({
  svg,
  depth,
  smoothness,
  color,
  bgColor,
  textureUrl,
  textureSettings,
  materialSettings,
  cursorOrbit,
  orbitStrength,
  resetOnIdle,
  resetDelay,
  animate,
  animateSpeed,
  animateReverse,
  rotationX,
  rotationY,
  zoom,
  resetKey,
  lightSettings,
  showLightHelper,
  registerCapture,
  registerCanvas,
  register3DExport,
}: SVGTo3DCanvasProps) {
  const shadowRef = useRef<THREE.Group>(null);
  const lightOrbRef = useRef<THREE.Group>(null);
  const bgPlaneRef = useRef<THREE.Mesh>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoader, setShowLoader] = useState(false);
  const loaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLoadingChange = useCallback((loading: boolean, progress: number) => {
    setIsLoading(loading);
    setLoadingProgress(progress);
    if (loading) {
      if (!loaderTimerRef.current) {
        loaderTimerRef.current = setTimeout(() => setShowLoader(true), 800);
      }
    } else {
      if (loaderTimerRef.current) { clearTimeout(loaderTimerRef.current); loaderTimerRef.current = null; }
      setShowLoader(false);
    }
  }, []);

  return (
    <>
      <div
        className={`absolute inset-0 z-20 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${showLoader ? "opacity-100" : "opacity-0"}`}
      >
        <div className="flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-xl px-4 py-2">
          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-xs text-white/70">{loadingProgress > 0 && loadingProgress < 100 ? `${loadingProgress}%` : "Loading..."}</span>
        </div>
      </div>
    <SVG3D
      svg={svg}
      depth={depth}
      smoothness={smoothness}
      color={color}
      material={materialSettings.preset}
      metalness={materialSettings.metalness}
      roughness={materialSettings.roughness}
      opacity={materialSettings.opacity}
      wireframe={materialSettings.wireframe}
      texture={textureUrl ?? undefined}
      textureRepeat={textureSettings.repeatX}
      textureRotation={textureSettings.rotation}
      textureOffset={[textureSettings.offsetX, textureSettings.offsetY]}
      lightPosition={[lightSettings.keyX, lightSettings.keyY, lightSettings.keyZ]}
      lightIntensity={lightSettings.keyIntensity}
      ambientIntensity={lightSettings.ambientIntensity}
      shadow={lightSettings.shadowEnabled}
      rotationX={rotationX}
      rotationY={rotationY}
      zoom={zoom}
      resetKey={resetKey}
      cursorOrbit={cursorOrbit}
      orbitStrength={orbitStrength}
      resetOnIdle={resetOnIdle}
      resetDelay={resetDelay}
      animate={animate}
      animateSpeed={animateSpeed}
      animateReverse={animateReverse}
      scrollZoom
      background="#0a0a0a"
      width="100%"
      height="100%"
      intro="zoom"
      onReady={() => setIsLoading(false)}
      onLoadingChange={handleLoadingChange}
      registerCanvas={registerCanvas}
    >
      {/* Export capture — needs GL access */}
      <DownloadCapture
        registerCapture={registerCapture}
        shadowRef={shadowRef}
        lightOrbRef={lightOrbRef}
        bgPlaneRef={bgPlaneRef}
      />

      {/* 3D model export — STL / GLB / OBJ / PLY */}
      <Download3DCapture register3DExport={register3DExport} />

      {/* Light position indicator */}
      <group ref={lightOrbRef}>
        {showLightHelper && (
          <mesh position={[lightSettings.keyX, lightSettings.keyY, lightSettings.keyZ]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
            <GlowSprite intensity={lightSettings.keyIntensity} />
          </mesh>
        )}
      </group>

      {/* Background plane — gives glass/transmission materials something to refract through */}
      <mesh ref={bgPlaneRef} position={[0, 0, -3]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={bgColor} roughness={0.8} metalness={0} />
      </mesh>
    </SVG3D>
    </>
  );
}
