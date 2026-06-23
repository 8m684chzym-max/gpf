import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, isMailConfigured } from "@/lib/mail";

export const dynamic = 'force-dynamic';

// Always return the same generic response, whether or not the email exists or
// has a password set — avoids leaking which emails are registered.
const GENERIC = { ok: true, message: "If that email has a password set, we've sent a reset link." };

export async function POST(req) {
  let email;
  try { ({ email } = await req.json()); } catch { return NextResponse.json(GENERIC); }
  if (!email) return NextResponse.json(GENERIC);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (user && user.passwordHash) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });
    const link = `${process.env.NEXTAUTH_URL || ""}/reset-password?token=${token}`;

    if (isMailConfigured()) {
      try {
        await sendPasswordResetEmail(user.email, link);
      } catch (e) {
        console.error("[forgot-password] email send failed:", e.message);
      }
    } else {
      // No SMTP configured — log the link (not the email) so it's usable in
      // local dev. In production, configure SMTP or use Admin → Members to
      // reset a member's password directly. Never log the email address itself
      // as Vercel retains server logs and that would be an unnecessary transfer.
      console.log(`[forgot-password] SMTP not configured. Reset link (no email shown): ${link}`);
    }
  }
  return NextResponse.json(GENERIC);
}
