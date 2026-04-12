/**
 * =============================================================================
 * AI SVG Generation API — Multi-Provider
 * =============================================================================
 *
 * Accepts { prompt, provider, apiKey, model? } and returns an SVG string.
 * The SVG is designed for 3D extrusion: flat, single-color, black fills,
 * fill-rule="evenodd" so interior holes extrude correctly.
 *
 * Supported providers: openai, anthropic, google, groq, mistral, together,
 *   cerebras, deepseek, xai, cohere, huggingface.
 * The caller supplies their own API key — this route only proxies the request
 * so the key is never exposed in client-side code.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getProvider } from "@/lib/ai-providers";

const SYSTEM_PROMPT = `You are an expert SVG icon designer. When given a description, you generate a clean, minimal SVG optimized for 3D extrusion.

Rules:
- Output ONLY the raw SVG markup — no markdown, no code fences, no explanations.
- Use a square viewBox: viewBox="0 0 200 200"
- Set width="200" height="200" on the <svg> element.
- Use ONLY black fills: fill="black"
- Use fill-rule="evenodd" on all <path> elements so interior holes extrude correctly.
- No gradients, no strokes, no colors other than black, no transparency.
- Keep the design simple, bold, and recognizable — think app icon or logo silhouette.
- Center the shape within the viewBox with reasonable padding (~10px on each side).
- Prefer a single compound <path> or a small number of <path> elements.
- Do NOT include any <text> elements.`;

const USER_MSG = (prompt: string) => `Generate an SVG icon for: ${prompt}`;

// ---------------------------------------------------------------------------
// Provider-specific callers
// ---------------------------------------------------------------------------

async function callOpenAICompat(
  apiKey: string,
  model: string,
  prompt: string,
  baseURL?: string
): Promise<string> {
  const opts: ConstructorParameters<typeof OpenAI>[0] = { apiKey };
  if (baseURL) opts.baseURL = baseURL;
  const client = new OpenAI(opts);
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: USER_MSG(prompt) },
    ],
    max_tokens: 2048,
    temperature: 0.7,
  });
  return completion.choices[0]?.message?.content ?? "";
}

async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: USER_MSG(prompt) }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ??
        `Anthropic API error ${res.status}`
    );
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return data.content?.find((b) => b.type === "text")?.text ?? "";
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: USER_MSG(prompt) }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ??
        `Gemini API error ${res.status}`
    );
  }
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
  // Thinking models (gemini-2.5+) prepend a {thought: true} part before the
  // actual response. Find the first non-thought text part so we always get
  // the real output, not the internal reasoning chain.
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const textPart = parts.find((p) => !p.thought && typeof p.text === "string");
  return textPart?.text ?? "";
}

// ---------------------------------------------------------------------------
// SVG sanitizer (server-side)
// Strips elements and attributes that can execute code or load external
// resources before the SVG is sent back to the client.
// Uses multi-pass removal to prevent reconstruction attacks.
// ---------------------------------------------------------------------------

/** Safe model name: only alphanumeric, hyphens, dots, underscores, slashes */
const SAFE_MODEL_RE = /^[a-zA-Z0-9\-._/]+$/;

function sanitizeSvg(svg: string): string {
  let s = svg;

  // Remove <script …> … </script> in all whitespace/case variations,
  // including `</script >` (with trailing spaces before `>`).
  // Run twice to catch nested/reconstructed patterns.
  for (let i = 0; i < 2; i++) {
    s = s.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "");
    s = s.replace(/<script\b[^>]*\/?>/gi, "");
  }

  // Remove <foreignObject> blocks (can embed HTML)
  s = s.replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, "");

  // Remove <use> pointing at external resources (not fragment refs)
  s = s.replace(
    /<use\b[^>]*?\s(?:xlink:)?href\s*=\s*["'][^#"][^"']*["'][^>]*>/gi,
    ""
  );

  // Remove ALL event-handler attributes (on* = "..."), case-insensitive
  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");

  // Remove javascript: URLs from href/src/action/xlink:href attributes
  s = s.replace(
    /\s*(?:xlink:)?(?:href|src|action)\s*=\s*["']\s*javascript:[^"']*/gi,
    ""
  );

  return s;
}

// ---------------------------------------------------------------------------
// Shared SVG extractor
// ---------------------------------------------------------------------------

function extractSvg(raw: string): string | null {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  const svg = match ? match[0] : raw.trim();
  if (!svg.startsWith("<svg")) return null;
  return sanitizeSvg(svg);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: { prompt?: unknown; provider?: unknown; apiKey?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").toString().trim();
  const providerId = (body.provider ?? "openai").toString().trim();
  const apiKey = (body.apiKey ?? "").toString().trim();
  // Optional model override — falls back to provider's defaultModel
  const rawModel = body.model ? (body.model as string).toString().trim() : null;
  const modelOverride =
    rawModel && SAFE_MODEL_RE.test(rawModel) ? rawModel : null;

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (prompt.length > 500) {
    return NextResponse.json(
      { error: "Prompt must be 500 characters or fewer" },
      { status: 400 }
    );
  }
  if (!apiKey) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json(
      { error: `Unknown provider: ${providerId}` },
      { status: 400 }
    );
  }

  const model = modelOverride ?? provider.defaultModel;

  try {
    let raw: string;

    if (provider.openaiCompat) {
      raw = await callOpenAICompat(apiKey, model, prompt, provider.baseUrl);
    } else if (provider.id === "anthropic") {
      raw = await callAnthropic(apiKey, model, prompt);
    } else if (provider.id === "google") {
      raw = await callGemini(apiKey, model, prompt);
    } else {
      return NextResponse.json(
        { error: `No handler for provider: ${providerId}` },
        { status: 500 }
      );
    }

    const svg = extractSvg(raw);
    if (!svg) {
      return NextResponse.json(
        { error: "AI did not return a valid SVG. Try a different prompt." },
        { status: 502 }
      );
    }

    return NextResponse.json({ svg });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unexpected error calling AI provider";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
