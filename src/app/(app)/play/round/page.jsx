"use client";
// Play › Start play › individual round: set up (tee, handicap, witness), then the
// live scorecard. Scores are entered hole by hole on the map (/play/map) or here;
// "Finish & submit" turns the card into a qualifying round on Rank.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Check, Flag, Loader2, Map as MapIcon, Trash2 } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";
import { courseBySlug, courseMapFor, DEFAULT_COURSE } from "@/lib/holes";
import { clearLive, courseHcp, holePoints, loadLive, mapHoleOf, newLive, parOf, saveLive, siOf, strokesOn, totals } from "@/lib/liveRound";

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
        <p className="lede">You have a round at <b>{live.courseName}</b> on this phone ({t.played}/{live.holes.length} holes, {live.date}). Finish or discard it to start one at {want.name}.</p>
      </div>
      <div className="btn-row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <Link href={`/play/map?course=${want.slug}`} className="btn btn-primary"><MapIcon size={15} /> {want.name} map</Link>
        <button className="btn btn-ghost" onClick={onKeep}>Go to the {live.courseName} round</button>
        <button className="btn btn-ghost" onClick={discard}><Trash2 size={15} /> Discard it and start here</button>
      </div>
    </div>
  );
}

function Setup({ onStart }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [d, setD] = useState(null);
  const [f, setF] = useState({ teeId: "", hcp: "", partnerId: "", date: today() });
  const [err, setErr] = useState("");
  const [cm, setCm] = useState(null); // mapped course from ?course=<slug> (default Pinheirinho)
  useEffect(() => { setCm(courseBySlug(new URLSearchParams(window.location.search).get("course")) || DEFAULT_COURSE); }, []);

  useEffect(() => {
    if (!session?.user || !cm) return;
    Promise.all([api("/api/courses"), api("/api/members"), api("/api/leaderboard")]).then(([cs, ms, lb]) => {
      const course = (cs.courses || []).find((c) => courseMapFor(c.name)?.slug === cm.slug);
      const me = (lb.road || []).find((r) => r.name === session.user.name);
      const tees = (course?.tees || []).slice().sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      setD({ course, tees, rankHcp: me?.hcp ?? null, members: (ms.members || []).filter((m) => m.role !== "ADMIN" && m.name !== session.user.name) });
      setF((x) => ({ ...x, teeId: tees[0]?.id || "", hcp: me?.hcp != null ? String(me.hcp) : "" }));
    }).catch((e) => setErr(e.message));
  }, [session?.user, cm]);

  if (err) return <div className="inline-err">{err}</div>;
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  if (!d.course) return <div className="card empty">{cm.name} isn&rsquo;t in the course list yet — ask the committee to add it.</div>;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const tee = d.tees.find((t) => t.id === f.teeId);
  const partner = d.members.find((m) => m.id === f.partnerId);
  const hcpOk = f.hcp === "" || (!Number.isNaN(Number(f.hcp)) && Number(f.hcp) >= -10 && Number(f.hcp) <= 54);
  const ch = tee && f.hcp !== "" && hcpOk ? courseHcp({ hcp: Number(f.hcp), tee }) : null;

  const start = () => {
    const r = newLive({ course: d.course, tee, hcp: f.hcp, partner, date: f.date });
    saveLive(r); onStart(r);
    router.push(`/play/map?course=${cm.slug}&hole=1`);
  };

  return (
    <div className="stack">
      <div className="page-top">
        <Link href="/play" className="link small" style={{ display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start" }}><ArrowLeft size={13} /> Play</Link>
        <div className="eyebrow">Start play · {d.course.name}</div>
        <h1 className="page-h">Your round.</h1>
        <p className="lede">Enter your score on each hole as you play. At the end it becomes a scorecard on Rank, witnessed by the member playing with you.</p>
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
          <label className="field"><span className="label">Handicap index <span className="muted">(your GPF Rank handicap: {fmtHcp(d.rankHcp)})</span></span>
            <input className="input" inputMode="decimal" value={f.hcp} onChange={(e) => set("hcp", e.target.value.replace(",", "."))} style={{ maxWidth: 160 }} />
            <span className="hint">{ch != null ? `Course handicap on this tee: ${ch} — used for strokes and live Stableford.` : "Used for strokes per hole and live Stableford points."} Rank always scores the card with your official handicap.</span></label>
          <label className="field"><span className="label">Member witness</span>
            <select className="input" value={f.partnerId} onChange={(e) => set("partnerId", e.target.value)}>
              <option value="">Who&rsquo;s playing with you?</option>
              {d.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <span className="hint">A qualifying round needs a member witness, same as Submit score.</span></label>
          <button className="btn btn-primary" disabled={!tee || !f.partnerId || !hcpOk || !f.date} onClick={start}><Flag size={15} /> Start round on hole 1</button>
          <Link href={`/play/map?course=${cm.slug}`} className="btn btn-ghost"><MapIcon size={15} /> Just look at the map</Link>
        </div>
      </div>
    </div>
  );
}

function Card({ live, setLive }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const t = totals(live);
  const update = (i, v) => {
    const digits = v.replace(/\D/g, "");
    const n = digits ? Math.min(20, Math.max(1, Number(digits))) : null;
    const r = { ...live, holes: live.holes.map((s, j) => (j === i ? n : s)) };
    saveLive(r); setLive(r);
  };
  const complete = live.holes.every((s) => s);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await api("/api/rounds", { method: "POST", body: JSON.stringify({
        type: "QUALIFYING", date: live.date, courseId: live.courseId, teeId: live.teeId,
        gross: t.gross, partnerId: live.partnerId, holes: live.holes, source: "MANUAL",
        out: live.holes.slice(0, 9).reduce((s, x) => s + x, 0), in: live.holes.slice(9).reduce((s, x) => s + x, 0),
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

  const half = (a, z) => live.holes.slice(a, z).reduce((s, x) => s + (x || 0), 0);
  return (
    <div className="stack">
      <div className="page-top">
        <div className="eyebrow">Live round · {live.courseName} · {live.teeName}</div>
        <h1 className="page-h">{t.played ? `${t.gross} (${t.toPar > 0 ? "+" : ""}${t.toPar}) · ${t.points} pts` : "Your card."}</h1>
        <p className="lede">{t.played}/18 holes · handicap {fmtHcp(live.hcp)}{courseHcp(live) != null ? ` (course ${courseHcp(live)})` : ""} · witness {live.partnerName} · {live.date}</p>
      </div>
      <div className="btn-row" style={{ justifyContent: "flex-start" }}>
        <button className="btn btn-primary" onClick={() => router.push(`/play/map?course=${courseMapFor(live.courseName)?.slug || DEFAULT_COURSE.slug}&hole=${(live.holes.findIndex((s) => !s) + 1) || live.holes.length}`)}><MapIcon size={15} /> Back to the map</button>
      </div>
      <div className="board">
        <div className="board-head" style={{ display: "grid", gridTemplateColumns: "58px 40px 44px minmax(0,1fr) 52px", gap: 6 }}><span>Hole</span><span>Par</span><span>SI</span><span style={{ textAlign: "center" }}>Strokes</span><span style={{ textAlign: "right" }}>Pts</span></div>
        {live.holes.map((s, i) => (
          <div key={i} className="board-row" style={{ display: "grid", gridTemplateColumns: "58px 40px 44px minmax(0,1fr) 52px", gap: 6, alignItems: "center", padding: "8px 16px" }}>
            <span className="num"><b>{i + 1}</b>{mapHoleOf(live, i)?.n !== i + 1 ? <span className="muted small"> ({mapHoleOf(live, i).n})</span> : null}</span><span className="num">{parOf(live, i)}</span>
            <span className="num muted">{siOf(live, i)}{strokesOn(live, i) > 0 ? <span style={{ color: "var(--flag)" }}> {"•".repeat(strokesOn(live, i))}</span> : null}</span>
            <input className="hole-in" style={{ maxWidth: 72, justifySelf: "center" }} inputMode="numeric" value={s ?? ""} aria-label={`Hole ${i + 1} strokes`} onChange={(e) => update(i, e.target.value)} />
            <span className="num tot" style={{ textAlign: "right" }}>{holePoints(live, i) ?? "—"}</span>
          </div>))}
        <div className="board-row" style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="muted small">Out {half(0, 9) || "—"} · In {half(9, 18) || "—"}</span><b className="num">{t.gross || "—"} · {t.points} pts</b>
        </div>
      </div>
      {err && <div className="inline-err">{err}</div>}
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={discard}><Trash2 size={15} /> Discard</button>
        <button className="btn btn-primary" disabled={!complete || busy} onClick={submit}>{busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Finish &amp; submit to Rank</button>
      </div>
      {!complete && <p className="hint" style={{ textAlign: "right", margin: 0 }}>Enter all 18 holes to submit.</p>}
    </div>
  );
}
