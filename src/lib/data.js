// Server helpers: load the active competition and its rounds, shaped for scoring.
import { prisma } from "@/lib/prisma";

export async function getActiveCompetition() {
  let comp = await prisma.competition.findFirst({ where: { active: true }, orderBy: { year: "desc" } });
  if (!comp) comp = await prisma.competition.findFirst({ orderBy: { year: "desc" } });
  return comp;
}

export function configFrom(comp) {
  return {
    year: comp.year,
    qualifyingRoundsRequired: comp.qualifyingRoundsRequired,
    handicapAllowance: comp.handicapAllowance,
    roundingMode: comp.roundingMode,
    tiebreak: comp.tiebreak,
    weekendDates: { r1: comp.r1Date, r2: comp.r2Date },
    qualifyingLocked: comp.qualifyingLocked,
    weekendLocked: comp.weekendLocked,
  };
}

// Returns rounds flattened for the scoring engine (includes tee data for WHS calculations).
export async function getScopedRounds(competitionId) {
  const rounds = await prisma.round.findMany({
    where: { competitionId },
    include: { tee: true, scorecard: true },
  });
  return rounds.map((r) => ({
    id: r.id, userId: r.userId, type: r.type, roundNo: r.roundNo, status: r.status,
    gross: r.gross, parAtTee: r.tee?.par ?? 72, tee: r.tee, holes: r.scorecard?.holes ?? null,
    points: r.scorecard?.points ?? null,
  }));
}

export async function logAudit(actor, action, targetId, details) {
  try { await prisma.auditLog.create({ data: { actor, action, targetId, details } }); } catch { /* ignore */ }
}
