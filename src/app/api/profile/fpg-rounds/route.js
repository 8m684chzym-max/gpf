// My profile › FPG rounds: the member's rounds as registered at the FPG
// (imported weekly from myFPG), newest first, flagged when they count on Rank.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { ensureFpgResultTable } from "@/lib/fpgResults";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { fpgNumber: true, fpgResultsAt: true } });
  if (!me?.fpgNumber) return NextResponse.json({ fpgNumber: null, rounds: [] });
  try {
    await ensureFpgResultTable();
    const rounds = await prisma.fpgResult.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, take: 40 });
    const ranked = await prisma.round.findMany({
      where: { userId: user.id, fpgScoreId: { in: rounds.map((r) => r.id) }, status: "APPROVED" },
      select: { fpgScoreId: true },
    });
    const inRank = new Set(ranked.map((r) => r.fpgScoreId));
    return NextResponse.json({
      fpgNumber: me.fpgNumber, importedAt: me.fpgResultsAt,
      rounds: rounds.map(({ data, ...r }) => ({ ...r, inRank: inRank.has(r.id) })),
    });
  } catch (e) {
    console.error("[profile/fpg-rounds]", e);
    return NextResponse.json({ fpgNumber: me.fpgNumber, rounds: [], error: "FPG rounds unavailable right now." });
  }
}
