import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site-chrome";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — GPF Golf" },
      {
        name: "description",
        content:
          "Tournaments, member matches, and social evenings on the calendar at GPF.",
      },
      { property: "og:title", content: "Events — GPF Golf" },
      { property: "og:description", content: "The season, laid out simply." },
    ],
  }),
  component: Events,
});

const events = [
  {
    date: "Apr 20",
    title: "Spring Opening Foursomes",
    kind: "Members",
    time: "9:00 AM · Tee 1",
    detail: "Season opener. Shotgun start followed by lunch on the terrace.",
  },
  {
    date: "May 04",
    title: "The Founder's Cup",
    kind: "Members",
    time: "8:30 AM · 36 holes",
    detail: "Stroke play across two rounds. Trophies at the clubhouse dinner.",
  },
  {
    date: "May 18",
    title: "Public Pro-Am",
    kind: "Open",
    time: "10:00 AM · Tee 1",
    detail: "Open to guests. Team of three joins a club pro for 18 holes.",
  },
  {
    date: "Jun 08",
    title: "Twilight Nine & Wine",
    kind: "Members",
    time: "5:30 PM · Tee 10",
    detail: "Casual nine holes, then wine and small plates at sundown.",
  },
];

function Events() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          The Season
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">
          Events, laid out simply.
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
          Tournaments, member matches, and social evenings. Members book from
          the app; the public can register for open events below.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <ul className="divide-y divide-border/70 border-t border-b border-border/70">
          {events.map((e) => (
            <li
              key={e.title}
              className="grid grid-cols-[68px_1fr_auto] items-center gap-6 py-6"
            >
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {e.date.split(" ")[0]}
                </div>
                <div className="text-2xl font-semibold tabular-nums">
                  {e.date.split(" ")[1]}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-medium">{e.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      e.kind === "Open"
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {e.kind}
                  </span>
                </div>
                <div className="mt-1 text-[13px] text-muted-foreground">{e.time}</div>
                <p className="mt-2 text-[14px] text-foreground/80">{e.detail}</p>
              </div>
              <button className="rounded-full border border-border bg-background px-4 py-2 text-[13px] font-medium transition-colors hover:bg-secondary">
                {e.kind === "Open" ? "Register" : "Sign up"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
