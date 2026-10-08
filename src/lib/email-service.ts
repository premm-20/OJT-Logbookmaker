import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { OtpPurpose } from "@/lib/otp-store";

export interface SendEmailParams {
  to: string;
  name: string;
  otp: string;
  purpose: OtpPurpose;
}

export interface SendEmailResult {
  success: boolean;
  deliveryMode: "smtp" | "resend" | "console";
  message: string;
  configured: boolean;
}

const COPY: Record<OtpPurpose, { subject: string; intro: string }> = {
  signup: {
    subject: "Your OJT Logbook verification code",
    intro: "Enter this code on the sign up page to confirm your university email and finish creating your account.",
  },
  reset: {
    subject: "Your OJT Logbook password reset code",
    intro: "Enter this code on the reset page to choose a new password. If you didn't ask for this, you can ignore this email.",
  },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function renderHtml({ name, otp, purpose }: SendEmailParams): string {
  const { intro } = COPY[purpose];
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OJT Logbook</title>
</head>
<body style="margin:0;padding:32px 16px;background:#f3f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#17232c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #dde5ea;">
    <tr>
      <td style="padding:28px 32px 0;">
        <div style="font-size:13px;font-weight:700;color:#0a6e99;">OJT Logbook</div>
        <div style="font-size:12px;color:#5b6b76;margin-top:2px;">Medhavi Skills University</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px 8px;">
        <p style="margin:0 0 12px;font-size:15px;font-weight:600;">Hi ${escapeHtml(name || "there")},</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#45545e;">${intro}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;">
        <div style="background:#eef5f9;border-radius:10px;padding:20px;text-align:center;">
          <div style="font-family:'SFMono-Regular',Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#0b3d55;">${otp}</div>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 28px;font-size:12px;line-height:1.6;color:#6c7a84;">
        The code expires in 15 minutes. Never share it with anyone, including staff.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, name, otp, purpose } = params;
  const { subject } = COPY[purpose];
  const html = renderHtml(params);
  const text = `Hi ${name || "there"},\n\n${COPY[purpose].intro}\n\nYour code: ${otp}\n\nThe code expires in 15 minutes.\n\nOJT Logbook, Medhavi Skills University`;

  // Method 1: SMTP via Nodemailer (Gmail, Brevo, Zoho, SendGrid, ...)
  const smtpHost =
    process.env.SMTP_HOST || (process.env.SMTP_USER?.endsWith("@gmail.com") ? "smtp.gmail.com" : "");
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || (smtpUser ? `"OJT Logbook" <${smtpUser}>` : "");

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost.includes("gmail.com") ? "smtp.gmail.com" : smtpHost,
        port: smtpPort || 587,
        secure: smtpPort === 465,
        family: 4, // Force IPv4 to prevent ENETUNREACH errors on networks without IPv6
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
      } as SMTPTransport.Options);

      await transporter.sendMail({ from: smtpFrom, to, subject, text, html });
      return { success: true, deliveryMode: "smtp", message: `Code sent to ${to}.`, configured: true };
    } catch (smtpErr: unknown) {
      console.error("Nodemailer SMTP failed:", smtpErr);
      return {
        success: false,
        deliveryMode: "smtp",
        message: "We couldn't send the email right now. Please try again in a minute.",
        configured: true,
      };
    }
  }

  // Method 2: Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "OJT Logbook <onboarding@resend.dev>",
          to: [to],
          subject,
          html,
          text,
        }),
      });
      if (res.ok) {
        return { success: true, deliveryMode: "resend", message: `Code sent to ${to}.`, configured: true };
      }
      console.warn("Resend API warning:", await res.json().catch(() => null));
    } catch (resendErr) {
      console.error("Resend API error:", resendErr);
    }
  }

  // Method 3: Local development without an email provider. The code is
  // printed to the terminal and returned to the browser (dev only).
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[OJT email:${purpose}] To: ${to}  Code: ${otp}\n`);
    return {
      success: true,
      deliveryMode: "console",
      message: "Email isn't configured, so the code is shown here and in the server terminal.",
      configured: false,
    };
  }

  return {
    success: false,
    deliveryMode: "console",
    message: "Email delivery isn't configured on the server. Please contact your coordinator.",
    configured: false,
  };
}
