/**
 * =============================================================================
 * Text Input
 * =============================================================================
 *
 * Text-to-SVG input. Loads Google Fonts via opentype.js and converts typed
 * text into per-glyph SVG paths for 3D extrusion.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import * as opentype from "opentype.js";

const FONTS = [
  { name: "DM Sans", url: "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf" },
  { name: "Bebas Neue", url: "https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXooxW4.ttf" },
  { name: "Playfair Display", url: "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKfsukDQ.ttf" },
  { name: "Righteous", url: "https://fonts.gstatic.com/s/righteous/v18/1cXxaUPXBpj2rGoU7C9mjw.ttf" },
  { name: "Black Ops One", url: "https://fonts.gstatic.com/s/blackopsone/v21/qWcsB6-ypo7xBdr6Xshe96H3WDw.ttf" },
  { name: "Permanent Marker", url: "https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004Hao.ttf" },
  { name: "Rubik Mono One", url: "https://fonts.gstatic.com/s/rubikmonoone/v20/UqyJK8kPP3hjw6ANTdfRk9YSN-8w.ttf" },
  { name: "Pacifico", url: "https://fonts.gstatic.com/s/pacifico/v23/FwZY7-Qmy14u9lezJ96A.ttf" },
  { name: "Oswald", url: "https://fonts.gstatic.com/s/oswald/v57/TK3_WkUHHAIjg75cFRf3bXL8LICs1xZogUE.ttf" },
  { name: "Archivo Black", url: "https://fonts.gstatic.com/s/archivoblack/v23/HTxqL289NzCGg4MzN6KJ7eW6OYs.ttf" },
];

const fontCache = new Map<string, opentype.Font>();

async function loadFont(name: string, url: string): Promise<opentype.Font> {
  if (fontCache.has(name)) return fontCache.get(name)!;
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const font = opentype.parse(buffer);
  fontCache.set(name, font);
  return font;
}

// Preload default font immediately so it's ready before user clicks text tab
const DEFAULT_FONT = FONTS.find((f) => f.name === "Rubik Mono One")!;
if (typeof window !== "undefined") {
  loadFont(DEFAULT_FONT.name, DEFAULT_FONT.url);
}

function textToSvg(text: string, font: opentype.Font): string {
  const size = 200;
  const available = size - 20;

  // Find optimal font size
  let fontSize = 180;
  let fullPath = font.getPath(text, 0, 0, fontSize);
  let bb = fullPath.getBoundingBox();
  let w = bb.x2 - bb.x1;
  let h = bb.y2 - bb.y1;

  while ((w > available || h > available) && fontSize > 8) {
    fontSize -= 4;
    fullPath = font.getPath(text, 0, 0, fontSize);
    bb = fullPath.getBoundingBox();
    w = bb.x2 - bb.x1;
    h = bb.y2 - bb.y1;
  }

  const offsetX = (size - w) / 2 - bb.x1;
  const offsetY = (size - h) / 2 - bb.y1;

  // Generate one <path> per glyph so SVGLoader correctly identifies holes
  // (e.g., the inside of A, O, M, W)
  const glyphs = font.stringToGlyphs(text);
  let x = offsetX;
  const paths: string[] = [];

  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    const glyphPath = glyph.getPath(x, offsetY, fontSize);
    const d = glyphPath.toPathData(2);
    if (d) {
      paths.push(`<path d="${d}" fill="black" fill-rule="evenodd"/>`);
    }
    // Advance x position
    const advance = (glyph.advanceWidth || 0) * (fontSize / (font.unitsPerEm || 1000));
    // Add kerning
    if (i < glyphs.length - 1) {
      const kerning = font.getKerningValue(glyphs[i], glyphs[i + 1]);
      x += advance + kerning * (fontSize / (font.unitsPerEm || 1000));
    } else {
      x += advance;
    }
  }

  if (paths.length === 0) return "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths.join("")}</svg>`;
}

interface TextInputProps {
  onSvgChange: (svg: string) => void;
  onTextChange?: (text: string) => void;
  onFontChange?: (font: string) => void;
  initialText?: string;
  initialFont?: string;
}

export function TextInput({ onSvgChange, onTextChange, onFontChange, initialText, initialFont, active }: TextInputProps & { active?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialText ?? "3DSVG");
  const [fontName, setFontName] = useState(initialFont ?? "Rubik Mono One");
  const [loadedFont, setLoadedFont] = useState<opentype.Font | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fontDef = FONTS.find((f) => f.name === fontName);
    if (!fontDef) return;
    // Check cache synchronously first — no loading flash if already preloaded
    const cached = fontCache.get(fontDef.name);
    if (cached) {
      setLoadedFont(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadFont(fontDef.name, fontDef.url)
      .then((font) => {
        setLoadedFont(font);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Font load failed:", err);
        setLoading(false);
      });
  }, [fontName]);

  useEffect(() => {
    if (!loadedFont || !text.trim()) {
      if (!text.trim()) onSvgChange("");
      return;
    }
    const svg = textToSvg(text.trim(), loadedFont);
    onSvgChange(svg);
  }, [text, loadedFont, onSvgChange]);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  return (
    <div className="space-y-3">
      <Input
        ref={inputRef}
        placeholder="Type something..."
        value={text}
        onChange={(e) => { setText(e.target.value); onTextChange?.(e.target.value); }}
        className="h-8 text-xs"
      />
      <select
        value={fontName}
        onChange={(e) => { setFontName(e.target.value); onFontChange?.(e.target.value); }}
        className="w-full h-8 rounded-md border border-input bg-background/50 px-3 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {FONTS.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>
      {loading && (
        <p className="text-[10px] text-muted-foreground animate-pulse">
          Loading font...
        </p>
      )}
    </div>
  );
}
