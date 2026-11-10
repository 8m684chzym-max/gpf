import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/site-chrome";
import { useCart } from "@/lib/cart";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Bag — GPF Golf" },
      { name: "description", content: "Review the pieces in your bag before checkout." },
      { property: "og:title", content: "Your Bag — GPF Golf" },
      { property: "og:description", content: "Review the pieces in your bag before checkout." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, subtotal, setQty, remove, hydrated } = useCart();
  const navigate = useNavigate();
  const shipping = subtotal === 0 || subtotal >= 150 ? 0 : 12;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = Math.round((subtotal + shipping + tax) * 100) / 100;

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-24">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" aria-hidden className="h-7 w-7" />
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Your Bag
          </p>
        </div>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">
          Ready when you are.
        </h1>

        {!hydrated ? null : items.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-border/60 bg-card p-16 text-center">
            <p className="text-muted-foreground">Your bag is empty.</p>
            <Link
              to="/shop"
              className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Browse the collection
            </Link>
          </div>
        ) : (
          <div className="mt-14 grid gap-12 md:grid-cols-[1fr_360px]">
            <ul className="divide-y divide-border/70 border-t border-b border-border/70">
              {items.map(({ product, qty }) => (
                <li key={product.id} className="grid grid-cols-[96px_1fr_auto] items-center gap-6 py-6">
                  <Link
                    to="/shop/$id"
                    params={{ id: product.id }}
                    className="relative block h-24 w-24 overflow-hidden rounded-xl bg-secondary"
                  >
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    {product.category === "Apparel" && (
                      <img src={logo} alt="" aria-hidden className="absolute right-1.5 top-1.5 h-4 w-4 opacity-90" />
                    )}
                  </Link>
                  <div>
                    <div className="text-[15px] font-medium">{product.name}</div>
                    <div className="mt-0.5 text-[13px] text-muted-foreground">{product.tagline}</div>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="inline-flex items-center rounded-full border border-border">
                        <button
                          onClick={() => setQty(product.id, qty - 1)}
                          className="px-3 py-1 text-muted-foreground hover:text-foreground"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-[13px] tabular-nums">{qty}</span>
                        <button
                          onClick={() => setQty(product.id, qty + 1)}
                          className="px-3 py-1 text-muted-foreground hover:text-foreground"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => remove(product.id)}
                        className="text-[12px] text-muted-foreground hover:text-foreground"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-[15px] tabular-nums">${(product.price * qty).toFixed(2)}</div>
                </li>
              ))}
            </ul>

            <aside className="h-fit rounded-3xl border border-border/60 bg-card p-6">
              <div className="mb-5 flex items-center gap-2">
                <img src={logo} alt="" aria-hidden className="h-5 w-5" />
                <div className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Order Summary
                </div>
              </div>
              <SummaryRow label="Subtotal" value={subtotal} />
              <SummaryRow label="Shipping" value={shipping} note={shipping === 0 ? "Free" : undefined} />
              <SummaryRow label="Estimated tax" value={tax} />
              <div className="my-4 border-t border-border/60" />
              <div className="flex items-baseline justify-between">
                <div className="text-[15px] font-medium">Total</div>
                <div className="text-[20px] font-semibold tabular-nums">${total.toFixed(2)}</div>
              </div>
              <button
                onClick={() => navigate({ to: "/checkout" })}
                className="mt-6 w-full rounded-full bg-primary py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Checkout
              </button>
              <p className="mt-4 text-center text-[12px] text-muted-foreground">
                Free shipping on orders over $150.
              </p>
            </aside>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function SummaryRow({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{note ?? `$${value.toFixed(2)}`}</span>
    </div>
  );
}
