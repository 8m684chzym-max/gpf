"use client";
import { useEffect, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";
const TIEBREAK = { "final-net": "lowest final-round net", back9: "lowest final-round back 9", manual: "committee decision" };

export default function Final() {
  const [d, setD] = useState(null);
  useEffect(() => { Promise.all([api("/api/leaderboard"), api("/api/config")]).then(([lb, cfg]) => setD({ final: lb.final, config: cfg.config })).catch(() => {}); }, []);
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  return (
    <div className="stack">
      <div className="final-hero"><Trophy size={18} /><div><div className="auth-eyebrow">GPF Weekend · {d.config.year}</div><h2 className="page-h tight">Final standings</h2></div></div>
      <p className="muted small">Lowest two-round net wins. Ties: {TIEBREAK[d.config.tiebreak]}.</p>
      <div className="board lb">
        <div className="board-head lb-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Hcp</span><span className="bh-c">R1</span><span className="bh-c">R2</span><span className="bh-c tot">Net</span></div>
        {d.final.length === 0 && <div style={{ padding: 16, color: "#9fc2b3" }}>No weekend scores in yet.</div>}
        {d.final.map((r, i) => (
          <div key={r.name} className={`board-row lb-row ${i === 0 && r.total != null ? "champion" : ""}`}>
            <span className="bh-rank num">{i === 0 && r.total != null ? <Trophy size={15} /> : i + 1}</span><span className="bh-name">{r.name}</span>
            <span className="bh-c num">{fmtHcp(r.hcp)} <span className="ph">({r.ph ?? "—"})</span></span>
            <span className="bh-c num">{r.net1 ?? "—"}</span><span className="bh-c num">{r.net2 ?? "—"}</span><span className="bh-c num tot">{r.total ?? "—"}</span>
          </div>))}
      </div>
      <p className="hint">R1/R2 show net strokes (gross − playing handicap). Playing handicap in brackets.</p>
    </div>
  );
}
