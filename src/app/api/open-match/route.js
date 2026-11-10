// GPF Open side game — Team match play (2 teams · 3 groups of 4 · six 1v1 net matches).
// Stored on the existing SideGame tables (type "teammatch"); see src/lib/teammatch.js.
//   GET    → the match for the active year (+ setup data for admins)
//   POST   → admin: create / update line-ups, team names, tee, playing handicaps
//   PATCH  → { player, hole, gross } — a player scores themselves (or a group-mate / admin corrects)
//   DELETE → admin: remove the match
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/guard";
import { getActiveCompetition, configFrom, getScopedRounds, logAudit } from "@/lib/data";
import { openIndexFor, openPlayingHandicap, roadBonusMap, netOf } from "@/lib/scoring";
import { MAJOR } from "@/lib/major";
import { TM_TYPE, TM_PLAYERS, META_HOLE, scoreHole, parseScoreHole, groupOf } from "@/lib/teammatch";

export const dynamic = "force-dynamic";

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const include = { players: { orderBy: { position: "asc" } }, holes: true };

async function findMatch(year) {
  const games = await prisma.sideGame.findMany({ where: { type: TM_TYPE }, orderBy: { createdAt: "desc" }, include });
  return games.find((g) => g.holes.find((h) => h.hole === META_HOLE)?.data?.year === year) || null;
}

async function majorTees() {
  const courses = await prisma.course.findMany({ include: { tees: true } });
  const c = courses.find((x) => norm(x.name) === norm(MAJOR.course));
  return c ? c.tees.sort((a, b) => (b.slope ?? 0) - (a.slope ?? 0)) : [];
}

function shape(g) {
  const meta = g.holes.find((h) => h.hole === META_HOLE)?.data || {};
  const scores = Array.from({ length: TM_PLAYERS }, () => Array.from({ length: 18 }, () => null));
  for (const h of g.holes) {
    const p = parseScoreHole(h.hole);
    if (p && Number.isFinite(h.data?.gross)) scores[p.player][p.hole - 1] = h.data.gross;
  }
  return {
    id: g.id, status: g.status, updatedAt: g.updatedAt,
    teams: meta.teams || ["Team A", "Team B"],
    tee: meta.tee || null, si: meta.si || [], par: meta.par || [], ph: meta.ph || [],
    players: g.players.map((p) => ({ name: p.name, userId: p.userId })),
    scores,
  };
}

// Medal net per player for the tie-break: the official GPF Open card when approved,
// otherwise the 18 grosses entered here − playing handicap − road bonus.
async function medalNets(match, comp, config) {
  const rounds = await getScopedRounds(comp.id);
  const members = await prisma.user.findMany({ where: { role: "MEMBER", approved: true }, select: { id: true, name: true, declaredHandicap: true, manualHandicap: true } });
  const bonus = roadBonusMap(members, rounds, config);
  const ids = match.players.map((p) => p.userId).filter(Boolean);
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, declaredHandicap: true, manualHandicap: true } });
  return match.players.map((p, i) => {
    const b = bonus.get(p.userId) ?? 0;
    const u = users.find((x) => x.id === p.userId);
    const r1 = u && rounds.find((r) => r.userId === u.id && r.type === "WEEKEND" && r.roundNo === 1 && r.status === "APPROVED");
    if (r1) {
      const ph = openPlayingHandicap(openIndexFor(u, rounds, config).value, r1.tee, config);
      const n = netOf(r1.gross, ph);
      if (n != null) return { net: n - b, source: "card" };
    }
    const grosses = match.scores[i];
    if (grosses.every((x) => x != null) && match.ph[i] != null)
      return { net: grosses.reduce((s, x) => s + x, 0) - match.ph[i] - b, source: "app" };
    return { net: null, source: null };
  });
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const comp = await getActiveCompetition();
  if (!comp) return NextResponse.json({ match: null });
  const config = configFrom(comp);
  const g = await findMatch(comp.year);
  const match = g ? shape(g) : null;
  if (match) match.nets = await medalNets(match, comp, config);

  let setup = null;
  if (user.role === "ADMIN") {
    const rounds = await getScopedRounds(comp.id);
    const users = await prisma.user.findMany({ where: { approved: true }, orderBy: { name: "asc" }, select: { id: true, name: true, declaredHandicap: true, manualHandicap: true } });
    const tees = await majorTees();
    setup = {
      config,
      tees: tees.map((t) => ({ id: t.id, name: t.name, par: t.par, rating: t.rating, slope: t.slope, strokeIndex: t.strokeIndex })),
      candidates: users.map((u) => ({ id: u.id, name: u.name, openIndex: openIndexFor(u, rounds, config).value })),
    };
  }
  return NextResponse.json({ match, setup, year: comp.year, isAdmin: user.role === "ADMIN", me: user.id });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const comp = await getActiveCompetition();
  if (!comp) return NextResponse.json({ error: "No active competition." }, { status: 400 });
  const b = await req.json();

  const players = Array.isArray(b.players) ? b.players : [];
  if (players.length !== TM_PLAYERS || players.some((p) => !p?.userId))
    return NextResponse.json({ error: `Pick all ${TM_PLAYERS} players.` }, { status: 400 });
  if (new Set(players.map((p) => p.userId)).size !== TM_PLAYERS)
    return NextResponse.json({ error: "A player can only be in one match." }, { status: 400 });
  const ph = players.map((p) => (p.ph === "" || p.ph == null || !Number.isFinite(Number(p.ph)) ? null : Math.round(Number(p.ph))));
  if (ph.some((x) => x == null)) return NextResponse.json({ error: "Every player needs a playing handicap." }, { status: 400 });

  const tee = (await majorTees()).find((t) => t.id === b.teeId);
  if (!tee) return NextResponse.json({ error: "Pick the tee." }, { status: 400 });
  if (!Array.isArray(tee.strokeIndex) || tee.strokeIndex.length !== 18)
    return NextResponse.json({ error: `${MAJOR.course} ${tee.name} has no stroke index — run npm run add-pinheirinho.` }, { status: 400 });

  const users = await prisma.user.findMany({ where: { id: { in: players.map((p) => p.userId) } }, select: { id: true, name: true } });
  if (users.length !== TM_PLAYERS) return NextResponse.json({ error: "Unknown player." }, { status: 400 });
  const teams = [0, 1].map((i) => String(b.teams?.[i] || `Team ${"AB"[i]}`).trim().slice(0, 24) || `Team ${"AB"[i]}`);
  const meta = { year: comp.year, teams, tee: tee.name, si: tee.strokeIndex, par: tee.holePars?.length === 18 ? tee.holePars : [], ph };
  const rows = players.map((p, i) => ({ position: i, userId: p.userId, name: users.find((u) => u.id === p.userId).name.slice(0, 40) }));

  const existing = await findMatch(comp.year);
  let id;
  if (existing) {
    // Line-up edits keep any scores already entered (they belong to the seat, 0–11).
    await prisma.$transaction([
      prisma.sideGamePlayer.deleteMany({ where: { gameId: existing.id } }),
      prisma.sideGamePlayer.createMany({ data: rows.map((r) => ({ ...r, gameId: existing.id })) }),
      prisma.sideGameHole.update({ where: { gameId_hole: { gameId: existing.id, hole: META_HOLE } }, data: { data: meta } }),
      prisma.sideGame.update({ where: { id: existing.id }, data: { updatedAt: new Date() } }),
    ]);
    id = existing.id;
  } else {
    const code = `T${String(comp.year).slice(-2)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
    const g = await prisma.sideGame.create({
      data: { code, type: TM_TYPE, status: "ACTIVE", createdById: admin.id, players: { create: rows }, holes: { create: [{ hole: META_HOLE, data: meta }] } },
    });
    id = g.id;
  }
  await logAudit(admin.name, existing ? "teammatch.update" : "teammatch.create", id, `${teams.join(" v ")} · ${tee.name}`);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const comp = await getActiveCompetition();
  const g = comp && (await findMatch(comp.year));
  if (!g) return NextResponse.json({ error: "No team match set up." }, { status: 404 });
  const b = await req.json();

  if (b.status === "FINISHED" || b.status === "ACTIVE") {
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });
    await prisma.sideGame.update({ where: { id: g.id }, data: { status: b.status } });
    return NextResponse.json({ ok: true });
  }
  if (g.status === "FINISHED") return NextResponse.json({ error: "The match is closed." }, { status: 403 });

  const player = Number(b.player), hole = Number(b.hole);
  if (!(player >= 0 && player < TM_PLAYERS) || !(hole >= 1 && hole <= 18))
    return NextResponse.json({ error: "Bad player or hole." }, { status: 400 });
  const gross = b.gross == null || b.gross === "" ? null : Math.round(Number(b.gross));
  if (gross != null && !(gross >= 1 && gross <= 15)) return NextResponse.json({ error: "Scores must be 1–15." }, { status: 400 });

  // Who may write: the player themselves, anyone in their group (the marker), or an admin.
  const mine = g.players.findIndex((p) => p.userId === user.id);
  const allowed = user.role === "ADMIN" || mine === player || (mine >= 0 && groupOf(mine) === groupOf(player));
  if (!allowed) return NextResponse.json({ error: "You can only score your own group." }, { status: 403 });

  const key = scoreHole(player, hole);
  if (gross == null) await prisma.sideGameHole.deleteMany({ where: { gameId: g.id, hole: key } });
  else await prisma.sideGameHole.upsert({
    where: { gameId_hole: { gameId: g.id, hole: key } },
    create: { gameId: g.id, hole: key, data: { gross, by: user.name } },
    update: { data: { gross, by: user.name } },
  });
  await prisma.sideGame.update({ where: { id: g.id }, data: { updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const comp = await getActiveCompetition();
  const g = comp && (await findMatch(comp.year));
  if (g) {
    await prisma.sideGame.delete({ where: { id: g.id } });
    await logAudit(admin.name, "teammatch.delete", g.id, "");
  }
  return NextResponse.json({ ok: true });
}
