/**
 * =============================================================================
 * AI Input
 * =============================================================================
 *
 * Multi-provider AI → SVG → 3D canvas.
 *
 * Flow:
 *  1. Pick a provider from the dropdown
 *  2. Enter / paste your API key (saved per-provider in localStorage)
 *  3. Models are fetched live from the provider's API; a static fallback is
 *     shown immediately while the request is in flight
 *  4. Pick a model (or keep the default)
 *  5. Describe your shape → Generate
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  KeyRound,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AI_PROVIDERS,
  DEFAULT_PROVIDER_ID,
  type AiProvider,
} from "@/lib/ai-providers";

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const LS_PROVIDER_KEY = "ai-provider-id";
const lsApiKey = (id: string) => `ai-provider-key-${id}`;
const lsModel = (id: string) => `ai-provider-model-${id}`;

function loadFromLS(key: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(key) ?? "";
}

function saveToLS(key: string, value: string) {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AiInputProps {
  onSvgChange: (svg: string) => void;
  active?: boolean;
}

export function AiInput({ onSvgChange, active }: AiInputProps) {
  // ── Provider & key ────────────────────────────────────────────────────────
  const [providerId, setProviderId] = useState<string>(() =>
    loadFromLS(LS_PROVIDER_KEY) || DEFAULT_PROVIDER_ID
  );
  const [apiKey, setApiKey] = useState<string>(() =>
    loadFromLS(lsApiKey(loadFromLS(LS_PROVIDER_KEY) || DEFAULT_PROVIDER_ID))
  );
  const [showKey, setShowKey] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  // ── Models ────────────────────────────────────────────────────────────────
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [modelsFetching, setModelsFetching] = useState(false);
  const [modelsWarning, setModelsWarning] = useState<string | null>(null);

  // ── Generation ────────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedSvg, setGeneratedSvg] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const provider: AiProvider =
    AI_PROVIDERS.find((p) => p.id === providerId) ?? AI_PROVIDERS[0];

  // ── Auto-open key section when no key is saved ────────────────────────────
  useEffect(() => {
    if (!apiKey) setKeyOpen(true);
  }, [apiKey]);

  // Focus textarea when tab becomes active
  useEffect(() => {
    if (active) textareaRef.current?.focus();
  }, [active]);

  // ── Fetch live model list ─────────────────────────────────────────────────
  const fetchModels = useCallback(
    async (pId: string, key: string) => {
      if (!key.trim()) return;

      setModelsFetching(true);
      setModelsWarning(null);

      try {
        const res = await fetch("/api/ai-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: pId, apiKey: key.trim() }),
        });
        const data = (await res.json()) as {
          models?: string[];
          warning?: string;
        };

        const fetched = data.models ?? [];
        const prov = AI_PROVIDERS.find((p) => p.id === pId) ?? AI_PROVIDERS[0];

        // Merge live + static (static already included by the route but keep robust)
        const merged = [
          ...fetched,
          ...prov.staticModels.filter((m) => !fetched.includes(m)),
        ];

        setModels(merged);
        if (data.warning) setModelsWarning(data.warning);

        // Restore saved model or fall back to default
        const saved = loadFromLS(lsModel(pId));
        const pick = merged.includes(saved)
          ? saved
          : merged.includes(prov.defaultModel)
            ? prov.defaultModel
            : merged[0] ?? prov.defaultModel;

        setSelectedModel(pick);
      } catch {
        // Network error — keep static list
        const prov = AI_PROVIDERS.find((p) => p.id === pId) ?? AI_PROVIDERS[0];
        setModels(prov.staticModels);
        setSelectedModel(loadFromLS(lsModel(pId)) || prov.defaultModel);
        setModelsWarning("Could not reach provider to fetch latest models.");
      } finally {
        setModelsFetching(false);
      }
    },
    []
  );

  // Seed with static models immediately when provider changes (no flash)
  const initModels = useCallback(
    (pId: string, key: string) => {
      const prov = AI_PROVIDERS.find((p) => p.id === pId) ?? AI_PROVIDERS[0];
      setModels(prov.staticModels);
      const saved = loadFromLS(lsModel(pId));
      setSelectedModel(
        prov.staticModels.includes(saved) ? saved : prov.defaultModel
      );
      setModelsWarning(null);

      if (key.trim()) {
        // Debounce so rapid typing doesn't spam the API
        if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
        fetchDebounceRef.current = setTimeout(() => {
          fetchModels(pId, key);
        }, 400);
      }
    },
    [fetchModels]
  );

  // Init on first mount
  useEffect(() => {
    initModels(providerId, apiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Switch provider ───────────────────────────────────────────────────────
  const switchProvider = useCallback(
    (id: string) => {
      setProviderId(id);
      saveToLS(LS_PROVIDER_KEY, id);
      const key = loadFromLS(lsApiKey(id));
      setApiKey(key);
      setError(null);
      setGeneratedSvg(null);
      if (!key) setKeyOpen(true);
      initModels(id, key);
    },
    [initModels]
  );

  // ── API key change ────────────────────────────────────────────────────────
  const handleApiKeyChange = useCallback(
    (val: string) => {
      setApiKey(val);
      saveToLS(lsApiKey(providerId), val);
      initModels(providerId, val);
    },
    [providerId, initModels]
  );

  // ── Model change ──────────────────────────────────────────────────────────
  const handleModelChange = (val: string) => {
    setSelectedModel(val);
    saveToLS(lsModel(providerId), val);
  };

  // ── Generate ──────────────────────────────────────────────────────────────
  const generate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    if (!apiKey.trim()) {
      setError("Enter your API key above before generating.");
      setKeyOpen(true);
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
          model: selectedModel || provider.defaultModel,
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Provider dropdown */}
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
          Provider
        </label>
        <select
          value={providerId}
          onChange={(e) => switchProvider(e.target.value)}
          className="w-full h-8 rounded-md border border-input bg-background/50 px-2 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {AI_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {provider.tagline}
        </p>
      </div>

      {/* API key section */}
      <div className="rounded-md border border-input bg-background/30 overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-2.5 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setKeyOpen((v) => !v)}
        >
          <KeyRound className="h-3 w-3 shrink-0" />
          <span className="flex-1 text-left truncate">
            {apiKey ? "API key saved ✓" : "Enter API key"}
          </span>
          {keyOpen ? (
            <ChevronUp className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0" />
          )}
        </button>

        {keyOpen && (
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

      {/* Model selector */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Model
          </label>
          {modelsFetching && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
              Fetching…
            </span>
          )}
          {!modelsFetching && apiKey && (
            <button
              className="text-[10px] text-primary hover:underline"
              onClick={() => fetchModels(providerId, apiKey)}
            >
              Refresh
            </button>
          )}
        </div>
        <select
          value={selectedModel}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full h-8 rounded-md border border-input bg-background/50 px-2 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
          disabled={modelsFetching}
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          {/* Always ensure current selection is an option even if not in list */}
          {selectedModel && !models.includes(selectedModel) && (
            <option value={selectedModel}>{selectedModel}</option>
          )}
        </select>
        {modelsWarning && (
          <p className="text-[10px] text-muted-foreground leading-snug">
            ⚠ {modelsWarning}
          </p>
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

