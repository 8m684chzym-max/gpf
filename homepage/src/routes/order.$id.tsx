import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/site-chrome";
import { getOrder, type Order } from "@/lib/orders";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/order/$id")({
  head: () => ({
    meta: [
      { title: "Order Confirmed — GPF Golf" },
      { name: "description", content: "Thank you for your order." },
      { property: "og:title", content: "Order Confirmed — GPF Golf" },
      { property: "og:description", content: "Thank you for your order." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderConfirmation,
});

function OrderConfirmation() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOrder(getOrder(id));
    setReady(true);
  }, [id]);

  if (!ready) return <PageShell><div className="min-h-[60vh]" /></PageShell>;

  if (!order) {
    return (
      <PageShell>
        <section className="mx-auto max-w-2xl px-6 py-32 text-center">
          <img src={logo} alt="" aria-hidden className="mx-auto h-8 w-8 opacity-80" />
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Order not found.</h1>
          <p className="mt-3 text-muted-foreground">
            We couldn't locate order <span className="font-mono">{id}</span>.
          </p>
          <Link
            to="/shop"
            className="mt-8 inline-flex rounded-full bg-primary px-6 py-3 text-[14px] font-medium text-primary-foreground"
          >
            Back to shop
          </Link>
        </section>
      </PageShell>
    );
  }

  const placed = new Date(order.createdAt);
  const arrives = new Date(placed.getTime() + 1000 * 60 * 60 * 24 * 5);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-6 pt-14 pb-16 print:pt-6">
        {/* Confirmation banner */}
        <div className="text-center print:hidden">
          <img src={logo} alt="" aria-hidden className="mx-auto h-10 w-10" />
          <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Order Confirmed
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">
            Thank you, {order.name.split(" ")[0] || "friend"}.
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
            A quiet email is on its way to{" "}
            <span className="text-foreground">{order.email}</span>. Your order should
            arrive by {fmt(arrives)}.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <button
              onClick={() => window.print()}
              className="rounded-full bg-primary px-6 py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Print receipt
            </button>
            <Link
              to="/shop"
              className="rounded-full border border-border bg-background px-6 py-3 text-[14px] font-medium transition-colors hover:bg-secondary"
            >
              Continue shopping
            </Link>
          </div>
        </div>

        {/* Receipt */}
        <article className="mt-16 rounded-3xl border border-border/70 bg-card p-10 print:mt-0 print:rounded-none print:border-0 print:bg-transparent print:p-0">
          <header className="flex items-start justify-between border-b border-border/60 pb-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="GPF" className="h-9 w-9" />
              <div>
                <div className="text-[15px] font-semibold tracking-tight">GPF Golf</div>
                <div className="text-[12px] text-muted-foreground">Receipt</div>
              </div>
            </div>
            <div className="text-right text-[12px] text-muted-foreground">
              <div>
                Order <span className="font-mono text-foreground">{order.id}</span>
              </div>
              <div className="mt-1">{fmt(placed)}</div>
            </div>
          </header>

          <div className="grid gap-8 py-6 sm:grid-cols-2">
            <Block title="Billed to">
              <div>{order.name}</div>
              <div className="text-muted-foreground">{order.email}</div>
            </Block>
            <Block title="Ship to">
              <div>{order.address.line1}</div>
              {order.address.line2 && <div>{order.address.line2}</div>}
              <div>
                {order.address.city}, {order.address.postal}
              </div>
              <div>{order.address.country}</div>
            </Block>
          </div>

          <table className="w-full border-t border-border/60 text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="py-3 text-left font-medium">Item</th>
                <th className="py-3 text-right font-medium">Qty</th>
                <th className="py-3 text-right font-medium">Price</th>
                <th className="py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {order.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-3">{l.name}</td>
                  <td className="py-3 text-right tabular-nums">{l.qty}</td>
                  <td className="py-3 text-right tabular-nums">${l.price.toFixed(2)}</td>
                  <td className="py-3 text-right tabular-nums">${(l.price * l.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 ml-auto max-w-xs space-y-1.5 text-[13px]">
            <TotalRow label="Subtotal" value={`$${order.subtotal.toFixed(2)}`} />
            <TotalRow
              label="Shipping"
              value={order.shipping === 0 ? "Free" : `$${order.shipping.toFixed(2)}`}
            />
            <TotalRow label="Tax" value={`$${order.tax.toFixed(2)}`} />
            <div className="my-2 border-t border-border/60" />
            <div className="flex items-baseline justify-between">
              <div className="font-medium">Total</div>
              <div className="text-[18px] font-semibold tabular-nums">
                ${order.total.toFixed(2)}
              </div>
            </div>
          </div>

          <footer className="mt-10 flex items-center justify-between border-t border-border/60 pt-6 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <img src={logo} alt="" aria-hidden className="h-4 w-4 opacity-70" />
              <span>GPF.golf · Est. 1982</span>
            </div>
            <span>Thank you for supporting the clubhouse.</span>
          </footer>
        </article>
      </section>
    </PageShell>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <div className="mt-2 text-[13px] leading-6">{children}</div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
