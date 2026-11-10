import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { logAudit } from "@/lib/data";
import { publicProduct, cleanProductInput } from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  try {
    const data = cleanProductInput(await req.json());
    const p = await prisma.shopProduct.update({ where: { id }, data });
    await logAudit(admin.name, "shop.product.update", id, Object.keys(data).join(","));
    return NextResponse.json({ product: publicProduct(p) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// Past orders keep their own copy of name and price, so deleting is safe.
export async function DELETE(req, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  const p = await prisma.shopProduct.delete({ where: { id } }).catch(() => null);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit(admin.name, "shop.product.delete", id, p.name);
  return NextResponse.json({ ok: true });
}
