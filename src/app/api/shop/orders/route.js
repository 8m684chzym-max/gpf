import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { logAudit } from "@/lib/data";
import { PAY_METHODS, getSettings, newOrderRef, publicOrder, revolutLink } from "@/lib/shop";
import { notifyOrderPlaced } from "@/lib/mail";

export const dynamic = "force-dynamic";

// Own orders; admins can list everyone's with ?all=1.
export async function GET(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const all = new URL(req.url).searchParams.get("all") === "1" && user.role === "ADMIN";
  const rows = await prisma.shopOrder.findMany({
    where: all ? {} : { userId: user.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: all ? 300 : 50,
  });
  return NextResponse.json({ orders: rows.map(publicOrder) });
}

// Place an order. Prices and stock come from the database, never from the client.
export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const method = String(b.method || "");
  if (!PAY_METHODS.includes(method)) return NextResponse.json({ error: "Choose MB WAY or Revolut" }, { status: 400 });
  const lines = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
  if (!lines.length) return NextResponse.json({ error: "Your bag is empty" }, { status: 400 });

  const settings = await getSettings();
  if (settings.shopOpen === "0") return NextResponse.json({ error: "The shop is closed for now" }, { status: 400 });

  try {
    const order = await prisma.$transaction(async (tx) => {
      const ids = [...new Set(lines.map((l) => String(l.productId)))];
      const products = await tx.shopProduct.findMany({ where: { id: { in: ids }, active: true } });
      const byId = Object.fromEntries(products.map((p) => [p.id, p]));
      const items = [];
      const wanted = {};
      for (const l of lines) {
        const p = byId[String(l.productId)];
        if (!p) throw new Error("A product in your bag is no longer available");
        const qty = Math.floor(Number(l.qty));
        if (!(qty >= 1 && qty <= 20)) throw new Error("Invalid quantity");
        const sizes = p.sizes ? p.sizes.split(",").map((s) => s.trim()).filter(Boolean) : [];
        const size = String(l.size || "");
        if (sizes.length && !sizes.includes(size)) throw new Error(`Choose a size for ${p.name}`);
        wanted[p.id] = (wanted[p.id] || 0) + qty;
        items.push({ productId: p.id, name: p.name, size: sizes.length ? size : "", qty, unitCents: p.priceCents });
      }
      for (const [id, qty] of Object.entries(wanted)) {
        const p = byId[id];
        if (p.stock != null) {
          if (p.stock < qty) throw new Error(`Only ${p.stock} left of ${p.name}`);
          await tx.shopProduct.update({ where: { id }, data: { stock: { decrement: qty } } });
        }
      }
      const totalCents = items.reduce((t, i) => t + i.unitCents * i.qty, 0);
      return tx.shopOrder.create({
        data: {
          ref: await newOrderRef(tx), userId: user.id, buyerName: user.name || "", buyerEmail: user.email || "",
          method, totalCents, note: String(b.note || "").trim().slice(0, 500), items: { create: items },
        },
        include: { items: true },
      });
    });
    await logAudit(user.name, "shop.order.create", order.id, `${order.ref} ${order.totalCents}`);
    await notifyOrderPlaced(order, { ...settings, revolutLink: revolutLink(settings.revolutTag) });
    return NextResponse.json({ order: publicOrder(order) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
