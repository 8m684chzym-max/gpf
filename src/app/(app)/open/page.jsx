"use client";
import { useEffect, useState } from "react";
import { Trophy, Loader2, Calendar, MapPin } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";
import { MAJOR, RANK_SINCE_LABEL } from "@/lib/major";
import { OPEN_2026, OPEN_2026_RESULTS } from "@/lib/open2026";

// GPF Open: 2026 final results (frozen, lib/open2026.js) and the 2027 field.
// The team match play is its own event now: Team Cup (/team-cup).
const TABS = [["2026", "2026"], ["2027", "2027"]];

export default function GpfOpen() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("2026");
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h === "teams" || h === "league") { window.location.replace("/team-cup" + window.location.search); return; }
    if (TABS.some(([k]) => k === h)) setTab(h);
  }, []);
  useEffect(() => {
    Promise.all([api("/api/leaderboard"), api("/api/config")])
      .then(([lb, cfg]) => setD({ road: lb.road, config: cfg.config }))
      .catch(() => {});
  }, []);
  const pick = (k) => { setTab(k); window.history.replaceState(null, "", `/open#${k}`); };

  return (
    <div className="stack">
      <div className="page-top">
        <div className="eyebrow">GPF Open</div>
        <h1 className="page-h">One round. One champion.</h1>
      </div>
      <div className="seg" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "seg-on" : ""} onClick={() => pick(k)}>
            {label}
          </button>))}
      </div>
      {tab === "2026" ? <Open2026 />
        : !d ? <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>
        : <Open2027 d={d} />}
    </div>
  );
}

function Open2026() {
  const rows = OPEN_2026_RESULTS;
  return (
    <>
      <a href={MAJOR.url} target="_blank" rel="noreferrer" className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {MAJOR.image
          ? <img src={MAJOR.image} alt={OPEN_2026.course} width={72} height={72} style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", flexShrink: 0 }} />
          : <span style={{ width: 72, height: 72, borderRadius: 16, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--soft)" }}><Trophy size={26} /></span>}
        <div style={{ display: "grid", gap: 4 }}>
          <b style={{ fontSize: 17, letterSpacing: "-.02em" }}>{OPEN_2026.course}</b>
          <span className="muted small" style={{ display: "flex", alignItems: "center", gap: 6 }}><Calendar size={13} /> {OPEN_2026.date}</span>
          <span className="muted small" style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={13} /> {MAJOR.location} · {OPEN_2026.tee} tees · {OPEN_2026.format}</span>
        </div>
      </a>

      <div className="card champ-card">
        <Trophy size={22} />
        <div><div className="eyebrow" style={{ margin: 0 }}>Champion 2026</div><b>{rows[0].name}</b> <span className="muted">· net {rows[0].net}</span></div>
      </div>

      <div className="sec-h">Final results</div>
      <div className="board lb open-final">
        <div className="board-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Hcp</span><span className="bh-c">Gross</span><span className="bh-c">Bonus</span><span className="bh-c tot">Net</span><span className="bh-c">Pts</span></div>
        {rows.map((r, i) => (
          <div key={r.name} className={`board-row ${r.pos === 1 ? "champion" : ""}`}>
            <span className="bh-rank num">{r.pos === 1 ? <Trophy size={15} /> : `${r.tied ? "T" : ""}${r.pos}`}</span>
            <span className="bh-name">{r.name}</span>
            <span className="bh-c num">{r.hcp}</span>
            <span className="bh-c num">{r.gross}</span>
            <span className="bh-c num">{r.bonus ? `−${r.bonus}` : "—"}</span>
            <span className="bh-c num tot">{r.net}</span>
            <span className="bh-c num">{r.pts}</span>
          </div>))}
      </div>
      <p className="hint">Net = gross − Rank bonus strokes (3/2/1) − playing handicap. Lowest net wins; equal nets share the place. Stableford points are shown for reference only and don&rsquo;t include the bonus strokes.</p>
    </>
  );
}

function Open2027({ d }) {
  const need = d.config.qualifyingRoundsRequired;
  // Field: everyone by GPF (Open) handicap, lowest first; no handicap last.
  const field = [...d.road].sort((a, b) => {
    const x = a.openIndex ?? a.hcp, y = b.openIndex ?? b.hcp;
    if (x == null && y == null) return a.name.localeCompare(b.name);
    if (x == null) return 1;
    if (y == null) return -1;
    return x - y || a.name.localeCompare(b.name);
  });
  return (
    <>
      <div className="card placeholder">
        <div className="eyebrow">Open 2027</div>
        <h3>Venue and date to be announced.</h3>
        <p>The 2027 edition will appear here once the committee confirms the course. The road to it runs on Rank.</p>
      </div>

      <div className="sec-h">Field · GPF handicaps</div>
      <div className="board">
        <div className="board-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Decl.</span><span className="bh-c">GPF hcp</span><span className="bh-c">Bonus</span></div>
        {field.length === 0 && <div className="empty" style={{ padding: 16 }}>No members yet.</div>}
        {field.map((r, i) => (
          <div key={r.name} className={`board-row ${r.bonus ? "lead" : ""}`}>
            <span className="bh-rank num">{i + 1}</span>
            <span className="bh-name">{r.name}{!r.qualified && <span className="badge badge-warn" style={{ marginLeft: 6 }}>{r.count}/{need}</span>}</span>
            <span className="bh-c num">{fmtHcp(r.hcp)}</span>
            <span className="bh-c num tot">{fmtHcp(r.openIndex ?? r.hcp)}{r.adjust ? <span className="ph"> ({r.adjust > 0 ? "+" : ""}{r.adjust})</span> : null}</span>
            <span className="bh-c num">{r.bonus ? `−${r.bonus}` : "—"}</span>
          </div>))}
      </div>
      <p className="hint">Declared handicap = playing handicap at the Open 2026, adjusted by each player&rsquo;s best 3 Rank rounds since {RANK_SINCE_LABEL} against 108. Players without {need} approved rounds keep their declared handicap. The top three on Rank carry 3/2/1 bonus strokes.</p>
    </>
  );
}
