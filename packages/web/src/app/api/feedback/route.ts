import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

interface Metadata {
  browser: {
    userAgent: string;
    language: string;
    platform: string;
    viewport: { width: number; height: number };
  };
  context: {
    url: string;
    timestamp: string;
    referrer: string;
    location?: { city: string; country: string; timezone: string; continent: string };
  };
}

interface EmailTemplateData {
  content: string;
  email?: string;
  emoji?: string;
  metadata?: Metadata;
}

// Escape user-controlled values before interpolating them into the email HTML,
// so submitted content can't inject markup (tracking pixels, deceptive links,
// layout spoofing) into the notification email.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Format a viewport dimension from the unvalidated body, falling back to "?"
// for non-numeric values so the email never shows "NaN".
function formatDimension(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "?";
}

// Accept a URL only if it parses and uses an http(s) scheme. Returns null for
// anything else (e.g. javascript:/data:) so it never reaches an href attribute.
function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const { protocol, href } = new URL(value);
    return protocol === "http:" || protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}

function generateEmailTemplate(data: EmailTemplateData): string {
  const { content, email, emoji, metadata } = data;

  const location = metadata?.context?.location;
  const viewport = metadata?.browser?.viewport;
  const platform = metadata?.browser?.platform;

  const rawUrl = metadata?.context?.url;
  const safeUrl = safeHttpUrl(rawUrl);
  const urlLabel = escapeHtml(rawUrl || "Unknown");
  const urlMarkup = safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" style="color: #374151; text-decoration: none;">${urlLabel}</a>`
    : `<span>${urlLabel}</span>`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #374151; margin-bottom: 24px;">New Feedback Received</h2>
      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
          ${escapeHtml(emoji || "💬")} ${escapeHtml(content)}
        </div>
        ${email ? `<div style="color: #64748b; font-size: 14px;">From: ${escapeHtml(email)}</div>` : ""}
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
        <h3 style="color: #374151; font-size: 14px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Context</h3>
        <div style="display: grid; gap: 8px; font-size: 14px;">
          <div><span style="color: #6b7280;">🕒 </span><span>${new Date().toLocaleString()}</span></div>
          <div><span style="color: #6b7280;">🔗 </span>${urlMarkup}</div>
          ${location ? `<div><span style="color: #6b7280;">🌍 </span><span>${escapeHtml(location.city)}, ${escapeHtml(location.country)} (${escapeHtml(location.timezone)})</span></div>` : ""}
          ${platform ? `<div><span style="color: #6b7280;">🖥️ </span><span>${escapeHtml(platform)}</span></div>` : ""}
          ${viewport ? `<div><span style="color: #6b7280;">📱 </span><span>${formatDimension(viewport.width)}×${formatDimension(viewport.height)}</span></div>` : ""}
        </div>
      </div>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #9ca3af; text-align: center;">
        Powered by <a href="https://freedback.dev" style="color: #374151; text-decoration: none;">Freedback</a>
      </div>
    </div>
  `;
}

const resendApiKey = process.env.RESEND_API_KEY;
const notificationEmail = process.env.FREEDBACK_EMAIL_NOTIFICATION;
const fromEmail = process.env.FREEDBACK_EMAIL_FROM;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Extra origins explicitly trusted to submit feedback (comma-separated), in
// addition to the deployment's own origin. Optional — only needed when the
// widget is embedded on a different domain.
const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

// Allow a request only when it comes from the deployment's own site (its Origin,
// or Referer as a fallback since some browsers omit Origin on same-origin
// requests) or from an explicitly trusted origin. Deriving the expected host
// from the request itself means forks and preview deployments work with no
// configuration, while cross-site and unattributed POSTs are rejected. Hosts
// are compared (scheme/port included) to stay robust across http/https.
function isAllowedRequest(req: NextRequest): boolean {
  const ownHost = req.headers.get("host");
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (!ownHost || !source) return false;

  const sourceHost = hostOf(source);
  if (!sourceHost) return false;
  if (sourceHost === ownHost) return true;
  return extraAllowedOrigins.some((origin) => hostOf(origin) === sourceHost);
}

// Lightweight per-IP rate limit. This is per-instance memory, so it is a
// deterrent against casual spam / cost amplification rather than a hard global
// guarantee; move to a durable store (e.g. Redis) if real abuse appears.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ENTRIES = 1000;
const rateLimitHits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitHits.get(key);

  if (!entry || now > entry.resetAt) {
    // Opportunistically drop expired entries so the map stays bounded.
    if (rateLimitHits.size > RATE_LIMIT_MAX_ENTRIES) {
      for (const [k, v] of rateLimitHits) {
        if (now > v.resetAt) rateLimitHits.delete(k);
      }
    }
    rateLimitHits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAllowedRequest(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Prefer x-real-ip: on Vercel the edge sets it to the true client IP, so it
  // can't be spoofed by a client-supplied header the way the first
  // x-forwarded-for entry can. Fall back to x-forwarded-for for other hosts.
  const clientIp =
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (isRateLimited(clientIp)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: {
    content?: string;
    email?: string;
    emoji?: string;
    metadata?: Metadata;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content, email, emoji, metadata } = body;

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  if (resend && notificationEmail && fromEmail) {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: notificationEmail,
        subject: `New Feedback Received ${emoji || ""}`,
        html: generateEmailTemplate({ content, email, emoji, metadata }),
      });
    } catch (emailError) {
      console.error("Email notification failed:", emailError);
    }
  } else {
    console.log("Feedback received (console-only mode):", { content, email, emoji, metadata });
  }

  return NextResponse.json({ success: true });
}
