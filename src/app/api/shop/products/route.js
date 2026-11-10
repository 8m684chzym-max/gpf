import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/guard";
import { logAudit } from "@/lib/data";
import { publicProduct, cleanProductInput } from "@/lib/shop";

export const dynamic = "force-dynamic";

// Members see active products; admins can ask for all of them (?all=1).
export async function GET(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const all = new URL(req.url).searchParams.get("all") === "1" && user.role === "ADMIN";
  const rows = await prisma.shopProduct.findMany({
    where: all ? {} : { active: true },
    orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ products: rows.map(publicProduct) });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  try {
    const data = cleanProductInput(await req.json());
    if (!data.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (data.priceCents == null) return NextResponse.json({ error: "Price is required" }, { status: 400 });
    const p = await prisma.shopProduct.create({ data });
    await logAudit(admin.name, "shop.product.create", p.id, p.name);
    return NextResponse.json({ product: publicProduct(p) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
