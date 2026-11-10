import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/site-chrome";
import { getProduct, products } from "@/lib/products";
import { useCart } from "@/lib/cart";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/shop/$id")({
  loader: ({ params }) => {
    const product = getProduct(params.id);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Product not found — GPF Golf" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { product } = loaderData;
    return {
      meta: [
        { title: `${product.name} — GPF Golf` },
        { name: "description", content: product.description },
        { property: "og:title", content: `${product.name} — GPF Golf` },
        { property: "og:description", content: product.description },
      ],
    };
  },
  notFoundComponent: () => (
    <PageShell>
      <div className="mx-auto max-w-2xl px-6 py-40 text-center">
        <h1 className="text-3xl font-semibold">Not in the collection.</h1>
        <p className="mt-3 text-muted-foreground">
          That product isn't available right now.
        </p>
        <Link
          to="/shop"
          className="mt-8 inline-flex rounded-full bg-primary px-5 py-2.5 text-[14px] text-primary-foreground"
        >
          Back to shop
        </Link>
      </div>
    </PageShell>
  ),
  errorComponent: ({ error, reset }) => (
    <PageShell>
      <div className="mx-auto max-w-2xl px-6 py-40 text-center">
        <h1 className="text-2xl font-semibold">Something didn't load.</h1>
        <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={reset}
          className="mt-8 rounded-full bg-primary px-5 py-2.5 text-[14px] text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </PageShell>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const related = products.filter((p) => p.id !== product.id).slice(0, 3);
  const { add } = useCart();
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    add(product.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-24">
        <Link
          to="/shop"
          className="text-[13px] text-muted-foreground hover:text-foreground"
        >
          ← All products
        </Link>

        <div className="mt-8 grid gap-12 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-3xl bg-secondary">
            <img
              src={product.image}
              alt={product.name}
              width={1000}
              height={1200}
              className="h-full w-full object-cover"
            />
            {product.category === "Apparel" && (
              <img
                src={logo}
                alt=""
                aria-hidden
                className="absolute right-6 top-6 h-14 w-14 opacity-90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]"
              />
            )}
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {product.category}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {product.name}
            </h1>
            <p className="mt-3 text-[16px] text-muted-foreground">{product.tagline}</p>
            <div className="mt-6 text-2xl tabular-nums">${product.price}</div>
            <p className="mt-8 max-w-md text-[15px] leading-relaxed text-foreground/80">
              {product.description}
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <button
                onClick={handleAdd}
                className="rounded-full bg-primary px-6 py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {added ? "Added to bag ✓" : `Add to bag — $${product.price}`}
              </button>
              <button
                onClick={() => { add(product.id, 1); navigate({ to: "/checkout" }); }}
                className="rounded-full border border-border bg-background px-6 py-3 text-[14px] font-medium transition-colors hover:bg-secondary"
              >
                Buy now
              </button>
            </div>
            <p className="mt-6 text-[12px] text-muted-foreground">
              Free shipping on orders over $150. Ships from the clubhouse.
            </p>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-32">
            <h2 className="text-2xl font-semibold tracking-tight">You might also like</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.id}
                  to="/shop/$id"
                  params={{ id: p.id }}
                  className="group block"
                >
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-secondary">
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      width={1000}
                      height={1200}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <div className="text-[14px] font-medium">{p.name}</div>
                    <div className="text-[14px] tabular-nums">${p.price}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}
