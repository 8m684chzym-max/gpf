"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";

export default function Road() {
  const [d, setD] = useState(null);
  useEffect(() => { Promise.all([api("/api/leaderboard"), api("/api/config")]).then(([lb, cfg]) => setD({ road: lb.road, config: cfg.config })).catch(() => {}); }, []);
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  const need = d.config.qualifyingRoundsRequired;
  return (
    <div className="stack">
      <h2 className="page-h">Road to GPF · {d.config.year}</h2>
      <p className="muted small">Ranked by total Stableford points from each player's 3 best rounds, then by handicap. {need} approved qualifying rounds to qualify. Points missing from a card are estimated with the WHS method.</p>
      <div className="board">
        <div className="board-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Pts·3</span><span className="bh-c">Hcp</span><span className="bh-c">Status</span></div>
        {d.road.length === 0 && <div className="empty" style={{ padding: 16, color: "#9fc2b3" }}>No members yet.</div>}
        {d.road.map((r, i) => (
          <div key={r.name} className={`board-row ${r.qualified ? "lead" : ""}`}>
            <span className="bh-rank num">{i + 1}</span><span className="bh-name">{r.name}</span>
            <span className="bh-c num tot">{r.points || 0}</span><span className="bh-c num">{fmtHcp(r.hcp)}</span>
            <span className="bh-c">{r.qualified ? <span className="badge badge-ok">In</span> : <span className="badge badge-warn">{r.count}/{need}</span>}</span>
          </div>))}
      </div>
    </div>
  );
}
