// Weekly FPG handicap sync.
//
// For every member with an FPG federation number, fetch the official Handicap
// Index from the FPG, store it (fpgIndex / fpgStatus / fpgClub / fpgSyncedAt) and
// make it the member's GPF handicap: declaredHandicap := FPG index, keeping the old
// value in hcpPrevious (Rank arrows). New cards are scored off it; cards already
// submitted keep their locked points. A committee manualHandicap still wins.
//
// Triggers:
//   • Vercel Cron (vercel.json, weekly) — authenticated with CRON_SECRET, which
//     Vercel sends as "Authorization: Bearer <CRON_SECRET>".
//   • Admin › Members › "Sync FPG now" — authenticated with the admin session.
//
// On any failure (session can't be opened, a lookup errors, a number isn't
// found, or the whole run crashes) an alert email goes to the admins and to
// ALERT_EMAIL, and the error is kept on the member (fpgError) for Admin.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { logAudit } from "@/lib/data";
import { openFpgSession } from "@/lib/fpg";
import { notifyFpgSyncProblem } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorise(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return { by: "cron" };
  const admin = await requireAdmin();
  if (admin) return { by: admin.name };
  return null;
}

async function run(trigger) {
  const startedAt = new Date();
  const members = await prisma.user.findMany({
    where: { fpgNumber: { not: null } },
    select: { id: true, name: true, fpgNumber: true, fpgIndex: true, declaredHandicap: true },
    orderBy: { name: "asc" },
  });
  const results = [];
  const problems = [];

  if (!members.length) return { startedAt, trigger, results, problems, note: "No members have an FPG number yet." };

  let session;
  try {
    session = await openFpgSession();
  } catch (e) {
    problems.push({ member: "—", fedno: "—", error: e.message });
    return { startedAt, trigger, results, problems, fatal: true };
  }
  if (!session.ackFromPortal) {
    problems.push({ member: "—", fedno: "—", error: "Couldn't read the current access key from the FPG portal; used the last known one. The sync worked, but check the portal page if this repeats.", warning: true });
  }

  for (const m of members) {
    try {
      const rec = await session.lookup(m.fpgNumber);
      if (!rec) {
        const error = `Federation number ${m.fpgNumber} not found at the FPG`;
        await prisma.user.update({ where: { id: m.id }, data: { fpgError: error } });
        problems.push({ member: m.name, fedno: m.fpgNumber, error });
        results.push({ member: m.name, fedno: m.fpgNumber, ok: false, error });
        continue;
      }
      // Only a valid FPG index replaces the GPF handicap ("Sem HCP" etc. leave it alone).
      const changes = rec.index != null && m.declaredHandicap !== rec.index;
      await prisma.user.update({
        where: { id: m.id },
        data: {
          fpgIndex: rec.index, fpgStatus: rec.status, fpgClub: rec.club, fpgName: rec.name, fpgSyncedAt: new Date(), fpgError: null,
          ...(changes ? { declaredHandicap: rec.index, hcpPrevious: m.declaredHandicap, hcpChangedAt: new Date() } : {}),
        },
      });
      if (changes) await logAudit("FPG sync", "hcp.fpg", m.id, `${m.name}: ${m.declaredHandicap ?? "—"} → ${rec.index}`);
      results.push({ member: m.name, fedno: m.fpgNumber, ok: true, index: rec.index, previous: m.declaredHandicap, changed: changes, status: rec.status, club: rec.club });
    } catch (e) {
      const error = e.name === "TimeoutError" ? "FPG did not answer in time" : e.message;
      await prisma.user.update({ where: { id: m.id }, data: { fpgError: error } }).catch(() => {});
      problems.push({ member: m.name, fedno: m.fpgNumber, error });
      results.push({ member: m.name, fedno: m.fpgNumber, ok: false, error });
    }
    await new Promise((r) => setTimeout(r, 300)); // be gentle with the FPG server
  }
  return { startedAt, trigger, results, problems };
}

async function handle(req) {
  const who = await authorise(req);
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let summary;
  try {
    summary = await run(who.by);
  } catch (e) {
    summary = { startedAt: new Date(), trigger: who.by, results: [], problems: [{ member: "—", fedno: "—", error: `Sync crashed: ${e.message}` }], fatal: true };
  }

  const ok = summary.results.filter((r) => r.ok).length;
  const failed = summary.problems.filter((p) => !p.warning);
  console.log("[fpg/sync]", JSON.stringify({ trigger: summary.trigger, ok, problems: summary.problems }));
  await logAudit(who.by, "fpg.sync", null, `${ok}/${summary.results.length} updated${failed.length ? `, ${failed.length} problem(s)` : ""}`);

  let alerted = false;
  if (summary.problems.length) {
    alerted = await notifyFpgSyncProblem(summary);
    if (!alerted) console.error("[fpg/sync] ALERT NOT SENT (email unavailable). Problems:", JSON.stringify(summary.problems));
  }

  const status = summary.fatal ? 502 : 200;
  return NextResponse.json({ ok: !summary.fatal && failed.length === 0, updated: ok, total: summary.results.length, results: summary.results, problems: summary.problems, alerted, note: summary.note }, { status });
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
