"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import Logo from "@/components/Logo";
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
        <Logo size={148} />
        <div className="auth-eyebrow">Members' competition · {year}</div>
        <h1 className="home-title">Road to <span>GPF</span> Open</h1>
        <p className="home-sub">Qualify on the road through the year. Settle it over two rounds on 26–27 September — Medal Net, lowest total wins.</p>
        <div className="home-cta"><button className="btn btn-primary" onClick={go}>Enter the clubhouse</button><button className="btn btn-ghost" onClick={go}>Join the group</button></div>
        <div className="home-stats">
          <div><div className="hs-num num">{members}</div><div className="hs-l">members</div></div>
          <div><div className="hs-num num">{qualified}</div><div className="hs-l">qualified</div></div>
          <div><div className="hs-num num">2</div><div className="hs-l">final rounds</div></div>
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
      </section>
      {board.length > 0 && (
        <section className="home-sec">
          <div className="sec-h"><Trophy size={14} /> Current standings</div>
          <div className="board lb">
            <div className="board-head lb-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">R1</span><span className="bh-c">R2</span><span className="bh-c tot">Net</span></div>
            {board.map((r, i) => (
              <div key={r.name} className={`board-row lb-row ${i === 0 && r.total != null ? "champion" : ""}`}>
                <span className="bh-rank num">{i === 0 && r.total != null ? <Trophy size={14} /> : i + 1}</span>
                <span className="bh-name">{r.name}</span><span className="bh-c num">{r.net1 ?? "—"}</span><span className="bh-c num">{r.net2 ?? "—"}</span><span className="bh-c num tot">{r.total ?? "—"}</span>
              </div>))}
          </div>
        </section>
      )}
      <footer className="home-foot">Private group · {year} · <button className="link" onClick={go}>Member sign in</button> · <a href="/privacy" style={{ color: "var(--muted)", fontSize: "inherit" }}>Privacy</a></footer>
    </div>
  );
}
