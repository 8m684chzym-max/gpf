// A round played hole by hole on a mapped course (Play › Start play), for up to 4 players:
// you (always player 0) plus GPF members and/or guests. Lives on this phone (localStorage)
// while it's being played, so a screen lock or a dead signal never loses a score. On Finish
// YOUR card is submitted as a qualifying round (POST /api/rounds), witnessed by a member
// in the group. The other players' cards are for live scoring (Stableford, strokeplay, net,
// match play) only. Independent of the Team Cup.
import { courseHandicapFor, strokesOnHole } from "@/lib/scoring";
import { courseMapFor, DEFAULT_COURSE } from "@/lib/holes";

const KEY = "gpf-live-round-v1";
export const CARD_HOLES = 18;
export const MAX_PLAYERS = 4;
const blankHoles = () => Array(CARD_HOLES).fill(null);

// Older rounds on a phone were single-player ({ hcp, holes, partnerId }): lift them into players[].
function normalize(r) {
  if (!r) return null;
  if (Array.isArray(r.players) && r.players.length) return r;
  if (!Array.isArray(r.holes)) return null;
  const players = [{ name: r.meName || "You", memberId: null, me: true, hcp: r.hcp ?? null, holes: r.holes }];
  if (r.partnerId) players.push({ name: r.partnerName || "Partner", memberId: r.partnerId, hcp: null, holes: blankHoles() });
  const { holes, hcp, ...rest } = r;
  return { ...rest, players, witnessId: r.partnerId || null, witnessName: r.partnerName || null };
}

export function loadLive() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { return null; }
}
export function saveLive(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* private mode */ } }
export function clearLive() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

// Par / stroke index per hole: the tee's own data when the course has it, else the map's.
const mapHoles = (r) => (courseMapFor(r?.courseName) || DEFAULT_COURSE).holes;
// Map hole for card hole i (0-based): on a 9-hole course the second loop is holes 1–9 again.
export const mapHoleOf = (r, i) => { const h = mapHoles(r); return h[i % h.length]; };
export const parOf = (r, i) => r?.tee?.holePars?.[i] ?? mapHoleOf(r, i)?.par ?? 4;
export const siOf = (r, i) => r?.tee?.strokeIndex?.[i] ?? mapHoleOf(r, i)?.si ?? i + 1;

// players: [{ name, memberId|null, hcp }] — first entry is you.
export function newLive({ course, tee, players, witness, date }) {
  return {
    courseId: course.id, courseName: course.name,
    teeId: tee.id, teeName: tee.name,
    tee: { par: tee.par, rating: tee.rating, slope: tee.slope, holePars: tee.holePars, strokeIndex: tee.strokeIndex },
    players: players.slice(0, MAX_PLAYERS).map((p, i) => ({
      name: p.name, memberId: p.memberId || null, me: i === 0,
      hcp: p.hcp == null || p.hcp === "" ? null : Number(p.hcp), holes: blankHoles(),
    })),
    witnessId: witness?.id || null, witnessName: witness?.name || null,
    date, startedAt: new Date().toISOString(),
  };
}

export const playerOf = (r, p = 0) => r?.players?.[p];
export const holesOf = (r, p = 0) => playerOf(r, p)?.holes || blankHoles();
export const setStroke = (r, p, i, v) => ({
  ...r, players: r.players.map((pl, j) => (j === p ? { ...pl, holes: pl.holes.map((x, k) => (k === i ? v : x)) } : pl)),
});

export const courseHcp = (r, p = 0) => { const h = playerOf(r, p)?.hcp; return h == null ? null : courseHandicapFor(h, r.tee); };
export const strokesOn = (r, i, p = 0) => { const ch = courseHcp(r, p); return ch == null ? 0 : strokesOnHole(siOf(r, i), ch); };

// Stableford points on hole i (null when not played yet).
export function holePoints(r, i, p = 0) {
  const s = holesOf(r, p)[i];
  if (!s) return null;
  return Math.max(0, 2 + parOf(r, i) + strokesOn(r, i, p) - s);
}
// Net strokes on hole i (gross − strokes received).
export function holeNet(r, i, p = 0) {
  const s = holesOf(r, p)[i];
  return s ? s - strokesOn(r, i, p) : null;
}

// Totals over the holes played so far. toPar / netToPar compare against the par of those holes.
export function totals(r, p = 0) {
  let gross = 0, points = 0, played = 0, par = 0, net = 0;
  holesOf(r, p).forEach((s, i) => {
    if (!s) return;
    gross += s; played += 1; par += parOf(r, i);
    points += holePoints(r, i, p) ?? 0; net += holeNet(r, i, p);
  });
  return { gross, points, played, par, net, toPar: gross - par, netToPar: net - par };
}

// ── Match play ──
// Formats for the players in the group (indices into players[]):
//   singles  [a] v [b]      — 100% of course handicap, strokes off the lower
//   fourball [a,b] v [c,d]  — better ball, 90% of course handicap, strokes off the lowest of the four
// (WHS Appendix C recommended allowances.)
export function matchFormats(n) {
  const out = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) out.push({ id: `s${a}${b}`, kind: "singles", A: [a], B: [b] });
  if (n === 4) for (const [a, b, c, d] of [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]]) out.push({ id: `f${a}${b}${c}${d}`, kind: "fourball", A: [a, b], B: [c, d] });
  return out;
}

// Returns { up, thru, holes: [{ win: "A"|"B"|"H"|null, net: { [p]: n } }], done, winner, label, rx: { [p]: strokes } }
//   up > 0 = side A leads. A hole counts once every player in the match has a score on it.
export function matchState(r, fmt) {
  const ids = [...fmt.A, ...fmt.B];
  const allow = fmt.kind === "fourball" ? 0.9 : 1;
  const ph = Object.fromEntries(ids.map((p) => [p, courseHcp(r, p) == null ? 0 : Math.round(courseHcp(r, p) * allow)]));
  const low = Math.min(...ids.map((p) => ph[p]));
  const rx = Object.fromEntries(ids.map((p) => [p, ph[p] - low]));
  let up = 0, thru = 0, done = false, closedAt = null;
  const holes = [];
  for (let i = 0; i < CARD_HOLES; i++) {
    const net = {};
    let all = true;
    for (const p of ids) {
      const s = holesOf(r, p)[i];
      if (!s) { all = false; continue; }
      net[p] = s - strokesOnHole(siOf(r, i), rx[p]);
    }
    let win = null;
    if (all && !done) {
      const best = (side) => Math.min(...side.map((p) => net[p]));
      const a = best(fmt.A), b = best(fmt.B);
      win = a < b ? "A" : b < a ? "B" : "H";
      if (win === "A") up++; else if (win === "B") up--;
      thru = i + 1;
      if (Math.abs(up) > CARD_HOLES - thru) { done = true; closedAt = thru; }
    }
    holes.push({ win, net });
  }
  if (!done && thru === CARD_HOLES) done = true;
  const left = CARD_HOLES - thru;
  let winner = null, label;
  if (done) {
    winner = up > 0 ? "A" : up < 0 ? "B" : "H";
    if (winner === "H") label = "Halved";
    else { const m = Math.abs(up), rem = CARD_HOLES - (closedAt ?? CARD_HOLES); label = rem > 0 ? `${m}&${rem}` : `${m} UP`; }
  } else if (thru === 0) label = "Not started";
  else if (up === 0) label = `All square thru ${thru}`;
  else label = `${Math.abs(up)} UP thru ${thru}${Math.abs(up) === left ? " · dormie" : ""}`;
  return { up, thru, holes, done, winner, label, rx };
}
