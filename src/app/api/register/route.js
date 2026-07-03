import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/data";

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { name, email, password, handicap } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
  if (!handicap || isNaN(parseFloat(handicap))) return NextResponse.json({ error: "A valid handicap index is required." }, { status: 400 });
  
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (exists) return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
  
  const passwordHash = await bcrypt.hash(password, 10);
  const handicapValue = parseFloat(handicap);
  
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: "MEMBER",
      declaredHandicap: handicapValue
    }
  });
  
  await logAudit(user.name, "member.register", user.id, null);
  return NextResponse.json({ ok: true });
}
