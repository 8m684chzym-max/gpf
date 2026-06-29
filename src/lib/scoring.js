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

// Manual override wins; else average of the best 3 qualifying differentials.
// Uses WHS Score Differential formula based on tee rating/slope if available.
export function calcHandicap(user, rounds, config) {
  if (user.manualHandicap != null) return { value: Number(user.manualHandicap), manual: true };
  const qs = approvedQualifying(rounds, user.id);
  if (qs.length === 0) return { value: null, manual: false };
  
  // Calculate score differentials for each qualifying round using WHS formula
  const diffs = qs.map((r) => {
    const courseRating = r.tee?.rating ?? r.parAtTee ?? 72;
    const slope = r.tee?.slope ?? 113;
    return scoreD(r.gross, courseRating, slope);
  }).sort((a, b) => a - b);
  
  const best = diffs.slice(0, Math.min(3, diffs.length));
  const avg = best.reduce((s, x) => s + x, 0) / best.length;
  return { value: Math.round(avg * 10) / 10, manual: false };
}

export function isQualified(user, rounds, config) {
  return approvedQualifying(rounds, user.id).length >= (config?.qualifyingRoundsRequired ?? 3);
}

// GPF Weekend: Medal Net at the configured allowance, two rounds added.
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
    .map((u) => ({
      user: u,
      count: approvedQualifying(rounds, u.id).length,
      hcp: calcHandicap(u, rounds, config).value,
      qualified: isQualified(u, rounds, config),
    }))
    .sort((a, b) => (b.qualified - a.qualified) || (b.count - a.count) || ((a.hcp ?? 99) - (b.hcp ?? 99)));
}
