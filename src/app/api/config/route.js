import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/guard";
import { getActiveCompetition, configFrom, logAudit } from "@/lib/data";

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const comp = await getActiveCompetition();
  return NextResponse.json({ config: configFrom(comp), id: comp.id });
}

export async function PATCH(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = await req.json();
  const comp = await getActiveCompetition();
  const data = {};
  for (const k of ["qualifyingRoundsRequired", "handicapAllowance"]) if (k in b) data[k] = Number(b[k]);
  for (const k of ["roundingMode", "tiebreak"]) if (k in b) data[k] = b[k];
  for (const k of ["qualifyingLocked", "weekendLocked"]) if (k in b) data[k] = !!b[k];
  if ("r1Date" in b) data.r1Date = b.r1Date ? new Date(b.r1Date) : null;
  if ("r2Date" in b) data.r2Date = b.r2Date ? new Date(b.r2Date) : null;
  if ("year" in b) data.year = Number(b.year);
  await prisma.competition.update({ where: { id: comp.id }, data });
  await logAudit(admin.name, "config.update", comp.id, JSON.stringify(data));
  return NextResponse.json({ ok: true });
}
