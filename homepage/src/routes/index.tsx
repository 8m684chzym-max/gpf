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
    </PageShell>
  );
}
