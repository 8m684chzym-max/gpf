// GDPR Article 20 — Right to data portability.
// A logged-in member can download all their personal data in a structured,
// machine-readable JSON format. This covers every field the app holds about them.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true, name: true, email: true, role: true,
      declaredHandicap: true, manualHandicap: true,
      createdAt: true,
      rounds: {
        select: {
          id: true, type: true, roundNo: true, date: true, gross: true,
          status: true, source: true, createdAt: true,
          course: { select: { name: true } },
          tee: { select: { name: true, par: true, rating: true, slope: true } },
          partner: { select: { name: true } },
          scorecard: {
            select: {
              holes: true, outScore: true, inScore: true, points: true,
              fairwaysPct: true, girPct: true, putts: true,
              bestHole: true, leaderboardPos: true,
            },
          },
        },
        orderBy: { date: "desc" },
      },
      handicapRecords: {
        select: { value: true, manual: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const export_ = {
    exportedAt: new Date().toISOString(),
    exportNote: "Your personal data held by Golf P'la Fresquinha under GDPR Art. 20.",
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      declaredHandicap: user.declaredHandicap,
      manualHandicap: user.manualHandicap,
      memberSince: user.createdAt,
    },
    rounds: user.rounds,
    handicapRecords: user.handicapRecords,
  };

  return new Response(JSON.stringify(export_, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="gpf-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
