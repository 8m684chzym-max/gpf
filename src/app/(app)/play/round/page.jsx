"use client";
// Play › Start play › round: set up (tee, up to 4 players with handicaps, witness), then the
// live scorecard for the whole group with Stableford / Strokeplay / Net / Match play views.
// Scores are entered hole by hole on the map (/play/map) or here; "Finish & submit" turns
// YOUR card into a qualifying round on Rank.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Check, Flag, Loader2, Map as MapIcon, Plus, Trash2, X } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";
import { strokesOnHole } from "@/lib/scoring";
import { courseBySlug, courseMapFor, DEFAULT_COURSE } from "@/lib/holes";
import { CARD_HOLES, MAX_PLAYERS, clearLive, courseHcp, holeNet, holePoints, holesOf, loadLive, mapHoleOf, matchFormats, matchState, newLive, parOf, saveLive, setStroke, siOf, strokesOn, totals } from "@/lib/liveRound";

const today = () => new Date().toISOString().slice(0, 10);

export default function LiveRoundPage() {
  const [live, setLive] = useState(undefined); // undefined = loading, null = none
  const [want, setWant] = useState(null);      // course asked for with ?course=<slug>
  const [keep, setKeep] = useState(false);     // carry on with the round in progress anyway
  useEffect(() => {
    setLive(loadLive());
    setWant(courseBySlug(new URLSearchParams(window.location.search).get("course")));
  }, []);
  if (live === undefined) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  // A round in progress on another course must not hijack "Start a round" on this one.
  const elsewhere = live && want && courseMapFor(live.courseName)?.slug !== want.slug;
  if (elsewhere && !keep) return <OtherRound live={live} want={want} onKeep={() => setKeep(true)} onDiscard={() => { clearLive(); setLive(null); }} />;
  return live ? <Card live={live} setLive={setLive} /> : <Setup onStart={setLive} />;
}

function OtherRound({ live, want, onKeep, onDiscard }) {
  const t = totals(live);
  const discard = () => { if (confirm(`Discard your round at ${live.courseName}? The scores on this phone will be deleted.`)) onDiscard(); };
  return (
    <div className="stack">
      <div className="page-top">
        <Link href="/play" className="link small" style={{ display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start" }}><ArrowLeft size={13} /> Play</Link>
        <div className="eyebrow">Start play · {want.name}</div>
        <h1 className="page-h">Round in progress elsewhere.</h1>
        <p className="lede">You have a round at <b>{live.courseName}</b> on this phone ({t.played}/{CARD_HOLES} holes, {live.date}). Finish or discard it to start one at {want.name}.</p>
      </div>
      <div className="btn-row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <Link href={`/play/map?course=${want.slug}`} className="btn btn-primary"><MapIcon size={15} /> {want.name} map</Link>
        <button className="btn btn-ghost" onClick={onKeep}>Go to the {live.courseName} round</button>
        <button className="btn btn-ghost" onClick={discard}><Trash2 size={15} /> Discard it and start here</button>
      </div>
    </div>
  );
}

const GUEST = "__guest";
const blankPlayer = () => ({ memberId: "", name: "", hcp: "" });

function Setup({ onStart }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [d, setD] = useState(null);
  const [f, setF] = useState({ teeId: "", hcp: "", witnessId: "", date: today() });
  const [others, setOthers] = useState([blankPlayer()]); // the rest of the group (up to 3)
  const [err, setErr] = useState("");
  const [cm, setCm] = useState(null); // mapped course from ?course=<slug> (default Pinheirinho)
  useEffect(() => { setCm(courseBySlug(new URLSearchParams(window.location.search).get("course")) || DEFAULT_COURSE); }, []);

  useEffect(() => {
    if (!session?.user || !cm) return;
    Promise.all([api("/api/courses"), api("/api/members"), api("/api/leaderboard")]).then(([cs, ms, lb]) => {
      const course = (cs.courses || []).find((c) => courseMapFor(c.name)?.slug === cm.slug);
      const rankHcp = (name) => (lb.road || []).find((r) => r.name === name)?.hcp ?? null;
      const tees = (course?.tees || []).slice().sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      const members = (ms.members || []).filter((m) => m.role !== "ADMIN" && m.approved !== false && m.name !== session.user.name)
        .map((m) => ({ ...m, hcp: rankHcp(m.name) ?? m.manualHandicap ?? m.declaredHandicap ?? null }));
      const mine = rankHcp(session.user.name);
      setD({ course, tees, rankHcp: mine, members });
      setF((x) => ({ ...x, teeId: tees[0]?.id || "", hcp: mine != null ? String(mine) : "" }));
    }).catch((e) => setErr(e.message));
  }, [session?.user, cm]);

  if (err) return <div className="inline-err">{err}</div>;
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  if (!d.course) return <div className="card empty">{cm.name} isn&rsquo;t in the course list yet — ask the committee to add it.</div>;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const tee = d.tees.find((t) => t.id === f.teeId);
  const okHcp = (h) => h === "" || (!Number.isNaN(Number(h)) && Number(h) >= -10 && Number(h) <= 54);
  const ch = (h) => (tee && h !== "" && okHcp(h) ? courseHcp({ tee, players: [{ hcp: Number(h) }] }) : null);

  const setOther = (i, patch) => setOthers((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const pickMember = (i, id) => {
    if (id === GUEST) return setOther(i, { memberId: GUEST, name: "", hcp: "" });
    const m = d.members.find((x) => x.id === id);
    setOther(i, { memberId: id, name: m?.name || "", hcp: m?.hcp != null ? String(m.hcp) : "" });
  };
  const taken = others.map((o) => o.memberId).filter((x) => x && x !== GUEST);
  const filled = others.filter((o) => o.memberId && (o.memberId !== GUEST || o.name.trim()));
  const memberPlayers = filled.filter((o) => o.memberId !== GUEST);
  const witnessId = memberPlayers.some((o) => o.memberId === f.witnessId) ? f.witnessId : memberPlayers[0]?.memberId || "";
  const allOk = okHcp(f.hcp) && filled.every((o) => okHcp(o.hcp));

  const start = () => {
    const players = [{ name: session.user.name, memberId: null, hcp: f.hcp },
      ...filled.map((o) => ({ name: o.memberId === GUEST ? o.name.trim() : o.name, memberId: o.memberId === GUEST ? null : o.memberId, hcp: o.hcp }))];
    const w = d.members.find((m) => m.id === witnessId);
    const r = newLive({ course: d.course, tee, players, witness: w, date: f.date });
    saveLive(r); onStart(r);
    router.push(`/play/map?course=${cm.slug}&hole=1`);
  };

  return (
    <div className="stack">
      <div className="page-top">
        <Link href="/play" className="link small" style={{ display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start" }}><ArrowLeft size={13} /> Play</Link>
        <div className="eyebrow">Start play · {d.course.name}</div>
        <h1 className="page-h">Your round.</h1>
        <p className="lede">Keep score for up to {MAX_PLAYERS} players — GPF members or guests — hole by hole. Your own card becomes a scorecard on Rank at the end, witnessed by a member in your group.</p>
        {cm.holes.length < 18 && <p className="hint" style={{ margin: 0 }}>{cm.name} has {cm.holes.length} holes: the card is 18 holes, two loops — holes 10–18 are holes 1–9 again.</p>}
      </div>
      <div className="card form">
        <div className="round-edit" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
          <div className="row2">
            <label className="field"><span className="label">Tee</span>
              <select className="input" value={f.teeId} onChange={(e) => set("teeId", e.target.value)}>
                {d.tees.map((t) => <option key={t.id} value={t.id}>{t.name}{t.rating ? ` · ${t.rating}/${t.slope ?? 113}` : ""}</option>)}
              </select></label>
            <label className="field"><span className="label">Date</span>
              <input className="input" type="date" value={f.date} max={today()} onChange={(e) => set("date", e.target.value)} /></label>
          </div>

          <label className="field"><span className="label">{session.user.name} (you) · handicap index <span className="muted">(GPF Rank: {fmtHcp(d.rankHcp)})</span></span>
            <input className="input" inputMode="decimal" value={f.hcp} onChange={(e) => set("hcp", e.target.value.replace(",", "."))} style={{ maxWidth: 160 }} />
            <span className="hint">{ch(f.hcp) != null ? `Course handicap on this tee: ${ch(f.hcp)}. ` : ""}Rank always scores your card with your official handicap.</span></label>

          {others.map((o, i) => (
            <div key={i} className="field">
              <span className="label">Player {i + 2}</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <select className="input" style={{ flex: "1 1 160px" }} value={o.memberId} onChange={(e) => pickMember(i, e.target.value)}>
                  <option value="">Choose a member or guest…</option>
                  {d.members.filter((m) => m.id === o.memberId || !taken.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  <option value={GUEST}>Guest (not in GPF)</option>
                </select>
                {o.memberId === GUEST && <input className="input" style={{ flex: "1 1 120px" }} placeholder="Guest name" value={o.name} onChange={(e) => setOther(i, { name: e.target.value })} />}
                <input className="input" style={{ width: 84 }} inputMode="decimal" placeholder="HCP" aria-label={`Player ${i + 2} handicap index`} value={o.hcp} onChange={(e) => setOther(i, { hcp: e.target.value.replace(",", ".") })} />
                <button className="btn btn-ghost" style={{ padding: "8px 10px" }} aria-label="Remove player" onClick={() => setOthers((xs) => xs.filter((_, j) => j !== i))}><X size={15} /></button>
              </div>
              {o.memberId && ch(o.hcp) != null && <span className="hint">Course handicap {ch(o.hcp)}</span>}
            </div>))}
          {others.length < MAX_PLAYERS - 1 && (
            <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setOthers((xs) => [...xs, blankPlayer()])}><Plus size={15} /> Add a player</button>)}

          <label className="field"><span className="label">Member witness</span>
            <select className="input" value={witnessId} disabled={!memberPlayers.length} onChange={(e) => set("witnessId", e.target.value)}>
              {!memberPlayers.length && <option value="">Add a GPF member to the group</option>}
              {memberPlayers.map((o) => <option key={o.memberId} value={o.memberId}>{o.name}</option>)}
            </select>
            <span className="hint">{memberPlayers.length ? "Your card goes to Rank witnessed by this member." : "Without a member in the group you can still keep score, but your card can't be submitted to Rank."}</span></label>

          <button className="btn btn-primary" disabled={!tee || !allOk || !f.date} onClick={start}><Flag size={15} /> Start round on hole 1</button>
          <Link href={`/play/map?course=${cm.slug}`} className="btn btn-ghost"><MapIcon size={15} /> Just look at the map</Link>
        </div>
      </div>
    </div>
  );
}

const MODES = [["stableford", "Stableford"], ["stroke", "Strokeplay"], ["net", "Net"], ["match", "Match play"]];
const signed = (n) => (n > 0 ? `+${n}` : n === 0 ? "E" : `${n}`);
const first = (name) => (name || "").split(" ")[0];

function Card({ live, setLive }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const [mode, setMode] = useState("stableford");
  const P = live.players;
  const fmts = matchFormats(P.length);
  const [fmtId, setFmtId] = useState(fmts.find((x) => x.kind === "fourball")?.id || fmts[0]?.id);
  const fmt = fmts.find((x) => x.id === fmtId) || fmts[0];
  const ms = mode === "match" && fmt ? matchState(live, fmt) : null;

  const t = totals(live, 0);
  const mine = holesOf(live, 0);
  const update = (p, i, v) => {
    const digits = v.replace(/\D/g, "");
    const n = digits ? Math.min(20, Math.max(1, Number(digits))) : null;
    const r = setStroke(live, p, i, n);
    saveLive(r); setLive(r);
  };
  const complete = mine.every((s) => s);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await api("/api/rounds", { method: "POST", body: JSON.stringify({
        type: "QUALIFYING", date: live.date, courseId: live.courseId, teeId: live.teeId,
        gross: t.gross, partnerId: live.witnessId, holes: mine, source: "MANUAL",
        out: mine.slice(0, 9).reduce((s, x) => s + x, 0), in: mine.slice(9).reduce((s, x) => s + x, 0),
      }) });
      clearLive(); setDone(res);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const discard = () => { if (confirm("Discard this round? The scores on this phone will be deleted.")) { clearLive(); setLive(null); } };

  if (done) return (
    <div className="stack">
      <div className="card success" style={{ padding: 32 }}>
        <Check size={30} />
        <h2 className="page-h tight">Card submitted.</h2>
        <p className="muted" style={{ margin: 0 }}>{done.held ? done.message : `Gross ${t.gross}${done.points != null ? ` · ${done.points} Stableford points` : ""} — it's on Rank now.`}</p>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <Link href="/rank" className="btn btn-primary">See Rank</Link>
          <Link href="/profile" className="btn btn-ghost">My rounds</Link>
        </div>
      </div>
    </div>
  );

  // Leaderboard for the chosen format: Stableford high wins; strokeplay / net low wins (vs par of holes played).
  const rows = P.map((pl, p) => ({ pl, p, ...totals(live, p), ch: courseHcp(live, p) }));
  const key = mode === "stableford" ? (x) => -x.points : mode === "net" ? (x) => x.netToPar : (x) => x.toPar;
  const board = [...rows].sort((a, b) => (a.played ? 0 : 1) - (b.played ? 0 : 1) || key(a) - key(b));
  const headline = mode === "stableford" ? `${t.points} pts` : mode === "net" ? `net ${t.net || "—"}` : `${t.gross} (${signed(t.toPar)})`;

  const cols = `40px 26px 30px repeat(${P.length}, minmax(0,1fr))${ms ? " 40px" : ""}`;
  const cell = (p, i) => {
    if (mode === "stableford") return holePoints(live, i, p);
    if (mode === "net") return holeNet(live, i, p);
    if (mode === "match" && ms && ms.rx[p] != null) { const n = ms.holes[i].net[p]; return n != null && n !== holesOf(live, p)[i] ? `net ${n}` : null; }
    return null;
  };
  const sideName = (side) => side.map((p) => first(P[p].name)).join(" & ");
  const half = (p, a, z) => holesOf(live, p).slice(a, z).reduce((s, x) => s + (x || 0), 0);
  const witnessLine = live.witnessName ? `witness ${live.witnessName}` : "no member witness — not for Rank";

  return (
    <div className="stack">
      <div className="page-top">
        <div className="eyebrow">Live round · {live.courseName} · {live.teeName}</div>
        <h1 className="page-h">{mode === "match" && ms ? (ms.up === 0 || ms.winner === "H" ? ms.label : `${sideName(ms.up > 0 ? fmt.A : fmt.B)} ${ms.label}`) : t.played ? headline : "Your card."}</h1>
        <p className="lede">{P.length} player{P.length > 1 ? "s" : ""} · {t.played}/{CARD_HOLES} holes · {witnessLine} · {live.date}</p>
      </div>
      <div className="btn-row" style={{ justifyContent: "flex-start" }}>
        <button className="btn btn-primary" onClick={() => router.push(`/play/map?course=${courseMapFor(live.courseName)?.slug || DEFAULT_COURSE.slug}&hole=${(mine.findIndex((s) => !s) + 1) || CARD_HOLES}`)}><MapIcon size={15} /> Back to the map</button>
      </div>

      <div className="seg" role="tablist">
        {MODES.filter(([k]) => k !== "match" || P.length > 1).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? "seg-on" : ""} onClick={() => setMode(k)}>{label}</button>))}
      </div>

      {mode === "match" && fmt ? (
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="field" style={{ margin: 0 }}><span className="label">Match</span>
            <select className="input" value={fmt.id} onChange={(e) => setFmtId(e.target.value)}>
              {fmts.map((x) => <option key={x.id} value={x.id}>{x.kind === "fourball" ? "Four-ball · " : "Singles · "}{sideName(x.A)} v {sideName(x.B)}</option>)}
            </select></label>
          <div className="small muted">
            {fmt.kind === "fourball" ? "Better ball, 90% of course handicap" : "Net, 100% of course handicap"}, strokes off the lowest:{" "}
            {[...fmt.A, ...fmt.B].map((p) => `${first(P[p].name)} ${ms.rx[p]}`).join(" · ")}
          </div>
        </div>
      ) : (
        <div className="board">
          <div className="board-head" style={{ gridTemplateColumns: "34px minmax(0,1fr) 54px 64px" }}>
            <span>#</span><span>Player</span><span style={{ textAlign: "right" }}>Thru</span>
            <span style={{ textAlign: "right" }}>{mode === "stableford" ? "Pts" : mode === "net" ? "Net" : "Gross"}</span>
          </div>
          {board.map((x, n) => (
            <div key={x.p} className="board-row" style={{ gridTemplateColumns: "34px minmax(0,1fr) 54px 64px" }}>
              <span className="bh-rank">{x.played ? n + 1 : "–"}</span>
              <span className="bh-name">{x.pl.name}{x.pl.me ? " (you)" : ""} <span className="ph">CH {x.ch ?? "—"}</span></span>
              <span className="num" style={{ textAlign: "right" }}>{x.played || "—"}</span>
              <span className="num bh-c tot" style={{ textAlign: "right" }}>
                {!x.played ? "—" : mode === "stableford" ? x.points : mode === "net" ? <>{x.net} <small>({signed(x.netToPar)})</small></> : <>{x.gross} <small>({signed(x.toPar)})</small></>}
              </span>
            </div>))}
        </div>
      )}

      <div className="board">
        <div className="board-head" style={{ display: "grid", gridTemplateColumns: cols, gap: 6 }}>
          <span>Hole</span><span>Par</span><span>SI</span>
          {P.map((pl, p) => <span key={p} style={{ textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{first(pl.name)}</span>)}
          {ms && <span style={{ textAlign: "center" }}>Res</span>}
        </div>
        {mine.map((_, i) => (
          <div key={i} className="board-row" style={{ display: "grid", gridTemplateColumns: cols, gap: 6, alignItems: "center", padding: "8px 12px" }}>
            <span className="num"><b>{i + 1}</b>{mapHoleOf(live, i)?.n !== i + 1 ? <span className="muted small"> ({mapHoleOf(live, i).n})</span> : null}</span>
            <span className="num">{parOf(live, i)}</span>
            <span className="num muted">{siOf(live, i)}</span>
            {P.map((pl, p) => {
              const inMatch = !ms || fmt.A.includes(p) || fmt.B.includes(p);
              const dots = mode === "match" ? (inMatch && ms ? Math.max(0, strokesOnHole(siOf(live, i), ms.rx[p])) : 0) : Math.max(0, strokesOn(live, i, p));
              const v = cell(p, i);
              return (
                <span key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, opacity: inMatch ? 1 : 0.4 }}>
                  <input className="hole-in" style={{ maxWidth: 56 }} inputMode="numeric" value={holesOf(live, p)[i] ?? ""} aria-label={`${pl.name} hole ${i + 1} strokes`} onChange={(e) => update(p, i, e.target.value)} />
                  <span className="small" style={{ lineHeight: 1, minHeight: 12 }}>
                    {dots > 0 && <span style={{ color: "var(--flag)" }}>{"•".repeat(dots)} </span>}
                    {v != null && <span className="muted">{mode === "stableford" ? `${v} pt${v === 1 ? "" : "s"}` : mode === "net" ? `net ${v}` : v}</span>}
                  </span>
                </span>);
            })}
            {ms && <span className="num" style={{ textAlign: "center", fontWeight: 700 }}>{ms.holes[i].win === "H" ? "½" : ms.holes[i].win ? first(P[(ms.holes[i].win === "A" ? fmt.A : fmt.B)[0]].name).slice(0, 3) + (fmt.kind === "fourball" ? "+" : "") : ""}</span>}
          </div>))}
        <div className="board-row" style={{ display: "grid", gridTemplateColumns: cols, gap: 6, alignItems: "center", padding: "10px 12px" }}>
          <span className="muted small" style={{ gridColumn: "span 3" }}>Out / In<br />Total</span>
          {P.map((pl, p) => { const x = totals(live, p); return (
            <span key={p} className="num" style={{ textAlign: "center", fontSize: 13 }}>
              {half(p, 0, 9) || "—"} / {half(p, 9, 18) || "—"}<br />
              <b>{mode === "stableford" ? `${x.points} pts` : mode === "net" ? (x.played ? x.net : "—") : x.gross || "—"}</b>
            </span>); })}
          {ms && <span />}
        </div>
      </div>
      <p className="hint" style={{ margin: 0 }}>Dots = handicap strokes on that hole{mode === "match" ? " in this match" : ""}.{P.length > 1 ? " Only your card goes to Rank; the others are for the group's scores." : ""}</p>

      {err && <div className="inline-err">{err}</div>}
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={discard}><Trash2 size={15} /> Discard</button>
        <button className="btn btn-primary" disabled={!complete || busy || !live.witnessId} onClick={submit}>{busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Finish &amp; submit to Rank</button>
      </div>
      {!complete && <p className="hint" style={{ textAlign: "right", margin: 0 }}>Enter all 18 of your holes to submit.</p>}
      {complete && !live.witnessId && <p className="hint" style={{ textAlign: "right", margin: 0 }}>No GPF member witness in this group, so it can&rsquo;t go to Rank. Discard it when you&rsquo;re done.</p>}
    </div>
  );
}
