/**
 * =============================================================================
 * Editor Page
 * =============================================================================
 *
 * Main application page. Composes the 3D canvas, input panel, controls
 * panel, and export bar into the full editor experience.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Settings2, CodeXml, MessageCircle, Download } from "lucide-react";
import { defaultLightSettings, type LightSettings, type Export3DFormat } from "@/components/svg-to-3d-canvas";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { InputPanel } from "@/components/input-panel";
import { ControlsPanel } from "@/components/controls-panel";
import { ExportModal } from "@/components/export-bar";
import { EmbedDialog } from "@/components/embed-dialog";
import { DownloadDialog } from "@/components/download-dialog";
import { Freedback } from "@/components/freedback";
import { GitHubStarBadge } from "@/components/github-star-badge";
import {
  defaultTextureSettings,
  defaultMaterialSettings,
  type TextureSettings,
  type MaterialSettings,
} from "@/lib/types";

const SVGTo3DCanvas = dynamic(
  () =>
    import("@/components/svg-to-3d-canvas").then((mod) => mod.SVGTo3DCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-muted rounded-lg animate-pulse" />
    ),
  }
);

export default function Home() {
  // --- Editor state ---
  const [customSvg, setCustomSvg] = useState("");
  const [fileSvg, setFileSvg] = useState("");
  const [pixelSvg, setPixelSvg] = useState("");
  const [textSvg, setTextSvg] = useState("");
  const [inputTab, setInputTab] = useState("draw");
  const [depth, setDepth] = useState(1);
  const [smoothness, setSmoothness] = useState(0.6);
  const [color, setColor] = useState("#4f46e5");
  const [bgColor, setBgColor] = useState("#6961ff");
  const [textureUrl, setTextureUrl] = useState<string | null>(null);
  const [textureSettings, setTextureSettings] =
    useState<TextureSettings>(defaultTextureSettings);
  const [materialSettings, setMaterialSettings] =
    useState<MaterialSettings>(defaultMaterialSettings);
  const captureFnRef = useRef<((resolution: number, withBackground: boolean, onCapture: (dataUrl: string) => void, aspectRatio?: number | null) => void) | null>(null);
  const export3DFnRef = useRef<((format: Export3DFormat, filename?: string) => void) | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [topPanel, setTopPanel] = useState<"toolbar" | "settings">("toolbar");
  const [lightingOpen, setLightingOpen] = useState(false);
  const [cursorOrbit, setCursorOrbit] = useState(false);
  const [orbitStrength, setOrbitStrength] = useState(0.15);
  const [resetOnIdle, setResetOnIdle] = useState(false);
  const [resetDelay, setResetDelay] = useState(2);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [zoom, setZoom] = useState(8);
  const [resetKey, setResetKey] = useState(0);
  const [animate, setAnimate] = useState<"none" | "spin" | "float" | "pulse" | "wobble" | "spinFloat" | "swing">("float");
  const [animateSpeed, setAnimateSpeed] = useState(1);
  const [animateReverse, setAnimateReverse] = useState(false);
  const [lightSettings, setLightSettings] = useState<LightSettings>(defaultLightSettings);
  const [currentText, setCurrentText] = useState("3DSVG");
  const [currentFont, setCurrentFont] = useState("Rubik Mono One");
  const [embedOpen, setEmbedOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // --- Export bar ---
  const [exportOpen] = useState(true);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const registerCapture = useCallback((fn: (resolution: number, withBackground: boolean, onCapture: (dataUrl: string) => void, aspectRatio?: number | null) => void) => {
    captureFnRef.current = fn;
  }, []);

  const registerCanvas = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const register3DExport = useCallback((fn: (format: Export3DFormat, filename?: string) => void) => {
    export3DFnRef.current = fn;
  }, []);

  const handle3DExport = useCallback((format: Export3DFormat) => {
    const base = inputTab === "text" && currentText ? currentText.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "3dsvg" : "3dsvg";
    export3DFnRef.current?.(format, base);
  }, [inputTab, currentText]);

  // --- Drag-and-drop SVG ---
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFile, setDroppedFile] = useState<{ name: string; content: string } | null>(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) setIsDragging(false);
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file && (file.type === "image/svg+xml" || file.name.endsWith(".svg"))) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          if (text) {
            setFileSvg(text);
            setInputTab("file");
            setDroppedFile({ name: file.name, content: text });
          }
        };
        reader.readAsText(file);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  const handleTextureUpload = useCallback((url: string | null) => {
    setTextureUrl(url);
    if (!url) setTextureSettings(defaultTextureSettings);
  }, []);

  const handlePixelSvgChange = useCallback((svg: string) => {
    setPixelSvg(svg);
  }, []);

  const handleTextSvgChange = useCallback((svg: string) => {
    setTextSvg(svg);
  }, []);

  // Show SVG from the active tab. When switching to an empty tab,
  // keep showing the last non-empty SVG that was displayed.
  const svgByTab: Record<string, string> = {
    text: textSvg,
    draw: pixelSvg,
    code: customSvg.trim(),
    file: fileSvg,
  };
  const tabSvg = svgByTab[inputTab] ?? "";
  const [lastActiveSvg, setLastActiveSvg] = useState("");
  if (tabSvg && tabSvg !== lastActiveSvg) {
    setLastActiveSvg(tabSvg);
  }
  const activeSvg = tabSvg || lastActiveSvg;

  return (
    <main className="relative w-screen overflow-hidden bg-background h-[100svh]">
      {/* Layer 0: 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <SVGTo3DCanvas
          svg={activeSvg}
          depth={depth}
          smoothness={smoothness}
          color={color}
          bgColor={bgColor}
          textureUrl={textureUrl}
          textureSettings={textureSettings}
          materialSettings={materialSettings}
          rotationX={rotationX}
          rotationY={rotationY}
          zoom={zoom}
          resetKey={resetKey}
          cursorOrbit={cursorOrbit}
          orbitStrength={orbitStrength}
          resetOnIdle={exportPreviewOpen ? false : resetOnIdle}
          resetDelay={resetDelay}
          animate={exportPreviewOpen ? "none" : animate}
          animateSpeed={animateSpeed}
          animateReverse={animateReverse}
          lightSettings={lightSettings}
          showLightHelper={controlsOpen && lightingOpen}
          registerCapture={registerCapture}
          registerCanvas={registerCanvas}
          register3DExport={register3DExport}
        />
      </div>

      {/* Layer 1: Ambient overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.13 0.01 275 / 0.15) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, oklch(0 0 0 / 0.3) 100%)",
        }}
      />

      {/* Layer 2: UI */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col p-5">
        {/* Left toolbar + content panel */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: 0.2 }}
          className={`pointer-events-none relative ${topPanel === "toolbar" ? "z-20" : "z-[8]"}`}
        >
          <InputPanel
            inputTab={inputTab}
            onInputTabChange={(tab) => { setInputTab(tab); setTopPanel("toolbar"); }}
            customSvg={customSvg}
            onCustomSvgChange={setCustomSvg}
            onFileSvgChange={setFileSvg}
            onPixelSvgChange={handlePixelSvgChange}
            onTextSvgChange={handleTextSvgChange}
            onTextChange={setCurrentText}
            onFontChange={setCurrentFont}
            initialText={currentText}
            initialFont={currentFont}
            droppedFile={droppedFile}
          />
        </motion.div>

      </div>

      {/* Top-right: embed + gear buttons */}
      <div className={`pointer-events-auto absolute top-5 right-5 flex gap-2 ${topPanel === "settings" ? "z-[60]" : "z-[8]"}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFeedbackOpen(true)}
              className="rounded-full bg-card/70 backdrop-blur-xl border border-white/[0.06] shadow-[0_8px_32px_oklch(0_0_0/0.4)] h-10 w-10"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Feedback</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDownloadOpen(true)}
              className="rounded-full bg-card/70 backdrop-blur-xl border border-white/[0.06] shadow-[0_8px_32px_oklch(0_0_0/0.4)] h-10 w-10"
            >
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Download 3D</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEmbedOpen(true)}
              className="rounded-full bg-card/70 backdrop-blur-xl border border-white/[0.06] shadow-[0_8px_32px_oklch(0_0_0/0.4)] h-10 w-10"
            >
              <CodeXml className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Embed</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setControlsOpen((v) => !v); setTopPanel("settings"); }}
              className={`rounded-full bg-card/70 backdrop-blur-xl border border-white/[0.06] shadow-[0_8px_32px_oklch(0_0_0/0.4)] h-10 w-10 ${
                controlsOpen ? "text-primary" : ""
              }`}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
      </div>

      {/* Right-side settings panel */}
      <motion.div
        initial={{ opacity: 0, x: 20, pointerEvents: "none" as const }}
        animate={controlsOpen
          ? { opacity: 1, x: 0, pointerEvents: "auto" as const }
          : { opacity: 0, x: 20, pointerEvents: "none" as const }
        }
        transition={{ duration: 0.2 }}
        className={`absolute top-5 right-5 bottom-5 max-md:left-5 ${topPanel === "settings" ? "z-[60]" : "z-[8]"}`}
      >
            <ControlsPanel
              depth={depth}
              onDepthChange={setDepth}
              smoothness={smoothness}
              onSmoothnessChange={setSmoothness}
              color={color}
              onColorChange={setColor}
              bgColor={bgColor}
              onBgColorChange={setBgColor}
              textureUrl={textureUrl}
              onTextureUpload={handleTextureUpload}
              textureSettings={textureSettings}
              onTextureSettingsChange={setTextureSettings}
              materialSettings={materialSettings}
              onMaterialSettingsChange={setMaterialSettings}
              animate={animate}
              onAnimateChange={setAnimate}
              animateSpeed={animateSpeed}
              onAnimateSpeedChange={setAnimateSpeed}
              animateReverse={animateReverse}
              onAnimateReverseChange={setAnimateReverse}
              rotationX={rotationX}
              onRotationXChange={setRotationX}
              rotationY={rotationY}
              onRotationYChange={setRotationY}
              zoom={zoom}
              onZoomChange={setZoom}
              onReset={() => setResetKey((k) => k + 1)}
              lightSettings={lightSettings}
              onLightSettingsChange={setLightSettings}
              cursorOrbit={cursorOrbit}
              onCursorOrbitChange={setCursorOrbit}
              orbitStrength={orbitStrength}
              onOrbitStrengthChange={setOrbitStrength}
              resetOnIdle={resetOnIdle}
              onResetOnIdleChange={setResetOnIdle}
              resetDelay={resetDelay}
              onResetDelayChange={setResetDelay}
              onClose={() => setControlsOpen(false)}
              onLightingSectionChange={setLightingOpen}
            />
      </motion.div>

      {/* Drag-and-drop overlay */}
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          <div className="absolute inset-2 rounded-2xl border-2 border-dashed border-white/20 bg-card/40 flex flex-col items-center justify-center gap-4">
            <svg className="h-16 w-16 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-xl font-medium text-white/60">Drop SVG file</span>
          </div>
        </motion.div>
      )}

      {/* Feedback widget */}
      <Freedback storage="email" open={feedbackOpen} onOpenChange={setFeedbackOpen} hideButton />

      {/* Download dialog */}
      <DownloadDialog
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        onDownload={handle3DExport}
      />

      {/* Embed dialog */}
      <EmbedDialog
        open={embedOpen}
        onOpenChange={setEmbedOpen}
        inputTab={inputTab}
        text={currentText}
        font={currentFont}
        activeSvg={activeSvg}
        depth={depth}
        smoothness={smoothness}
        color={color}
        materialSettings={materialSettings}
        textureUrl={textureUrl}
        textureSettings={textureSettings}
        animate={animate}
        animateSpeed={animateSpeed}
        animateReverse={animateReverse}
        rotationX={rotationX}
        rotationY={rotationY}
        zoom={zoom}
        cursorOrbit={cursorOrbit}
        orbitStrength={orbitStrength}
        resetOnIdle={resetOnIdle}
        resetDelay={resetDelay}
        lightSettings={lightSettings}
      />

      <GitHubStarBadge />

      {/* Export modal */}
      <ExportModal
        open={exportOpen}
        onClose={() => {}}
        canvasRef={canvasRef}
        captureFn={captureFnRef}
        animate={animate}
        animateSpeed={animateSpeed}
        onPreviewOpen={setExportPreviewOpen}
      />
    </main>
  );
}
