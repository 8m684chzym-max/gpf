// Members' shop helpers (server side).
import { prisma } from "@/lib/prisma";

export const ORDER_STATUSES = ["PENDING", "SENT", "PAID", "DELIVERED", "CANCELLED"];
export const PAY_METHODS = ["MBWAY", "REVOLUT"];
export const SETTING_KEYS = ["mbwayPhone", "mbwayName", "revolutTag", "payNote", "shopOpen"];

export const euro = (cents) => `€${(cents / 100).toFixed(2).replace(".", ",")}`;

export async function getSettings() {
  const rows = await prisma.shopSetting.findMany();
  const s = Object.fromEntries(SETTING_KEYS.map((k) => [k, ""]));
  for (const r of rows) if (SETTING_KEYS.includes(r.key)) s[r.key] = r.value;
  if (!s.shopOpen) s.shopOpen = "1";
  return s;
}

export async function saveSettings(patch) {
  const ops = [];
  for (const k of SETTING_KEYS) {
    if (!(k in patch)) continue;
    const value = String(patch[k] ?? "").trim().slice(0, 500);
    ops.push(prisma.shopSetting.upsert({ where: { key: k }, create: { key: k, value }, update: { value } }));
  }
  await prisma.$transaction(ops);
}

// Revolut: accept "@tag", "tag" or a full revolut.me link.
export function revolutLink(tag) {
  const t = (tag || "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://revolut.me/${t.replace(/^@/, "")}`;
}

// Uploaded photos are stored as data: URLs; serve them through /api/shop/image
// so product lists stay small and the browser can cache each photo.
export function publicProduct(p) {
  const image = p.image?.startsWith("data:") ? `/api/shop/image/${p.id}?v=${new Date(p.updatedAt).getTime()}` : p.image || null;
  return {
    id: p.id, name: p.name, description: p.description, priceCents: p.priceCents, image,
    sizes: p.sizes ? p.sizes.split(",").map((x) => x.trim()).filter(Boolean) : [],
    stock: p.stock, active: p.active, sort: p.sort,
  };
}

export function cleanProductInput(b) {
  const data = {};
  if ("name" in b) data.name = String(b.name || "").trim().slice(0, 120);
  if ("description" in b) data.description = String(b.description || "").trim().slice(0, 2000);
  if ("price" in b) {
    const n = Math.round(Number(String(b.price).replace(",", ".")) * 100);
    if (!Number.isFinite(n) || n < 0) throw new Error("Invalid price");
    data.priceCents = n;
  }
  if ("sizes" in b) data.sizes = (Array.isArray(b.sizes) ? b.sizes : String(b.sizes || "").split(",")).map((x) => String(x).trim()).filter(Boolean).join(",");
  if ("stock" in b) data.stock = b.stock === "" || b.stock == null ? null : Math.max(0, Math.floor(Number(b.stock)));
  if ("active" in b) data.active = !!b.active;
  if ("sort" in b) data.sort = Math.floor(Number(b.sort) || 0);
  if ("image" in b) {
    const img = b.image ? String(b.image) : null;
    if (img && !(img.startsWith("data:image/") || img.startsWith("/"))) throw new Error("Invalid image");
    if (img && img.length > 1_500_000) throw new Error("Image too large");
    data.image = img;
  }
  return data;
}

export async function newOrderRef(tx = prisma) {
  for (let i = 0; i < 20; i++) {
    const ref = `GPF-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await tx.shopOrder.findUnique({ where: { ref } }))) return ref;
  }
  return `GPF-${Date.now().toString(36).toUpperCase()}`;
}

export function publicOrder(o) {
  return {
    id: o.id, ref: o.ref, status: o.status, method: o.method, totalCents: o.totalCents, note: o.note,
    buyerName: o.buyerName, buyerEmail: o.buyerEmail, userId: o.userId,
    createdAt: o.createdAt, sentAt: o.sentAt, paidAt: o.paidAt,
    items: (o.items || []).map((i) => ({ id: i.id, productId: i.productId, name: i.name, size: i.size, qty: i.qty, unitCents: i.unitCents })),
  };
}
