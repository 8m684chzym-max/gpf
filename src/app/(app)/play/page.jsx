"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, Dices, Map as MapIcon, ChevronRight, Loader2, Swords, Medal } from "lucide-react";
import GamesHub from "@/components/games/GamesHub";
import MatchPlay from "@/components/play/MatchPlay";
import IndividualLeague from "@/components/play/IndividualLeague";
import { loadLive, totals } from "@/lib/liveRound";
import { COURSE_MAP } from "@/lib/holes";
import { api } from "@/lib/client";

// Courses with a hole map (GPS distances, hole sketches). Add an entry here when
// another course gets mapped (src/lib/holes.js + public/holes/*).
const MAPPED = [
  { match: COURSE_MAP.name.toLowerCase(), name: COURSE_MAP.name, place: "Comporta", href: "/play/round", mapHref: "/play/map", image: "/courses/pinheirinho.jpeg" },
];
const mappedFor = (name) => MAPPED.find((m) => name.toLowerCase().includes(m.match));

const TABS = [["start", "Start play", Flag], ["match", "Match play", Swords], ["games", "Games", Dices], ["league", "Individual league", Medal]];

export default function Play() {
  const [tab, setTab] = useState("start");
  useEffect(() => {
    const k = window.location.hash.replace("#", "") || new URLSearchParams(window.location.search).get("tab");
    if (TABS.some(([t]) => t === k)) setTab(k);
  }, []);
  const pick = (k) => { setTab(k); window.history.replaceState(null, "", k === "start" ? "/play" : `/play#${k}`); };

  return (
    <div className="stack">
      <div className="page-top">
        <div className="eyebrow">Play</div>
        <h1 className="page-h">On the course.</h1>
      </div>
      <div className="seg" role="tablist">
        {TABS.map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "seg-on" : ""} onClick={() => pick(k)}><Icon size={14} /> {label}</button>))}
      </div>
      {tab === "games" ? <GamesHub /> : tab === "match" ? <MatchPlay /> : tab === "league" ? <IndividualLeague /> : <StartPlay />}
    </div>
  );
}

function StartPlay() {
  const [courses, setCourses] = useState(null);
  useEffect(() => { api("/api/courses").then((r) => setCourses(r.courses || [])).catch(() => setCourses([])); }, []);
  if (!courses) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;

  // Mapped courses first (always shown, even before the course is in the database), then the rest.
  const withMap = MAPPED.map((m) => ({ ...m, course: courses.find((c) => mappedFor(c.name) === m) }));
  const others = courses.filter((c) => !mappedFor(c.name));

  const live = typeof window !== "undefined" ? loadLive() : null;
  return (
    <>
      {live && (
        <Link href="/play/round" className="card course-card" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderColor: "var(--ink)" }}>
          <span><span className="eyebrow">Round in progress</span><br /><b>{live.courseName} · {live.teeName}</b>
            <span className="muted small"> · {totals(live).played}/18 holes · {totals(live).points} pts</span></span>
          <ChevronRight size={18} />
        </Link>)}
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>Pick the course you&rsquo;re playing. On a mapped course you get live GPS distances and enter your score hole by hole; at the end your card goes to Rank.</p>
      <div className="sec-h">Courses with maps</div>
      <div className="course-grid">
        {withMap.map((m) => (
          <Link key={m.name} href={m.href} className="card course-card">
            <div className="course-img">{m.image ? <img src={m.image} alt={m.name} /> : <MapIcon size={28} />}</div>
            <div className="course-body">
              <span className="course-name">{m.name}</span>
              <span className="muted small">{m.place}{m.course?.tees?.length ? ` · ${m.course.tees.length} tees` : ""} · 18 holes mapped</span>
              <span style={{ marginTop: 8, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>Start a round <ChevronRight size={15} /></span>
            </div>
          </Link>))}
      </div>
      {others.length > 0 && (<>
        <div className="sec-h">Other courses</div>
        <div className="board">
          {others.map((c) => (
            <div key={c.id} className="board-row" style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="bh-name">{c.name}</span>
              <span className="muted small">Map coming soon</span>
            </div>))}
        </div>
      </>)}
    </>
  );
}
