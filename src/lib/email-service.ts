import nodemailer from "nodemailer";

export interface SendEmailParams {
  to: string;
  name: string;
  otp: string;
  magicLinkUrl: string;
}

export interface SendEmailResult {
  success: boolean;
  deliveryMode: "smtp" | "resend" | "console";
  message: string;
  configured: boolean;
}

export async function sendVerificationEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const { to, name, otp, magicLinkUrl } = params;

  // 1. Check for custom SMTP configuration (Gmail SMTP, Brevo, SendGrid, Zoho, etc.)
  const smtpHost = process.env.SMTP_HOST || (process.env.SMTP_USER?.endsWith("@gmail.com") ? "smtp.gmail.com" : "");
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom =
    process.env.SMTP_FROM ||
    (smtpUser ? `"Medhavi Skills University OJT" <${smtpUser}>` : '"Medhavi Skills University OJT" <noreply@medhaviskillsuniversity.edu.in>');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Medhavi Skills University - OJT Verification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; font-weight: 500; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
    .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .otp-box { background: #f1f5f9; border: 2px dashed #93c5fd; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-label { font-size: 11px; font-weight: 800; color: #2563eb; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
    .otp-code { font-family: monospace; font-size: 36px; font-weight: 900; letter-spacing: 0.25em; color: #0f172a; margin: 0; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
    .divider { height: 1px; background: #e2e8f0; margin: 28px 0; }
    .footer { font-size: 12px; color: #94a3b8; line-height: 1.5; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Medhavi Skills University</h1>
      <p>Official On-the-Job Training (OJT) Logbook Portal</p>
    </div>
    <div class="content">
      <div class="greeting">Dear ${name || "Student"},</div>
      <p class="text">
        Use the 6-digit verification code below to verify your university Gmail account and access your official OJT Logbook workspace.
      </p>

      <div class="otp-box">
        <div class="otp-label">Your 6-Digit Verification Code</div>
        <div class="otp-code">${otp}</div>
      </div>

      <div class="btn-container">
        <a href="${magicLinkUrl}" class="btn" target="_blank">
          Direct One-Click Login &rarr;
        </a>
      </div>

      <p class="text" style="font-size: 12px; text-align: center; color: #64748b;">
        Or copy-paste this direct verification link in your browser:<br>
        <a href="${magicLinkUrl}" style="color: #2563eb; word-break: break-all;">${magicLinkUrl}</a>
      </p>

      <div class="divider"></div>

      <div class="footer">
        <p>This code and login link will expire in <strong>15 minutes</strong>.</p>
        <p>If you did not request this verification, please contact your university program coordinator immediately.</p>
        <p>&copy; ${new Date().getFullYear()} Medhavi Skills University. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  // Method 1: SMTP via Nodemailer
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const isGmail = smtpHost.includes("gmail.com") || smtpUser.endsWith("@gmail.com");
      const transporter = isGmail
        ? nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
          })
        : nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
          });

      await transporter.sendMail({
        from: smtpFrom,
        to,
        subject: `[MSU] Your OJT Verification Code: ${otp}`,
        text: `Dear ${name},\n\nYour Medhavi Skills University OJT verification code is: ${otp}\n\nOr click here to verify and log in directly: ${magicLinkUrl}\n\nThis code expires in 15 minutes.\n\nMedhavi Skills University`,
        html: htmlContent,
      });

      return {
        success: true,
        deliveryMode: "smtp",
        message: `Verification code successfully delivered to ${to} via SMTP.`,
        configured: true,
      };
    } catch (smtpErr: unknown) {
      console.error("Nodemailer SMTP failed:", smtpErr);
      const errMsg = smtpErr instanceof Error ? smtpErr.message : "SMTP delivery failure";
      return {
        success: false,
        deliveryMode: "smtp",
        message: `Failed to deliver verification email: ${errMsg}`,
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Medhavi Skills University <onboarding@resend.dev>",
          to: [to],
          subject: `[MSU] Your OJT Verification Code: ${otp}`,
          html: htmlContent,
        }),
      });

      if (res.ok) {
        return {
          success: true,
          deliveryMode: "resend",
          message: `Verification email delivered to ${to} via Resend.`,
          configured: true,
        };
      } else {
        const errJson = await res.json();
        console.warn("Resend API warning:", errJson);
      }
    } catch (resendErr) {
      console.error("Resend API error:", resendErr);
    }
  }

  // Method 3: Development / Fallback
  console.log(`\n======================================================`);
  console.log(`[MSU EMAIL DISPATCH] To: ${to} (${name})`);
  console.log(`[MSU EMAIL DISPATCH] 6-Digit OTP: ${otp}`);
  console.log(`[MSU EMAIL DISPATCH] One-Click Magic Link: ${magicLinkUrl}`);
  console.log(`======================================================\n`);

  return {
    success: false,
    deliveryMode: "console",
    message: `SMTP not configured in .env.local yet.`,
    configured: false,
  };
}
