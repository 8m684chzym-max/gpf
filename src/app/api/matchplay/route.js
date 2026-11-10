import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { logAudit } from "@/lib/data";

export const dynamic = "force-dynamic";

const include = {
  course: { select: { id: true, name: true } },
  playerA: { select: { id: true, name: true } },
  playerB: { select: { id: true, name: true } },
};

// All match play results (newest first). Confirmed ones feed the Individual league.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const matches = await prisma.matchPlay.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 300, include });
  return NextResponse.json({ matches, me: user.id, isAdmin: user.role === "ADMIN" });
}

// Register a match: the caller is player A; the opponent (player B) confirms it.
export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json();
  if (!b.opponentId || !b.courseId || !b.date) return NextResponse.json({ error: "Pick an opponent, a course and a date." }, { status: 400 });
  if (b.opponentId === user.id) return NextResponse.json({ error: "Pick another member as your opponent." }, { status: 400 });
  if (!["WIN", "LOSS", "HALVED"].includes(b.outcome)) return NextResponse.json({ error: "Choose the result: won, halved or lost." }, { status: 400 });
  const date = new Date(b.date);
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "That date isn't valid." }, { status: 400 });
  if (date > new Date(Date.now() + 864e5)) return NextResponse.json({ error: "The date can't be in the future." }, { status: 400 });
  const [opp, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: b.opponentId }, select: { id: true, name: true, approved: true } }),
    prisma.course.findUnique({ where: { id: b.courseId }, select: { id: true } }),
  ]);
  if (!opp?.approved) return NextResponse.json({ error: "That member can't be found." }, { status: 400 });
  if (!course) return NextResponse.json({ error: "That course can't be found." }, { status: 400 });
  const margin = typeof b.margin === "string" ? b.margin.trim().slice(0, 12) : "";
  const result = b.outcome === "HALVED" ? "HALVED" : b.outcome === "WIN" ? "A" : "B";
  const m = await prisma.matchPlay.create({
    data: { date, courseId: course.id, playerAId: user.id, playerBId: opp.id, result, margin: result === "HALVED" ? null : margin || null },
    include,
  });
  await logAudit(user.name, "matchplay.register", m.id, `${user.name} v ${opp.name}: ${result === "HALVED" ? "halved" : result === "A" ? `${user.name} won` : `${opp.name} won`}${m.margin ? ` ${m.margin}` : ""}`);
  return NextResponse.json({ ok: true, match: m });
}
