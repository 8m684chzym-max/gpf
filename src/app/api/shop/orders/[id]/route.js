import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { logAudit } from "@/lib/data";
import { ORDER_STATUSES, getSettings, revolutLink, publicOrder } from "@/lib/shop";

export const dynamic = "force-dynamic";

async function load(id) {
  return prisma.shopOrder.findUnique({ where: { id }, include: { items: true } });
}

export async function GET(req, { params: paramsPromise }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await paramsPromise;
  const o = await load(id);
  if (!o || (o.userId !== user.id && user.role !== "ADMIN")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const s = await getSettings();
  return NextResponse.json({
    order: publicOrder(o),
    pay: { mbwayPhone: s.mbwayPhone, mbwayName: s.mbwayName, revolutTag: s.revolutTag, revolutLink: revolutLink(s.revolutTag), payNote: s.payNote },
  });
}

// Member: "sent" (I've paid) or "cancel" while still unpaid.
// Admin: { status } to any value.
export async function PATCH(req, { params: paramsPromise }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await paramsPromise;
  const o = await load(id);
  const isAdmin = user.role === "ADMIN";
  if (!o || (o.userId !== user.id && !isAdmin)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));

  let next;
  if (b.action === "sent" && o.userId === user.id && o.status === "PENDING") next = "SENT";
  else if (b.action === "cancel" && o.userId === user.id && ["PENDING", "SENT"].includes(o.status)) next = "CANCELLED";
  else if (isAdmin && ORDER_STATUSES.includes(b.status)) next = b.status;
  else return NextResponse.json({ error: "Not allowed" }, { status: 400 });
  if (next === o.status) return NextResponse.json({ order: publicOrder(o) });

  const updated = await prisma.$transaction(async (tx) => {
    // Return stock when an order is cancelled; take it again if un-cancelled.
    const delta = next === "CANCELLED" ? 1 : o.status === "CANCELLED" ? -1 : 0;
    if (delta) {
      for (const i of o.items) {
        if (!i.productId) continue;
        const p = await tx.shopProduct.findUnique({ where: { id: i.productId }, select: { stock: true } });
        if (p && p.stock != null) await tx.shopProduct.update({ where: { id: i.productId }, data: { stock: { increment: delta * i.qty } } });
      }
    }
    const data = { status: next };
    if (next === "SENT") data.sentAt = new Date();
    if (next === "PAID" && !o.paidAt) data.paidAt = new Date();
    return tx.shopOrder.update({ where: { id }, data, include: { items: true } });
  });
  await logAudit(user.name, "shop.order.status", id, `${o.ref} ${o.status}→${next}`);
  return NextResponse.json({ order: publicOrder(updated) });
}
