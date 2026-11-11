// Team Cup — Warriors vs Patuas. Season-long 1v1 match play between the two teams.
//
//   · Pairings are free: any player challenges any player of the other team.
//   · The same pair can meet at most TC_PAIR_MAX times.
//   · TC_TOTAL points in play (1 a match, ½ a half); the first team to TC_TO_WIN wins.
//
// Results are MatchPlay rows with cup = TC_CUP (registered by a player, confirmed by the
// opponent — same flow as Play › Match play). The rosters live in ShopSetting under
// TC_ROSTER_KEY as { teams: [[userId…], [userId…]] }.
// Pure helpers, shared by the API route and the client.

export const TC_CUP = "teamcup";
export const TC_ROSTER_KEY = "teamcup.roster";
export const TC_TOTAL = 36;
export const TC_TO_WIN = TC_TOTAL / 2 + 0.5; // 18½
export const TC_PAIR_MAX = 3;

export const TC_TEAMS = [
  { key: "warriors", name: "Warriors", mascot: "Eagle", logo: "/teams/warriors.png", color: "#b3261e" },
  { key: "patuas", name: "Patuas", mascot: "Lion", logo: "/teams/patuas.png", color: "#2e6a4b" },
];

// Unordered pair key.
export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Which team (0 | 1) a user is on, or -1.
export const teamOf = (roster, userId) => (roster?.[0]?.includes(userId) ? 0 : roster?.[1]?.includes(userId) ? 1 : -1);

// Points per team from confirmed matches + per-player records.
//   roster: [[ids], [ids]]   matches: MatchPlay rows (any status)
export function cupScore(roster, matches) {
  const pts = [0, 0];
  const rec = new Map(); // userId → { w, d, l, pts, played }
  const r = (id) => { if (!rec.has(id)) rec.set(id, { w: 0, d: 0, l: 0, pts: 0, played: 0 }); return rec.get(id); };
  let confirmed = 0, pending = 0;
  for (const m of matches) {
    if (m.status !== "CONFIRMED") { pending++; continue; }
    const ta = teamOf(roster, m.playerAId), tb = teamOf(roster, m.playerBId);
    if (ta < 0 || tb < 0 || ta === tb) continue; // roster changed since — ignore
    confirmed++;
    const a = r(m.playerAId), b = r(m.playerBId);
    a.played++; b.played++;
    if (m.result === "HALVED") { pts[ta] += 0.5; pts[tb] += 0.5; a.d++; b.d++; a.pts += 0.5; b.pts += 0.5; }
    else {
      const [w, l, tw] = m.result === "A" ? [a, b, ta] : [b, a, tb];
      pts[tw] += 1; w.w++; l.l++; w.pts += 1;
    }
  }
  const winner = pts[0] >= TC_TO_WIN ? 0 : pts[1] >= TC_TO_WIN ? 1 : null;
  return { pts, rec, confirmed, pending, left: Math.max(0, TC_TOTAL - confirmed), winner };
}

// How many times each pair has been registered (pending + confirmed).
export function pairCounts(matches) {
  const c = new Map();
  for (const m of matches) { const k = pairKey(m.playerAId, m.playerBId); c.set(k, (c.get(k) || 0) + 1); }
  return c;
}

export const fmtPts = (x) => {
  const w = Math.floor(x), h = x - w >= 0.5;
  return h ? (w ? `${w}½` : "½") : String(w);
};
