import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/guard";
import { logAudit } from "@/lib/data";

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const { action, gross, reason } = await req.json();
  const id = params.id;
  
  // User self-rejection of own rounds
  if (action === "userReject") {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const round = await prisma.round.findUnique({ where: { id } });
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    if (round.userId !== user.id) return NextResponse.json({ error: "Can only reject your own rounds" }, { status: 403 });
    await prisma.round.update({ where: { id }, data: { status: "REJECTED", rejectReason: "User rejected", reviewedAt: new Date() } });
    await logAudit(user.name, "round.userReject", id, null);
    return NextResponse.json({ ok: true });
  }
  
  // Admin actions
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  
  if (action === "approve") {
    await prisma.round.update({ where: { id }, data: { status: "APPROVED", reviewedBy: admin.name, reviewedAt: new Date() } });
    await logAudit(admin.name, "round.approve", id, null);
  } else if (action === "reject") {
    await prisma.round.update({ where: { id }, data: { status: "REJECTED", rejectReason: reason || "rejected", reviewedBy: admin.name, reviewedAt: new Date() } });
    await logAudit(admin.name, "round.reject", id, reason);
  } else if (action === "edit") {
    await prisma.round.update({ where: { id }, data: { gross: Number(gross) } });
    await logAudit(admin.name, "round.edit", id, `gross -> ${gross}`);
  } else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  
  try {
    // Delete scorecard first if exists (cascade is automatic, but explicit is safer)
    await prisma.scorecard.deleteMany({ where: { roundId: params.id } });
    
    // Then delete the round
    await prisma.round.delete({ where: { id: params.id } });
    await logAudit(admin.name, "round.delete", params.id, null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete round error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete round" }, { status: 400 });
  }
}
