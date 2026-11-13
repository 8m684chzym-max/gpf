// Storage for every myFPG round of a member (My profile › FPG rounds).
import { prisma } from "@/lib/prisma";

// The table is created on first use if it isn't there yet (same columns as the
// Prisma model FpgResult), so a deploy never breaks while waiting for db:push.
let ensured = false;
export async function ensureFpgResultTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS gpf."FpgResult" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "course" TEXT, "event" TEXT, "holes" INTEGER, "par" INTEGER, "gross" INTEGER, "points" INTEGER,
    "hcpIndex" DOUBLE PRECISION, "playingHcp" INTEGER, "differential" DOUBLE PRECISION,
    "qualifying" BOOLEAN NOT NULL DEFAULT false, "origin" TEXT, "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FpgResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES gpf."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FpgResult_userId_date_idx" ON gpf."FpgResult"("userId", "date")`);
  ensured = true;
}

export async function saveFpgResults(userId, recs) {
  await ensureFpgResultTable();
  for (const r of recs) {
    if (!r.date) continue;
    const data = {
      userId, date: new Date(`${r.date}T12:00:00Z`), course: r.course, event: r.event,
      holes: r.holes != null ? Math.round(r.holes) : null, par: r.par != null ? Math.round(r.par) : null,
      gross: r.gross != null ? Math.round(r.gross) : null, points: r.points != null ? Math.round(r.points) : null,
      hcpIndex: r.index, playingHcp: r.playingHcp != null ? Math.round(r.playingHcp) : null,
      differential: r.differential, qualifying: !!r.hcpQualifying, origin: r.origin, data: r,
    };
    await prisma.fpgResult.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data });
  }
}
