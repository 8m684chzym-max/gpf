import { getProduct } from "@/lib/products";

export type OrderLine = { id: string; name: string; qty: number; price: number };

export type Order = {
  id: string;
  createdAt: string;
  email: string;
  name: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postal: string;
    country: string;
  };
  lines: OrderLine[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
};

const STORAGE_KEY = "gpf.orders.v1";

function readAll(): Record<string, Order> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Order>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Order>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function saveOrder(order: Order) {
  const all = readAll();
  all[order.id] = order;
  writeAll(all);
}

export function getOrder(id: string): Order | null {
  return readAll()[id] ?? null;
}

export function newOrderId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GPF-${stamp}-${rnd}`;
}

export function computeTotals(
  lines: { id: string; qty: number }[],
): { subtotal: number; shipping: number; tax: number; total: number; orderLines: OrderLine[] } {
  const orderLines: OrderLine[] = lines
    .map((l) => {
      const p = getProduct(l.id);
      return p ? { id: p.id, name: p.name, qty: l.qty, price: p.price } : null;
    })
    .filter((x): x is OrderLine => x !== null);
  const subtotal = orderLines.reduce((s, l) => s + l.price * l.qty, 0);
  const shipping = subtotal === 0 || subtotal >= 150 ? 0 : 12;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = Math.round((subtotal + shipping + tax) * 100) / 100;
  return { subtotal, shipping, tax, total, orderLines };
}
