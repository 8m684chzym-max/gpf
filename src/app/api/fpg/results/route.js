// Weekly import of members' official rounds from myFPG.
//
// For each member with an FPG number, read their latest results from myFPG and
// add the 18-hole rounds played on/after FPG_ROUNDS_SINCE as approved qualifying
// rounds, with the Stableford points the FPG calculated (handicap of the day) —
// locked, like any GPF card. From the first successful import, Rank counts only
// these official rounds for that member (best 3 Stableford).
//
// A GPF card the member already submitted for the same day is linked to the FPG
// round instead of duplicated, and takes the FPG's points.
//
// Triggers: Vercel Cron (after /api/fpg/sync) or an admin. ?dry=1 returns what
// myFPG sends (first records per member) without writing anything.
// Problems → alert email to the admins + ALERT_EMAIL.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { logAudit, getActiveCompetition } from "@/lib/data";
import { openMyFpgSession, normaliseRecord } from "@/lib/myfpg";
import { notifyFpgSyncProblem } from "@/lib/mail";
import { FPG_ROUNDS_SINCE } from "@/lib/major";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorise(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return { by: "cron" };
  const admin = await requireAdmin();
  return admin ? { by: admin.name } : null;
}

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(golf|golfe|club|clube|course|campo|resort|the|de|do|da|e)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

// Find the GPF course for an FPG course name, or create it (with an "FPG" tee).
async function courseAndTee(rec, courses) {
  const key = norm(rec.course);
  let course = key && courses.find((c) => { const k = norm(c.name); return k && (k === key || key.includes(k) || k.includes(key)); });
  if (!course) {
    course = await prisma.course.create({
      data: { name: rec.course || "FPG course", par: rec.par ?? 72,
        tees: { create: { name: rec.tee || "FPG", par: rec.par ?? 72, rating: rec.rating, slope: rec.slope != null ? Math.round(rec.slope) : null } } },
      include: { tees: true },
    });
    courses.push(course);
    return { course, tee: course.tees[0], created: true };
  }
  const tee = (rec.tee && course.tees.find((t) => norm(t.name) === norm(rec.tee))) || course.tees[0]
    || await prisma.tee.create({ data: { courseId: course.id, name: rec.tee || "FPG", par: rec.par ?? course.par ?? 72, rating: rec.rating, slope: rec.slope != null ? Math.round(rec.slope) : null } });
  return { course, tee, created: false };
}

async function run(trigger, dry) {
  const startedAt = new Date();
  const members = await prisma.user.findMany({
    where: { fpgNumber: { not: null } },
    select: { id: true, name: true, fpgNumber: true, declaredHandicap: true },
    orderBy: { name: "asc" },
  });
  const results = [], problems = [], sample = {};
  if (!members.length) return { startedAt, trigger, results, problems, note: "No members have an FPG number." };

  let session;
  try { session = await openMyFpgSession(); }
  catch (e) { problems.push({ member: "—", fedno: "—", error: e.message }); return { startedAt, trigger, results, problems, fatal: true }; }

  const comp = dry ? null : await getActiveCompetition();
  const courses = dry ? [] : await prisma.course.findMany({ include: { tees: true } });

  for (const m of members) {
    try {
      const raw = await session.results(m.fpgNumber, 20);
      if (dry) { sample[m.name] = { total: raw.length, keys: raw[0] ? Object.keys(raw[0]) : [], first: raw.slice(0, 3) }; results.push({ member: m.name, fedno: m.fpgNumber, ok: true, rounds: raw.length }); continue; }

      const recs = raw.map((x) => normaliseRecord(x, m.fpgNumber))
        .filter((x) => x.date && x.date >= FPG_ROUNDS_SINCE && x.holes === 18 && x.gross != null && x.points != null);
      let added = 0, linked = 0;
      for (const rec of recs) {
        if (await prisma.round.findUnique({ where: { fpgScoreId: rec.id }, select: { id: true } })) continue;
        const day = new Date(`${rec.date}T12:00:00Z`);
        const fpgData = { ...rec };
        const lock = { lockedPoints: Math.round(rec.points), lockedIndex: rec.index ?? m.declaredHandicap ?? null, lockedCourseHcp: rec.playingHcp != null ? Math.round(rec.playingHcp) : null, lockedAt: new Date() };

        // Same-day GPF card from this member → link it (FPG figures win).
        const card = await prisma.round.findFirst({
          where: { userId: m.id, competitionId: comp.id, type: "QUALIFYING", status: { not: "REJECTED" }, fpgScoreId: null,
            date: { gte: new Date(`${rec.date}T00:00:00Z`), lt: new Date(`${rec.date}T23:59:59Z`) } },
        });
        if (card) {
          await prisma.round.update({ where: { id: card.id }, data: { fpgScoreId: rec.id, fpgData, ...lock, status: "APPROVED", reviewedBy: card.reviewedBy ?? "FPG import", reviewedAt: card.reviewedAt ?? new Date() } });
          if (card.gross !== rec.gross) problems.push({ member: m.name, fedno: m.fpgNumber, error: `${rec.date}: GPF card gross ${card.gross} vs FPG ${rec.gross} — FPG points (${rec.points}) used.`, warning: true });
          linked++;
          continue;
        }
        const { course, tee, created } = await courseAndTee(rec, courses);
        if (created) problems.push({ member: m.name, fedno: m.fpgNumber, error: `New course created from FPG: "${course.name}" — check its tee data in Admin.`, warning: true });
        await prisma.round.create({
          data: {
            userId: m.id, competitionId: comp.id, type: "QUALIFYING", date: day, courseId: course.id, teeId: tee.id, gross: rec.gross,
            status: "APPROVED", reviewedBy: "FPG import", reviewedAt: new Date(), fpgScoreId: rec.id, fpgData, ...lock,
          },
        });
        added++;
      }
      await prisma.user.update({ where: { id: m.id }, data: { fpgResultsAt: new Date() } });
      if (added || linked) await logAudit("FPG import", "round.fpg-import", m.id, `${m.name}: ${added} added, ${linked} linked`);
      results.push({ member: m.name, fedno: m.fpgNumber, ok: true, found: recs.length, added, linked });
    } catch (e) {
      const error = e.name === "TimeoutError" ? "myFPG did not answer in time" : e.message;
      problems.push({ member: m.name, fedno: m.fpgNumber, error });
      results.push({ member: m.name, fedno: m.fpgNumber, ok: false, error });
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { startedAt, trigger, results, problems, sample: dry ? sample : undefined };
}

async function handle(req) {
  const who = await authorise(req);
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  let s;
  try { s = await run(who.by, dry); }
  catch (e) { s = { startedAt: new Date(), trigger: who.by, results: [], problems: [{ member: "—", fedno: "—", error: `Import crashed: ${e.message}` }], fatal: true }; }

  const failed = s.problems.filter((p) => !p.warning);
  console.log("[fpg/results]", JSON.stringify({ trigger: s.trigger, dry, results: s.results, problems: s.problems }));
  let alerted = false;
  if (!dry) {
    await logAudit(who.by, "fpg.results", null, `${s.results.filter((r) => r.ok).length}/${s.results.length} members${failed.length ? `, ${failed.length} problem(s)` : ""}`);
    if (s.problems.length) alerted = await notifyFpgSyncProblem(s, "FPG rounds import");
  }
  return NextResponse.json({ ok: !s.fatal && failed.length === 0, dry, results: s.results, problems: s.problems, alerted, sample: s.sample, note: s.note }, { status: s.fatal ? 502 : 200 });
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
