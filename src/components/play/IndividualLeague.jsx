"use client";
import { useEffect, useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { buildIndividualLeague, fmtPts } from "@/lib/league";

// Individual league: side games (4/3/2/1) + confirmed 1v1 match play (1 / ½).
export default function IndividualLeague() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    Promise.all([api("/api/games?status=finished").catch(() => ({ games: [] })), api("/api/matchplay").catch(() => ({ matches: [] }))])
      .then(([g, mp]) => setRows(buildIndividualLeague(g.games || [], mp.matches || [])));
  }, []);
  if (!rows) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  const cols = { display: "grid", gridTemplateColumns: "28px minmax(0,1fr) 64px 52px 52px", gap: 6 };
  return (
    <>
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>One season-long ladder. <b>Match play</b>: win 1, halved ½. <b>Side games</b>: 4 / 3 / 2 / 1 to the top four. Separate from Rank, the Open and the Team Cup.</p>
      {rows.length === 0 ? <div className="card empty">No points yet. Register a match or finish a side game.</div> : (
        <div className="board">
          <div className="board-head" style={cols}><span>#</span><span>Player</span><span style={{ textAlign: "center" }}>W-D-L</span><span style={{ textAlign: "center" }}>Games</span><span style={{ textAlign: "right" }}>Pts</span></div>
          {rows.map((r, i) => (
            <div key={r.name + i} className={`board-row ${i === 0 ? "lead" : ""}`} style={{ ...cols, alignItems: "center" }}>
              <span className="bh-rank num">{i === 0 && r.points > 0 ? <Crown size={14} style={{ color: "var(--flag)" }} /> : i + 1}</span>
              <span className="bh-name">{r.name}</span>
              <span className="bh-c num">{r.matches ? `${r.w}-${r.d}-${r.l}` : "—"}</span>
              <span className="bh-c num">{r.games || "—"}</span>
              <span className="bh-c tot num" style={{ textAlign: "right" }}>{fmtPts(r.points)}</span>
            </div>))}
        </div>)}
    </>
  );
}
