import { NextResponse } from "next/server";
import { requireUser, requireAdmin } from "@/lib/guard";
import { logAudit } from "@/lib/data";
import { getSettings, saveSettings, revolutLink } from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await getSettings();
  return NextResponse.json({ settings: { ...s, revolutLink: revolutLink(s.revolutTag) } });
}

export async function PATCH(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  await saveSettings(await req.json());
  await logAudit(admin.name, "shop.settings.update", "shop", "");
  return NextResponse.json({ ok: true });
}
