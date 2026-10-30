"use client";
import { useEffect, useState } from "react";
import { Trophy, ListOrdered, Loader2 } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";
import { MAJOR, TIEBREAK } from "@/lib/major";


export default function GpfOpen() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("road");
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#final") setTab("final");
  }, []);
  useEffect(() => {
    Promise.all([api("/api/leaderboard"), api("/api/config")])
      .then(([lb, cfg]) => setD({ road: lb.road, final: lb.final, config: cfg.config }))
      .catch(() => {});
  }, []);
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;

  const need = d.config.qualifyingRoundsRequired;

  return (
    <div className="stack">
      <div className="final-hero">
        <Trophy size={18} />
        <div>
          <div className="auth-eyebrow">GPF Open · {d.config.year}</div>
          <h2 className="page-h tight">Standings</h2>
        </div>
      </div>

      <div className="seg">
        <button className={tab === "road" ? "seg-on" : ""} onClick={() => setTab("road")}><ListOrdered size={15} /> Road</button>
        <button className={tab === "final" ? "seg-on" : ""} onClick={() => setTab("final")}><Trophy size={15} /> Final</button>
      </div>

      {tab === "road" ? (
        <>
          <p className="muted small">Ranked by total Stableford points from each player&rsquo;s 3 best rounds, then by handicap. {need} approved qualifying rounds to qualify. Points missing from a card are estimated with the WHS method.</p>
          <div className="board">
            <div className="board-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Pts·3</span><span className="bh-c">Hcp</span><span className="bh-c">Status</span></div>
            {d.road.length === 0 && <div className="empty" style={{ padding: 16, color: "#9fc2b3" }}>No members yet.</div>}
            {d.road.map((r, i) => (
              <div key={r.name} className={`board-row ${r.qualified ? "lead" : ""}`}>
                <span className="bh-rank num">{i + 1}</span><span className="bh-name">{r.name}</span>
                <span className="bh-c num tot">{r.points || 0}</span><span className="bh-c num">{fmtHcp(r.hcp)}</span>
                <span className="bh-c">{r.qualified ? <span className="badge badge-ok">{r.bonus ? `In · −${r.bonus}` : "In"}</span> : <span className="badge badge-warn">{r.count}/{need}</span>}</span>
              </div>))}
          </div>
        </>
      ) : (
        <>
          <p className="muted small">Single round at {MAJOR.course} — lowest net wins. Ties: {TIEBREAK[d.config.tiebreak]}.</p>
          <div className="board lb">
            <div className="board-head lb-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Hcp</span><span className="bh-c">Gross</span><span className="bh-c">Bonus</span><span className="bh-c tot">Net</span></div>
            {d.final.length === 0 && <div style={{ padding: 16, color: "#9fc2b3" }}>No weekend scores in yet.</div>}
            {d.final.map((r, i) => (
              <div key={r.name} className={`board-row lb-row ${i === 0 && r.total != null ? "champion" : ""}`}>
                <span className="bh-rank num">{i === 0 && r.total != null ? <Trophy size={15} /> : i + 1}</span><span className="bh-name">{r.name}</span>
                <span className="bh-c num">{fmtHcp(r.hcp)} <span className="ph">({r.ph ?? "—"})</span></span>
                <span className="bh-c num">{r.gross ?? "—"}</span><span className="bh-c num">{r.bonus ? `−${r.bonus}` : "—"}</span><span className="bh-c num tot">{r.total ?? "—"}</span>
              </div>))}
          </div>
          <p className="hint">Playing handicap (in brackets) = course handicap on the tee played × {d.config.handicapAllowance}%. Net = gross − playing handicap − road bonus (3/2/1 strokes for the top three on the road).</p>
        </>
      )}
    </div>
  );
}
