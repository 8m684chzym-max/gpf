// Pure scoring engine — shared by server (API routes) and client.
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

export function netOf(gross, ph) {
  return gross == null || ph == null ? null : gross - ph;
}

export function back9(holes) {
  return !holes || holes.length < 18 ? null : holes.slice(9, 18).reduce((s, x) => s + (Number(x) || 0), 0);
}

export function approvedQualifying(rounds, userId) {
  return rounds.filter((r) => r.userId === userId && r.type === "QUALIFYING" && r.status === "APPROVED");
}

// Calculate WHS Score Differential: (113 / Slope) × (Gross - Course Rating)
// For rounds without rating/slope data, use conservative defaults (par, slope 113).
export function scoreD(gross, courseRating, slope) {
  const rating = courseRating ?? 72;
  const s = slope ?? 113;
  return (113 / s) * (gross - rating);
}

// WHS Index from qualifying rounds: average of the best 3 score differentials
// (or fewer if not enough rounds). Each differential uses the played tee's
// Course Rating and Slope — so the tee mark directly affects the handicap.
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

// Handicap precedence:
//   1. Committee manual override (manualHandicap) — always wins.
//   2. Once the player has the required number of qualifying rounds, the WHS
//      index computed from results takes over.
//   3. Until then, the player's self-declared starting index is provisional.
//   4. If there's no declared index but some rounds exist, show a provisional
//      WHS index from whatever rounds are available.
export function calcHandicap(user, rounds, config) {
  if (user.manualHandicap != null) return { value: Number(user.manualHandicap), manual: true, source: "manual" };
  const qs = approvedQualifying(rounds, user.id);
  const required = config?.qualifyingRoundsRequired ?? 3;

  if (qs.length >= required) return { value: whsIndex(qs), manual: false, source: "results" };
  if (user.declaredHandicap != null) return { value: Number(user.declaredHandicap), manual: false, source: "declared", provisional: true };
  if (qs.length > 0) return { value: whsIndex(qs), manual: false, source: "results", provisional: true };
  return { value: null, manual: false, source: "none" };
}

// WHS Course Handicap on a given tee: Index × (Slope / 113) + (Rating − Par), rounded.
export function courseHandicapFor(index, tee) {
  if (index == null || !tee) return null;
  const slope = tee.slope ?? 113;
  const rating = tee.rating ?? tee.par ?? 72;
  const par = tee.par ?? 72;
  return Math.round(index * (slope / 113) + (rating - par));
}

// Net Stableford estimate when the scorecard didn't carry a points total.
// Playing to your Course Handicap is worth 36 pts; each net stroke better/worse
// is ≈ ±1 pt, so points ≈ 36 + CourseHandicap + Par − Gross (floored at 0).
export function estimateStableford(round, index) {
  const tee = round.tee;
  const ch = courseHandicapFor(index, tee);
  if (ch == null || round.gross == null || !tee) return null;
  const par = tee.par ?? 72;
  return Math.max(0, Math.round(36 + ch + par - round.gross));
}

// Stableford points for a round: the card's value if present, else a WHS estimate.
export function roundPoints(round, index) {
  if (round.points != null) return Number(round.points);
  return estimateStableford(round, index);
}

// Total Stableford points across a player's best `n` qualifying rounds.
export function bestPointsTotal(userId, rounds, index, n = 3) {
  const pts = approvedQualifying(rounds, userId)
    .map((r) => roundPoints(r, index))
    .filter((p) => p != null)
    .sort((a, b) => b - a)
    .slice(0, n);
  return { total: pts.reduce((s, x) => s + x, 0), used: pts.length };
}

export function isQualified(user, rounds, config) {
  return approvedQualifying(rounds, user.id).length >= (config?.qualifyingRoundsRequired ?? 3);
}

// GPF Open: Medal Net at the configured allowance, two rounds added.
export function buildFinalBoard(users, rounds, config) {
  const rows = users.map((u) => {
    const hcp = calcHandicap(u, rounds, config).value;
    const ph = playingHandicap(hcp, config);
    const r1 = rounds.find((r) => r.userId === u.id && r.type === "WEEKEND" && r.roundNo === 1 && r.status === "APPROVED");
    const r2 = rounds.find((r) => r.userId === u.id && r.type === "WEEKEND" && r.roundNo === 2 && r.status === "APPROVED");
    const net1 = r1 ? netOf(r1.gross, ph) : null;
    const net2 = r2 ? netOf(r2.gross, ph) : null;
    const total = net1 != null && net2 != null ? net1 + net2 : null;
    return { user: u, hcp, ph, net1, net2, total, finalBack9: r2 ? back9(r2.holes) : null, manualTiebreak: u.tiebreakOverride ?? 0 };
  }).filter((row) => row.net1 != null || row.net2 != null);

  rows.sort((a, b) => {
    if (a.total == null && b.total == null) return 0;
    if (a.total == null) return 1;
    if (b.total == null) return -1;
    if (a.total !== b.total) return a.total - b.total;
    if (config?.tiebreak === "back9") return (a.finalBack9 ?? 999) - (b.finalBack9 ?? 999);
    if (config?.tiebreak === "manual") return a.manualTiebreak - b.manualTiebreak;
    return (a.net2 ?? 999) - (b.net2 ?? 999); // final-net default
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
        hcp,
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
