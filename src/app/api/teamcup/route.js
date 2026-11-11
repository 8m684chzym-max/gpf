// Team Cup (Warriors vs Patuas) — season-long 1v1 match play between the two teams.
//   GET  → rosters, cup matches, my team
//   POST → register a result (player vs a member of the other team). Admins may
//          register for anyone; their entries are confirmed straight away.
//   PUT  → admin: set the rosters { teams: [[userId…], [userId…]] }
// Confirm / withdraw / delete go through /api/matchplay/[id] (same flow as Play › Match play).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/guard";
import { logAudit } from "@/lib/data";
import { calcHandicap } from "@/lib/scoring";
import { TC_CUP, TC_ROSTER_KEY, TC_TOTAL, TC_PAIR_MAX, teamOf, pairKey, pairCounts } from "@/lib/teamcup";
import { TM_TYPE } from "@/lib/teammatch";

export const dynamic = "force-dynamic";

const include = {
  course: { select: { id: true, name: true } },
  playerA: { select: { id: true, name: true } },
  playerB: { select: { id: true, name: true } },
};

// Rosters: the saved setting, else the line-up of the Open-day team match
// (even seats = first team, odd seats = second team).
async function loadRoster() {
  const s = await prisma.shopSetting.findUnique({ where: { key: TC_ROSTER_KEY } });
  if (s) { try { const v = JSON.parse(s.value); if (Array.isArray(v?.teams) && v.teams.length === 2) return v.teams; } catch { /* fall through */ } }
  const g = await prisma.sideGame.findFirst({ where: { type: TM_TYPE }, orderBy: { createdAt: "desc" }, include: { players: { orderBy: { position: "asc" } } } });
  if (!g) return [[], []];
  const t = [[], []];
  for (const p of g.players) if (p.userId) t[p.position % 2].push(p.userId);
  return t;
}

const cupMatches = () => prisma.matchPlay.findMany({ where: { cup: TC_CUP }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], include });

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [roster, matches] = await Promise.all([loadRoster(), cupMatches()]);
  const isAdmin = user.role === "ADMIN";
  const users = await prisma.user.findMany({
    where: isAdmin ? { approved: true } : { id: { in: roster.flat() } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, declaredHandicap: true, manualHandicap: true },
  });
  const person = (u) => ({ id: u.id, name: u.name, hcp: calcHandicap(u).value });
  const byId = new Map(users.map((u) => [u.id, u]));
  const teams = roster.map((ids) => ids.map((id) => byId.get(id)).filter(Boolean).map(person));
  return NextResponse.json({
    roster, teams, matches, me: user.id, isAdmin, myTeam: teamOf(roster, user.id),
    members: isAdmin ? users.filter((u) => u.role === "MEMBER").map(person) : undefined,
  });
}

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = user.role === "ADMIN";
  const b = await req.json();
  const roster = await loadRoster();
  const aId = isAdmin && b.playerAId ? b.playerAId : user.id;
  const bId = b.opponentId;
  const ta = teamOf(roster, aId), tb = teamOf(roster, bId);
  if (ta < 0) return NextResponse.json({ error: isAdmin ? "Pick a player from one of the teams." : "Only Team Cup players can enter a result." }, { status: 403 });
  if (tb < 0 || tb === ta) return NextResponse.json({ error: "Your opponent must be on the other team." }, { status: 400 });
  if (!b.courseId || !b.date) return NextResponse.json({ error: "Pick a course and a date." }, { status: 400 });
  if (!["WIN", "LOSS", "HALVED"].includes(b.outcome)) return NextResponse.json({ error: "Choose the result: won, halved or lost." }, { status: 400 });
  const date = new Date(b.date);
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "That date isn't valid." }, { status: 400 });
  if (date > new Date(Date.now() + 864e5)) return NextResponse.json({ error: "The date can't be in the future." }, { status: 400 });
  const course = await prisma.course.findUnique({ where: { id: b.courseId }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "That course can't be found." }, { status: 400 });

  const matches = await cupMatches();
  if (matches.length >= TC_TOTAL) return NextResponse.json({ error: `All ${TC_TOTAL} Team Cup matches have been played.` }, { status: 400 });
  if ((pairCounts(matches).get(pairKey(aId, bId)) || 0) >= TC_PAIR_MAX)
    return NextResponse.json({ error: `These two have already met ${TC_PAIR_MAX} times — pick another opponent.` }, { status: 400 });

  const margin = typeof b.margin === "string" ? b.margin.trim().slice(0, 12) : "";
  const result = b.outcome === "HALVED" ? "HALVED" : b.outcome === "WIN" ? "A" : "B";
  const byAdmin = isAdmin && aId !== user.id;
  const m = await prisma.matchPlay.create({
    data: {
      cup: TC_CUP, date, courseId: course.id, playerAId: aId, playerBId: bId, result, margin: result === "HALVED" ? null : margin || null,
      ...(byAdmin ? { status: "CONFIRMED", confirmedBy: user.name, confirmedAt: new Date() } : {}),
    },
    include,
  });
  await logAudit(user.name, "teamcup.register", m.id, `${m.playerA.name} v ${m.playerB.name}: ${result}${m.margin ? ` ${m.margin}` : ""}`);
  return NextResponse.json({ ok: true, match: m });
}

export async function PUT(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = await req.json();
  const teams = Array.isArray(b.teams) && b.teams.length === 2 ? b.teams.map((t) => [...new Set((t || []).filter((x) => typeof x === "string"))]) : null;
  if (!teams) return NextResponse.json({ error: "Two teams expected." }, { status: 400 });
  if (teams[0].some((id) => teams[1].includes(id))) return NextResponse.json({ error: "A player can only be on one team." }, { status: 400 });
  const value = JSON.stringify({ teams });
  await prisma.shopSetting.upsert({ where: { key: TC_ROSTER_KEY }, update: { value }, create: { key: TC_ROSTER_KEY, value } });
  await logAudit(admin.name, "teamcup.roster", null, value);
  return NextResponse.json({ ok: true });
}
