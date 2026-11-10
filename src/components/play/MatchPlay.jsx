"use client";
// Play › Match play — register a 1v1 match; the opponent confirms; confirmed results
// score in the Individual league (win 1, halved ½).
import { useEffect, useState } from "react";
import { Check, Loader2, Swords, Trash2, X } from "lucide-react";
import { api } from "@/lib/client";

const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({ opponentId: "", courseId: "", date: today(), outcome: "", margin: "" });

export default function MatchPlay() {
  const [d, setD] = useState(null);          // { matches, me, isAdmin, members, courses }
  const [f, setF] = useState(blank());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const load = () => Promise.all([api("/api/matchplay"), api("/api/members"), api("/api/courses")])
    .then(([mp, ms, cs]) => setD({ ...mp, members: (ms.members || []).filter((m) => m.approved !== false), courses: cs.courses || [] }))
    .catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (!d) return err ? <div className="inline-err">{err}</div> : <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const opponents = d.members.filter((m) => m.id !== d.me);
  const valid = f.opponentId && f.courseId && f.date && f.outcome;
  const toConfirm = d.matches.filter((m) => m.status === "PENDING" && (m.playerBId === d.me || d.isAdmin));
  const mineWaiting = d.matches.filter((m) => m.status === "PENDING" && m.playerAId === d.me);

  const register = async () => {
    setErr(""); setOk(""); setBusy(true);
    try {
      await api("/api/matchplay", { method: "POST", body: JSON.stringify(f) });
      const opp = opponents.find((m) => m.id === f.opponentId)?.name;
      setOk(`Registered. It counts once ${opp} confirms it.`); setF(blank()); await load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const act = async (m, method) => {
    if (method === "DELETE" && !confirm(m.status === "CONFIRMED" ? "Delete this confirmed result?" : "Remove this result?")) return;
    setErr("");
    try {
      await api(`/api/matchplay/${m.id}`, method === "PATCH" ? { method, body: JSON.stringify({ action: "confirm" }) } : { method });
      await load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>Played a 1v1 match? Register it here. Once your opponent confirms, it scores in the Individual league: <b>win 1 point</b>, <b>halved ½</b>.</p>

      {toConfirm.length > 0 && (<>
        <div className="sec-h">Waiting for your confirmation</div>
        {toConfirm.map((m) => <MatchRow key={m.id} m={m} me={d.me} isAdmin={d.isAdmin} onConfirm={() => act(m, "PATCH")} onDelete={() => act(m, "DELETE")} />)}
      </>)}

      <div className="sec-h">Register a match</div>
      <div className="card form">
        <div className="round-edit" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
          <div className="row2">
            <label className="field"><span className="label">Opponent</span>
              <select className="input" value={f.opponentId} onChange={(e) => set("opponentId", e.target.value)}>
                <option value="">Choose a member…</option>
                {opponents.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select></label>
            <label className="field"><span className="label">Date</span>
              <input className="input" type="date" value={f.date} max={today()} onChange={(e) => set("date", e.target.value)} /></label>
          </div>
          <label className="field"><span className="label">Course</span>
            <select className="input" value={f.courseId} onChange={(e) => set("courseId", e.target.value)}>
              <option value="">Choose a course…</option>
              {d.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          <div className="field"><span className="label">Result</span>
            <div className="seg" style={{ alignSelf: "stretch" }}>
              {[["WIN", "I won"], ["HALVED", "Halved"], ["LOSS", "I lost"]].map(([k, l]) => (
                <button key={k} type="button" className={f.outcome === k ? "seg-on" : ""} style={{ flex: 1 }} onClick={() => set("outcome", k)}>{l}</button>))}
            </div>
          </div>
          {f.outcome && f.outcome !== "HALVED" && (
            <label className="field"><span className="label">Margin <span className="muted">(optional)</span></span>
              <input className="input" value={f.margin} placeholder="e.g. 3&2 or 1 up" maxLength={12} onChange={(e) => set("margin", e.target.value)} /></label>)}
          {err && <div className="inline-err">{err}</div>}
          {ok && <div className="ok-note"><Check size={15} /> {ok}</div>}
          <button className="btn btn-primary" disabled={!valid || busy} onClick={register}>{busy ? <Loader2 className="spin" size={15} /> : <Swords size={15} />} Register match</button>
        </div>
      </div>

      {mineWaiting.length > 0 && (<>
        <div className="sec-h">Waiting for your opponent</div>
        {mineWaiting.map((m) => <MatchRow key={m.id} m={m} me={d.me} isAdmin={d.isAdmin} onDelete={() => act(m, "DELETE")} />)}
      </>)}

      <div className="sec-h">Recent matches</div>
      {d.matches.filter((m) => m.status === "CONFIRMED").length === 0 && <div className="card empty">No confirmed matches yet.</div>}
      {d.matches.filter((m) => m.status === "CONFIRMED").slice(0, 30).map((m) => (
        <MatchRow key={m.id} m={m} me={d.me} isAdmin={d.isAdmin} onDelete={d.isAdmin ? () => act(m, "DELETE") : null} />))}
    </>
  );
}

function MatchRow({ m, me, isAdmin, onConfirm, onDelete }) {
  const a = m.playerA?.name, b = m.playerB?.name;
  const line = m.result === "HALVED" ? `${a} and ${b} halved` : `${m.result === "A" ? a : b} beat ${m.result === "A" ? b : a}${m.margin ? ` ${m.margin}` : ""}`;
  const canConfirm = onConfirm && m.status === "PENDING" && (m.playerBId === me || isAdmin);
  return (
    <div className="card row-card">
      <div><div className="row-title">{line}</div>
        <div className="muted small">{String(m.date).slice(0, 10)} · {m.course?.name}{m.status === "PENDING" ? ` · registered by ${a}` : ""}</div></div>
      <div className="row-right">
        {m.status === "PENDING" ? <span className="badge badge-warn">pending</span> : <span className="badge badge-ok">confirmed</span>}
        {canConfirm && <button className="btn btn-primary small-btn" onClick={onConfirm}><Check size={14} /> Confirm</button>}
        {onDelete && <button className="icon-btn" title={m.playerBId === me && m.status === "PENDING" ? "Decline" : "Remove"} aria-label="Remove result" onClick={onDelete}>{m.playerBId === me && m.status === "PENDING" ? <X size={15} /> : <Trash2 size={15} />}</button>}
      </div>
    </div>
  );
}
