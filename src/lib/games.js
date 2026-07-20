// src/lib/games.js — GPF side games (Wolf · Round Robin · Bingo Bango Bongo)
//
// These are casual on-course games. NOTHING here touches the Road to GPF Open
// standings, competition handicaps, or the rounds database. All state lives in
// the scorer's browser (localStorage), so a game survives a screen-lock or
// refresh and can be resumed — but it never leaves the device.

export const HOLES = 18;

export const GAMES = {
  wolf: {
    key: "wolf",
    name: "Wolf",
    min: 4, max: 4,
    blurb: "A rotating 'Wolf' each hole picks a partner after the tee shots — or braves it alone for more points.",
    ordered: true, // tee order matters (Wolf rotates through it)
  },
  roundrobin: {
    key: "roundrobin",
    name: "Round Robin",
    min: 4, max: 4,
    blurb: "Better-ball where partners rotate every 6 holes, so everyone pairs with everyone once.",
    ordered: true,
  },
  bbb: {
    key: "bbb",
    name: "Bingo Bango Bongo",
    min: 2, max: 6,
    blurb: "Three points a hole: first on the green, closest once all are on, first in the cup.",
    ordered: false,
  },
};

// Points schemes — kept here so they're trivial to tweak later.
export const WOLF_PTS = {
  partnerWin: 1,     // each winner in a 2v2 hole
  loneWin: 3,        // Lone Wolf beats the field
  loneLossEach: 1,   // each opponent when Lone Wolf loses
  blindWin: 4,       // Blind (declared before tee shots) Wolf wins
  blindLossEach: 1,  // each opponent when Blind Wolf loses
};
export const RR_WIN_PTS = 1; // per player on the winning side, per hole

// ---- storage -------------------------------------------------------------
const KEY = "gpf.sidegame.v1";
const canStore = () => typeof window !== "undefined" && !!window.localStorage;

export function loadGame() {
  if (!canStore()) return null;
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
export function saveGame(g) {
  if (!canStore()) return;
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* quota */ }
}
export function clearGame() {
  if (!canStore()) return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// ---- game construction ---------------------------------------------------
export function newGame(type, players) {
  return {
    type,
    players: players.map((p) => ({ id: p.id, name: p.name })),
    holes: Array.from({ length: HOLES }, () => null), // per-hole result objects
    hole: 1,
    createdAt: new Date().toISOString(),
  };
}

// ---- Wolf ----------------------------------------------------------------
// Wolf for a hole = the player at rotation position (hole-1) % players.length.
export function wolfIndexFor(game, hole) {
  return (hole - 1) % game.players.length;
}

// result shape: { mode: "partner"|"lone"|"blind", partner: idx|null,
//                 outcome: "win"|"loss"|"halve" }  (outcome from the WOLF side)
export function wolfHolePoints(game, hole) {
  const res = game.holes[hole - 1];
  const n = game.players.length;
  const pts = Array(n).fill(0);
  if (!res || !res.outcome) return pts;
  const w = wolfIndexFor(game, hole);
  const others = [...Array(n).keys()].filter((i) => i !== w);

  if (res.mode === "partner" && res.partner != null) {
    const team = [w, res.partner];
    const opp = others.filter((i) => i !== res.partner);
    if (res.outcome === "win") team.forEach((i) => (pts[i] += WOLF_PTS.partnerWin));
    else if (res.outcome === "loss") opp.forEach((i) => (pts[i] += WOLF_PTS.partnerWin));
  } else {
    const blind = res.mode === "blind";
    if (res.outcome === "win") pts[w] += blind ? WOLF_PTS.blindWin : WOLF_PTS.loneWin;
    else if (res.outcome === "loss")
      others.forEach((i) => (pts[i] += blind ? WOLF_PTS.blindLossEach : WOLF_PTS.loneLossEach));
  }
  return pts;
}

// ---- Round Robin ---------------------------------------------------------
// 6-6-6 rotation over 18 holes so each of the 4 pairs with each once.
export function rrTeams(hole) {
  if (hole <= 6) return [[0, 1], [2, 3]];
  if (hole <= 12) return [[0, 2], [1, 3]];
  return [[0, 3], [1, 2]];
}
export function rrHolePoints(game, hole) {
  const res = game.holes[hole - 1];
  const pts = Array(game.players.length).fill(0);
  if (!res || !res.winner || res.winner === "halve") return pts;
  const [A, B] = rrTeams(hole);
  (res.winner === "A" ? A : B).forEach((i) => (pts[i] += RR_WIN_PTS));
  return pts;
}

// ---- Bingo Bango Bongo ---------------------------------------------------
// result shape: { bingo: idx|null, bango: idx|null, bongo: idx|null }
export function bbbHolePoints(game, hole) {
  const res = game.holes[hole - 1];
  const pts = Array(game.players.length).fill(0);
  if (!res) return pts;
  ["bingo", "bango", "bongo"].forEach((k) => { if (res[k] != null) pts[res[k]] += 1; });
  return pts;
}

// ---- totals --------------------------------------------------------------
const HOLE_FN = { wolf: wolfHolePoints, roundrobin: rrHolePoints, bbb: bbbHolePoints };

export function totals(game) {
  const fn = HOLE_FN[game.type];
  const sums = Array(game.players.length).fill(0);
  for (let h = 1; h <= HOLES; h++) fn(game, h).forEach((v, i) => (sums[i] += v));
  return sums;
}

export function standings(game) {
  const sums = totals(game);
  return game.players
    .map((p, i) => ({ ...p, index: i, points: sums[i] }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

export function holesPlayed(game) {
  return game.holes.filter((h) => h && (h.outcome || h.winner || h.bingo != null || h.bango != null || h.bongo != null)).length;
}
