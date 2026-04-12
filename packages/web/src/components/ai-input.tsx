/**
 * =============================================================================
 * AI Input
 * =============================================================================
 *
 * Multi-provider AI → SVG → 3D canvas.
 *
 * Users pick a provider, paste their own API key (saved to localStorage per
 * provider), type a description, and hit Generate. The returned SVG is passed
 * up via onSvgChange and previewed inline.
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, KeyRound, ExternalLink, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AI_PROVIDERS, DEFAULT_PROVIDER_ID, type AiProvider } from "@/lib/ai-providers";

const LS_PROVIDER_KEY = "ai-provider-id";
const lsApiKey = (id: string) => `ai-provider-key-${id}`;

function loadApiKey(providerId: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(lsApiKey(providerId)) ?? "";
}

function saveApiKey(providerId: string, key: string) {
  if (typeof window === "undefined") return;
  if (key) {
    localStorage.setItem(lsApiKey(providerId), key);
  } else {
    localStorage.removeItem(lsApiKey(providerId));
  }
}

interface AiInputProps {
  onSvgChange: (svg: string) => void;
  active?: boolean;
}

export function AiInput({ onSvgChange, active }: AiInputProps) {
  const [providerId, setProviderId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_PROVIDER_ID;
    return localStorage.getItem(LS_PROVIDER_KEY) ?? DEFAULT_PROVIDER_ID;
  });
  const [apiKey, setApiKey] = useState<string>(() => loadApiKey(
    typeof window !== "undefined"
      ? (localStorage.getItem(LS_PROVIDER_KEY) ?? DEFAULT_PROVIDER_ID)
      : DEFAULT_PROVIDER_ID
  ));
  const [showKey, setShowKey] = useState(false);
  const [keySettingsOpen, setKeySettingsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedSvg, setGeneratedSvg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const provider: AiProvider =
    AI_PROVIDERS.find((p) => p.id === providerId) ?? AI_PROVIDERS[0];

  // Auto-open key settings when there's no API key for the selected provider
  useEffect(() => {
    if (!apiKey) setKeySettingsOpen(true);
  }, [apiKey]);

  useEffect(() => {
    if (active) textareaRef.current?.focus();
  }, [active]);

  const switchProvider = useCallback((id: string) => {
    setProviderId(id);
    localStorage.setItem(LS_PROVIDER_KEY, id);
    const saved = loadApiKey(id);
    setApiKey(saved);
    setError(null);
    if (!saved) setKeySettingsOpen(true);
  }, []);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    saveApiKey(providerId, val);
  };

  const generate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    if (!apiKey.trim()) {
      setError("Enter your API key above before generating.");
      setKeySettingsOpen(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai-svg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          provider: providerId,
          apiKey: apiKey.trim(),
        }),
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
      {/* Provider picker */}
      <div className="grid grid-cols-5 gap-1">
        {AI_PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => switchProvider(p.id)}
            className={`rounded-md px-1 py-1.5 text-[10px] font-medium transition-colors leading-tight text-center ${
              p.id === providerId
                ? "bg-primary text-primary-foreground"
                : "bg-accent/60 text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Provider tagline */}
      <p className="text-[10px] text-muted-foreground leading-snug -mt-1">
        {provider.tagline}
      </p>

      {/* API key section */}
      <div className="rounded-md border border-input bg-background/30 overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-2.5 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setKeySettingsOpen((v) => !v)}
        >
          <KeyRound className="h-3 w-3 shrink-0" />
          <span className="flex-1 text-left truncate">
            {apiKey ? "API key saved ✓" : "Enter API key"}
          </span>
          {keySettingsOpen ? (
            <ChevronUp className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0" />
          )}
        </button>

        {keySettingsOpen && (
          <div className="px-2.5 pb-2.5 space-y-2 border-t border-input">
            <div className="relative mt-2">
              <input
                type={showKey ? "text" : "password"}
                className="w-full rounded-md border border-input bg-background/50 px-2.5 py-1.5 pr-8 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={provider.apiKeyPlaceholder}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowKey((v) => !v)}
                tabIndex={-1}
              >
                {showKey ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
              </button>
            </div>
            <a
              href={provider.apiKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              Get {provider.name} API key
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        )}
      </div>

      {/* Prompt */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-xs h-16 resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          placeholder={"Describe a shape…\ne.g. a lightning bolt, a rocket, a heart"}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
          disabled={loading}
        />
        <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/40 pointer-events-none select-none">
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
        <div className="rounded-lg border border-white/[0.06] bg-white p-3 flex items-center justify-center aspect-square overflow-hidden">
          {/* Render via data-URI <img> so SVG scripts are fully sandboxed */}
          <img
            src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(generatedSvg)))}`}
            alt="AI-generated SVG preview"
            className="w-full h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
