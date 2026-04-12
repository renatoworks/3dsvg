/**
 * =============================================================================
 * AI Input
 * =============================================================================
 *
 * Text prompt → AI-generated SVG → 3D canvas.
 * Calls /api/ai-svg and passes the returned SVG to the parent via onSvgChange.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AiInputProps {
  onSvgChange: (svg: string) => void;
  active?: boolean;
}

export function AiInput({ onSvgChange, active }: AiInputProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedSvg, setGeneratedSvg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (active) textareaRef.current?.focus();
  }, [active]);

  const generate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai-svg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setGeneratedSvg(data.svg);
      onSvgChange(data.svg);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      generate();
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-xs h-20 resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          placeholder={"Describe a shape...\ne.g. a lightning bolt, a rocket, a heart"}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
          disabled={loading}
        />
        <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/50 pointer-events-none">
          ⌘↵
        </span>
      </div>

      <Button
        size="sm"
        className="w-full text-xs gap-1.5"
        onClick={generate}
        disabled={!prompt.trim() || loading}
      >
        {loading ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Generate 3D Shape
          </>
        )}
      </Button>

      {error && (
        <p className="text-[11px] text-destructive leading-snug">{error}</p>
      )}

      {!error && generatedSvg && !loading && (
        <div
          className="rounded-lg border border-white/[0.06] bg-white p-3 flex items-center justify-center aspect-square overflow-hidden"
          dangerouslySetInnerHTML={{
            __html: generatedSvg.replace(
              /<svg/,
              '<svg style="width:100%;height:100%;object-fit:contain;display:block;max-width:100%;max-height:100%"'
            ),
          }}
        />
      )}

      {!generatedSvg && !loading && !error && (
        <p className="text-[10px] text-muted-foreground leading-snug">
          Describe any shape, icon, or symbol — AI will generate an SVG optimized for 3D extrusion.
        </p>
      )}
    </div>
  );
}
