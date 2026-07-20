"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, ListOrdered, Trophy, Flag, Dices, Check, CircleDot, ChevronRight, Loader2 } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";

export default function Dashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [d, setD] = useState(null);
  useEffect(() => {
    Promise.all([api("/api/leaderboard"), api("/api/rounds"), api("/api/config")])
      .then(([lb, mine, cfg]) => setD({ road: lb.road, mine: mine.rounds, config: cfg.config })).catch(() => {});
  }, []);
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  const me = d.road.find((r) => r.name === session?.user?.name) || { count: 0, hcp: null, qualified: false };
  const need = d.config.qualifyingRoundsRequired;
  return (
    <div className="stack">
      <div className="hello"><div className="muted small">Welcome back</div><h2 className="page-h">{session?.user?.name}</h2></div>
      <div className="card hcp-card">
        <div><div className="muted small">Competition handicap</div><div className="hcp-big">{fmtHcp(me.hcp)}</div>
          <div className="muted small">{me.hcp == null ? "Play qualifying rounds to set it" : "From your best qualifying rounds"}</div></div>
        <div className="hcp-meter"><div className="meter-label">Qualification</div>
          <div className="dots">{Array.from({ length: need }).map((_, i) => (<span key={i} className={`qdot ${i < me.count ? "on" : ""}`}>{i < me.count ? <Check size={13} /> : <CircleDot size={13} />}</span>))}</div>
          <div style={{ marginTop: 8 }}>{me.qualified ? <span className="badge badge-ok">Qualified</span> : <span className="badge badge-warn">{me.count}/{need} rounds</span>}</div></div>
      </div>
      <div className="grid2">
        <button className="quick" onClick={() => router.push("/submit")}><Plus size={18} /><span>Submit a round</span><ChevronRight size={16} className="chev" /></button>
        <button className="quick" onClick={() => router.push("/open")}><ListOrdered size={18} /><span>Road to GPF</span><ChevronRight size={16} className="chev" /></button>
        <button className="quick" onClick={() => router.push("/weekend")}><Trophy size={18} /><span>GPF Open</span><ChevronRight size={16} className="chev" /></button>
        <button className="quick" onClick={() => router.push("/games")}><Dices size={18} /><span>Side games</span><ChevronRight size={16} className="chev" /></button>
        <button className="quick" onClick={() => router.push("/open#final")}><Flag size={18} /><span>Final standings</span><ChevronRight size={16} className="chev" /></button>
      </div>
      <div className="sec-h">Your recent rounds</div>
      {d.mine.length === 0 && <div className="card empty">No rounds yet. Submit your first qualifying round to start the road.</div>}
      {d.mine.slice(0, 5).map((r) => (
        <div key={r.id} className="card row-card">
          <div><div className="row-title">{r.course?.name} · {r.tee?.name}</div><div className="muted small">{r.date?.slice(0, 10)} · {r.type === "WEEKEND" ? `GPF Open R${r.roundNo}` : "Qualifying"}{r.source === "OCR" ? " · from scorecard" : ""}</div></div>
          <div className="row-right"><div className="gross">{r.gross}</div><span className={`badge badge-${r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "bad" : "warn"}`}>{r.status.toLowerCase()}</span></div>
        </div>))}
      <div className="sec-h">How the year runs</div>
      <div className="steps">
        <div className="step"><span className="step-n num">1</span><div><b>Play the road</b><p className="muted small">Log at least 3 qualifying rounds, each with a member witness. Your best rounds set your handicap.</p></div></div>
        <div className="step"><span className="step-n num">2</span><div><b>Get qualified</b>
          <p className="muted small">Three approved rounds and you're in — your competition handicap locks for the Open.</p>
          <p className="muted small" style={{ marginTop: 6 }}>Your finishing rank on the road carries bonus strokes into the Open:</p>
          <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 3 }}>
            <li className="small"><b>🥇1st</b> — 3 strokes</li>
            <li className="small"><b>🥈2nd</b> — 2 strokes</li>
            <li className="small"><b>🥉3rd</b> — 1 stroke</li>
          </ul>
        </div></div>
        <div className="step"><span className="step-n num">3</span><div><b>GPF Open</b>
          <p className="muted small">26–27 September — two rounds at 90% handicap. Net = gross − playing handicap, both days added together.</p>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <a href="https://rfegolf.es/club/isla_canela_old_course.html?id=337" target="_blank" rel="noreferrer"
               style={{ display: "flex", gap: 12, alignItems: "center", padding: 8, borderRadius: 12, background: "var(--card, rgba(255,255,255,0.04))", border: "1px solid var(--border, rgba(255,255,255,0.08))", textDecoration: "none", color: "inherit" }}>
              <img src="/courses/ic-old.jpeg" alt="Isla Canela Old Course" width={64} height={64}
                   style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
              <div><div className="muted small">26 September</div><b>Isla Canela Old Course</b></div>
            </a>
            <a href="https://rfegolf.es/club/valle_guadiana_links?id=1101" target="_blank" rel="noreferrer"
               style={{ display: "flex", gap: 12, alignItems: "center", padding: 8, borderRadius: 12, background: "var(--card, rgba(255,255,255,0.04))", border: "1px solid var(--border, rgba(255,255,255,0.08))", textDecoration: "none", color: "inherit" }}>
              <img src="/courses/ic-links.jpeg" alt="Isla Canela Links" width={64} height={64}
                   style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
              <div><div className="muted small">27 September</div><b>Isla Canela Links</b></div>
            </a>
          </div>
        </div></div>
      </div>
    </div>
  );
}
