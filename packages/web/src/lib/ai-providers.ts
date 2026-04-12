/**
 * =============================================================================
 * AI Provider Definitions
 * =============================================================================
 *
 * Single source of truth for every supported AI provider.
 * Imported by both the API route (server) and the AiInput component (client).
 * Keep this file free of server-only or browser-only imports.
 */

export interface AiProvider {
  /** Unique identifier used in API requests */
  id: string;
  /** Human-readable name */
  name: string;
  /** Model identifier sent to the provider's API */
  model: string;
  /** Short label shown in the provider picker */
  label: string;
  /** Tagline shown under the provider name */
  tagline: string;
  /** URL where the user can obtain an API key */
  apiKeyUrl: string;
  /** Placeholder text for the API key input */
  apiKeyPlaceholder: string;
  /** Whether this provider uses an OpenAI-compatible chat endpoint */
  openaiCompat: boolean;
  /** Base URL for OpenAI-compatible providers (omit for native OpenAI) */
  baseUrl?: string;
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    model: "gpt-4o-mini",
    label: "OpenAI",
    tagline: "GPT-4o mini · Fast & capable",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    apiKeyPlaceholder: "sk-...",
    openaiCompat: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    model: "claude-3-5-haiku-20241022",
    label: "Anthropic",
    tagline: "Claude 3.5 Haiku · Precise & creative",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    apiKeyPlaceholder: "sk-ant-...",
    openaiCompat: false,
  },
  {
    id: "google",
    name: "Google",
    model: "gemini-1.5-flash",
    label: "Gemini",
    tagline: "Gemini 1.5 Flash · Google AI",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    apiKeyPlaceholder: "AIza...",
    openaiCompat: false,
  },
  {
    id: "groq",
    name: "Groq",
    model: "llama-3.3-70b-versatile",
    label: "Groq",
    tagline: "Llama 3.3 70B · Blazing fast, free tier",
    apiKeyUrl: "https://console.groq.com/keys",
    apiKeyPlaceholder: "gsk_...",
    openaiCompat: true,
    baseUrl: "https://api.groq.com/openai/v1",
  },
  {
    id: "mistral",
    name: "Mistral",
    model: "mistral-small-latest",
    label: "Mistral",
    tagline: "Mistral Small · Lightweight & efficient",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    apiKeyPlaceholder: "...",
    openaiCompat: true,
    baseUrl: "https://api.mistral.ai/v1",
  },
];

export const DEFAULT_PROVIDER_ID = "openai";

export function getProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}
