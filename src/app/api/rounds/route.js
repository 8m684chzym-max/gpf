import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { getActiveCompetition, logAudit } from "@/lib/data";

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
    include: { course: true, tee: true, partner: { select: { name: true } }, user: { select: { name: true } } },
  });
  return NextResponse.json({ rounds });
}

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json();
  const comp = await getActiveCompetition();
  if (b.type === "QUALIFYING" && comp.qualifyingLocked) return NextResponse.json({ error: "Qualifying is locked." }, { status: 403 });
  if (b.type === "WEEKEND" && comp.weekendLocked) return NextResponse.json({ error: "Weekend scores are locked." }, { status: 403 });
  if (!b.date || !b.courseId || !b.teeId || b.gross == null) return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  if (b.type === "QUALIFYING" && !b.partnerId) return NextResponse.json({ error: "A qualifying round needs a member witness." }, { status: 400 });

  const round = await prisma.round.create({
    data: {
      userId: user.id, competitionId: comp.id, type: b.type, roundNo: b.type === "WEEKEND" ? Number(b.roundNo) : null,
      date: new Date(b.date), courseId: b.courseId, teeId: b.teeId, gross: Number(b.gross),
      partnerId: b.type === "QUALIFYING" ? b.partnerId : null, source: b.source === "OCR" ? "OCR" : "MANUAL",
      status: "APPROVED", reviewedBy: "Auto-approved", reviewedAt: new Date(),
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
  await logAudit(user.name, "round.submit", round.id, `${b.type} gross ${b.gross}`);
  return NextResponse.json({ ok: true, id: round.id });
}
