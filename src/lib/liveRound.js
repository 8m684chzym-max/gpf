// An individual round played hole by hole on a mapped course (Play › Start play).
// Lives on this phone (localStorage) while it's being played, so a screen lock or a
// dead signal never loses a score; on Finish it is submitted as a qualifying round
// (POST /api/rounds) and becomes a scorecard on Rank. Independent of the Team Cup.
import { courseHandicapFor, strokesOnHole } from "@/lib/scoring";
import { HOLES } from "@/lib/holes";

const KEY = "gpf-live-round-v1";

export function loadLive() {
  try { const r = JSON.parse(localStorage.getItem(KEY) || "null"); return r && Array.isArray(r.holes) ? r : null; } catch { return null; }
}
export function saveLive(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* private mode */ } }
export function clearLive() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

// Par / stroke index per hole: the tee's own data when the course has it, else the map's.
export const parOf = (r, i) => r?.tee?.holePars?.[i] ?? HOLES[i]?.par ?? 4;
export const siOf = (r, i) => r?.tee?.strokeIndex?.[i] ?? HOLES[i]?.si ?? i + 1;

export function newLive({ course, tee, hcp, partner, date }) {
  return {
    courseId: course.id, courseName: course.name,
    teeId: tee.id, teeName: tee.name,
    tee: { par: tee.par, rating: tee.rating, slope: tee.slope, holePars: tee.holePars, strokeIndex: tee.strokeIndex },
    hcp: hcp == null || hcp === "" ? null : Number(hcp),
    partnerId: partner?.id || null, partnerName: partner?.name || null,
    date, holes: Array(18).fill(null), startedAt: new Date().toISOString(),
  };
}

export const courseHcp = (r) => (r?.hcp == null ? null : courseHandicapFor(r.hcp, r.tee));
export const strokesOn = (r, i) => { const ch = courseHcp(r); return ch == null ? 0 : strokesOnHole(siOf(r, i), ch); };

// Stableford points on hole i (null when not played yet).
export function holePoints(r, i) {
  const s = r?.holes?.[i];
  if (!s) return null;
  return Math.max(0, 2 + parOf(r, i) + strokesOn(r, i) - s);
}

export function totals(r) {
  let gross = 0, points = 0, played = 0, par = 0;
  r.holes.forEach((s, i) => { if (s) { gross += s; played += 1; par += parOf(r, i); points += holePoints(r, i) ?? 0; } });
  return { gross, points, played, toPar: gross - par };
}
