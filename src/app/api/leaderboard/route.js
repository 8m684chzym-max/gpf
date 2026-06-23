import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveCompetition, configFrom, getScopedRounds } from "@/lib/data";
import { buildFinalBoard, buildRoadBoard } from "@/lib/scoring";

export const dynamic = 'force-dynamic';

export async function GET() {
  const comp = await getActiveCompetition();
  if (!comp) return NextResponse.json({ final: [], road: [], config: null });
  const config = configFrom(comp);
  const users = await prisma.user.findMany({ where: { role: "MEMBER" }, select: { id: true, name: true, declaredHandicap: true, manualHandicap: true, tiebreakOverride: true } });
  const rounds = await getScopedRounds(comp.id);
  const final = buildFinalBoard(users, rounds, config).map((r) => ({ name: r.user.name, hcp: r.hcp, ph: r.ph, net1: r.net1, net2: r.net2, total: r.total }));
  const road = buildRoadBoard(users, rounds, config).map((r) => ({ name: r.user.name, count: r.count, hcp: r.hcp, points: r.points, pointsUsed: r.pointsUsed, qualified: r.qualified }));
  return NextResponse.json({ final, road, config });
}
