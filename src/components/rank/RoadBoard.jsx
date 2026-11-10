"use client";
// Rank (was "Road to GPF"): every member ranked by Stableford points from their best 3 qualifying rounds.
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { fmtHcp } from "@/lib/client";

export default function RoadBoard({ road, need }) {
  const [openName, setOpenName] = useState(null);
  const toggle = (name) => setOpenName(openName === name ? null : name);
  return (
    <div className="board">
      <div className="board-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Pts·3</span><span className="bh-c">Hcp</span><span className="bh-c">Status</span></div>
      {road.length === 0 && <div className="empty" style={{ padding: 16 }}>No members yet.</div>}
      {road.map((r, i) => (<Fragment key={r.name}>
        <div className={`board-row ${r.qualified ? "lead" : ""}`} role="button" tabIndex={0} style={{ cursor: "pointer" }}
             onClick={() => toggle(r.name)}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(r.name); } }}>
          <span className="bh-rank num">{i + 1}</span>
          <span className="bh-name" style={{ display: "flex", alignItems: "center", gap: 4 }}>{openName === r.name ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{r.name}</span>
          <span className="bh-c num tot">{r.points || 0}</span><span className="bh-c num">{fmtHcp(r.hcp)}</span>
          <span className="bh-c">{r.qualified ? <span className="badge badge-ok">{r.bonus ? `In · −${r.bonus}` : "In"}</span> : <span className="badge badge-warn">{r.count}/{need}</span>}</span>
        </div>
        {openName === r.name && <RoundsDetail rounds={r.rounds} row={r} />}
      </Fragment>))}
    </div>
  );
}

// One player's approved qualifying rounds. ✓ marks the best three that make up the road total.
function RoundsDetail({ rounds, row }) {
  if (!rounds) return null;
  const cell = { padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap" };
  return (
    <div className="rd" style={{ padding: "4px 8px 12px 28px", overflowX: "auto" }}>
      {rounds.length === 0 ? <div className="muted small">No approved qualifying rounds yet.</div> : (
        <table className="small" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...cell, textAlign: "left" }}>Date</th><th style={{ ...cell, textAlign: "left" }}>Course</th>
            <th style={cell}>Gross</th><th style={cell}>Playing hcp</th><th style={cell}>Pts</th><th style={cell} aria-label="Counts"></th>
          </tr></thead>
          <tbody>{rounds.map((x) => (
            <tr key={x.id} style={{ opacity: x.counted ? 1 : 0.55 }}>
              <td style={{ ...cell, textAlign: "left" }} className="num">{x.date ? String(x.date).slice(0, 10) : "—"}</td>
              <td style={{ ...cell, textAlign: "left", whiteSpace: "normal" }}>{x.course ?? "—"}{x.tee ? <span className="muted"> · {x.tee}</span> : null}</td>
              <td style={cell} className="num">{x.gross ?? "—"}</td>
              <td style={cell} className="num">{x.ph ?? "—"}</td>
              <td style={cell} className="num"><b>{x.points ?? "—"}</b></td>
              <td style={cell}>{x.counted ? <Check size={14} aria-label="counts" /> : null}</td>
            </tr>))}</tbody>
        </table>)}
      <div className="muted small" style={{ marginTop: 4 }}><Check size={12} /> = one of the 3 best rounds counted in the total</div>
      {row?.perRound != null && (
        <div style={{ marginTop: 6 }}>
          Declared {fmtHcp(row.hcp)} · best 3 = {row.points} pts ({row.perRound > 0 ? "+" : ""}{row.perRound} a round vs 36)
          {" → "}<b>Open handicap {fmtHcp(row.openIndex)}</b> ({row.adjust > 0 ? "+" : ""}{row.adjust})
        </div>)}
    </div>
  );
}
