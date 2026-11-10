// Individual league (formerly the side-games "Points League").
// Two sources of points, one season-long ladder:
//   • side games (Wolf, Round Robin, Bingo Bango Bongo): 4 / 3 / 2 / 1 by finishing position
//   • 1v1 match play (confirmed results only): win 1, halved ½, loss 0
// Independent of Rank (qualifying rounds), the GPF Open and the Team Cup.
import { holesPlayed, standings } from "@/lib/games";

export const GAME_POS_POINTS = [4, 3, 2, 1];
export const MATCH_POINTS = { win: 1, halved: 0.5, loss: 0 };

export function buildIndividualLeague(finishedGames = [], matches = []) {
  const agg = new Map();
  const row = (key, name) => {
    const cur = agg.get(key) || { name, points: 0, games: 0, gameWins: 0, matches: 0, w: 0, d: 0, l: 0 };
    cur.name = name || cur.name;
    agg.set(key, cur);
    return cur;
  };

  for (const g of finishedGames) {
    if (holesPlayed(g) === 0) continue;
    const board = standings(g);
    if (!board.length || board[0].points <= 0) continue;
    board.forEach((p) => {
      const rank = board.filter((q) => q.points > p.points).length;
      const r = row(p.userId || `guest:${p.name.toLowerCase()}`, p.name);
      r.points += GAME_POS_POINTS[rank] ?? 0; r.games += 1; if (rank === 0) r.gameWins += 1;
    });
  }

  for (const m of matches) {
    if (m.status !== "CONFIRMED") continue;
    const a = row(m.playerAId, m.playerA?.name), b = row(m.playerBId, m.playerB?.name);
    a.matches += 1; b.matches += 1;
    if (m.result === "HALVED") { a.d += 1; b.d += 1; a.points += MATCH_POINTS.halved; b.points += MATCH_POINTS.halved; }
    else {
      const [w, l] = m.result === "A" ? [a, b] : [b, a];
      w.w += 1; l.l += 1; w.points += MATCH_POINTS.win;
    }
  }

  return [...agg.values()].sort((x, y) => y.points - x.points || (y.w + y.gameWins) - (x.w + x.gameWins) || x.name.localeCompare(y.name));
}

export const fmtPts = (n) => (Number.isInteger(n) ? String(n) : `${Math.floor(n) || ""}½`);
