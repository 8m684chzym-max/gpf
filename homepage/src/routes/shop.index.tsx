import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/site-chrome";
import { products } from "@/lib/products";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/shop/")({
  head: () => ({
    meta: [
      { title: "Shop — GPF Golf" },
      {
        name: "description",
        content:
          "Course-tested apparel, equipment, and accessories. A tight edit from GPF, open to everyone.",
      },
      { property: "og:title", content: "Shop — GPF Golf" },
      {
        property: "og:description",
        content: "A tight edit of course-tested apparel, equipment, and accessories.",
      },
    ],
  }),
  component: ShopIndex,
});

function ShopIndex() {
  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          The Shop
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
          Made for the course.
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
          A small collection, quietly considered. Ships from the clubhouse
          within one working day.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.id}
              to="/shop/$id"
              params={{ id: p.id }}
              className="group block"
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-secondary">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  width={1000}
                  height={1200}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                {p.category === "Apparel" && (
                  <img
                    src={logo}
                    alt=""
                    aria-hidden
                    className="absolute right-4 top-4 h-9 w-9 opacity-90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.25)]"
                  />
                )}
              </div>
              <div className="mt-5 flex items-baseline justify-between">
                <div>
                  <div className="text-[15px] font-medium">{p.name}</div>
                  <div className="mt-0.5 text-[13px] text-muted-foreground">
                    {p.tagline}
                  </div>
                </div>
                <div className="text-[15px] tabular-nums">${p.price}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
