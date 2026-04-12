/**
 * =============================================================================
 * AI Provider Definitions
 * =============================================================================
 *
 * Single source of truth for every supported AI provider.
 * Imported by both the API route (server) and the AiInput component (client).
 * Keep this file free of server-only or browser-only imports.
 */

/**
 * How to fetch a live model list for this provider:
 *  - "openai-compat"  → GET {baseUrl}/models  with  Authorization: Bearer {key}
 *  - "anthropic"      → GET https://api.anthropic.com/v1/models  with  x-api-key: {key}
 *  - "google"         → GET https://generativelanguage.googleapis.com/v1beta/models?key={key}
 *  - "static"         → no live fetch; use staticModels only
 */
export type ModelSource = "openai-compat" | "anthropic" | "google" | "static";

export interface AiProvider {
  /** Unique identifier used in API requests */
  id: string;
  /** Human-readable name shown in the <select> */
  name: string;
  /** Short badge label */
  label: string;
  /** Tagline: model family + key highlight */
  tagline: string;
  /** Default model used before live list is fetched */
  defaultModel: string;
  /** Static model list — shown immediately and used as fallback */
  staticModels: string[];
  /** URL where the user can obtain an API key */
  apiKeyUrl: string;
  /** Placeholder text for the API key input */
  apiKeyPlaceholder: string;
  /** Whether chat completions use the OpenAI-compatible format */
  openaiCompat: boolean;
  /** Base URL for OpenAI-compatible providers (omit for native OpenAI) */
  baseUrl?: string;
  /** Which strategy to use when fetching the live model list */
  modelsSource: ModelSource;
}

export const AI_PROVIDERS: AiProvider[] = [
  // ── Tier 1: most popular ──────────────────────────────────────────────────
  {
    id: "openai",
    name: "OpenAI",
    label: "OpenAI",
    tagline: "GPT-4o · Most capable",
    defaultModel: "gpt-4o-mini",
    staticModels: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "o4-mini", "o3-mini"],
    apiKeyUrl: "https://platform.openai.com/api-keys",
    apiKeyPlaceholder: "sk-...",
    openaiCompat: true,
    modelsSource: "openai-compat",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    label: "Claude",
    tagline: "Claude 3.5 Haiku · Precise & creative",
    defaultModel: "claude-3-5-haiku-20241022",
    staticModels: [
      "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307",
      "claude-3-opus-20240229",
    ],
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    apiKeyPlaceholder: "sk-ant-...",
    openaiCompat: false,
    modelsSource: "anthropic",
  },
  {
    id: "google",
    name: "Google Gemini",
    label: "Gemini",
    tagline: "Gemini 1.5 Flash · Google AI Studio",
    defaultModel: "gemini-1.5-flash",
    staticModels: [
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ],
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    apiKeyPlaceholder: "AIza...",
    openaiCompat: false,
    modelsSource: "google",
  },

  // ── Tier 2: fast free tiers ───────────────────────────────────────────────
  {
    id: "groq",
    name: "Groq",
    label: "Groq",
    tagline: "Llama 3.3 70B · Ultra-fast LPU, free tier",
    defaultModel: "llama-3.3-70b-versatile",
    staticModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "llama-3.1-70b-versatile",
      "gemma2-9b-it",
      "mixtral-8x7b-32768",
    ],
    apiKeyUrl: "https://console.groq.com/keys",
    apiKeyPlaceholder: "gsk_...",
    openaiCompat: true,
    baseUrl: "https://api.groq.com/openai/v1",
    modelsSource: "openai-compat",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    label: "Cerebras",
    tagline: "Llama 3.3 70B · Real-time high-speed inference",
    defaultModel: "llama-3.3-70b",
    staticModels: ["llama-3.3-70b", "llama3.1-8b", "llama3.1-70b"],
    apiKeyUrl: "https://cloud.cerebras.ai/",
    apiKeyPlaceholder: "csk-...",
    openaiCompat: true,
    baseUrl: "https://api.cerebras.ai/v1",
    modelsSource: "openai-compat",
  },
  {
    id: "together",
    name: "Together AI",
    label: "Together",
    tagline: "200+ open models · $100 sign-up credit",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    staticModels: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "meta-llama/Llama-3.1-8B-Instruct-Turbo",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      "google/gemma-2-27b-it",
    ],
    apiKeyUrl: "https://api.together.ai/settings/api-keys",
    apiKeyPlaceholder: "...",
    openaiCompat: true,
    baseUrl: "https://api.together.xyz/v1",
    modelsSource: "openai-compat",
  },

  // ── Tier 3: reasoning & specialized ──────────────────────────────────────
  {
    id: "deepseek",
    name: "DeepSeek",
    label: "DeepSeek",
    tagline: "DeepSeek-R1 · Advanced reasoning, $5 trial credit",
    defaultModel: "deepseek-chat",
    staticModels: ["deepseek-chat", "deepseek-reasoner"],
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    apiKeyPlaceholder: "sk-...",
    openaiCompat: true,
    baseUrl: "https://api.deepseek.com",
    modelsSource: "static",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    label: "Grok",
    tagline: "Grok 3 · $175/mo credit w/ data program",
    defaultModel: "grok-3-mini",
    staticModels: ["grok-3-mini", "grok-2-1212", "grok-beta", "grok-3"],
    apiKeyUrl: "https://console.x.ai/",
    apiKeyPlaceholder: "xai-...",
    openaiCompat: true,
    baseUrl: "https://api.x.ai/v1",
    modelsSource: "openai-compat",
  },

  // ── Tier 4: open-source & coding ──────────────────────────────────────────
  {
    id: "mistral",
    name: "Mistral AI",
    label: "Mistral",
    tagline: "Mistral Small · Free Codestral tier",
    defaultModel: "mistral-small-latest",
    staticModels: [
      "mistral-small-latest",
      "mistral-medium-latest",
      "mistral-large-latest",
      "codestral-latest",
      "open-mixtral-8x22b",
    ],
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    apiKeyPlaceholder: "...",
    openaiCompat: true,
    baseUrl: "https://api.mistral.ai/v1",
    modelsSource: "openai-compat",
  },
  {
    id: "cohere",
    name: "Cohere",
    label: "Cohere",
    tagline: "Command R+ · Free trial for RAG & search",
    defaultModel: "command-r-plus-08-2024",
    staticModels: [
      "command-r-plus-08-2024",
      "command-r-08-2024",
      "command-r",
      "command-light",
    ],
    apiKeyUrl: "https://dashboard.cohere.com/api-keys",
    apiKeyPlaceholder: "...",
    openaiCompat: true,
    baseUrl: "https://api.cohere.com/compatibility/v1",
    modelsSource: "openai-compat",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    label: "HuggingFace",
    tagline: "Open models · Free inference via HF Router",
    defaultModel: "meta-llama/Llama-3.1-8B-Instruct",
    staticModels: [
      "meta-llama/Llama-3.1-8B-Instruct",
      "meta-llama/Llama-3.3-70B-Instruct",
      "mistralai/Mistral-7B-Instruct-v0.3",
      "Qwen/Qwen2.5-72B-Instruct",
      "HuggingFaceH4/zephyr-7b-beta",
    ],
    apiKeyUrl: "https://huggingface.co/settings/tokens",
    apiKeyPlaceholder: "hf_...",
    openaiCompat: true,
    baseUrl: "https://router.huggingface.co/v1",
    modelsSource: "static",
  },
];

export const DEFAULT_PROVIDER_ID = "openai";

export function getProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

