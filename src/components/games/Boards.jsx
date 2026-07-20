"use client";
import { Check, ChevronLeft, ChevronRight, Crown, Flag, Minus, Trophy, X } from "lucide-react";
import GameIcon from "@/components/games/GameIcon";
import {
  GAMES, HOLES, standings, holesPlayed,
  wolfIndexFor, wolfHolePoints, rrTeams, rrHolePoints, bbbHolePoints,
} from "@/lib/games";

const initials = (name) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// ---- shared pieces -------------------------------------------------------
function Leaderboard({ game }) {
  const rows = standings(game);
  const grid = { display: "grid", gridTemplateColumns: "30px 1fr 52px", gap: 6, padding: "11px 13px", alignItems: "center" };
  return (
    <div className="board" style={{ marginTop: 4 }}>
      <div className="board-head" style={{ ...grid, gridTemplateColumns: "30px 1fr 52px" }}>
        <span>#</span><span>Player</span><span style={{ textAlign: "right" }}>Pts</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.id} className={`board-row ${i === 0 && r.points > 0 ? "lead" : ""}`} style={{ ...grid }}>
          <span className="bh-rank num">{i + 1}</span>
          <span className="bh-name">{r.name}</span>
          <span className="bh-c tot" style={{ textAlign: "right" }}>{r.points}</span>
        </div>
      ))}
    </div>
  );
}

function HoleNav({ game, setGame }) {
  const hole = game.hole;
  const go = (h) => setGame((g) => ({ ...g, hole: Math.min(HOLES, Math.max(1, h)) }));
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <button className="btn btn-ghost small-btn" disabled={hole <= 1} onClick={() => go(hole - 1)}>
        <ChevronLeft size={16} />
      </button>
      <div style={{ textAlign: "center" }}>
        <div className="muted small" style={{ letterSpacing: 1, textTransform: "uppercase" }}>Hole</div>
        <div style={{ fontFamily: "var(--disp)", fontSize: 30, fontWeight: 700, lineHeight: 1, color: "var(--green-900)" }}>{hole}</div>
        <div className="muted small">{holesPlayed(game)}/{HOLES} scored</div>
      </div>
      <button className="btn btn-ghost small-btn" disabled={hole >= HOLES} onClick={() => go(hole + 1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// A generic tap chip for players
function Chip({ active, onClick, children, tone = "green" }) {
  const base = {
    padding: "10px 12px", borderRadius: 11, border: "1px solid var(--line)", background: "#fff",
    color: "var(--ink)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", display: "inline-flex",
    alignItems: "center", gap: 6, justifyContent: "center",
  };
  const on = tone === "amber"
    ? { background: "var(--flag-soft)", borderColor: "#f0d79a", color: "#7a5300" }
    : { background: "var(--green-700)", borderColor: "var(--green-700)", color: "#fff" };
  return <button onClick={onClick} style={active ? { ...base, ...on } : base}>{children}</button>;
}

// ---- Wolf ----------------------------------------------------------------
function WolfBoard({ game, setGame }) {
  const hole = game.hole;
  const w = wolfIndexFor(game, hole);
  const res = game.holes[hole - 1] || {};
  const others = game.players.map((_, i) => i).filter((i) => i !== w);
  const set = (patch) => setGame((g) => {
    const holes = g.holes.slice();
    holes[hole - 1] = { ...(holes[hole - 1] || {}), ...patch };
    return { ...g, holes };
  });
  const pickMode = (mode, partner = null) => set({ mode, partner, outcome: res.outcome || null });
  const pts = wolfHolePoints(game, hole);
  const partnered = res.mode === "partner";

  return (
    <>
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Crown size={18} style={{ color: "var(--flag)" }} />
          <div>
            <div style={{ fontWeight: 700 }}>{game.players[w].name} is the Wolf</div>
            <div className="muted small">Wolf rotates each hole</div>
          </div>
        </div>

        <div>
          <div className="label" style={{ marginBottom: 6 }}>Wolf's call</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {others.map((i) => (
              <Chip key={i} active={partnered && res.partner === i} onClick={() => pickMode("partner", i)}>
                + {game.players[i].name}
              </Chip>
            ))}
            <Chip active={res.mode === "lone"} onClick={() => pickMode("lone")} tone="amber">Lone Wolf</Chip>
            <Chip active={res.mode === "blind"} onClick={() => pickMode("blind")} tone="amber">Blind Wolf</Chip>
          </div>
        </div>

        {res.mode && (
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              {partnered ? `${game.players[w].name} + ${game.players[res.partner]?.name} vs field` : `${game.players[w].name} alone vs field`}
            </div>
            <div className="seg">
              <button className={res.outcome === "win" ? "seg-on" : ""} onClick={() => set({ outcome: "win" })}><Check size={14} /> Won</button>
              <button className={res.outcome === "halve" ? "seg-on" : ""} onClick={() => set({ outcome: "halve" })}><Minus size={14} /> Halved</button>
              <button className={res.outcome === "loss" ? "seg-on" : ""} onClick={() => set({ outcome: "loss" })}><X size={14} /> Lost</button>
            </div>
          </div>
        )}

        {res.outcome && (
          <div className="ocr-note">
            This hole: {pts.map((v, i) => v ? `${game.players[i].name} +${v}` : null).filter(Boolean).join(" · ") || "no points"}
          </div>
        )}
      </div>
      <div className="muted small" style={{ padding: "0 4px" }}>
        Scoring — 2v2 win: +1 each · Lone Wolf win: +3 · Lone loss: +1 to each opponent · Blind Wolf win: +4.
      </div>
    </>
  );
}

// ---- Round Robin ---------------------------------------------------------
function RoundRobinBoard({ game, setGame }) {
  const hole = game.hole;
  const [A, B] = rrTeams(hole);
  const res = game.holes[hole - 1] || {};
  const set = (winner) => setGame((g) => {
    const holes = g.holes.slice();
    holes[hole - 1] = { winner };
    return { ...g, holes };
  });
  const name = (idxs) => idxs.map((i) => game.players[i].name).join(" & ");
  const seg = hole <= 6 ? 1 : hole <= 12 ? 2 : 3;

  return (
    <>
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div className="muted small">Better-ball · pairing block {seg} of 3 (holes {(seg - 1) * 6 + 1}–{seg * 6})</div>
        <div style={{ display: "grid", gap: 8 }}>
          <Chip active={res.winner === "A"} onClick={() => set("A")}><Check size={14} /> Team A — {name(A)}</Chip>
          <Chip active={res.winner === "halve"} onClick={() => set("halve")} tone="amber"><Minus size={14} /> Halved</Chip>
          <Chip active={res.winner === "B"} onClick={() => set("B")}><Check size={14} /> Team B — {name(B)}</Chip>
        </div>
      </div>
      <div className="muted small" style={{ padding: "0 4px" }}>Winning side: +1 to each partner, every hole. Partners rotate each 6 holes.</div>
    </>
  );
}

// ---- Bingo Bango Bongo ---------------------------------------------------
function BBBBoard({ game, setGame }) {
  const hole = game.hole;
  const res = game.holes[hole - 1] || {};
  const set = (cat, idx) => setGame((g) => {
    const holes = g.holes.slice();
    const cur = { ...(holes[hole - 1] || {}) };
    cur[cat] = cur[cat] === idx ? null : idx; // tap again to clear
    holes[hole - 1] = cur;
    return { ...g, holes };
  });
  const rows = [
    ["bingo", "Bingo", "First on the green"],
    ["bango", "Bango", "Closest once all on"],
    ["bongo", "Bongo", "First in the cup"],
  ];
  return (
    <>
      <div className="card" style={{ display: "grid", gap: 16 }}>
        {rows.map(([cat, label, hint]) => (
          <div key={cat}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span className="label">{label}</span>
              <span className="muted small">{hint}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))", gap: 8 }}>
              {game.players.map((p, i) => (
                <Chip key={p.id} active={res[cat] === i} onClick={() => set(cat, i)}>{p.name}</Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="muted small" style={{ padding: "0 4px" }}>One point per category, per hole. Tap a name again to clear it.</div>
    </>
  );
}

const BOARDS = { wolf: WolfBoard, roundrobin: RoundRobinBoard, bbb: BBBBoard };

// ---- top-level board -----------------------------------------------------
export default function GameBoard({ game, setGame, onExit }) {
  const Inner = BOARDS[game.type];
  const meta = GAMES[game.type];
  const lead = standings(game)[0];
  const done = holesPlayed(game) >= HOLES;

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <GameIcon type={game.type} size={26} style={{ color: "var(--green-700)" }} />
          <div>
            <div className="muted small" style={{ letterSpacing: 1, textTransform: "uppercase" }}>Side game</div>
            <h2 className="page-h" style={{ margin: 0 }}>{meta.name}</h2>
          </div>
        </div>
        <button className="btn btn-ghost small-btn" onClick={onExit}><X size={15} /> Exit</button>
      </div>

      <div className="ocr-note"><Flag size={14} /> Casual game — doesn't affect the Road to GPF Open.</div>

      <div className="card"><HoleNav game={game} setGame={setGame} /></div>

      <Inner game={game} setGame={setGame} />

      <div className="sec-h" style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Trophy size={15} /> Standings
        {done && lead?.points > 0 && <span className="badge badge-accent" style={{ marginLeft: "auto" }}><Crown size={11} /> {lead.name}</span>}
      </div>
      <Leaderboard game={game} />
    </div>
  );
}
