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
// layout spoofing) into the notification email. Accepts unknown so non-string
// fields from a malformed body coerce to "" instead of throwing a TypeError
// inside the resend try/catch (which would otherwise silently drop the email
// while still returning success to the client).
function escapeHtml(value: unknown): string {
  const s = typeof value === "string" ? value : "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Per-field size caps applied to inputs before they reach the notification
// email. content rejects at the POST handler (400 so the caller can correct);
// optional fields silently truncate here so a malformed or excessively
// chatty browser metadata payload still produces a bounded notification
// email rather than dropping the feedback or shipping a multi-MB HTML body
// to Resend.
const MAX_CONTENT_LENGTH = 10_000;
const MAX_EMAIL_LENGTH = 254;       // RFC 5321 §4.5.3.1 maximum email length
const MAX_EMOJI_LENGTH = 32;        // Unicode code points; bounds subject/body display
const MAX_URL_LENGTH = 2048;
const MAX_METADATA_STRING_LENGTH = 64;

// Coerce non-string to "" and truncate to `max` characters. Used together
// with escapeHtml so an oversized or malformed body field renders as a
// bounded, safe value in the notification email.
function clampString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.length > max ? value.slice(0, max) : value;
}

// Like clampString but counts Unicode code points instead of UTF-16 code
// units. Used for emoji fields (including ZWJ sequences) so truncation
// can't leave a dangling lone surrogate, and the cap reflects user-visible
// characters more closely without pulling in grapheme-cluster parsing.
function clampCodePoints(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return Array.from(value).slice(0, max).join("");
}

// Build the dynamic suffix for the email subject line. Subject lines are
// header values, not HTML, so we strip CR/LF (which some MTAs would
// otherwise parse as additional headers) and other ASCII control
// characters instead of escaping for HTML.
function sanitizeSubjectSuffix(value: unknown, max: number): string {
  return clampCodePoints(value, max)
    .replace(/[\r\n]+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "");
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

  // Clamp optional user-controlled fields once at the top so every
  // interpolation site below renders bounded output. content is already
  // length-checked in the POST handler.
  const safeEmail = clampString(email, MAX_EMAIL_LENGTH);
  const safeEmoji = clampCodePoints(emoji, MAX_EMOJI_LENGTH);
  const safePlatform = clampString(metadata?.browser?.platform, MAX_METADATA_STRING_LENGTH);

  const location = metadata?.context?.location;
  const viewport = metadata?.browser?.viewport;

  // Pre-compute the location pieces and assemble them without dangling
  // punctuation when any piece is missing or non-string. Only render the
  // location row when at least one piece is present.
  const safeCity = clampString(location?.city, MAX_METADATA_STRING_LENGTH);
  const safeCountry = clampString(location?.country, MAX_METADATA_STRING_LENGTH);
  const safeTimezone = clampString(location?.timezone, MAX_METADATA_STRING_LENGTH);
  const hasLocation = Boolean(safeCity || safeCountry || safeTimezone);
  const cityCountry = [safeCity, safeCountry].filter(Boolean).join(", ");
  const locationDisplay = cityCountry
    ? (safeTimezone ? `${cityCountry} (${safeTimezone})` : cityCountry)
    : safeTimezone;

  // Non-string url becomes "" (so "Unknown" renders); URLs longer than
  // MAX_URL_LENGTH are shown truncated as plain text rather than as a
  // clickable link, so a maliciously crafted long URL can't slip past
  // safeHttpUrl()'s scheme check via mid-URL truncation.
  const submittedUrl =
    typeof metadata?.context?.url === "string" ? metadata.context.url : "";
  const urlTooLong = submittedUrl.length > MAX_URL_LENGTH;
  const rawUrl = clampString(submittedUrl, MAX_URL_LENGTH);
  const safeUrl = urlTooLong ? null : safeHttpUrl(rawUrl);
  const urlLabel = escapeHtml(rawUrl || "Unknown");
  const urlMarkup = safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" style="color: #374151; text-decoration: none;">${urlLabel}</a>`
    : `<span>${urlLabel}</span>`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #374151; margin-bottom: 24px;">New Feedback Received</h2>
      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
          ${escapeHtml(safeEmoji || "💬")} ${escapeHtml(content)}
        </div>
        ${safeEmail ? `<div style="color: #64748b; font-size: 14px;">From: ${escapeHtml(safeEmail)}</div>` : ""}
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
        <h3 style="color: #374151; font-size: 14px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Context</h3>
        <div style="display: grid; gap: 8px; font-size: 14px;">
          <div><span style="color: #6b7280;">🕒 </span><span>${new Date().toLocaleString()}</span></div>
          <div><span style="color: #6b7280;">🔗 </span>${urlMarkup}</div>
          ${hasLocation ? `<div><span style="color: #6b7280;">🌍 </span><span>${escapeHtml(locationDisplay)}</span></div>` : ""}
          ${safePlatform ? `<div><span style="color: #6b7280;">🖥️ </span><span>${escapeHtml(safePlatform)}</span></div>` : ""}
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

  // Reject non-string content with the same 400 the empty-content path returns,
  // so a malformed body (e.g. content: {}) doesn't crash the route via
  // ({}).trim() throwing a TypeError outside the resend try/catch.
  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  // Cap content length so a single submission can't produce a multi-MB
  // HTML email after escaping. 10k characters fits any legitimate feedback
  // message; over that we surface a 400 so the caller can shorten and retry.
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` },
      { status: 400 }
    );
  }

  if (resend && notificationEmail && fromEmail) {
    try {
      // Drop the suffix entirely when it's empty (missing/non-string/all-stripped
      // emoji) so the subject doesn't render with a trailing space.
      const subjectSuffix = sanitizeSubjectSuffix(emoji, MAX_EMOJI_LENGTH);
      const subject = subjectSuffix
        ? `New Feedback Received ${subjectSuffix}`
        : "New Feedback Received";
      await resend.emails.send({
        from: fromEmail,
        to: notificationEmail,
        subject,
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
