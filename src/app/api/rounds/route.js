import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { getActiveCompetition, logAudit, getScopedRounds, configFrom } from "@/lib/data";
import { calcHandicap, auditRound } from "@/lib/scoring";

const USER_HCP = { id: true, name: true, declaredHandicap: true, manualHandicap: true };

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = new URL(req.url).searchParams.get("scope");
  const comp = await getActiveCompetition();
  const where = { competitionId: comp.id };
  if (!(scope === "all" && user.role === "ADMIN")) where.userId = user.id;
  const rounds = await prisma.round.findMany({
    where, orderBy: { createdAt: "desc" },
    include: { course: true, tee: true, scorecard: true, partner: { select: { name: true } }, user: { select: { name: true } } },
  });
  if (scope === "all" && user.role === "ADMIN") {
    // Committee view: check each card against the player's appointed index.
    const config = configFrom(comp);
    const scoped = await getScopedRounds(comp.id);
    const people = await prisma.user.findMany({ select: USER_HCP });
    const idx = new Map(people.map((u) => [u.id, calcHandicap(u, scoped, config).value]));
    for (const r of rounds) {
      if (r.type !== "QUALIFYING") continue;
      r.audit = auditRound({ gross: r.gross, tee: r.tee, holes: r.scorecard?.holes ?? null, points: r.scorecard?.points ?? null }, idx.get(r.userId));
    }
  }
  return NextResponse.json({ rounds });
}

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json();
  const comp = await getActiveCompetition();
  if (b.type === "QUALIFYING" && comp.qualifyingLocked) return NextResponse.json({ error: "Qualifying is locked." }, { status: 403 });
  if (b.type === "WEEKEND" && comp.weekendLocked) return NextResponse.json({ error: "GPF Open scores are locked." }, { status: 403 });
  if (!b.date || !b.courseId || !b.teeId || b.gross == null) return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  if (b.type === "WEEKEND") {
    const existing = await prisma.round.findFirst({ where: { userId: user.id, competitionId: comp.id, type: "WEEKEND", status: { not: "REJECTED" } } });
    if (existing) return NextResponse.json({ error: "You've already entered your GPF Open round." }, { status: 409 });
  }
  const holes = Array.isArray(b.holes) && b.holes.length === 18 ? b.holes.map(Number) : null;
  if (holes && holes.some((x) => !Number.isInteger(x) || x < 1 || x > 20))
    return NextResponse.json({ error: "Each hole score must be a whole number between 1 and 20." }, { status: 400 });
  if (holes && holes.reduce((s, x) => s + x, 0) !== Number(b.gross))
    return NextResponse.json({ error: `Hole scores add up to ${holes.reduce((s, x) => s + x, 0)}, but the gross entered is ${b.gross}.` }, { status: 400 });
  if (b.type === "QUALIFYING" && !b.partnerId) return NextResponse.json({ error: "A qualifying round needs a member witness." }, { status: 400 });

  // Qualifying cards: points are recomputed from strokes with the player's appointed index.
  // A card claiming more than that goes to the committee instead of straight onto the road.
  let audit = null;
  if (b.type === "QUALIFYING") {
    const tee = await prisma.tee.findUnique({ where: { id: b.teeId } });
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: USER_HCP });
    const index = calcHandicap(me, await getScopedRounds(comp.id), configFrom(comp)).value;
    audit = auditRound({ gross: Number(b.gross), tee, holes, points: b.points ?? null }, index);
  }
  const held = audit?.flagged;

  const round = await prisma.round.create({
    data: {
      userId: user.id, competitionId: comp.id, type: b.type, roundNo: b.type === "WEEKEND" ? 1 : null,
      date: new Date(b.date), courseId: b.courseId, teeId: b.teeId, gross: Number(b.gross),
      partnerId: b.type === "QUALIFYING" ? b.partnerId : null, source: b.source === "OCR" ? "OCR" : "MANUAL",
      ...(held ? { status: "PENDING" } : { status: "APPROVED", reviewedBy: "Auto-approved", reviewedAt: new Date() }),
      scorecard: (b.holes?.length === 18 || b.points != null || b.putts != null) ? {
        create: {
          holes: Array.isArray(b.holes) ? b.holes.map(Number) : [],
          outScore: b.out ?? null, inScore: b.in ?? null, points: b.points ?? null,
          fairwaysPct: b.fairwaysPct ?? null, girPct: b.girPct ?? null, putts: b.putts ?? null,
          bestHole: b.bestHole ?? null, leaderboardPos: b.leaderboardPos ?? null,
        },
      } : undefined,
    },
  });
  await logAudit(user.name, held ? "round.submit.held" : "round.submit", round.id,
    `${b.type} gross ${b.gross}` + (audit ? ` · card ${audit.card ?? "—"} pts vs computed ${audit.computed ?? "—"} (CH ${audit.ch ?? "—"})` : ""));
  return NextResponse.json({ ok: true, id: round.id, held: !!held,
    points: audit?.computed ?? null,
    message: held ? `Card says ${audit.card} pts; your strokes are worth ${audit.computed} pts off course handicap ${audit.ch}. Sent to the committee for review.` : null });
}
