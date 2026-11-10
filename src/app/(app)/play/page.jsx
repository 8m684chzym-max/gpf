"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, Dices, Map as MapIcon, ChevronRight, Loader2 } from "lucide-react";
import GamesHub from "@/components/games/GamesHub";
import { COURSE_MAP } from "@/lib/holes";
import { api } from "@/lib/client";

// Courses with a hole map (GPS distances, hole sketches). Add an entry here when
// another course gets mapped (src/lib/holes.js + public/holes/*).
const MAPPED = [
  { match: COURSE_MAP.name.toLowerCase(), name: COURSE_MAP.name, place: "Comporta", href: "/play/map", image: "/courses/pinheirinho.jpeg" },
];
const mappedFor = (name) => MAPPED.find((m) => name.toLowerCase().includes(m.match));

export default function Play() {
  const [tab, setTab] = useState("start");
  useEffect(() => { if (window.location.hash === "#games" || new URLSearchParams(window.location.search).get("tab") === "games") setTab("games"); }, []);
  const pick = (k) => { setTab(k); window.history.replaceState(null, "", k === "games" ? "/play#games" : "/play"); };

  return (
    <div className="stack">
      <div className="page-top">
        <div className="eyebrow">Play</div>
        <h1 className="page-h">On the course.</h1>
      </div>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab === "start"} className={tab === "start" ? "seg-on" : ""} onClick={() => pick("start")}><Flag size={14} /> Start play</button>
        <button role="tab" aria-selected={tab === "games"} className={tab === "games" ? "seg-on" : ""} onClick={() => pick("games")}><Dices size={14} /> Games</button>
      </div>
      {tab === "games" ? <GamesHub /> : <StartPlay />}
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

  return (
    <>
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>Pick the course you&rsquo;re playing. Mapped courses open the hole-by-hole map with live GPS distances to the green.</p>
      <div className="sec-h">Courses with maps</div>
      <div className="course-grid">
        {withMap.map((m) => (
          <Link key={m.name} href={m.href} className="card course-card">
            <div className="course-img">{m.image ? <img src={m.image} alt={m.name} /> : <MapIcon size={28} />}</div>
            <div className="course-body">
              <span className="course-name">{m.name}</span>
              <span className="muted small">{m.place}{m.course?.tees?.length ? ` · ${m.course.tees.length} tees` : ""} · 18 holes mapped</span>
              <span style={{ marginTop: 8, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>Start round <ChevronRight size={15} /></span>
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
