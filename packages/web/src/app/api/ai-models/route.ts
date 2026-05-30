/**
 * =============================================================================
 * AI Model List API
 * =============================================================================
 *
 * Accepts { provider, apiKey } and returns the live model list for that
 * provider, merged with the static fallback so the response is never empty.
 *
 * GET /api/ai-models   is not implemented — POST only so the key stays
 * out of query strings / server logs.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/ai-providers";

// ---------------------------------------------------------------------------
// OpenAI-compatible  GET {baseUrl}/models
// ---------------------------------------------------------------------------

interface OpenAIModel {
  id: string;
  object: string;
}

interface OpenAIModelsResponse {
  data?: OpenAIModel[];
}

async function fetchOpenAICompatModels(
  apiKey: string,
  baseUrl: string,
  providerId: string
): Promise<string[]> {
  const url = baseUrl.replace(/\/$/, "") + "/models";
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = (await res.json()) as OpenAIModelsResponse;
  const models = (json.data ?? []).map((m) => m.id).filter(Boolean);

  return filterChatModels(models, providerId);
}

// ---------------------------------------------------------------------------
// Anthropic  GET /v1/models
// ---------------------------------------------------------------------------

interface AnthropicModel {
  id: string;
  type: string;
}

interface AnthropicModelsResponse {
  data?: AnthropicModel[];
}

async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as AnthropicModelsResponse;
  return (json.data ?? []).map((m) => m.id).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Google Gemini  GET /v1beta/models
// ---------------------------------------------------------------------------

interface GeminiModel {
  name: string; // "models/gemini-1.5-flash"
  supportedGenerationMethods?: string[];
}

interface GeminiModelsResponse {
  models?: GeminiModel[];
}

async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as GeminiModelsResponse;

  return (json.models ?? [])
    .filter((m) =>
      (m.supportedGenerationMethods ?? []).includes("generateContent")
    )
    .map((m) => m.name.replace(/^models\//, ""))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Model filter: keep only chat-capable models for noisy providers
// ---------------------------------------------------------------------------

function filterChatModels(ids: string[], providerId: string): string[] {
  // Together AI returns 200+ models of all types; limit to language/chat ones
  if (providerId === "together") {
    return ids
      .filter((id) => {
        const lower = id.toLowerCase();
        return (
          lower.includes("instruct") ||
          lower.includes("chat") ||
          lower.includes("turbo") ||
          lower.includes("it") // instruction-tuned abbreviation
        );
      })
      .slice(0, 60);
  }

  // OpenAI: exclude embeddings, DALL-E, TTS, Whisper, moderation, realtime
  if (providerId === "openai") {
    return ids.filter((id) => {
      const lower = id.toLowerCase();
      return (
        !lower.startsWith("text-embedding") &&
        !lower.startsWith("dall-e") &&
        !lower.startsWith("tts") &&
        !lower.startsWith("whisper") &&
        !lower.includes("moderation") &&
        !lower.includes("embedding") &&
        !lower.includes("audio") &&
        !lower.includes("realtime") &&
        !lower.includes("transcribe") &&
        !lower.includes("search") &&
        !lower.includes("similarity") &&
        !lower.includes("babbage") &&
        !lower.includes("davinci") &&
        !lower.includes("curie") &&
        !lower.includes("ada-0")
      );
    });
  }

  // Mistral: exclude embedding models
  if (providerId === "mistral") {
    return ids.filter((id) => !id.toLowerCase().includes("embed"));
  }

  // Cohere: exclude embedding models
  if (providerId === "cohere") {
    return ids.filter((id) => {
      const lower = id.toLowerCase();
      return !lower.includes("embed") && !lower.includes("rerank");
    });
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: { provider?: unknown; apiKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const providerId = (body.provider ?? "").toString().trim();
  const apiKey = (body.apiKey ?? "").toString().trim();

  if (!providerId) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 });
  }

  // Start from the static list so we always have something to return
  const staticModels = provider.staticModels ?? [];

  if (provider.modelsSource === "static") {
    return NextResponse.json({ models: staticModels, source: "static" });
  }

  try {
    let liveModels: string[] = [];

    if (provider.modelsSource === "openai-compat") {
      const baseUrl = provider.baseUrl ?? "https://api.openai.com/v1";
      liveModels = await fetchOpenAICompatModels(apiKey, baseUrl, providerId);
    } else if (provider.modelsSource === "anthropic") {
      liveModels = await fetchAnthropicModels(apiKey);
    } else if (provider.modelsSource === "google") {
      liveModels = await fetchGeminiModels(apiKey);
    }

    // Merge: live first, then static entries not already present
    const seen = new Set(liveModels);
    const merged = [
      ...liveModels,
      ...staticModels.filter((m) => !seen.has(m)),
    ];

    return NextResponse.json({ models: merged.length ? merged : staticModels, source: "live" });
  } catch (err: unknown) {
    // On any error fall back to static list gracefully
    const message = err instanceof Error ? err.message : "Failed to fetch models";
    return NextResponse.json(
      { models: staticModels, source: "static", warning: message },
      { status: 200 } // 200 so the client always gets usable data
    );
  }
}
