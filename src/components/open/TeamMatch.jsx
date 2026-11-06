"use client";
// GPF Open · Team match play — two teams, 3 groups of 4, six 1v1 net matches.
// Live-synced (4 s polling) like the other side games; maths in src/lib/teammatch.js.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Map as MapIcon, ArrowLeft, ChevronLeft, ChevronRight, Loader2, Pencil, Save, Swords, Trash2, Trophy, Users, Wifi, Lock, Unlock } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";
import { openPlayingHandicap } from "@/lib/scoring";
import { TM_GROUPS, TM_PLAYERS, TM_TO_WIN, matchList, matchState, teamScore, medalTiebreak, holeStrokes, fmtPts, liveMedal, fmtToPar, groupOf } from "@/lib/teammatch";

export default function TeamMatch() {
  const [d, setD] = useState(null);          // { match, setup, isAdmin, year }
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(false);
  const [scoring, setScoring] = useState(null); // group index being scored
  const [openMatch, setOpenMatch] = useState(null);
  const pending = useRef(new Map());         // "player-hole" → local gross not yet confirmed
  const [startHole, setStartHole] = useState(null); // from the hole map: /open?score=N#teams
  const jumped = useRef(false);

  const load = () => api("/api/open-match").then((r) => {
    if (r.match) for (const [k, v] of pending.current) { const [p, h] = k.split("-").map(Number); r.match.scores[p][h - 1] = v; }
    setD(r); setErr(null);
  }).catch((e) => setErr(e.message));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!d?.match || editing) return;
    const iv = setInterval(() => { if (!document.hidden) load(); }, 4000);
    return () => clearInterval(iv);
  }, [!!d?.match, editing]);
  // Arrived from the hole map (/open?score=N#teams): open my group's score entry on that hole, once.
  useEffect(() => {
    if (!d || jumped.current) return;
    jumped.current = true;
    const n = Number(new URLSearchParams(window.location.search).get("score"));
    if (!n) return;
    window.history.replaceState(null, "", "/open#teams");
    const me = d.match ? d.match.players.findIndex((p) => p.userId && p.userId === d.me) : -1;
    if (n >= 1 && n <= 18 && me >= 0) { setStartHole(n); setScoring(groupOf(me)); }
  }, [d]);

  if (!d) return err ? <div className="card muted small">{err}</div> : <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;

  if (editing || (!d.match && d.isAdmin && d.setup)) {
    if (!d.match && !editing)
      return <Intro onStart={() => setEditing(true)} />;
    return <Setup d={d} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />;
  }
  if (!d.match) return <div className="card muted small">The team match for the GPF Open hasn&rsquo;t been set up yet.</div>;

  const m = d.match;
  const myIdx = m.players.findIndex((p) => p.userId && p.userId === d.me);
  const canScore = (player) => d.isAdmin || (myIdx >= 0 && groupOf(myIdx) === groupOf(player));
  const writeHole = async (player, hole, gross) => {
    const key = `${player}-${hole}`;
    pending.current.set(key, gross);
    setD((prev) => { const scores = prev.match.scores.map((r) => r.slice()); scores[player][hole - 1] = gross; return { ...prev, match: { ...prev.match, scores } }; });
    try { await api("/api/open-match", { method: "PATCH", body: JSON.stringify({ player, hole, gross }) }); }
    catch (e) { alert(e.message); }
    finally { if (pending.current.get(key) === gross) pending.current.delete(key); }
  };

  if (scoring != null)
    return <ScoreEntry m={m} group={scoring} myIdx={myIdx} canScore={canScore} startHole={startHole}
      onBack={() => { setScoring(null); setStartHole(null); }} onWrite={writeHole} />;

  return <Overview d={d} m={m} myIdx={myIdx} canScore={canScore} openMatch={openMatch} setOpenMatch={setOpenMatch} onScore={setScoring}
    onEdit={() => setEditing(true)} reload={load} />;
}

function Intro({ onStart }) {
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="sec-h"><Swords size={15} /> Team match play</div>
      <p className="muted small" style={{ margin: 0 }}>Twelve players, two teams, three groups of four. In every group two 1v1 net matches run alongside the medal: the higher handicap gets the difference in Open playing handicaps, by stroke index. 1 point a match, ½ for a half — first to {fmtPts(TM_TO_WIN)} wins. At 3–3, the lower sum of the team&rsquo;s six medal nets wins.</p>
      <button className="btn btn-primary" onClick={onStart}><Users size={16} /> Set up teams</button>
    </div>
  );
}

// ---------------------------------------------------------------- overview
function Overview({ d, m, myIdx, canScore, openMatch, setOpenMatch, onScore, onEdit, reload }) {
  const ts = useMemo(() => teamScore(m), [m]);
  const tb = useMemo(() => medalTiebreak(m.nets?.map((x) => x.net)), [m.nets]);
  const [A, B] = m.teams;
  const name = (i) => m.players[i]?.name ?? "—";
  const finalWinner = ts.winner === "TIE" ? (tb.winner === "A" ? "A" : tb.winner === "B" ? "B" : tb.winner === "H" ? "H" : null) : ts.winner;

  const setStatus = async (status) => { try { await api("/api/open-match", { method: "PATCH", body: JSON.stringify({ status }) }); reload(); } catch (e) { alert(e.message); } };
  const del = async () => {
    if (!confirm("Delete the team match and every score entered? This can't be undone.")) return;
    try { await api("/api/open-match", { method: "DELETE" }); reload(); } catch (e) { alert(e.message); }
  };

  return (
    <div className="stack">
      <div className="tm-score">
        <div className="tm-team"><span className="tm-dot" />{A}</div>
        <div className="tm-big">{fmtPts(ts.a)}<span className="sep">–</span>{fmtPts(ts.b)}</div>
        <div className="tm-team b">{B}<span className="tm-dot b" /></div>
        {finalWinner && finalWinner !== "H" && <div className="tm-win"><Trophy size={14} style={{ verticalAlign: -2 }} /> {finalWinner === "A" ? A : B} win{ts.winner === "TIE" ? " on medal net" : ""}</div>}
        {finalWinner === "H" && <div className="tm-win">Tied — even on medal net</div>}
        {!ts.allDone && !ts.winner && <div className="tm-sub">Live projection {fmtPts(ts.projA)}–{fmtPts(ts.projB)} · {fmtPts(TM_TO_WIN)} to win</div>}
        {ts.winner === "TIE" && <div className="tm-sub">3–3 · medal net {tb.complete ? `${tb.sumA} v ${tb.sumB}` : "waiting for every card"}</div>}
      </div>

      {myIdx >= 0 && m.status !== "FINISHED" && (
        <button className="btn btn-primary" onClick={() => onScore(groupOf(myIdx))}><Pencil size={16} /> Enter my score</button>
      )}
      <div className="ocr-note"><Wifi size={14} /> Live · {m.tee} tees · every player enters their own gross per hole — medal net and match status update for everyone. {m.status === "FINISHED" ? "Match closed." : ""}</div>

      {Array.from({ length: TM_GROUPS }, (_, g) => (
        <div key={g} className="card tm-group">
          <div className="tm-ghead">
            <span className="sec-h" style={{ margin: 0 }}>Group {g + 1}</span>
            {m.status !== "FINISHED" && canScore(g * 4) && <button className="btn btn-ghost small-btn" onClick={() => onScore(g)}><Pencil size={14} /> Scores</button>}
          </div>
          {ts.states.filter((s) => s.group === g).map((s) => {
            const pill = s.done ? (s.winner === "H" ? "h" : s.winner.toLowerCase()) : s.thru && s.up ? (s.up > 0 ? "a" : "b") : "";
            const text = s.done
              ? (s.winner === "H" ? "Halved" : s.label)
              : s.label;
            return (
              <Fragment key={s.id}>
                <div className="tm-match" role="button" tabIndex={0} onClick={() => setOpenMatch(openMatch === s.id ? null : s.id)}>
                  <span className={`tm-p ${s.up > 0 ? "lead" : ""}`}><span className="tm-dot" />{name(s.a)} <span className="ph">({m.ph[s.a]})</span></span>
                  <span className={`tm-pill ${pill}`}>{text}</span>
                  <span className={`tm-p b ${s.up < 0 ? "lead" : ""}`}><span className="ph">({m.ph[s.b]})</span> {name(s.b)}<span className="tm-dot b" /></span>
                </div>
                {openMatch === s.id && <HoleStrip s={s} m={m} />}
              </Fragment>
            );
          })}
        </div>
      ))}

      <LiveMedal m={m} myIdx={myIdx} />

      {(ts.winner === "TIE" || ts.allDone) && m.nets && (
        <div className="card stack" style={{ gap: 8 }}>
          <div className="sec-h">Tie-break · medal net</div>
          {[["a", A, tb.sumA], ["b", B, tb.sumB]].map(([k, team, sum]) => (
            <div key={k} className="small">
              <b>{team}</b> — {tb.complete ? sum : "…"}
              <div className="muted">{matchList().map((x) => `${name(x[k])} ${m.nets[x[k]]?.net ?? "—"}`).join(" · ")}</div>
            </div>
          ))}
          <div className="hint">Official GPF Open card when approved (gross − playing hcp − road bonus); otherwise the 18 grosses entered here.</div>
        </div>
      )}

      {d.isAdmin && (
        <div className="btn-row" style={{ justifyContent: "flex-start" }}>
          <button className="btn btn-ghost small-btn" onClick={onEdit}><Users size={14} /> Edit line-ups</button>
          {m.status === "FINISHED"
            ? <button className="btn btn-ghost small-btn" onClick={() => setStatus("ACTIVE")}><Unlock size={14} /> Reopen</button>
            : <button className="btn btn-ghost small-btn" onClick={() => setStatus("FINISHED")}><Lock size={14} /> Close match</button>}
          <button className="btn btn-ghost small-btn" style={{ color: "var(--bad)" }} onClick={del}><Trash2 size={14} /> Delete</button>
        </div>
      )}
    </div>
  );
}

function LiveMedal({ m, myIdx }) {
  const rows = m.players.map((p, i) => ({ i, name: p.name, team: i % 2, ...liveMedal(m, i) }))
    .sort((a, b) => (a.toPar == null) - (b.toPar == null) || (a.toPar ?? 0) - (b.toPar ?? 0) || b.thru - a.thru || a.name.localeCompare(b.name));
  let rank = 0, prev;
  return (
    <>
      <div className="sec-h" style={{ marginTop: 6 }}><Trophy size={15} /> Live medal net</div>
      <div className="board">
        <div className="board-head" style={{ gridTemplateColumns: "30px 1fr 44px 48px 52px" }}><span className="bh-rank">#</span><span className="bh-name">Player</span><span className="bh-c">Thru</span><span className="bh-c">Gross</span><span className="bh-c">Net</span></div>
        {rows.map((r, k) => {
          if (r.toPar !== prev) { rank = k + 1; prev = r.toPar; }
          return (
            <div key={r.i} className={`board-row ${r.i === myIdx ? "lead" : ""}`} style={{ gridTemplateColumns: "30px 1fr 44px 48px 52px" }}>
              <span className="bh-rank num">{r.toPar == null ? "–" : rank}</span>
              <span className="bh-name" style={{ display: "flex", alignItems: "center", gap: 6 }}><span className={`tm-dot ${r.team ? "b" : ""}`} />{r.name} <span className="ph">({m.ph[r.i]})</span></span>
              <span className="bh-c num">{r.thru === 18 ? "F" : r.thru || "—"}</span>
              <span className="bh-c num">{r.gross ?? "—"}</span>
              <span className="bh-c num tot">{fmtToPar(r.toPar)}</span>
            </div>
          );
        })}
      </div>
      <p className="hint">Net to par so far, off the full Open playing handicap by stroke index. Road bonus strokes and the official result come from the approved card (Submit → GPF Open).</p>
    </>
  );
}

function HoleStrip({ s, m }) {
  return (
    <div className="tm-strip">
      {s.holes.map((h) => {
        const cls = h.win === "A" ? "a" : h.win === "B" ? "b" : h.win === "H" ? "h" : "";
        const st = h.sA ? `${m.players[s.a]?.name} gets ${h.sA}` : h.sB ? `${m.players[s.b]?.name} gets ${h.sB}` : "no strokes";
        return <div key={h.hole} className={`tm-cell ${cls}`} title={`Hole ${h.hole} · ${st}${h.gA != null ? ` · ${h.gA}–${h.gB ?? "?"}` : ""}`}>{h.hole}{(h.sA || h.sB) ? "•" : ""}</div>;
      })}
    </div>
  );
}

// ---------------------------------------------------------------- score entry
function ScoreEntry({ m, group, myIdx, canScore, startHole, onBack, onWrite }) {
  const seats = [0, 1, 2, 3].map((s) => group * 4 + s);
  const rows = Array.from({ length: 18 }, (_, h) => seats.map((p) => m.scores[p]?.[h] ?? null));
  const mineInGroup = myIdx >= 0 && groupOf(myIdx) === group;
  const firstOpen = rows.findIndex((r) => (mineInGroup ? r[myIdx % 4] == null : r.some((x) => x == null)));
  const [hole, setHole] = useState(startHole || (firstOpen < 0 ? 18 : firstOpen + 1));
  const holesRef = useRef(null);
  useEffect(() => {
    holesRef.current?.querySelector(".on")?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [hole]);

  const gross = rows[hole - 1];
  const par = m.par?.[hole - 1] ?? null, si = m.si?.[hole - 1] ?? null;
  const matches = matchList().filter((x) => x.group === group);
  const states = matches.map((x) => matchState(m, x));
  const set = (slot, v) => onWrite(group * 4 + slot, hole, v == null ? null : Math.max(1, Math.min(15, v)));
  const order = [0, 1, 2, 3]; // slot order: M1 A, M1 B, M2 A, M2 B
  const strokesFor = (slot) => {
    const x = matches[slot < 2 ? 0 : 1];
    const [sA, sB] = holeStrokes(m.ph[x.a], m.ph[x.b], si);
    return slot % 2 === 0 ? sA : sB;
  };

  return (
    <div className="stack">
      <div className="g-top">
        <button className="g-back" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <div style={{ flex: 1 }}>
          <div className="muted small" style={{ letterSpacing: 1, textTransform: "uppercase" }}>Team match · Group {group + 1}</div>
          <h2 className="page-h tight">Hole {hole}{par ? <span className="muted" style={{ fontSize: 15 }}> · Par {par} · SI {si}</span> : null}</h2>
        </div>
        <Link href={`/open/map?hole=${hole}`} className="btn btn-accent small-btn" aria-label={`Hole ${hole} map`}><MapIcon size={15} /> Map</Link>
      </div>

      <div className="tm-holes" ref={holesRef}>
        {Array.from({ length: 18 }, (_, i) => {
          const r = rows[i]; const done = r && r.every((x) => x != null);
          return <button key={i} className={`tm-hbtn ${done ? "done" : ""} ${hole === i + 1 ? "on" : ""}`} onClick={() => setHole(i + 1)}>{i + 1}</button>;
        })}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {order.map((slot) => {
          const idx = group * 4 + slot, v = gross[slot], st = strokesFor(slot), me = idx === myIdx, ok = canScore(idx);
          const lm = liveMedal(m, idx);
          return (
            <Fragment key={slot}>
              {slot === 2 && <div style={{ height: 6, background: "var(--paper)" }} />}
              <div className="tm-entry" style={me ? { background: "var(--flag-soft)" } : undefined}>
                <div>
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`tm-dot ${slot % 2 ? "b" : ""}`} />{m.players[idx]?.name}{me && <span className="badge badge-accent">You</span>}
                    {st > 0 && <span className="tm-strokes" title={`${st} stroke${st > 1 ? "s" : ""} in the match`}>{"●".repeat(st)}</span>}
                  </div>
                  <div className="muted small">{m.teams[slot % 2]} · PH {m.ph[idx]} · net {fmtToPar(lm.toPar)}{lm.thru ? ` thru ${lm.thru}` : ""}</div>
                </div>
                <div className="tm-step" style={ok ? undefined : { opacity: 0.4, pointerEvents: "none" }}>
                  <button onClick={() => set(slot, v == null ? (par ?? 4) - 1 : v - 1)} aria-label="One less">−</button>
                  <span className={`tm-val num ${v == null ? "empty" : ""}`} onClick={() => v == null ? set(slot, par ?? 4) : set(slot, null)} title={v == null ? "Tap for par" : "Tap to clear"}>{v ?? "–"}</span>
                  <button onClick={() => set(slot, v == null ? (par ?? 4) : v + 1)} aria-label="One more">+</button>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        {states.map((s) => {
          const h = s.holes[hole - 1];
          return (
            <div key={s.id} className="small" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span><b>{m.players[s.a]?.name}</b> v <b>{m.players[s.b]?.name}</b>{h.win ? <span className="muted"> · hole {hole}: {h.win === "H" ? "halved" : m.players[h.win === "A" ? s.a : s.b]?.name}</span> : null}</span>
              <span className={`tm-pill ${s.done ? (s.winner === "H" ? "h" : s.winner.toLowerCase()) : s.up > 0 ? "a" : s.up < 0 ? "b" : ""}`}>{s.done && s.winner !== "H" ? `${m.players[s.winner === "A" ? s.a : s.b]?.name.split(" ")[0]} ${s.label}` : s.label.replace(/ UP/, s.up > 0 ? ` UP ${m.players[s.a]?.name.split(" ")[0]}` : s.up < 0 ? ` UP ${m.players[s.b]?.name.split(" ")[0]}` : " UP")}</span>
            </div>
          );
        })}
      </div>

      <div className="btn-row" style={{ justifyContent: "space-between" }}>
        <button className="btn btn-ghost" disabled={hole <= 1} onClick={() => setHole(hole - 1)}><ChevronLeft size={16} /> {hole - 1 || ""}</button>
        <button className="btn btn-primary" disabled={hole >= 18} onClick={() => setHole(hole + 1)}>Hole {Math.min(18, hole + 1)} <ChevronRight size={16} /></button>
      </div>
      <p className="hint center">Enter your gross — medal net and both matches update live for everyone. ● = shot received in your match on this hole. Tap an empty score for par, tap a score to clear it. Anyone in the group can correct a partner&rsquo;s slip. The official medal card still goes in through Submit.</p>
    </div>
  );
}

// ---------------------------------------------------------------- setup (admin)
function Setup({ d, onCancel, onSaved }) {
  const { setup, match } = d;
  const tees = setup.tees;
  const defaultTee = match ? tees.find((t) => t.name === match.tee) : tees.find((t) => /yellow/i.test(t.name) && !/\(w\)/i.test(t.name)) || tees[0];
  const [teeId, setTeeId] = useState(defaultTee?.id || "");
  const [teams, setTeams] = useState(match?.teams || ["Team A", "Team B"]);
  const [ids, setIds] = useState(() => match ? match.players.map((p) => p.userId || "") : Array(TM_PLAYERS).fill(""));
  const [ph, setPh] = useState(() => match ? match.ph.map((x) => (x == null ? "" : String(x))) : Array(TM_PLAYERS).fill(""));
  const [touched, setTouched] = useState(() => Array(TM_PLAYERS).fill(!!match)); // PH edited by hand → don't overwrite
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const tee = tees.find((t) => t.id === teeId);
  const cand = (id) => setup.candidates.find((c) => c.id === id);
  const suggest = (id, t = tee) => { const c = cand(id); const v = c && t ? openPlayingHandicap(c.openIndex, t, setup.config) : null; return v == null ? "" : String(v); };

  const pick = (i, id) => {
    setIds((a) => { const n = a.slice(); n[i] = id; return n; });
    setPh((a) => { const n = a.slice(); n[i] = suggest(id); return n; });
    setTouched((a) => { const n = a.slice(); n[i] = false; return n; });
  };
  const changeTee = (id) => {
    setTeeId(id);
    const t = tees.find((x) => x.id === id);
    setPh((a) => a.map((v, i) => (touched[i] || !ids[i] ? v : suggest(ids[i], t))));
  };
  const recalcAll = () => { setPh(ids.map((id) => (id ? suggest(id) : ""))); setTouched(Array(TM_PLAYERS).fill(false)); };

  const used = new Set(ids.filter(Boolean));
  const ready = ids.every(Boolean) && used.size === TM_PLAYERS && ph.every((x) => x !== "" && Number.isFinite(Number(x))) && teeId;
  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await api("/api/open-match", { method: "POST", body: JSON.stringify({ teams, teeId, players: ids.map((userId, i) => ({ userId, ph: ph[i] })) }) });
      onSaved();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const teamSum = (k) => ids.reduce((s, id, i) => s + ((i % 2) === k && ph[i] !== "" ? Number(ph[i]) : 0), 0);

  return (
    <div className="stack">
      <div className="g-top">
        {match && <button className="g-back" onClick={onCancel} aria-label="Back"><ArrowLeft size={20} /></button>}
        <div style={{ flex: 1 }}>
          <div className="muted small" style={{ letterSpacing: 1, textTransform: "uppercase" }}>GPF Open · Team match</div>
          <h2 className="page-h tight">{match ? "Edit line-ups" : "Set up teams"}</h2>
        </div>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <div className="grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[0, 1].map((k) => (
            <label key={k} className="field"><span className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}><span className={`tm-dot ${k ? "b" : ""}`} />Team {k + 1}</span>
              <input className="input" value={teams[k]} maxLength={24} onChange={(e) => setTeams(teams.map((t, j) => (j === k ? e.target.value : t)))} />
            </label>
          ))}
        </div>
        <label className="field"><span className="label">Tee (playing handicaps &amp; stroke index)</span>
          <select className="input" value={teeId} onChange={(e) => changeTee(e.target.value)}>
            {tees.length === 0 && <option value="">No Pinheirinho tees — run add-pinheirinho</option>}
            {tees.map((t) => <option key={t.id} value={t.id}>{t.name}{t.rating ? ` · CR ${t.rating} / SR ${t.slope}` : ""}{t.strokeIndex?.length === 18 ? "" : " · no SI"}</option>)}
          </select>
        </label>
        <div className="hint">PH = course handicap on this tee × {setup.config.handicapAllowance}% from each player&rsquo;s GPF Open handicap — same as the medal. Override any number by hand; road bonus strokes don&rsquo;t apply in the matches. <button className="link" onClick={recalcAll}>Recalculate all</button></div>
      </div>

      {Array.from({ length: TM_GROUPS }, (_, g) => (
        <div key={g} className="card stack" style={{ gap: 10 }}>
          <div className="sec-h" style={{ margin: 0 }}>Group {g + 1}</div>
          {[0, 1].map((mi) => (
            <div key={mi} className="stack" style={{ gap: 6 }}>
              {[0, 1].map((side) => {
                const i = g * 4 + mi * 2 + side, c = cand(ids[i]);
                return (
                  <Fragment key={side}>
                    {side === 1 && <div className="tm-vs">vs</div>}
                    <div className="tm-setup-row">
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span className={`tm-dot ${side ? "b" : ""}`} />
                        <select className="input" value={ids[i]} onChange={(e) => pick(i, e.target.value)}>
                          <option value="">{teams[side]} · match {g * 2 + mi + 1}</option>
                          {setup.candidates.filter((x) => x.id === ids[i] || !used.has(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name} ({fmtHcp(x.openIndex)})</option>)}
                        </select>
                      </div>
                      <input className="input" inputMode="numeric" aria-label="Playing handicap" placeholder="PH" value={ph[i]}
                        onChange={(e) => { const v = e.target.value.replace(/[^0-9-]/g, ""); setPh(ph.map((x, j) => (j === i ? v : x))); setTouched(touched.map((x, j) => (j === i ? true : x))); }} />
                    </div>
                    {c && side === 1 && ids[i - 1] && ph[i] !== "" && ph[i - 1] !== "" && (
                      <div className="hint" style={{ textAlign: "right" }}>
                        {Number(ph[i]) === Number(ph[i - 1]) ? "Level — no strokes" : `${Number(ph[i]) > Number(ph[i - 1]) ? c.name : cand(ids[i - 1])?.name} gets ${Math.abs(Number(ph[i]) - Number(ph[i - 1]))}`}
                      </div>
                    )}
                  </Fragment>
                );
              })}
              {mi === 0 && <div style={{ borderTop: "1px solid var(--line)", margin: "4px 0" }} />}
            </div>
          ))}
        </div>
      ))}

      <div className="muted small">Team PH totals: {teams[0]} {teamSum(0)} · {teams[1]} {teamSum(1)}</div>
      {err && <div className="inline-err">{err}</div>}
      {match && <div className="warn-strip">Scores already entered stay attached to each group&rsquo;s seats — swapping players mid-round moves their holes with the seat.</div>}
      <div className="btn-row">
        {match && <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
        <button className="btn btn-primary" disabled={!ready || saving} onClick={save}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save</button>
      </div>
    </div>
  );
}
