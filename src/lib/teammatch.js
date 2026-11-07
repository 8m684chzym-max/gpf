// src/lib/teammatch.js — GPF Open side game: two teams, 1v1 net match play.
//
// Pure helpers shared by the API route and the client. Stored as a SideGame
// with type "teammatch" — no schema change:
//   · players: 12 SideGamePlayer rows, position = group*4 + slot
//       slot 0 = match 1 · team A   slot 1 = match 1 · team B
//       slot 2 = match 2 · team A   slot 3 = match 2 · team B
//   · meta:   SideGameHole row hole = 0 → { teams, tee, si, ph, year }
//   · scores: SideGameHole row hole = (player+1)*100 + h → { gross, by }
//     (one row per player per hole — every player scores themselves live and
//      nobody can overwrite a partner's entry by accident)
//
// Match play off the difference of the two GPF Open playing handicaps: the
// higher handicap gets the difference in strokes, allocated by stroke index.

import { strokesOnHole } from "./scoring";

export const TM_TYPE = "teammatch";
export const TM_GROUPS = 3;
export const TM_PER_GROUP = 4;
export const TM_PLAYERS = TM_GROUPS * TM_PER_GROUP; // 12
export const TM_MATCHES = TM_GROUPS * 2;             // 6
export const TM_TO_WIN = TM_MATCHES / 2 + 0.5;       // 3½
export const META_HOLE = 0;

export const scoreHole = (player, hole) => (player + 1) * 100 + hole;
export const parseScoreHole = (n) => {
  const player = Math.floor(n / 100) - 1, hole = n % 100;
  return player >= 0 && player < TM_PLAYERS && hole >= 1 && hole <= 18 ? { player, hole } : null;
};
export const groupOf = (player) => Math.floor(player / TM_PER_GROUP);

// The six matches, in group order. a / b are indices 0..11 into players.
export function matchList() {
  const out = [];
  for (let g = 0; g < TM_GROUPS; g++)
    for (let m = 0; m < 2; m++) out.push({ id: g * 2 + m, group: g, slotA: m * 2, slotB: m * 2 + 1, a: g * 4 + m * 2, b: g * 4 + m * 2 + 1 });
  return out;
}

// Strokes each side receives on a hole: [strokesA, strokesB].
export function holeStrokes(phA, phB, si) {
  if (phA == null || phB == null || si == null) return [0, 0];
  const diff = Math.round(phA) - Math.round(phB);
  return diff > 0 ? [strokesOnHole(si, diff), 0] : [0, strokesOnHole(si, -diff)];
}

// Full match state.
//   game: { ph: [12], si: [18], scores: [player][hole-1] → gross|null }
// Returns { up, thru, holes: [{hole, gA, gB, sA, sB, win}], done, winner, label, ptsA, ptsB }
//   up > 0 = A leads. win per hole: "A" | "B" | "H" | null (not both scored).
export function matchState(game, match) {
  const phA = game.ph?.[match.a], phB = game.ph?.[match.b];
  const rowA = game.scores?.[match.a] || [], rowB = game.scores?.[match.b] || [];
  let up = 0, thru = 0, done = false, closedAt = null;
  const holes = [];
  for (let h = 1; h <= 18; h++) {
    const gA = rowA[h - 1] ?? null, gB = rowB[h - 1] ?? null;
    const [sA, sB] = holeStrokes(phA, phB, game.si?.[h - 1]);
    let win = null;
    if (gA != null && gB != null && !done) {
      const nA = gA - sA, nB = gB - sB;
      win = nA < nB ? "A" : nB < nA ? "B" : "H";
      if (win === "A") up++; else if (win === "B") up--;
      thru = h;
      if (Math.abs(up) > 18 - h) { done = true; closedAt = h; }
    }
    holes.push({ hole: h, gA, gB, sA, sB, win });
  }
  if (!done && thru === 18) done = true;

  const left = 18 - thru;
  let winner = null, label, ptsA = 0, ptsB = 0;
  if (done) {
    winner = up > 0 ? "A" : up < 0 ? "B" : "H";
    if (winner === "H") { label = "Halved"; ptsA = ptsB = 0.5; }
    else {
      const margin = Math.abs(up), rem = 18 - (closedAt ?? 18);
      label = rem > 0 ? `${margin}&${rem}` : `${margin} UP`;
      if (winner === "A") ptsA = 1; else ptsB = 1;
    }
  } else if (thru === 0) label = "Not started";
  else if (up === 0) label = `AS thru ${thru}`;
  else label = `${Math.abs(up)} UP thru ${thru}${Math.abs(up) === left ? " · dormie" : ""}`;

  return { ...match, up, thru, holes, done, winner, label, ptsA, ptsB };
}

// Team score: closed matches only ("points"), plus a live projection where
// matches in progress count for whoever is leading (½ if all square).
export function teamScore(game) {
  const states = matchList().map((m) => matchState(game, m));
  let a = 0, b = 0, pa = 0, pb = 0;
  for (const s of states) {
    a += s.ptsA; b += s.ptsB;
    if (s.done) { pa += s.ptsA; pb += s.ptsB; }
    else if (s.thru > 0) { if (s.up > 0) pa += 1; else if (s.up < 0) pb += 1; else { pa += 0.5; pb += 0.5; } }
  }
  const allDone = states.every((s) => s.done);
  const winner = a >= TM_TO_WIN ? "A" : b >= TM_TO_WIN ? "B" : allDone ? "TIE" : null;
  return { states, a, b, projA: pa, projB: pb, allDone, winner };
}

// Tie-break at 3–3: lowest sum of the team's six medal nets wins.
// nets: [12] (null where unknown). Returns { sumA, sumB, complete, winner }.
export function medalTiebreak(nets) {
  const ms = matchList();
  const pick = (k) => ms.map((m) => nets?.[m[k]]);
  const A = pick("a"), B = pick("b");
  const complete = [...A, ...B].every((v) => v != null);
  const sum = (xs) => xs.reduce((s, v) => s + (v ?? 0), 0);
  const sumA = sum(A), sumB = sum(B);
  const winner = !complete ? null : sumA < sumB ? "A" : sumB < sumA ? "B" : "H";
  return { sumA, sumB, complete, winner };
}

export const fmtPts = (x) => {
  const w = Math.floor(x), h = x - w >= 0.5;
  return h ? (w ? `${w}½` : "½") : String(w);
};

// Live medal for one player: holes played, gross, and net against par so far,
// using the player's full playing handicap allocated by stroke index (the same
// PH as the medal; road bonus strokes come off at the end, on the official card).
export function liveMedal(game, i) {
  const row = game.scores?.[i] || [], ph = game.ph?.[i];
  let thru = 0, gross = 0, par = 0, rec = 0, last = 0;
  for (let h = 1; h <= 18; h++) {
    const g = row[h - 1];
    if (g == null) continue;
    thru++; last = h; gross += g;
    par += game.par?.[h - 1] ?? 4;
    if (ph != null && game.si?.[h - 1] != null) rec += strokesOnHole(game.si[h - 1], Math.round(ph));
  }
  return { thru, last, gross: thru ? gross : null, toPar: thru ? gross - rec - par : null, net18: thru === 18 && ph != null ? gross - ph : null };
}
export const fmtToPar = (x) => (x == null ? "—" : x === 0 ? "E" : x > 0 ? `+${x}` : String(x));
