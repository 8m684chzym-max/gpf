import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { logAudit } from "@/lib/data";

export const dynamic = "force-dynamic";

// The opponent (player B) — or an admin — confirms a registered result.
export async function PATCH(req, { params: paramsPromise }) {
  const { id } = await paramsPromise;
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { action } = await req.json();
  if (action !== "confirm") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const m = await prisma.matchPlay.findUnique({ where: { id } });
  if (!m) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (m.status === "CONFIRMED") return NextResponse.json({ ok: true });
  if (m.playerBId !== user.id && user.role !== "ADMIN")
    return NextResponse.json({ error: "Only your opponent (or the committee) can confirm this result." }, { status: 403 });
  await prisma.matchPlay.update({ where: { id }, data: { status: "CONFIRMED", confirmedBy: user.name, confirmedAt: new Date() } });
  await logAudit(user.name, "matchplay.confirm", id, null);
  return NextResponse.json({ ok: true });
}

// Either player can withdraw/decline a result while it's pending; admins can delete any.
export async function DELETE(req, { params: paramsPromise }) {
  const { id } = await paramsPromise;
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const m = await prisma.matchPlay.findUnique({ where: { id } });
  if (!m) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  const isPlayer = m.playerAId === user.id || m.playerBId === user.id;
  if (user.role !== "ADMIN" && !(isPlayer && m.status === "PENDING"))
    return NextResponse.json({ error: "Confirmed results can only be removed by the committee." }, { status: 403 });
  await prisma.matchPlay.delete({ where: { id } });
  await logAudit(user.name, "matchplay.delete", id, m.status);
  return NextResponse.json({ ok: true });
}
