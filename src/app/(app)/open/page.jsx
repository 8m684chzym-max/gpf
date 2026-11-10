"use client";
import { useEffect, useState } from "react";
import { Trophy, Loader2, Calendar, MapPin, Swords } from "lucide-react";
import TeamMatch from "@/components/open/TeamMatch";
import { api, fmtHcp } from "@/lib/client";
import { MAJOR, TIEBREAK } from "@/lib/major";

// GPF Open: this year's edition, next year's placeholder, and the 2027 team league
// (Warriors vs Patuas — the team match play that used to sit under "Teams").
const TABS = [["2026", "2026"], ["2027", "2027"], ["league", "Team league 2027"]];

export default function GpfOpen() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("2026");
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h === "teams" || h === "league") setTab("league");
    else if (TABS.some(([k]) => k === h)) setTab(h);
  }, []);
  useEffect(() => {
    Promise.all([api("/api/leaderboard"), api("/api/config")])
      .then(([lb, cfg]) => setD({ road: lb.road, final: lb.final, config: cfg.config }))
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
            {k === "league" && <Swords size={14} />}{label}
          </button>))}
      </div>
      {tab === "league" ? <TeamMatch />
        : tab === "2027" ? <Open2027 />
        : !d ? <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>
        : <Open2026 d={d} />}
    </div>
  );
}

function Open2026({ d }) {
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
      <a href={MAJOR.url} target="_blank" rel="noreferrer" className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {MAJOR.image
          ? <img src={MAJOR.image} alt={MAJOR.course} width={72} height={72} style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", flexShrink: 0 }} />
          : <span style={{ width: 72, height: 72, borderRadius: 16, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--soft)" }}><Trophy size={26} /></span>}
        <div style={{ display: "grid", gap: 4 }}>
          <b style={{ fontSize: 17, letterSpacing: "-.02em" }}>{MAJOR.course}</b>
          <span className="muted small" style={{ display: "flex", alignItems: "center", gap: 6 }}><Calendar size={13} /> {MAJOR.dayLabel}, {MAJOR.dateLabel}</span>
          <span className="muted small" style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={13} /> {MAJOR.location} · single round · medal net · {d.config.handicapAllowance}% allowance</span>
        </div>
      </a>

      <div className="sec-h">Final standings</div>
      <p className="muted small" style={{ margin: 0 }}>Lowest net wins. Ties: {TIEBREAK[d.config.tiebreak]}.</p>
      <div className="board lb">
        <div className="board-head lb-head"><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Hcp</span><span className="bh-c">Gross</span><span className="bh-c">Bonus</span><span className="bh-c tot">Net</span></div>
        {d.final.length === 0 && <div className="empty" style={{ padding: 16 }}>No scores yet — the Open is on {MAJOR.dayLabel}, {MAJOR.dateLabel}.</div>}
        {d.final.map((r, i) => (
          <div key={r.name} className={`board-row lb-row ${i === 0 && r.total != null ? "champion" : ""}`}>
            <span className="bh-rank num">{i === 0 && r.total != null ? <Trophy size={15} /> : i + 1}</span><span className="bh-name">{r.name}</span>
            <span className="bh-c num">{fmtHcp(r.hcp)} <span className="ph">({r.ph ?? "—"})</span></span>
            <span className="bh-c num">{r.gross ?? "—"}</span><span className="bh-c num">{r.bonus ? `−${r.bonus}` : "—"}</span><span className="bh-c num tot">{r.total ?? "—"}</span>
          </div>))}
      </div>
      <p className="hint">Playing handicap (in brackets) = course handicap on the tee played × {d.config.handicapAllowance}%. Net = gross − playing handicap − Rank bonus (3/2/1 strokes for the top three).</p>

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
      <p className="hint">Declared handicap adjusted by each player&rsquo;s best 3 Rank rounds against 108. Players without {need} approved rounds keep their declared handicap.</p>
    </>
  );
}

function Open2027() {
  return (
    <div className="card placeholder">
      <div className="eyebrow">Open 2027</div>
      <h3>Venue and date to be announced.</h3>
      <p>The 2027 edition will appear here once the committee confirms the course. Meanwhile, the road to it is on Rank and the team league is already on.</p>
    </div>
  );
}
