import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site-chrome";
import hero from "@/assets/hero-course.jpg";
// Rendered with Higgsfield (Kling 4.0, image-to-video from hero-course.jpg), served from
// Higgsfield's CDN. If it ever goes away the poster photo is what visitors see.
const heroVideo =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3EgZl6XTm29RFytRBe8DU6rbJSJ/hf_20261110_224053_5829db58-7676-4187-bee9-014e96a16447.mp4";


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


const APP = "https://app.gpf.golf";
const sections: { title: string; kicker?: string; logos?: string[]; text: string; cta: string; href: string }[] = [
  {
    title: "Open",
    kicker: "The major",
    text: "One round, one champion. Medal net off your GPF handicap, with bonus strokes for the top three on the Rank. 2026 went to Pinheirinho — 2027 is next.",
    cta: "Results and field",
    href: `${APP}/open`,
  },
  {
    title: "Team Cup",
    logos: [`${APP}/teams/warriors.png`, `${APP}/teams/patuas.png`],
    text: "Warriors vs Patuas. Season-long 1v1 match play between the two teams — 36 points in play, first to 18½ lifts the cup.",
    cta: "Score and teams",
    href: `${APP}/team-cup`,
  },
  {
    title: "Ranking",
    kicker: "All year",
    text: "A continuous ranking from your best three cards. Keep submitting rounds: it sets your handicap for the next Open and the top three earn bonus strokes.",
    cta: "See the ranking",
    href: `${APP}/rank`,
  },
];

function Index() {
  return (
    <PageShell>
      {/* Hero only: the menu in the header is the way in. */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 h-[calc(100svh-3.5rem)] w-full overflow-hidden">
          {/* Summer sunrise with a waving flag (rendered with Higgsfield from the hero photo).
              Plays once and holds on the last frame; the photo is the poster and the
              reduced-motion / no-video fallback. */}
          <video
            className="h-full w-full object-cover motion-reduce:hidden"
            src={heroVideo}
            poster={hero}
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-hidden
          />
          <img
            src={hero}
            alt="Golf green on a summer morning with the pin flag and the sun rising behind the hills"
            width={1920}
            height={1200}
            decoding="async"
            fetchPriority="high"
            className="hidden h-full w-full object-cover motion-reduce:block"
          />
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

      {/* The three competitions — each opens in the members' app. */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-center text-[13px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          The competitions
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {sections.map((s) => (
            <a
              key={s.title}
              href={s.href}
              className="group flex flex-col rounded-3xl border border-border bg-card p-7 transition-colors hover:bg-secondary"
            >
              <div className="flex h-14 items-center gap-2">
                {s.logos ? (
                  s.logos.map((l) => <img key={l} src={l} alt="" aria-hidden className="h-14 w-14 object-contain" />)
                ) : (
                  <span className="text-[13px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{s.kicker}</span>
                )}
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">{s.title}</h2>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-muted-foreground">{s.text}</p>
              <span className="mt-6 text-[13px] font-medium text-foreground">
                {s.cta} <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </a>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
