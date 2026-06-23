// Sends password-reset emails via SMTP. Works with any provider (Gmail App
// Password, Resend SMTP, SendGrid, Mailgun, etc.) — just set the SMTP_* env vars.
// If SMTP isn't configured, callers should catch the thrown error and fall
// back gracefully (the forgot-password route logs the link to the server
// console instead, and admins can always reset a member's password directly).
import nodemailer from "nodemailer";

export function isMailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendPasswordResetEmail(to, link) {
  const t = getTransporter();
  if (!t) throw new Error("SMTP is not configured (set SMTP_HOST / SMTP_USER / SMTP_PASS).");
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await t.sendMail({
    from,
    to,
    subject: "Reset your Golf P'la Fresquinha password",
    text: `Reset your password using this link (expires in 1 hour):\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>Reset your Golf P'la Fresquinha password using the link below. It expires in 1 hour.</p>
<p><a href="${link}">${link}</a></p>
<p style="color:#666;font-size:13px">If you didn't request this, you can ignore this email.</p>`,
  });
}
