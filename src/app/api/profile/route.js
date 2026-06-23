import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { logAudit } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { declaredHandicap: true, manualHandicap: true },
  });
  return NextResponse.json({
    declaredHandicap: me?.declaredHandicap ?? null,
    // true when the committee has set a manual override, which takes precedence
    overridden: me?.manualHandicap != null,
    manualHandicap: me?.manualHandicap ?? null,
  });
}

export async function PATCH(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!("declaredHandicap" in body)) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const raw = body.declaredHandicap;
  let value = null;
  if (raw !== "" && raw != null) {
    value = Number(raw);
    if (Number.isNaN(value) || value < -10 || value > 54) {
      return NextResponse.json({ error: "Handicap index must be between -10 and 54." }, { status: 400 });
    }
    value = Math.round(value * 10) / 10;
  }

  await prisma.user.update({ where: { id: user.id }, data: { declaredHandicap: value } });
  await logAudit(user.name, "profile.declaredHandicap", user.id, value == null ? "cleared" : String(value));
  return NextResponse.json({ ok: true, declaredHandicap: value });
}
