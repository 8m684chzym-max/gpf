import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { logAudit } from "@/lib/data";

export const dynamic = 'force-dynamic';

function randomTempPassword() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

export async function PATCH(req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const body = await req.json();

  // Instant password reset — no email needed. Useful any time, essential if SMTP isn't set up.
  if (body.resetPassword) {
    const tempPassword = randomTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await prisma.user.update({ where: { id: params.id }, data: { passwordHash } });
    await logAudit(admin.name, "member.resetPassword", params.id, null);
    return NextResponse.json({ ok: true, tempPassword });
  }

  const data = {};
  if ("manualHandicap" in body) data.manualHandicap = body.manualHandicap === "" || body.manualHandicap == null ? null : Number(body.manualHandicap);
  if ("role" in body) data.role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";
  if ("tiebreakOverride" in body) data.tiebreakOverride = body.tiebreakOverride == null ? null : Number(body.tiebreakOverride);
  await prisma.user.update({ where: { id: params.id }, data });
  await logAudit(admin.name, "member.update", params.id, JSON.stringify(data));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  
  try {
    // Delete in the correct order respecting foreign key constraints:
    // 1. Delete password reset tokens (has CASCADE but explicit is safer)
    await prisma.passwordResetToken.deleteMany({ where: { userId: params.id } });
    
    // 2. Delete handicap records
    await prisma.handicapRecord.deleteMany({ where: { userId: params.id } });
    
    // 3. Remove user as partner from rounds (sets partnerId to null)
    await prisma.round.updateMany({
      where: { partnerId: params.id },
      data: { partnerId: null }
    });
    
    // 4. Delete scorecards for rounds where user is player
    await prisma.scorecard.deleteMany({
      where: { round: { userId: params.id } }
    });
    
    // 5. Delete rounds (has CASCADE but explicit is safer)
    await prisma.round.deleteMany({ where: { userId: params.id } });
    
    // 6. Finally delete the user
    await prisma.user.delete({ where: { id: params.id } });
    
    await logAudit(admin.name, "member.remove", params.id, null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete member error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete member" }, { status: 400 });
  }
}
