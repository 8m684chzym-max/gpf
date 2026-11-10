import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/site-chrome";
import { products } from "@/lib/products";
import hero from "@/assets/hero-course.jpg";
import clubhouse from "@/assets/clubhouse.jpg";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GPF Golf — A quieter way to play." },
      {
        name: "description",
        content:
          "A private clubhouse, a public shop, and a companion for every round. Discover GPF.",
      },
      { property: "og:title", content: "GPF Golf — A quieter way to play." },
      {
        property: "og:description",
        content:
          "A private clubhouse, a public shop, and a companion for every round. Discover GPF.",
      },
    ],
    links: [
      {
        rel: "preload",
        as: "image",
        href: hero,
        fetchpriority: "high",
      },
    ],
  }),
  component: Index,
});


function Index() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 h-[92vh] w-full overflow-hidden">
          <img
            src={hero}
            alt="Rolling fairway at dawn with a red pin flag on the green and the sun rising behind distant hills"
            width={1920}
            height={1200}
            decoding="async"
            fetchPriority="high"
            className="hero-image h-full w-full object-cover"
          />

          <div className="hero-sun-rise" aria-hidden />
          <div className="hero-mist" aria-hidden />

          {/* Waving flag overlay, positioned over the pin in the photo */}
          <div className="hero-flag" aria-hidden>
            <svg viewBox="0 0 120 160" width="100%" height="100%">
              {/* pole */}
              <line
                x1="20" y1="10" x2="20" y2="150"
                stroke="oklch(0.25 0.01 260)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle cx="20" cy="9" r="2.2" fill="oklch(0.25 0.01 260)" />
              {/* flag cloth */}
              <g className="hero-flag-cloth">
                <path
                  d="M20 12
                     C 45 6, 70 22, 95 14
                     L 95 46
                     C 70 54, 45 38, 20 46
                     Z"
                  fill="oklch(0.58 0.22 27)"
                />
              </g>
            </svg>
          </div>
        </div>

        <div className="absolute inset-0 -z-10 h-[92vh] bg-gradient-to-b from-background/10 via-background/0 to-background" />








        <div className="mx-auto flex h-[92vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-foreground/70">
            Golf p'la Fresquinha · Est. 2012
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-tight text-foreground sm:text-6xl md:text-7xl">
            A quieter way to play.
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-foreground/70">
            Members' clubhouse. Curated shop. A companion for every round —
            considered, uncomplicated, and made for the course.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/shop"
              className="rounded-full bg-primary px-6 py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Shop the collection
            </Link>
            <Link
              to="/members"
              className="rounded-full border border-foreground/20 bg-background/60 px-6 py-3 text-[14px] font-medium text-foreground backdrop-blur transition-colors hover:bg-background"
            >
              Explore membership →
            </Link>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="mx-auto max-w-6xl px-6 py-28">
        <div className="grid gap-6 md:grid-cols-2">
          <Pillar
            eyebrow="Members"
            title="The Clubhouse."
            body="Private lounges, tee-time priority, and a members' feed for scores, matches, and after-round conversation."
            href="/members"
          />
          <Pillar
            eyebrow="Shop"
            title="The Collection."
            body="A tight edit of course-tested apparel, equipment, and accessories. Open to everyone."
            href="/shop"
          />
          {/* "Play" pillar hidden for now:
          <Pillar eyebrow="Play" title="The Round." body="Book tees, join events, keep score, and track handicap — everything for the day, in one place." href="/play" /> */}
        </div>
      </section>

      {/* Clubhouse spotlight */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="grid items-center gap-10 rounded-3xl bg-secondary p-6 md:grid-cols-2 md:p-10">
          <div className="order-2 md:order-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Members' Clubhouse
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Belonging, quietly designed.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              A private space for members — dining, events, priority tee sheets,
              and a digital home for every card, match, and moment.
            </p>
            <Link
              to="/members"
              className="mt-8 inline-flex rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Request an invitation
            </Link>
          </div>
          <div className="order-1 overflow-hidden rounded-2xl md:order-2">
            <img
              src={clubhouse}
              alt="Warm-lit clubhouse interior overlooking the fairway"
              loading="lazy"
              width={1600}
              height={1000}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              From the Shop
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              New this season.
            </h2>
          </div>
          <Link
            to="/shop"
            className="hidden text-[14px] text-muted-foreground hover:text-foreground sm:inline"
          >
            View all →
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
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
                <div>
                  <div className="text-[14px] font-medium">{p.name}</div>
                  <div className="text-[13px] text-muted-foreground">{p.category}</div>
                </div>
                <div className="text-[14px] tabular-nums">${p.price}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function Pillar({
  eyebrow,
  title,
  body,
  href,
}: {
  eyebrow: string;
  title: string;
  body: string;
  href: "/members" | "/shop" | "/play";
}) {
  return (
    <Link
      to={href}
      className="group flex flex-col justify-between rounded-3xl border border-border/60 bg-card p-8 transition-all hover:border-foreground/20 hover:shadow-[0_1px_40px_-12px] hover:shadow-foreground/10"
    >
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </p>
        <h3 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className="mt-10 text-[14px] text-foreground/70 transition-colors group-hover:text-foreground">
        Learn more →
      </div>
    </Link>
  );
}


