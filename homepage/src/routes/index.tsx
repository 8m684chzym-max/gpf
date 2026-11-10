import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site-chrome";
import hero from "@/assets/hero-course.jpg";


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
      {/* Hero only: the menu in the header is the way in. */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 h-[calc(100svh-3.5rem)] w-full overflow-hidden">
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
          <div className="hero-flag" aria-hidden>
            <svg viewBox="0 0 120 160" width="100%" height="100%">
              <line x1="20" y1="10" x2="20" y2="150" stroke="oklch(0.25 0.01 260)" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="20" cy="9" r="2.2" fill="oklch(0.25 0.01 260)" />
              <g className="hero-flag-cloth">
                <path d="M20 12 C 45 6, 70 22, 95 14 L 95 46 C 70 54, 45 38, 20 46 Z" fill="oklch(0.58 0.22 27)" />
              </g>
            </svg>
          </div>
        </div>
        <div className="absolute inset-0 -z-10 h-[calc(100svh-3.5rem)] bg-gradient-to-b from-background/10 via-background/0 to-background/60" />

        <div className="mx-auto flex h-[calc(100svh-3.5rem)] max-w-6xl flex-col items-center justify-center px-6 text-center">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-foreground/70">
            Golf p'la Fresquinha · Est. 2012
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-tight text-foreground sm:text-6xl md:text-7xl">
            A quieter way to play.
          </h1>
        </div>
      </section>
    </PageShell>
  );
}
