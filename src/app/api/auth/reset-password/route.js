import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/data";

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "Missing token or password." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const rec = await prisma.passwordResetToken.findUnique({ where: { token }, include: { user: true } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
  ]);
  await logAudit(rec.user.name, "password.reset", rec.userId, null);
  return NextResponse.json({ ok: true });
}
