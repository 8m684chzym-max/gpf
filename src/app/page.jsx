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
        <h1 className="home-title">Road to <span>GPF Open</span> 2026</h1>
        <p className="home-sub">Qualify on the road through the year. Settle it over one weekend in October at Isla Canela — two rounds, Medal Net, lowest total wins.</p>
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
          <div className="step"><span className="step-n num">2</span><div><b>Get qualified</b><p className="muted small">Three approved rounds and you're in — your competition handicap locks for the weekend. Top 3 ranked players will get a handicap advantage:</p>
            <div style={{ marginTop: 12, fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>
              <div>🥇 1º place &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; -3 strokes</div>
              <div>🥈 2º place &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; -2 strokes</div>
              <div>🥉 3º place &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; -1 stroke</div>
            </div>
          </div></div>
          <div className="step"><span className="step-n num">3</span><div><b>GPF Open 2026</b><p className="muted small">Two October rounds at 90% handicap. Net = gross − playing handicap. Two days added together.</p>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ borderRadius: 6, overflow: "hidden", background: "#f0f0f0" }}>
                <img src="https://www.golfbreaksspain.com/site/assets/files/11032/links_back9-3.jpg" alt="Isla Canela Links" style={{ width: "100%", height: 80, objectFit: "cover" }} />
                <div style={{ padding: 8, fontSize: 12 }}>
                  <strong>Day 1</strong><br/><span style={{ color: "#666" }}>Isla Canela Links</span>
                </div>
              </div>
              <div style={{ borderRadius: 6, overflow: "hidden", background: "#f0f0f0" }}>
                <img src="https://www.islacanela.es/media/2018/07/golf-1.png" alt="Golf Isla Canela" style={{ width: "100%", height: 80, objectFit: "cover" }} />
                <div style={{ padding: 8, fontSize: 12 }}>
                  <strong>Day 2</strong><br/><span style={{ color: "#666" }}>Golf Isla Canela</span>
                </div>
              </div>
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
      <footer className="home-foot">Private group · {year} · <button className="link" onClick={go}>Member sign in</button></footer>
    </div>
  );
}
