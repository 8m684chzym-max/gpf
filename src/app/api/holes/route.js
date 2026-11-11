import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { courseBySlug, DEFAULT_COURSE } from "@/lib/holes";
import { distance } from "@/lib/geo";

export const dynamic = "force-dynamic";

// Shared tee / green positions for the hole map. Kept as audit-log entries
// (action "hole.geo", newest per hole wins) so corrections made on the course
// reach every player straight away, with who/when recorded, and no schema change.
// One map per course: ?course=<slug> (GET) / { course } (POST), default Pinheirinho.
// Entries are keyed "<course name>:<hole>".
const ACTION = "hole.geo";
const pick = (slug) => (slug ? courseBySlug(slug) : DEFAULT_COURSE);

const okPoint = (p, course) =>
  Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v)) &&
  distance(p, course.centre) < 25000; // must be somewhere near the course

export async function GET(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const course = pick(new URL(req.url).searchParams.get("course"));
  if (!course) return NextResponse.json({ error: "Unknown course" }, { status: 404 });
  const rows = await prisma.auditLog.findMany({
    where: { action: ACTION, targetId: { startsWith: `${course.name}:` } },
    orderBy: { createdAt: "asc" },
  });
  const holes = {};
  for (const r of rows) {
    const n = Number(r.targetId.split(":")[1]);
    let d; try { d = JSON.parse(r.details || "{}"); } catch { continue; }
    if (d.reset) { delete holes[n]; continue; }
    holes[n] = { ...(holes[n] || {}), ...d, by: r.actor, at: r.createdAt };
  }
  return NextResponse.json({ holes });
}

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const course = pick(b.course);
  if (!course) return NextResponse.json({ error: "Unknown course" }, { status: 404 });
  const n = Number(b.n);
  if (!Number.isInteger(n) || n < 1 || n > 18) return NextResponse.json({ error: "Bad hole number" }, { status: 400 });
  let details;
  if (b.reset) details = { reset: true };
  else {
    details = {};
    for (const k of ["tee", "green"]) {
      if (b[k] == null) continue;
      const p = b[k].map(Number);
      if (!okPoint(p, course)) return NextResponse.json({ error: `That ${k} is not on the course` }, { status: 400 });
      details[k] = [+p[0].toFixed(7), +p[1].toFixed(7)];
    }
    if (!Object.keys(details).length) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }
  await prisma.auditLog.create({ data: { actor: user.name, action: ACTION, targetId: `${course.name}:${n}`, details: JSON.stringify(details) } });
  return NextResponse.json({ ok: true });
}
