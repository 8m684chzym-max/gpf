import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/site-chrome";
import { useCart } from "@/lib/cart";
import { computeTotals, newOrderId, saveOrder } from "@/lib/orders";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — GPF Golf" },
      { name: "description", content: "Complete your GPF order." },
      { property: "og:title", content: "Checkout — GPF Golf" },
      { property: "og:description", content: "Complete your GPF order." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, lines, subtotal, clear, hydrated } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    line1: "",
    line2: "",
    city: "",
    postal: "",
    country: "United States",
    card: "",
    exp: "",
    cvc: "",
  });

  const totals = computeTotals(lines);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    const id = newOrderId();
    saveOrder({
      id,
      createdAt: new Date().toISOString(),
      email: form.email,
      name: form.name,
      address: {
        line1: form.line1,
        line2: form.line2 || undefined,
        city: form.city,
        postal: form.postal,
        country: form.country,
      },
      lines: totals.orderLines,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      tax: totals.tax,
      total: totals.total,
    });
    clear();
    navigate({ to: "/order/$id", params: { id } });
  }

  if (hydrated && items.length === 0) {
    return (
      <PageShell>
        <section className="mx-auto max-w-2xl px-6 py-32 text-center">
          <img src={logo} alt="" aria-hidden className="mx-auto h-8 w-8 opacity-80" />
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Nothing to check out.</h1>
          <p className="mt-3 text-muted-foreground">Your bag is empty.</p>
          <Link
            to="/shop"
            className="mt-8 inline-flex rounded-full bg-primary px-6 py-3 text-[14px] font-medium text-primary-foreground"
          >
            Browse the collection
          </Link>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-24">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" aria-hidden className="h-7 w-7" />
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Checkout
          </p>
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          One quiet step.
        </h1>

        <form onSubmit={onSubmit} className="mt-12 grid gap-12 md:grid-cols-[1fr_380px]">
          <div className="space-y-10">
            <Section title="Contact">
              <Field label="Email" value={form.email} onChange={(v) => update("email", v)} type="email" required />
            </Section>

            <Section title="Shipping">
              <Field label="Full name" value={form.name} onChange={(v) => update("name", v)} required />
              <Field label="Address" value={form.line1} onChange={(v) => update("line1", v)} required />
              <Field label="Apartment, suite (optional)" value={form.line2} onChange={(v) => update("line2", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" value={form.city} onChange={(v) => update("city", v)} required />
                <Field label="Postal code" value={form.postal} onChange={(v) => update("postal", v)} required />
              </div>
              <Field label="Country" value={form.country} onChange={(v) => update("country", v)} required />
            </Section>

            <Section title="Payment">
              <Field label="Card number" value={form.card} onChange={(v) => update("card", v)} placeholder="1234 5678 9012 3456" required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Expiry" value={form.exp} onChange={(v) => update("exp", v)} placeholder="MM / YY" required />
                <Field label="CVC" value={form.cvc} onChange={(v) => update("cvc", v)} placeholder="123" required />
              </div>
              <p className="text-[12px] text-muted-foreground">
                Demo checkout — no card is actually charged.
              </p>
            </Section>
          </div>

          <aside className="h-fit rounded-3xl border border-border/60 bg-card p-6">
            <div className="mb-5 flex items-center gap-2">
              <img src={logo} alt="" aria-hidden className="h-5 w-5" />
              <div className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
                Order
              </div>
            </div>
            <ul className="mb-5 space-y-4">
              {items.map(({ product, qty }) => (
                <li key={product.id} className="flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-secondary">
                    <img src={product.image} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 text-[13px]">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-muted-foreground">Qty {qty}</div>
                  </div>
                  <div className="text-[13px] tabular-nums">${(product.price * qty).toFixed(2)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 text-[13px]">
              <Row label="Subtotal" value={`$${totals.subtotal.toFixed(2)}`} />
              <Row label="Shipping" value={totals.shipping === 0 ? "Free" : `$${totals.shipping.toFixed(2)}`} />
              <Row label="Tax" value={`$${totals.tax.toFixed(2)}`} />
            </div>
            <div className="my-4 border-t border-border/60" />
            <div className="flex items-baseline justify-between">
              <div className="text-[15px] font-medium">Total</div>
              <div className="text-[20px] font-semibold tabular-nums">${totals.total.toFixed(2)}</div>
            </div>
            <button
              type="submit"
              disabled={submitting || subtotal === 0}
              className="mt-6 w-full rounded-full bg-primary py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Placing order…" : `Pay $${totals.total.toFixed(2)}`}
            </button>
          </aside>
        </form>
      </section>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-foreground/40"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
