// Pure scoring engine — shared by server (API routes) and client.
import { RANK_SINCE, FPG_ROUNDS_SINCE } from "./major";

// Rounds passed in are already scoped to the active competition. Each
// qualifying round must carry `parAtTee` (the par of the tee played) so
// handicap differentials can be computed. Enum-like strings are UPPERCASE.

export function roundHcp(value, mode) {
  if (value == null) return null;
  switch (mode) {
    case "floor": return Math.floor(value);
    case "ceil": return Math.ceil(value);
    case "dp1": return Math.round(value * 10) / 10;
    default: return Math.round(value); // nearest, 0.5 up
  }
}

export function playingHandicap(hcp, config) {
  if (hcp == null) return null;
  return roundHcp((hcp * (config?.handicapAllowance ?? 90)) / 100, config?.roundingMode ?? "round");
}

// GPF Open playing handicap (WHS): Course Handicap on the tee played × allowance.
// Course Handicap = Index × Slope/113 + (Course Rating − Par), rounded to a whole number first.
export function openPlayingHandicap(hcp, tee, config) {
  const ch = courseHandicapFor(hcp, tee);
  if (ch == null) return null;
  return roundHcp((ch * (config?.handicapAllowance ?? 90)) / 100, config?.roundingMode ?? "round");
}

// B — Road to GPF bonus strokes: 1st/2nd/3rd qualified player on the road board.
export const ROAD_BONUS = [3, 2, 1];
export function roadBonusMap(users, rounds, config) {
  const map = new Map();
  buildRoadBoard(users, rounds, config)
    .filter((r) => r.qualified)
    .slice(0, ROAD_BONUS.length)
    .forEach((r, i) => map.set(r.user.id, ROAD_BONUS[i]));
  return map;
}

export function netOf(gross, ph) {
  return gross == null || ph == null ? null : gross - ph;
}

// Net countback for a single medal round: last 9, 6, 3, then 18th hole,
// each less the matching fraction (1/2, 1/3, 1/6, 1/18) of playing handicap.
// Returns an array to compare lexicographically; null when hole scores are missing.
export function netCountback(holes, ph) {
  if (!holes || holes.length < 18 || ph == null) return null;
  const last = (n) => holes.slice(18 - n).reduce((s, x) => s + (Number(x) || 0), 0);
  return [last(9) - ph / 2, last(6) - ph / 3, last(3) - ph / 6, last(1) - ph / 18];
}

export function back9(holes) {
  return !holes || holes.length < 18 ? null : holes.slice(9, 18).reduce((s, x) => s + (Number(x) || 0), 0);
}

// Continuous Rank: only rounds on or after RANK_SINCE count (see lib/major.js).
const sinceOk = (r) => !r.date || String(r.date instanceof Date ? r.date.toISOString() : r.date).slice(0, 10) >= RANK_SINCE;
// Members whose FPG results are imported (r.fpgOnly) count only official myFPG
// rounds (r.fpgScoreId) from FPG_ROUNDS_SINCE; everyone else counts their cards.
const dayOf = (r) => String(r.date instanceof Date ? r.date.toISOString() : r.date ?? "").slice(0, 10);
const fpgOk = (r) => !r.fpgOnly || (r.fpgScoreId && dayOf(r) >= FPG_ROUNDS_SINCE);
export function approvedQualifying(rounds, userId) {
  return rounds.filter((r) => r.userId === userId && r.type === "QUALIFYING" && r.status === "APPROVED" && sinceOk(r) && fpgOk(r));
}

// Calculate WHS Score Differential: (113 / Slope) × (Gross - Course Rating)
// For rounds without rating/slope data, use conservative defaults (par, slope 113).
export function scoreD(gross, courseRating, slope) {
  const rating = courseRating ?? 72;
  const s = slope ?? 113;
  return (113 / s) * (gross - rating);
}

// Informational only (no longer used for the competition): average of the best 3
// score differentials.
export function whsIndex(qs) {
  if (!qs.length) return null;
  const diffs = qs.map((r) => {
    const courseRating = r.tee?.rating ?? r.parAtTee ?? 72;
    const slope = r.tee?.slope ?? 113;
    return scoreD(r.gross, courseRating, slope);
  }).sort((a, b) => a - b);
  const best = diffs.slice(0, Math.min(3, diffs.length));
  const avg = best.reduce((s, x) => s + x, 0) / best.length;
  return Math.round(avg * 10) / 10;
}

// ── GPF handicap rules ───────────────────────────────────────────────────────
// 1. Every player starts from their self-declared handicap (the committee may
//    correct it with manualHandicap). This is the index every road round is
//    scored with — it does NOT move with results, so points stay comparable.
//    Since Nov 2026 it is the player's official FPG Handicap Index, refreshed weekly
//    by /api/fpg/sync (players without an FPG number keep their declared value).
// 2. Each qualifying round = gross on a course/tee.
// 3. Points = WHS Stableford for that gross, on that tee, off the declared index
//    (Course Handicap = Index × Slope/113 + (CR − Par), full allowance).
//    Each card's points are LOCKED at submission with the index registered then
//    (Round.lockedPoints); a later handicap change never rescores old cards.
// 4. Road total = best 3 rounds (by locked points, whatever the index was).
// 5. Open index = declared index adjusted by how the best 3 compare with 108
//    (36 a round = playing exactly to handicap). See openIndexFor().
export function calcHandicap(user /*, rounds, config — unused, kept for call sites */) {
  if (user.manualHandicap != null) return { value: Number(user.manualHandicap), manual: true, source: "manual" };
  if (user.declaredHandicap != null) return { value: Number(user.declaredHandicap), manual: false, source: "declared" };
  return { value: null, manual: false, source: "none" };
}

export const ROAD_TARGET_PER_ROUND = 36;

// Rule 5. Average points above/below 36 over the best `n` rounds is the number of
// strokes (of Course Handicap) the declared handicap is off by per round. Convert
// that to index with the average slope of those rounds:
//   adjust = −(total − 36·n)/n × 113 / slope
//   e.g. best 3 = 117 pts (+3/round) on slope 123 → index −2.8
//        best 3 =  96 pts (−4/round) on slope 123 → index +3.7
// Applied only once the player has n rounds; result kept within WHS limits (+8 … 54).
export function openIndexFor(user, rounds, config, n = 3) {
  const base = calcHandicap(user).value;
  const counted = base == null ? [] : roadRoundsFor(user.id, rounds, base, n).filter((x) => x.counted);
  if (base == null || counted.length < n) return { base, adjust: 0, value: base, total: null, perRound: null };
  const total = counted.reduce((s, x) => s + x.points, 0);
  const perRound = (total - ROAD_TARGET_PER_ROUND * n) / n;
  const slope = counted.reduce((s, x) => s + (x.slope ?? 113), 0) / n;
  const adjust = Math.round((-perRound * 113 / slope) * 10) / 10;
  const value = Math.min(54, Math.max(-8, Math.round((base + adjust) * 10) / 10));
  return { base, adjust: Math.round((value - base) * 10) / 10, value, total, perRound: Math.round(perRound * 10) / 10 };
}

// WHS Course Handicap on a given tee: Index × (Slope / 113) + (Rating − Par), rounded.
export function courseHandicapFor(index, tee) {
  if (index == null || !tee) return null;
  const slope = tee.slope ?? 113;
  const rating = tee.rating ?? tee.par ?? 72;
  const par = tee.par ?? 72;
  return Math.round(index * (slope / 113) + (rating - par));
}

// Strokes received on a hole of stroke index `si` for a whole-number Course Handicap.
// Plus handicaps give strokes back, starting from the easiest hole (SI 18).
export function strokesOnHole(si, ch) {
  if (ch >= 0) return Math.floor(ch / 18) + (si <= ch % 18 ? 1 : 0);
  const p = -ch;
  return -(Math.floor(p / 18) + (si > 18 - (p % 18) ? 1 : 0));
}

const hasHoleData = (tee) =>
  Array.isArray(tee?.holePars) && tee.holePars.length === 18 &&
  Array.isArray(tee?.strokeIndex) && tee.strokeIndex.length === 18;

// Exact Stableford from hole scores, the tee's par/SI per hole and the Course Handicap.
// null when hole scores or the tee's hole data are missing.
export function exactStableford(holes, tee, ch) {
  if (ch == null || !hasHoleData(tee) || !Array.isArray(holes) || holes.length !== 18) return null;
  return holes.reduce((s, x, i) => {
    const score = Number(x);
    if (!score) return s; // no return on the hole → 0 pts
    return s + Math.max(0, 2 + tee.holePars[i] + strokesOnHole(tee.strokeIndex[i], ch) - score);
  }, 0);
}

// Net Stableford estimate from gross alone.
// Playing to your Course Handicap is worth 36 pts; each net stroke better/worse
// is ±1 pt, so points = 36 + CourseHandicap + Par − Gross (floored at 0).
// Exact when no hole scores 0 pts; otherwise slightly low (a blow-up hole costs > 2).
export function estimateStableford(round, index) {
  const tee = round.tee;
  const ch = courseHandicapFor(index, tee);
  if (ch == null || round.gross == null || !tee) return null;
  const par = tee.par ?? 72;
  return Math.max(0, Math.round(36 + ch + par - round.gross));
}

// Stableford points for a round — ALWAYS computed from the strokes and the player's
// appointed index, never taken from the card (a card can be marked off a false handicap).
// Exact per hole when the tee has par/SI data and all 18 scores exist; else from gross.
export function roundPoints(round, index) {
  const exact = exactStableford(round.holes, round.tee, courseHandicapFor(index, round.tee));
  return exact != null ? exact : estimateStableford(round, index);
}

// Points that count for a round: the locked value when the card has one, otherwise
// (legacy rounds from before locking) computed with the given index.
export function countedPoints(round, index) {
  if (round.lockedPoints != null) return Number(round.lockedPoints);
  return roundPoints(round, index);
}

// What to store when a card is submitted or its strokes are edited.
export function lockFor(round, index) {
  const ch = courseHandicapFor(index, round.tee);
  return { lockedIndex: index, lockedCourseHcp: ch, lockedPoints: roundPoints(round, index), lockedAt: new Date() };
}

// Integrity check of a submitted card against the player's appointed index.
//   holesMismatch — the 18 hole scores don't add up to the gross entered
//   pointsGap     — points written on the card minus points the strokes are worth
//   impliedCH     — Course Handicap the card's points imply (gross method)
// flagged when hole scores ≠ gross, or the card claims more than 2 pts above the computed value.
export function auditRound(round, index) {
  const ch = courseHandicapFor(index, round.tee);
  const computed = roundPoints(round, index);
  const holes = Array.isArray(round.holes) && round.holes.length === 18 ? round.holes.map(Number) : null;
  const holeSum = holes ? holes.reduce((s, x) => s + (x || 0), 0) : null;
  const holesMismatch = holeSum != null && round.gross != null && holeSum !== Number(round.gross);
  const card = round.points != null ? Number(round.points) : null;
  const par = round.tee?.par ?? 72;
  const pointsGap = card != null && computed != null ? card - computed : null;
  const impliedCH = card != null && round.gross != null ? card - 36 - par + Number(round.gross) : null;
  const flagged = holesMismatch || (pointsGap != null && pointsGap > 2);
  return { ch, computed, card, pointsGap, impliedCH, holeSum, holesMismatch, flagged, exact: exactStableford(round.holes, round.tee, ch) != null };
}

// Total Stableford points across a player's best `n` qualifying rounds.
export function bestPointsTotal(userId, rounds, index, n = 3) {
  const pts = approvedQualifying(rounds, userId)
    .map((r) => countedPoints(r, index))
    .filter((p) => p != null)
    .sort((a, b) => b - a)
    .slice(0, n);
  return { total: pts.reduce((s, x) => s + x, 0), used: pts.length };
}

// A player's approved qualifying rounds, newest first, with what each is worth:
// playing hcp = Course Handicap on the tee (100%, as for road Stableford) from the
// player's appointed index; `counted` marks the best `n` that make up their road total.
export function roadRoundsFor(userId, rounds, index, n = 3) {
  const list = approvedQualifying(rounds, userId).map((r) => ({
    id: r.id, date: r.date ?? null, course: r.tee?.course?.name ?? null, tee: r.tee?.name ?? null,
    gross: r.gross, slope: r.tee?.slope ?? 113,
    ph: r.lockedCourseHcp ?? courseHandicapFor(index, r.tee), hcpIndex: r.lockedIndex ?? index, locked: r.lockedPoints != null, fpg: !!r.fpgScoreId,
    points: countedPoints(r, index),
  }));
  const best = new Set(list.filter((x) => x.points != null).sort((a, b) => b.points - a.points).slice(0, n).map((x) => x.id));
  return list
    .map((x) => ({ ...x, counted: best.has(x.id) }))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
}

export function isQualified(user, rounds, config) {
  return approvedQualifying(rounds, user.id).length >= (config?.qualifyingRoundsRequired ?? 3);
}

// GPF Open: single-round Medal Net (see lib/major.js).
//   playing hcp = Course Handicap on the tee played × allowance   (A)
//   net         = gross − playing hcp
//   total       = net − road bonus strokes (3/2/1 for road 1st/2nd/3rd)   (B)
// net2 is kept in the row shape (always null) so older consumers don't break.
export function buildFinalBoard(users, rounds, config) {
  const bonus = roadBonusMap(users, rounds, config);
  const rows = users.map((u) => {
    const hcp = openIndexFor(u, rounds, config).value; // rule 5: declared, adjusted by road form
    const r1 = rounds.find((r) => r.userId === u.id && r.type === "WEEKEND" && r.roundNo === 1 && r.status === "APPROVED");
    // Tee missing rating/slope → courseHandicapFor falls back to par/113, i.e. plain index × allowance.
    const ph = r1 ? openPlayingHandicap(hcp, r1.tee, config) : playingHandicap(hcp, config);
    const net1 = r1 ? netOf(r1.gross, ph) : null;
    const b = bonus.get(u.id) ?? 0;
    const total = net1 == null ? null : net1 - b;
    return { user: u, hcp, ph, tee: r1?.tee?.name ?? null, bonus: b, gross: r1 ? r1.gross : null, net1, net2: null, total, countback: r1 ? netCountback(r1.holes, ph) : null, manualTiebreak: u.tiebreakOverride ?? 0 };
  }).filter((row) => row.net1 != null);

  rows.sort((a, b) => {
    if (a.total == null && b.total == null) return 0;
    if (a.total == null) return 1;
    if (b.total == null) return -1;
    if (a.total !== b.total) return a.total - b.total;
    if (config?.tiebreak === "manual") return a.manualTiebreak - b.manualTiebreak;
    // Single round: net countback. Cards without hole scores sort after cards with them.
    if (!a.countback || !b.countback) return (a.countback ? 0 : 1) - (b.countback ? 0 : 1);
    for (let i = 0; i < 4; i++) if (a.countback[i] !== b.countback[i]) return a.countback[i] - b.countback[i];
    return 0;
  });
  return rows;
}

export function buildRoadBoard(users, rounds, config) {
  return users
    .map((u) => {
      const hcp = calcHandicap(u, rounds, config).value;
      const { total, used } = bestPointsTotal(u.id, rounds, hcp, 3);
      return {
        user: u,
        count: approvedQualifying(rounds, u.id).length,
        hcp,                 // declared (appointed) index — what road rounds are scored off
        open: openIndexFor(u, rounds, config), // { base, adjust, value, total, perRound }
        points: total,       // sum of the 3 best rounds' Stableford points
        pointsUsed: used,    // how many rounds went into that total (0–3)
        qualified: isQualified(u, rounds, config),
      };
    })
    // Rank: most Stableford points first, then lowest handicap, then name.
    .sort((a, b) =>
      (b.points - a.points) ||
      ((a.hcp ?? 99) - (b.hcp ?? 99)) ||
      a.user.name.localeCompare(b.user.name)
    );
}
