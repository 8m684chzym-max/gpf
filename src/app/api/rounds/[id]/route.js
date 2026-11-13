import { NextResponse } from "next/server";
import { lockFor, calcHandicap } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/guard";
import { logAudit } from "@/lib/data";

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const body = await req.json();
  const id = params.id;
  // Members edit their own submitted rounds from My profile.
  if (body.action === "update") return updateOwnRound(id, body);

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { action, gross, reason } = body;
  if (action === "approve") {
    await prisma.round.update({ where: { id }, data: { status: "APPROVED", reviewedBy: admin.name, reviewedAt: new Date() } });
    await logAudit(admin.name, "round.approve", id, null);
  } else if (action === "reject") {
    await prisma.round.update({ where: { id }, data: { status: "REJECTED", rejectReason: reason || "rejected", reviewedBy: admin.name, reviewedAt: new Date() } });
    await logAudit(admin.name, "round.reject", id, reason);
  } else if (action === "edit") {
    const r = await prisma.round.findUnique({ where: { id }, include: { tee: true, scorecard: true, user: { select: { declaredHandicap: true, manualHandicap: true } } } });
    if (!r) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    // Strokes changed → rescore, but with the index locked at submission (not today's).
    const index = r.lockedIndex ?? calcHandicap(r.user).value;
    const holes = r.scorecard?.holes?.length === 18 && r.scorecard.holes.reduce((s, x) => s + x, 0) === Number(gross) ? r.scorecard.holes : null;
    const lock = r.type === "QUALIFYING" && index != null ? lockFor({ gross: Number(gross), tee: r.tee, holes }, index) : {};
    await prisma.round.update({ where: { id }, data: { gross: Number(gross), ...lock } });
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

// A member corrects one of their own rounds (date, course, tee, gross, hole scores, witness).
// Any edit sends the round back to PENDING so the committee re-approves it before it
// counts on Rank or in the Open. Same validation as a new submission.
async function updateOwnRound(id, b) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const round = await prisma.round.findUnique({ where: { id }, include: { competition: true, scorecard: true } });
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
  if (round.userId !== user.id) return NextResponse.json({ error: "You can only edit your own rounds." }, { status: 403 });
  const locked = round.type === "WEEKEND" ? round.competition?.weekendLocked : round.competition?.qualifyingLocked;
  if (locked) return NextResponse.json({ error: "These scores are locked — ask the committee." }, { status: 403 });

  const date = b.date ? new Date(b.date) : round.date;
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "That date isn't valid." }, { status: 400 });
  if (date > new Date(Date.now() + 36e5 * 24)) return NextResponse.json({ error: "The date can't be in the future." }, { status: 400 });
  const courseId = b.courseId || round.courseId;
  const teeId = b.teeId || round.teeId;
  const tee = await prisma.tee.findUnique({ where: { id: teeId } });
  if (!tee || tee.courseId !== courseId) return NextResponse.json({ error: "Pick a tee from the selected course." }, { status: 400 });
  const gross = b.gross != null ? Number(b.gross) : round.gross;
  if (!Number.isInteger(gross) || gross < 18 || gross > 200) return NextResponse.json({ error: "Gross must be a whole number between 18 and 200." }, { status: 400 });

  let holes = null;
  if (Array.isArray(b.holes)) {
    if (b.holes.length !== 18) return NextResponse.json({ error: "Enter all 18 hole scores." }, { status: 400 });
    holes = b.holes.map(Number);
    if (holes.some((x) => !Number.isInteger(x) || x < 1 || x > 20))
      return NextResponse.json({ error: "Each hole score must be a whole number between 1 and 20." }, { status: 400 });
  } else if (round.scorecard?.holes?.length === 18) holes = round.scorecard.holes;
  if (holes && holes.reduce((s, x) => s + x, 0) !== gross)
    return NextResponse.json({ error: `Hole scores add up to ${holes.reduce((s, x) => s + x, 0)}, but the gross is ${gross}.` }, { status: 400 });

  let partnerId = round.partnerId;
  if (round.type === "QUALIFYING" && b.partnerId !== undefined) {
    if (!b.partnerId) return NextResponse.json({ error: "A qualifying round needs a member witness." }, { status: 400 });
    if (b.partnerId === user.id) return NextResponse.json({ error: "Your witness must be another member." }, { status: 400 });
    partnerId = b.partnerId;
  }

  const changes = [];
  if (date.toISOString().slice(0, 10) !== round.date.toISOString().slice(0, 10)) changes.push(`date ${date.toISOString().slice(0, 10)}`);
  if (courseId !== round.courseId || teeId !== round.teeId) changes.push("course/tee");
  if (gross !== round.gross) changes.push(`gross ${round.gross}→${gross}`);
  if (Array.isArray(b.holes) && JSON.stringify(holes) !== JSON.stringify(round.scorecard?.holes ?? [])) changes.push("hole scores");
  if (partnerId !== round.partnerId) changes.push("witness");
  if (!changes.length) return NextResponse.json({ ok: true, unchanged: true });

  const half = (a, z) => (holes ? holes.slice(a, z).reduce((s, x) => s + x, 0) : null);
  // Rescore with the index locked when the card was first submitted (not today's index).
  let lock = {};
  if (round.type === "QUALIFYING") {
    const index = round.lockedIndex ?? calcHandicap(await prisma.user.findUnique({ where: { id: user.id }, select: { declaredHandicap: true, manualHandicap: true } })).value;
    if (index != null) lock = { ...lockFor({ gross, tee, holes }, index), lockedIndex: index };
  }
  await prisma.round.update({
    where: { id },
    data: {
      date, courseId, teeId, gross, partnerId, ...lock,
      status: "PENDING", reviewedBy: null, reviewedAt: null, rejectReason: null,
      // Card-stated points no longer match edited strokes: drop them so they're recomputed.
      ...(round.scorecard
        ? { scorecard: { update: { holes: holes ?? round.scorecard.holes, outScore: half(0, 9) ?? round.scorecard.outScore, inScore: half(9, 18) ?? round.scorecard.inScore, points: changes.length ? null : round.scorecard.points } } }
        : holes ? { scorecard: { create: { holes, outScore: half(0, 9), inScore: half(9, 18) } } } : {}),
    },
  });
  await logAudit(user.name, "round.member-edit", id, `${changes.join(", ")} → pending review`);
  return NextResponse.json({ ok: true, status: "PENDING" });
}
