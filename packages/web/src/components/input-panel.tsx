/**
 * =============================================================================
 * Input Panel
 * =============================================================================
 *
 * Vertical toolbar (top-left) + expandable content panel. Each tool produces
 * an SVG string fed to the 3D canvas.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Pencil,
  Type,
  FileUp,
  Upload,
  Code,
  FileCheck,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { PixelEditor } from "@/components/pixel-editor";
import { TextInput } from "@/components/text-input";
import { AiInput } from "@/components/ai-input";

interface InputPanelProps {
  inputTab: string;
  onInputTabChange: (tab: string) => void;
  customSvg: string;
  onCustomSvgChange: (v: string) => void;
  onFileSvgChange: (svg: string) => void;
  onPixelSvgChange: (svg: string) => void;
  onTextSvgChange: (svg: string) => void;
  onAiSvgChange: (svg: string) => void;
  onTextChange?: (text: string) => void;
  onFontChange?: (font: string) => void;
  initialText?: string;
  initialFont?: string;
  droppedFile?: { name: string; content: string } | null;
}

const tabs = [
  { value: "draw", icon: Pencil, label: "Draw" },
  { value: "text", icon: Type, label: "Text" },
  { value: "ai", icon: Sparkles, label: "AI Generate" },
  { value: "code", icon: Code, label: "SVG Code" },
  { value: "file", icon: FileUp, label: "Upload File" },
];

const contentVariants = {
  enter: { opacity: 0, x: -8 },
  active: { opacity: 1, x: 0, transition: { duration: 0.15 } },
  exit: { opacity: 0, x: -8, transition: { duration: 0.1 } },
};

export function InputPanel({
  inputTab,
  onInputTabChange,
  customSvg,
  onCustomSvgChange,
  onFileSvgChange,
  onPixelSvgChange,
  onTextSvgChange,
  onAiSvgChange,
  onTextChange,
  onFontChange,
  initialText,
  initialFont,
  droppedFile,
}: InputPanelProps) {
  const [expanded, setExpanded] = useState(true);

  // Collapse on mobile after mount
  useEffect(() => {
    if (window.innerWidth < 768) setExpanded(false);
  }, []);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedSvgContent, setUploadedSvgContent] = useState<string | null>(null);
  const svgFileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sync dropped file from parent (drag-and-drop)
  useEffect(() => {
    if (droppedFile) {
      setUploadedFileName(droppedFile.name);
      setUploadedSvgContent(droppedFile.content);
      setExpanded(true);
    }
  }, [droppedFile]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  const handleTabClick = (value: string) => {
    if (inputTab === value && expanded) {
      setExpanded(false);
    } else {
      onInputTabChange(value);
      setExpanded(true);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        setUploadedSvgContent(text);
        onFileSvgChange(text);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div ref={panelRef} className="flex items-start gap-2 pointer-events-none">
      {/* Vertical toolbar */}
      <div className="flex flex-col gap-1 rounded-xl bg-card/70 backdrop-blur-xl border border-white/[0.06] shadow-[0_8px_32px_oklch(0_0_0/0.4)] p-1.5 pointer-events-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = inputTab === tab.value;
          const isOpen = isSelected && expanded;
          return (
            <Tooltip key={tab.value}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${
                    isOpen
                      ? "bg-accent text-accent-foreground ring-1 ring-primary"
                      : isSelected
                        ? "bg-accent/50 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => handleTabClick(tab.value)}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{tab.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Expandable content panel */}
      <motion.div
        animate={expanded ? { opacity: 1, x: 0, pointerEvents: "auto" as const } : { opacity: 0, x: -8, pointerEvents: "none" as const }}
        transition={{ duration: 0.15 }}
        className="w-80 rounded-xl bg-card/70 backdrop-blur-xl border border-white/[0.06] shadow-[0_8px_32px_oklch(0_0_0/0.4)] p-3"
      >
            <div className={inputTab === "draw" ? "" : "hidden"}>
              <PixelEditor onSvgChange={onPixelSvgChange} />
            </div>
            <div className={inputTab === "text" ? "" : "hidden"}>
              <TextInput onSvgChange={onTextSvgChange} onTextChange={onTextChange} onFontChange={onFontChange} initialText={initialText} initialFont={initialFont} active={inputTab === "text" && expanded} />
            </div>
            <div className={inputTab === "ai" ? "" : "hidden"}>
              <AiInput onSvgChange={onAiSvgChange} active={inputTab === "ai" && expanded} />
            </div>
            <div className={inputTab === "code" ? "" : "hidden"}>
              <div className="space-y-2">
                <textarea
                  className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-xs font-mono h-32 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n  <path d="..." fill="black"/>\n</svg>`}
                  value={customSvg}
                  onChange={(e) => onCustomSvgChange(e.target.value)}
                />
                {!customSvg && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs w-full"
                    onClick={() => onCustomSvgChange('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="black"/></svg>')}
                  >
                    Load example (star)
                  </Button>
                )}
                {customSvg.trim().startsWith("<svg") && (
                  <div className="rounded-lg border border-white/[0.06] bg-white p-3 flex items-center justify-center aspect-square overflow-hidden">
                    <img
                      src={`data:image/svg+xml,${encodeURIComponent(customSvg.trim())}`}
                      alt="SVG preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className={inputTab === "file" ? "" : "hidden"}>
              {uploadedFileName ? (
                <div className="space-y-3">
                  {uploadedSvgContent && (
                    <div
                      className="rounded-lg border border-white/[0.06] bg-white p-4 flex items-center justify-center aspect-square overflow-hidden"
                      dangerouslySetInnerHTML={{ __html: uploadedSvgContent.replace(/<svg/, '<svg style="width:100%;height:100%;object-fit:contain;display:block;max-width:100%;max-height:100%"') }}
                    />
                  )}
                  <div className="flex items-center gap-3 rounded-md border border-input p-3">
                    <FileCheck className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-xs text-foreground truncate flex-1">{uploadedFileName}</span>
                    <button
                      onClick={() => {
                        setUploadedFileName(null);
                        setUploadedSvgContent(null);
                        onFileSvgChange("");
                        if (svgFileInputRef.current) svgFileInputRef.current.value = "";
                      }}
                      className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-6">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Upload an SVG file
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => svgFileInputRef.current?.click()}
                    >
                      Choose File
                    </Button>
                  </div>
                )}
                <input
                  ref={svgFileInputRef}
                  type="file"
                  accept=".svg"
                  className="hidden"
                  onChange={handleFileUpload}
                />
            </div>
      </motion.div>
    </div>
  );
}
