import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site-chrome";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Play — GPF Golf" },
      {
        name: "description",
        content:
          "Book tee times, keep score, and track your handicap. The GPF companion for every round.",
      },
      { property: "og:title", content: "Play — GPF Golf" },
      { property: "og:description", content: "Your round, in one place." },
    ],
  }),
  component: Play,
});

function Play() {
  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-14 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Play
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">
          Your round, in one place.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
          Book tees, invite your fourball, keep score, and track handicap —
          quietly, from the moment you park the car.
        </p>
      </section>

      {/* Mock app preview */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          <Card
            eyebrow="Tee Sheet"
            title="Saturday, 8:20 AM"
            body="Four-ball · McKay, Ito, Costa"
            action="Change time"
          />
          <Card
            eyebrow="Scorecard"
            title="+2 · thru 11"
            body="Front nine 38 · 3 pars, 2 birdies"
            action="Open card"
          />
          <Card
            eyebrow="Handicap"
            title="8.4"
            body="Trend −0.3 over last 5 rounds"
            action="See history"
          />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card
            eyebrow="Course Guide"
            title="Hole 7 · 412y · Par 4"
            body="Fairway bunker at 240. Green tilts back-to-front, favor the low side."
            action="Full guide"
          />
          <Card
            eyebrow="Range"
            title="Book a bay"
            body="Heated bays, TrackMan-fitted. 30-minute slots."
            action="Reserve"
          />
        </div>
      </section>
    </PageShell>
  );
}

function Card({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action: string;
}) {
  return (
    <div className="group flex flex-col justify-between rounded-3xl border border-border/60 bg-card p-6 transition-all hover:border-foreground/20">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-[14px] text-muted-foreground">{body}</p>
      </div>
      <button className="mt-8 self-start text-[13px] font-medium text-foreground/80 transition-colors group-hover:text-foreground">
        {action} →
      </button>
    </div>
  );
}
