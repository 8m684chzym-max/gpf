import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/guard";
import { logAudit } from "@/lib/data";

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const members = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, manualHandicap: true },
  });
  return NextResponse.json({ members });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { name, email, password, role } = await req.json();
  if (!name || !email) return NextResponse.json({ error: "Name and email required." }, { status: 400 });
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (exists) return NextResponse.json({ error: "Email already in use." }, { status: 409 });
  const passwordHash = await bcrypt.hash(password || "welcome123", 10);
  const u = await prisma.user.create({ data: { name: name.trim(), email: email.toLowerCase().trim(), passwordHash, role: role === "ADMIN" ? "ADMIN" : "MEMBER" } });
  await logAudit(admin.name, "member.add", u.id, `${u.name} (${u.role})`);
  return NextResponse.json({ ok: true });
}
