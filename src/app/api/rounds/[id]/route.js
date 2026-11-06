import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/guard";
import { logAudit } from "@/lib/data";

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { action, gross, reason } = await req.json();
  const id = params.id;
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

// Admins can delete any round. Players can delete their own, unless the
// committee has locked that kind of round (qualifying / GPF Open).
export async function DELETE(req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const round = await prisma.round.findUnique({ where: { id: params.id }, include: { competition: true } });
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin) {
    if (round.userId !== user.id) return NextResponse.json({ error: "You can only delete your own rounds." }, { status: 403 });
    const locked = round.type === "WEEKEND" ? round.competition?.weekendLocked : round.competition?.qualifyingLocked;
    if (locked) return NextResponse.json({ error: "These scores are locked — ask the committee." }, { status: 403 });
  }

  try {
    await prisma.scorecard.deleteMany({ where: { roundId: round.id } });
    await prisma.round.delete({ where: { id: round.id } });
    await logAudit(user.name, "round.delete", round.id, `${round.type} gross ${round.gross} on ${round.date.toISOString().slice(0, 10)}${isAdmin && round.userId !== user.id ? " (by admin)" : ""}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete round error:", err);
    return NextResponse.json({ error: "Failed to delete round" }, { status: 400 });
  }
}
