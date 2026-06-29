"use client";
import { useEffect, useState } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";

export default function Road() {
  const [d, setD] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [roundsMap, setRoundsMap] = useState({});
  
  useEffect(() => {
    Promise.all([api("/api/leaderboard"), api("/api/config"), api("/api/rounds")]).then(([lb, cfg, rnd]) => {
      setD({ road: lb.road, config: cfg.config });
      // Map rounds by userId for easy lookup
      const map = {};
      rnd.rounds.forEach(r => {
        if (!map[r.userId]) map[r.userId] = [];
        if (r.status === "APPROVED") map[r.userId].push(r);
      });
      // Sort and get top 3 for each user
      Object.keys(map).forEach(uid => {
        map[uid].sort((a, b) => {
          const scoreA = a.points ?? 0;
          const scoreB = b.points ?? 0;
          return scoreB - scoreA;
        });
        map[uid] = map[uid].slice(0, 3);
      });
      setRoundsMap(map);
    }).catch(() => {});
  }, []);
  
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  const need = d.config.qualifyingRoundsRequired;
  
  return (
    <div className="stack">
      <h2 className="page-h">Road to GPF · {d.config.year}</h2>
      <p className="muted small">{need} approved qualifying rounds to qualify. Click a player to see their best 3 rounds.</p>
      <div className="board">
        <div className="board-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Rounds</span><span className="bh-c">Hcp</span><span className="bh-c">Status</span></div>
        {d.road.length === 0 && <div className="empty" style={{ padding: 16, color: "#9fc2b3" }}>No members yet.</div>}
        {d.road.map((r, i) => {
          const playerRounds = roundsMap[r.userId] || [];
          const isExp = expanded[r.userId];
          
          return (
            <div key={r.userId}>
              <div className={`board-row ${r.qualified ? "lead" : ""}`} style={{ cursor: "pointer" }} onClick={() => setExpanded({...expanded, [r.userId]: !isExp})}>
                <span className="bh-rank num"><ChevronRight size={16} style={{ transform: isExp ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} /></span>
                <span className="bh-name">{r.name}</span>
                <span className="bh-c num">{r.count}/{need}</span><span className="bh-c num">{fmtHcp(r.hcp)}</span>
                <span className="bh-c">{r.qualified ? <span className="badge badge-ok">In</span> : <span className="badge badge-warn">{r.count}/{need}</span>}</span>
              </div>
              {isExp && playerRounds.length > 0 && (
                <div style={{ background: "var(--surface-1)", padding: "12px 16px", borderBottom: "0.5px solid var(--border)" }}>
                  {playerRounds.map((round, idx) => (
                    <div key={round.id} style={{ paddingBottom: "12px", marginBottom: idx < playerRounds.length - 1 ? "12px" : "0", borderBottom: idx < playerRounds.length - 1 ? "0.5px solid var(--border)" : "none", fontSize: "13px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <strong>{round.course?.name}</strong><br/>
                          <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{round.date?.slice(0, 10)} • {round.gross} strokes</span>
                        </div>
                        <div style={{ textAlign: "right", fontWeight: "500", color: "var(--text-accent)" }}>
                          {round.points ?? "—"} pts
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
