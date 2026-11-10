import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/members/playing")({
  head: () => ({
    meta: [
      { title: "Playing — GPF Members" },
      { name: "description", content: "Tee times, scoring, handicap, events and stats — the round in one place." },
      { property: "og:title", content: "Playing — GPF Members" },
      { property: "og:description", content: "Tee times, scoring, handicap, events and stats." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Playing,
});

type Tab = "today" | "score" | "events" | "leaderboard" | "course" | "stats";

const holes = [
  { n: 1, par: 4, yards: 402, tip: "Bunker right at 250. Aim left-center." },
  { n: 2, par: 3, yards: 178, tip: "Wind swirls in the trees. Club up." },
  { n: 3, par: 5, yards: 528, tip: "Reachable with a fade around the dogleg." },
  { n: 4, par: 4, yards: 396, tip: "Green tilts back-to-front. Below the hole." },
  { n: 5, par: 4, yards: 421, tip: "Blind tee shot — pick the church steeple." },
  { n: 6, par: 3, yards: 165, tip: "Water short. Take one more club." },
  { n: 7, par: 4, yards: 412, tip: "Fairway bunker at 240. Favor the low side." },
  { n: 8, par: 5, yards: 561, tip: "Layup zone at 150 — beware the cross-bunker." },
  { n: 9, par: 4, yards: 384, tip: "Approach uphill; add half a club." },
];

const leaderboard = [
  { pos: 1, name: "Marcus McKay", score: "-6", thru: "F" },
  { pos: 2, name: "Ana Costa", score: "-4", thru: "F" },
  { pos: 3, name: "Kenji Ito", score: "-3", thru: "17" },
  { pos: 4, name: "You", score: "-2", thru: "16" },
  { pos: 5, name: "Sofia Bianchi", score: "-1", thru: "F" },
  { pos: 6, name: "Owen Reyes", score: "E", thru: "F" },
];

const memberEvents = [
  { date: "Apr 20", title: "Spring Opening Foursomes", status: "Signed up" },
  { date: "May 04", title: "The Founder's Cup", status: "Signed up" },
  { date: "May 18", title: "Public Pro-Am", status: "Available" },
  { date: "Jun 08", title: "Twilight Nine & Wine", status: "Available" },
];

function Playing() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <section className="mx-auto max-w-6xl px-6 pt-10 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Playing
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Your round, in one place.
          </h1>
        </div>
        <div className="hidden rounded-2xl border border-border/60 bg-card px-5 py-3 text-right sm:block">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Handicap</div>
          <div className="text-3xl font-semibold tabular-nums">8.4</div>
          <div className="text-[11px] text-muted-foreground">↓ 0.3 · last 5 rounds</div>
        </div>
      </div>

      <nav className="mt-8 flex flex-wrap gap-1 rounded-full border border-border bg-card p-1 text-[13px]">
        <TabBtn active={tab === "today"} onClick={() => setTab("today")}>Today</TabBtn>
        <TabBtn active={tab === "score"} onClick={() => setTab("score")}>Scorecard</TabBtn>
        <TabBtn active={tab === "events"} onClick={() => setTab("events")}>Events</TabBtn>
        <TabBtn active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>Leaderboard</TabBtn>
        <TabBtn active={tab === "course"} onClick={() => setTab("course")}>Course Guide</TabBtn>
        <TabBtn active={tab === "stats"} onClick={() => setTab("stats")}>Stats</TabBtn>
      </nav>

      <div className="mt-8">
        {tab === "today" && <Today />}
        {tab === "score" && <Scorecard />}
        {tab === "events" && <Events />}
        {tab === "leaderboard" && <Leaderboard />}
        {tab === "course" && <CourseGuide />}
        {tab === "stats" && <Stats />}
      </div>
    </section>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Card({ eyebrow, title, body, action }: { eyebrow: string; title: string; body: string; action?: string }) {
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-border/60 bg-card p-6 transition-colors hover:border-foreground/20">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-[14px] text-muted-foreground">{body}</p>
      </div>
      {action && (
        <button className="mt-8 self-start text-[13px] font-medium text-foreground/80 hover:text-foreground">
          {action} →
        </button>
      )}
    </div>
  );
}

function Today() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card eyebrow="Tee Sheet" title="Saturday, 8:20 AM" body="Four-ball · McKay, Ito, Costa" action="Change time" />
      <Card eyebrow="Weather" title="62° · light NE wind" body="Chance of showers after 2pm." action="Radar" />
      <Card eyebrow="Range" title="Book a bay" body="Heated bays, TrackMan-fitted. 30-minute slots." action="Reserve" />
      <Card eyebrow="Handicap" title="8.4" body="Trend −0.3 over last 5 rounds." action="History" />
      <Card eyebrow="Next Event" title="Founder's Cup · May 4" body="Stroke play. Practice round Thursday." action="Details" />
      <Card eyebrow="Course Note" title="Hole 7 pin front" body="Play it long — front bunker in play." action="Full guide" />
    </div>
  );
}

function Scorecard() {
  const scores = [4, 3, 5, 4, 5, 3, 4, 6, 4];
  const front = scores.reduce((a, b) => a + b, 0);
  const parFront = holes.reduce((a, h) => a + h.par, 0);

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Round in progress</div>
          <div className="mt-1 text-[15px] font-medium">Front nine · +{front - parFront}</div>
        </div>
        <button className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground">
          Save round
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-[13px]">
          <thead className="text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Hole</th>
              {holes.map((h) => (
                <th key={h.n} className="px-2 py-3 text-center font-medium">{h.n}</th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Out</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border/60 text-muted-foreground">
              <td className="px-4 py-3">Par</td>
              {holes.map((h) => <td key={h.n} className="px-2 py-3 text-center tabular-nums">{h.par}</td>)}
              <td className="px-4 py-3 text-right tabular-nums">{parFront}</td>
            </tr>
            <tr className="border-t border-border/60">
              <td className="px-4 py-3 font-medium">You</td>
              {scores.map((s, i) => {
                const delta = s - holes[i].par;
                const cls =
                  delta < 0 ? "bg-primary text-primary-foreground" : delta > 1 ? "bg-secondary" : "";
                return (
                  <td key={i} className="px-2 py-3 text-center">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full tabular-nums ${cls}`}>
                      {s}
                    </span>
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right tabular-nums">{front}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Events() {
  return (
    <ul className="divide-y divide-border/70 border-t border-b border-border/70">
      {memberEvents.map((e) => (
        <li key={e.title} className="grid grid-cols-[68px_1fr_auto] items-center gap-6 py-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {e.date.split(" ")[0]}
            </div>
            <div className="text-2xl font-semibold tabular-nums">{e.date.split(" ")[1]}</div>
          </div>
          <div>
            <div className="text-[16px] font-medium">{e.title}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">Members · Tee 1</div>
          </div>
          <button
            className={`rounded-full px-4 py-2 text-[13px] font-medium ${
              e.status === "Signed up"
                ? "border border-border bg-background text-muted-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {e.status === "Signed up" ? "Signed up ✓" : "Sign up"}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Leaderboard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card">
      <div className="border-b border-border/60 px-6 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Live</div>
        <div className="mt-1 text-[15px] font-medium">Founder's Cup · Round 1</div>
      </div>
      <ul className="divide-y divide-border/60">
        {leaderboard.map((row) => (
          <li
            key={row.name}
            className={`grid grid-cols-[48px_1fr_80px_60px] items-center px-6 py-3.5 text-[14px] ${
              row.name === "You" ? "bg-secondary/60" : ""
            }`}
          >
            <div className="tabular-nums text-muted-foreground">{row.pos}</div>
            <div className="font-medium">{row.name}</div>
            <div className="text-right tabular-nums">{row.score}</div>
            <div className="text-right text-muted-foreground tabular-nums">{row.thru}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CourseGuide() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {holes.map((h) => (
        <div key={h.n} className="rounded-3xl border border-border/60 bg-card p-6">
          <div className="flex items-baseline justify-between">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              Hole {h.n}
            </div>
            <div className="text-[12px] text-muted-foreground tabular-nums">
              Par {h.par} · {h.yards}y
            </div>
          </div>
          <div className="mt-3 text-[15px] font-medium">The play</div>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{h.tip}</p>
        </div>
      ))}
    </div>
  );
}

function Stats() {
  const stats = [
    { label: "Rounds this year", value: "23" },
    { label: "Scoring avg", value: "78.4" },
    { label: "Fairways hit", value: "62%" },
    { label: "GIR", value: "48%" },
    { label: "Putts / round", value: "31.2" },
    { label: "Sand saves", value: "44%" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-3xl border border-border/60 bg-card p-6">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {s.label}
          </div>
          <div className="mt-3 text-4xl font-semibold tabular-nums">{s.value}</div>
        </div>
      ))}
    </div>
  );
}
