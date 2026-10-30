"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Flag } from "lucide-react";
import { MAJOR } from "@/lib/major";
import Logo from "@/components/Logo";
import GPFLoginMark from "@/components/GPFLoginMark";
import { api } from "@/lib/client";

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState({ final: [], road: [], config: null });
  useEffect(() => { api("/api/leaderboard").then(setData).catch(() => {}); }, []);
  const go = () => router.push("/login");
  const board = (data.final || []).slice(0, 3);
  const members = (data.road || []).length;
  const qualified = (data.road || []).filter((r) => r.qualified).length;
  const year = data.config?.year || new Date().getFullYear();
  return (
    <div className="home-wrap">
      <header className="home-top">
        <div className="brand"><Logo size={30} withText={false} /><span>Golf P'la Fresquinha</span></div>
        <button className="btn btn-ghost small-btn" onClick={go}>Log in</button>
      </header>
      <section className="home-hero">
      <GPFLoginMark size={148} tagline={false} />
        <div className="auth-eyebrow">Members' competition · {year}</div>
        <h1 className="home-title">Road to <span>GPF</span> Open</h1>
        <p className="home-sub">Qualify on the road through the year. Settle it in one round on {MAJOR.dateLabel} at {MAJOR.course} — Medal Net, lowest score wins.</p>
        <div className="home-cta"><button className="btn btn-primary" onClick={go}>Enter the clubhouse</button><button className="btn btn-ghost" onClick={go}>Join the group</button></div>
        <div className="home-stats">
          <div><div className="hs-num num">{members}</div><div className="hs-l">members</div></div>
          <div><div className="hs-num num">{qualified}</div><div className="hs-l">qualified</div></div>
          <div><div className="hs-num num">{MAJOR.rounds}</div><div className="hs-l">final round</div></div>
        </div>
      </section>
      <section className="home-sec">
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
            <p className="muted small">{MAJOR.dateLabel} at {MAJOR.course}, {MAJOR.location} — one round, 90% of your course handicap on the tee you play. Net = gross − playing handicap − road bonus; lowest wins.</p>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <a href={MAJOR.url} target="_blank" rel="noreferrer"
                 style={{ display: "flex", gap: 12, alignItems: "center", padding: 8, borderRadius: 12, background: "var(--card, rgba(255,255,255,0.04))", border: "1px solid var(--border, rgba(255,255,255,0.08))", textDecoration: "none", color: "inherit" }}>
                {MAJOR.image
                  ? <img src={MAJOR.image} alt={MAJOR.course} width={64} height={64} style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  : <span style={{ width: 64, height: 64, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: "#113221", color: "#f3e9d2" }}><Flag size={26} /></span>}
                <div><div className="muted small">{MAJOR.dayLabel}, {MAJOR.dateLabel}</div><b>{MAJOR.course}</b><div className="muted small">{MAJOR.location}</div></div>
              </a>
            </div>
          </div></div>
        </div>
      </section>
      {board.length > 0 && (
        <section className="home-sec">
          <div className="sec-h"><Trophy size={14} /> Current standings</div>
          <div className="board lb">
            <div className="board-head lb-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c tot">Net</span></div>
            {board.map((r, i) => (
              <div key={r.name} className={`board-row lb-row ${i === 0 && r.total != null ? "champion" : ""}`}>
                <span className="bh-rank num">{i === 0 && r.total != null ? <Trophy size={14} /> : i + 1}</span>
                <span className="bh-name">{r.name}</span><span className="bh-c num tot">{r.total ?? "—"}</span>
              </div>))}
          </div>
        </section>
      )}
      <footer className="home-foot">Private group · {year} · <button className="link" onClick={go}>Member sign in</button> · <a href="/privacy" style={{ color: "var(--muted)", fontSize: "inherit" }}>Privacy</a></footer>
    </div>
  );
}
