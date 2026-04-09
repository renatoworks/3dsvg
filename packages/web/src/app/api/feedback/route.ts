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

function generateEmailTemplate(data: EmailTemplateData): string {
  const { content, email, emoji, metadata } = data;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #374151; margin-bottom: 24px;">New Feedback Received</h2>
      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
          ${emoji || "💬"} ${content}
        </div>
        ${email ? `<div style="color: #64748b; font-size: 14px;">From: ${email}</div>` : ""}
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
        <h3 style="color: #374151; font-size: 14px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Context</h3>
        <div style="display: grid; gap: 8px; font-size: 14px;">
          <div><span style="color: #6b7280;">🕒 </span><span>${new Date().toLocaleString()}</span></div>
          <div><span style="color: #6b7280;">🔗 </span><a href="${metadata?.context?.url || "Unknown"}" style="color: #374151; text-decoration: none;">${metadata?.context?.url || "Unknown"}</a></div>
          ${metadata?.context?.location ? `<div><span style="color: #6b7280;">🌍 </span><span>${metadata.context.location.city}, ${metadata.context.location.country} (${metadata.context.location.timezone})</span></div>` : ""}
          ${metadata?.browser?.platform ? `<div><span style="color: #6b7280;">🖥️ </span><span>${metadata.browser.platform}</span></div>` : ""}
          ${metadata?.browser?.viewport ? `<div><span style="color: #6b7280;">📱 </span><span>${metadata.browser.viewport.width}×${metadata.browser.viewport.height}</span></div>` : ""}
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

export async function POST(req: NextRequest) {
  const { content, email, emoji, metadata } = await req.json();

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
