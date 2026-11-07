"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, ListOrdered, Loader2, ChevronDown, ChevronRight, Check, Map as MapIcon, Swords } from "lucide-react";
import TeamMatch from "@/components/open/TeamMatch";
import { api, fmtHcp } from "@/lib/client";
import { MAJOR, TIEBREAK } from "@/lib/major";


export default function GpfOpen() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("road");
  const [openName, setOpenName] = useState(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#final") setTab("final");
    if (window.location.hash === "#teams") setTab("teams");
  }, []);
  useEffect(() => {
    Promise.all([api("/api/leaderboard"), api("/api/config")])
      .then(([lb, cfg]) => setD({ road: lb.road, final: lb.final, config: cfg.config }))
      .catch(() => {});
  }, []);
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;

  const need = d.config.qualifyingRoundsRequired;
  // Final tab field: all players by GPF (Open) handicap, lowest first; no handicap last.
  const field = [...d.road].sort((a, b) => {
    const x = a.openIndex ?? a.hcp, y = b.openIndex ?? b.hcp;
    if (x == null && y == null) return a.name.localeCompare(b.name);
    if (x == null) return 1;
    if (y == null) return -1;
    return x - y || a.name.localeCompare(b.name);
  });

  return (
    <div className="stack">
      <div className="final-hero">
        <Trophy size={18} />
        <div>
          <div className="auth-eyebrow">GPF Open · {d.config.year}</div>
          <h2 className="page-h tight">Standings</h2>
        </div>
        <Link href="/open/map" className="btn btn-accent small-btn" style={{ marginLeft: "auto" }}><MapIcon size={15} /> Hole map</Link>
      </div>

      <div className="seg">
        <button className={tab === "road" ? "seg-on" : ""} onClick={() => setTab("road")}><ListOrdered size={15} /> Road</button>
        <button className={tab === "final" ? "seg-on" : ""} onClick={() => setTab("final")}><Trophy size={15} /> Final</button>
        <button className={tab === "teams" ? "seg-on" : ""} onClick={() => setTab("teams")}><Swords size={15} /> Teams</button>
      </div>

      {tab === "teams" ? <TeamMatch /> : tab === "road" ? (
        <>
          <p className="muted small">Ranked by total Stableford points from each player&rsquo;s 3 best rounds, then by handicap. {need} approved qualifying rounds to qualify. Every round is scored off the player&rsquo;s declared handicap (WHS Stableford for that gross on that tee). 36 a round means playing to handicap, so the best 3 are compared with 108 to set each player&rsquo;s Open handicap. Tap a player to see their rounds.</p>
          <div className="board">
            <div className="board-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Pts·3</span><span className="bh-c">Hcp</span><span className="bh-c">Status</span></div>
            {d.road.length === 0 && <div className="empty" style={{ padding: 16, color: "#9fc2b3" }}>No members yet.</div>}
            {d.road.map((r, i) => (<Fragment key={r.name}>
              <div className={`board-row ${r.qualified ? "lead" : ""}`} role="button" tabIndex={0} style={{ cursor: "pointer" }}
                   onClick={() => setOpenName(openName === r.name ? null : r.name)}
                   onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenName(openName === r.name ? null : r.name); } }}>
                <span className="bh-rank num">{i + 1}</span>
                <span className="bh-name" style={{ display: "flex", alignItems: "center", gap: 4 }}>{openName === r.name ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{r.name}</span>
                <span className="bh-c num tot">{r.points || 0}</span><span className="bh-c num">{fmtHcp(r.hcp)}</span>
                <span className="bh-c">{r.qualified ? <span className="badge badge-ok">{r.bonus ? `In · −${r.bonus}` : "In"}</span> : <span className="badge badge-warn">{r.count}/{need}</span>}</span>
              </div>
              {openName === r.name && <RoundsDetail rounds={r.rounds} row={r} />}
            </Fragment>))}
          </div>
        </>
      ) : (
        <>
          <p className="muted small">Single round at {MAJOR.course} — lowest net wins. Ties: {TIEBREAK[d.config.tiebreak]}.</p>
          <div className="board lb">
            <div className="board-head lb-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Hcp</span><span className="bh-c">Gross</span><span className="bh-c">Bonus</span><span className="bh-c tot">Net</span></div>
            {d.final.length === 0 && <div style={{ padding: 16, color: "#9fc2b3" }}>No scores yet — the Open is on {MAJOR.dayLabel}, {MAJOR.dateLabel}.</div>}
            {d.final.map((r, i) => (
              <div key={r.name} className={`board-row lb-row ${i === 0 && r.total != null ? "champion" : ""}`}>
                <span className="bh-rank num">{i === 0 && r.total != null ? <Trophy size={15} /> : i + 1}</span><span className="bh-name">{r.name}</span>
                <span className="bh-c num">{fmtHcp(r.hcp)} <span className="ph">({r.ph ?? "—"})</span></span>
                <span className="bh-c num">{r.gross ?? "—"}</span><span className="bh-c num">{r.bonus ? `−${r.bonus}` : "—"}</span><span className="bh-c num tot">{r.total ?? "—"}</span>
              </div>))}
          </div>
          <p className="hint">Playing handicap (in brackets) = course handicap on the tee played × {d.config.handicapAllowance}%. Net = gross − playing handicap − road bonus (3/2/1 strokes for the top three on the road).</p>

          <div className="sec-h" style={{ marginTop: 18 }}>Field · GPF handicaps</div>
          <p className="muted small">Every player&rsquo;s handicap for the Open: declared, adjusted by their best 3 road rounds against 108. The top three on the road also get the bonus strokes off their net.</p>
          <div className="board">
            <div className="board-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Decl.</span><span className="bh-c">GPF hcp</span><span className="bh-c">Bonus</span></div>
            {field.length === 0 && <div style={{ padding: 16, color: "#9fc2b3" }}>No members yet.</div>}
            {field.map((r, i) => (
              <div key={r.name} className={`board-row ${r.bonus ? "lead" : ""}`}>
                <span className="bh-rank num">{i + 1}</span>
                <span className="bh-name">{r.name}{!r.qualified && <span className="badge badge-warn" style={{ marginLeft: 6 }}>{r.count}/{need}</span>}</span>
                <span className="bh-c num">{fmtHcp(r.hcp)}</span>
                <span className="bh-c num tot">{fmtHcp(r.openIndex ?? r.hcp)}{r.adjust ? <span className="ph"> ({r.adjust > 0 ? "+" : ""}{r.adjust})</span> : null}</span>
                <span className="bh-c num">{r.bonus ? `−${r.bonus}` : "—"}</span>
              </div>))}
          </div>
          <p className="hint">Ranked by GPF handicap, lowest first. Players without 3 approved rounds keep their declared handicap and are marked with their round count.</p>
        </>
      )}
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
