"use client";
// Team Cup — Warriors vs Patuas. Score on top, "Enter my score" (a 1v1 match play result
// against a player of the other team), rosters side by side, then results.
// Rules and maths: src/lib/teamcup.js.
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Save, Swords, Trash2, Trophy, Users, X } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";
import { TC_TEAMS, TC_TOTAL, TC_TO_WIN, TC_PAIR_MAX, cupScore, pairCounts, pairKey, teamOf, fmtPts } from "@/lib/teamcup";

const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({ playerAId: "", opponentId: "", courseId: "", date: today(), outcome: "", margin: "" });

export default function TeamCup() {
  const [d, setD] = useState(null);
  const [courses, setCourses] = useState([]);
  const [err, setErr] = useState("");
  const [entering, setEntering] = useState(false);
  const [editRoster, setEditRoster] = useState(false);

  const load = () => api("/api/teamcup").then((r) => { setD(r); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); api("/api/courses").then((c) => setCourses(c.courses || [])).catch(() => {}); }, []);
  if (!d) return err ? <div className="card muted small">{err}</div> : <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;

  const score = cupScore(d.roster, d.matches);
  const name = (id) => d.teams.flat().find((p) => p.id === id)?.name ?? "—";
  const canEnter = (d.myTeam >= 0 || d.isAdmin) && score.winner == null && d.matches.length < TC_TOTAL;
  const toConfirm = d.matches.filter((m) => m.status === "PENDING" && (m.playerBId === d.me || d.isAdmin));
  const pending = d.matches.filter((m) => m.status === "PENDING" && !toConfirm.includes(m));
  const confirmed = d.matches.filter((m) => m.status === "CONFIRMED");

  const act = async (m, method) => {
    if (method === "DELETE" && !confirm(m.status === "CONFIRMED" ? "Delete this confirmed result?" : "Remove this result?")) return;
    try {
      await api(`/api/matchplay/${m.id}`, method === "PATCH" ? { method, body: JSON.stringify({ action: "confirm" }) } : { method });
      await load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="stack">
      <Scoreboard score={score} />

      {canEnter && !entering && (
        <button className="btn btn-primary" onClick={() => setEntering(true)}><Pencil size={16} /> Enter my score</button>)}
      {entering && <EntryForm d={d} courses={courses} onCancel={() => setEntering(false)} onSaved={() => { setEntering(false); load(); }} />}

      {toConfirm.length > 0 && (<>
        <div className="sec-h">Waiting for your confirmation</div>
        {toConfirm.map((m) => <ResultRow key={m.id} m={m} roster={d.roster} me={d.me} isAdmin={d.isAdmin} onConfirm={() => act(m, "PATCH")} onDelete={() => act(m, "DELETE")} />)}
      </>)}

      <div className="tc-teams">
        {TC_TEAMS.map((t, i) => (
          <div key={t.key} className={`card tc-team tc-${t.key}`}>
            <div className="tc-team-head">
              <img src={t.logo} alt={`${t.name} logo`} width={64} height={64} />
              <div><b>{t.name}</b><div className="muted small">{fmtPts(score.pts[i])} pts</div></div>
            </div>
            {d.teams[i].length === 0 && <div className="muted small">No players yet.</div>}
            {d.teams[i].map((p) => {
              const r = score.rec.get(p.id);
              return (
                <div key={p.id} className="tc-player">
                  <span className="tc-pn">{p.name}{p.id === d.me ? <span className="badge badge-accent" style={{ marginLeft: 5 }}>you</span> : null}</span>
                  <span className="muted small num">{fmtHcp(p.hcp)}</span>
                  <span className="small num tc-rec">{r ? `${r.w}-${r.d}-${r.l}` : "0-0-0"}</span>
                </div>);
            })}
          </div>))}
      </div>
      <div className="hint" style={{ marginTop: -6 }}>Handicap · record won-halved-lost</div>

      {d.isAdmin && !editRoster && <button className="btn btn-ghost small-btn" style={{ alignSelf: "flex-start" }} onClick={() => setEditRoster(true)}><Users size={14} /> Edit teams</button>}
      {editRoster && <RosterEditor d={d} onCancel={() => setEditRoster(false)} onSaved={() => { setEditRoster(false); load(); }} />}

      <div className="card stack" style={{ gap: 6 }}>
        <div className="sec-h" style={{ margin: 0 }}><Swords size={15} /> How it works</div>
        <p className="muted small" style={{ margin: 0 }}>1v1 match play between the two teams. Pairings are up to the players: challenge anyone from the other team, but the same two players can meet at most {TC_PAIR_MAX} times. Win = 1 point, halved = ½. {TC_TOTAL} points are in play and the first team to {fmtPts(TC_TO_WIN)} wins the cup. Enter the result after your match; it counts once your opponent confirms it.</p>
      </div>

      <div className="sec-h">Results</div>
      {confirmed.length === 0 && <div className="card empty">No confirmed matches yet.</div>}
      {confirmed.map((m) => <ResultRow key={m.id} m={m} roster={d.roster} me={d.me} isAdmin={d.isAdmin} onDelete={d.isAdmin ? () => act(m, "DELETE") : null} />)}

      {pending.length > 0 && (<>
        <div className="sec-h">Waiting for confirmation</div>
        {pending.map((m) => <ResultRow key={m.id} m={m} roster={d.roster} me={d.me} isAdmin={d.isAdmin}
          onDelete={m.playerAId === d.me || d.isAdmin ? () => act(m, "DELETE") : null} />)}
      </>)}
    </div>
  );
}

function Scoreboard({ score }) {
  const [A, B] = TC_TEAMS;
  const w = score.winner;
  return (
    <div className="tc-score">
      <div className="tc-side"><img src={A.logo} alt="" width={84} height={84} /><span>{A.name}</span></div>
      <div className="tc-mid">
        <div className="tc-big num">{fmtPts(score.pts[0])}<span className="sep">–</span>{fmtPts(score.pts[1])}</div>
        <div className="tc-sub">{fmtPts(TC_TO_WIN)} to win · {score.confirmed} of {TC_TOTAL} played</div>
      </div>
      <div className="tc-side"><img src={B.logo} alt="" width={84} height={84} /><span>{B.name}</span></div>
      {w != null && <div className="tc-win"><Trophy size={14} style={{ verticalAlign: -2 }} /> {TC_TEAMS[w].name} win the Team Cup</div>}
    </div>
  );
}

function ResultRow({ m, roster, me, isAdmin, onConfirm, onDelete }) {
  const a = m.playerA?.name, b = m.playerB?.name;
  const winTeam = m.result === "HALVED" ? null : teamOf(roster, m.result === "A" ? m.playerAId : m.playerBId);
  const line = m.result === "HALVED" ? `${a} and ${b} halved` : `${m.result === "A" ? a : b} beat ${m.result === "A" ? b : a}${m.margin ? ` ${m.margin}` : ""}`;
  const canConfirm = onConfirm && m.status === "PENDING" && (m.playerBId === me || isAdmin);
  return (
    <div className="card row-card">
      <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
        {winTeam != null && winTeam >= 0 ? <img src={TC_TEAMS[winTeam].logo} alt={TC_TEAMS[winTeam].name} width={30} height={30} style={{ flex: "none" }} /> : <span className="tc-half">½</span>}
        <div style={{ minWidth: 0 }}><div className="row-title">{line}</div>
          <div className="muted small">{String(m.date).slice(0, 10)} · {m.course?.name}{m.status === "PENDING" ? ` · entered by ${a}` : ""}</div></div>
      </div>
      <div className="row-right">
        {m.status === "PENDING" && <span className="badge badge-warn">pending</span>}
        {canConfirm && <button className="btn btn-primary small-btn" onClick={onConfirm}><Check size={14} /> Confirm</button>}
        {onDelete && <button className="icon-btn" aria-label="Remove result" title={m.playerBId === me && m.status === "PENDING" ? "Decline" : "Remove"} onClick={onDelete}>{m.playerBId === me && m.status === "PENDING" ? <X size={15} /> : <Trash2 size={15} />}</button>}
      </div>
    </div>
  );
}

function EntryForm({ d, courses, onCancel, onSaved }) {
  const [f, setF] = useState(blank());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === "playerAId" ? { opponentId: "" } : {}) }));
  const meId = d.isAdmin && f.playerAId ? f.playerAId : d.me;
  const myTeam = teamOf(d.roster, meId);
  const counts = useMemo(() => pairCounts(d.matches), [d.matches]);
  const opponents = myTeam < 0 ? [] : d.teams[1 - myTeam];
  const left = (oppId) => TC_PAIR_MAX - (counts.get(pairKey(meId, oppId)) || 0);
  const adminForOther = d.isAdmin && (d.myTeam < 0 || f.playerAId);
  const valid = myTeam >= 0 && f.opponentId && f.courseId && f.date && f.outcome && left(f.opponentId) > 0;
  const who = adminForOther ? (d.teams.flat().find((p) => p.id === f.playerAId)?.name ?? "Player") : "I";

  const save = async () => {
    setErr(""); setBusy(true);
    try { await api("/api/teamcup", { method: "POST", body: JSON.stringify({ ...f, playerAId: d.isAdmin ? f.playerAId || undefined : undefined }) }); onSaved(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="card form">
      <div className="round-edit" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
        <div className="sec-h" style={{ margin: 0 }}><Swords size={15} /> Enter a Team Cup result</div>
        {d.isAdmin && (
          <label className="field"><span className="label">Player {d.myTeam >= 0 ? <span className="muted">(committee: leave blank for yourself)</span> : null}</span>
            <select className="input" value={f.playerAId} onChange={(e) => set("playerAId", e.target.value)}>
              <option value="">{d.myTeam >= 0 ? "Me" : "Choose a player…"}</option>
              {TC_TEAMS.map((t, i) => <optgroup key={t.key} label={t.name}>{d.teams[i].map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>)}
            </select></label>)}
        <div className="row2">
          <label className="field"><span className="label">Opponent{myTeam >= 0 ? ` · ${TC_TEAMS[1 - myTeam].name}` : ""}</span>
            <select className="input" value={f.opponentId} disabled={myTeam < 0} onChange={(e) => set("opponentId", e.target.value)}>
              <option value="">Choose…</option>
              {opponents.map((p) => <option key={p.id} value={p.id} disabled={left(p.id) <= 0}>{p.name} · {left(p.id)} of {TC_PAIR_MAX} left</option>)}
            </select></label>
          <label className="field"><span className="label">Date</span>
            <input className="input" type="date" value={f.date} max={today()} onChange={(e) => set("date", e.target.value)} /></label>
        </div>
        <label className="field"><span className="label">Course</span>
          <select className="input" value={f.courseId} onChange={(e) => set("courseId", e.target.value)}>
            <option value="">Choose a course…</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <div className="field"><span className="label">Result</span>
          <div className="seg" style={{ alignSelf: "stretch" }}>
            {[["WIN", `${who} won`], ["HALVED", "Halved"], ["LOSS", `${who} lost`]].map(([k, l]) => (
              <button key={k} type="button" className={f.outcome === k ? "seg-on" : ""} style={{ flex: 1 }} onClick={() => set("outcome", k)}>{l}</button>))}
          </div>
        </div>
        {f.outcome && f.outcome !== "HALVED" && (
          <label className="field"><span className="label">Margin <span className="muted">(optional)</span></span>
            <input className="input" value={f.margin} placeholder="e.g. 3&2 or 1 up" maxLength={12} onChange={(e) => set("margin", e.target.value)} /></label>)}
        {err && <div className="inline-err">{err}</div>}
        <p className="hint" style={{ margin: 0 }}>{adminForOther ? "Entered by the committee: counts straight away." : "Counts for your team once your opponent confirms it."}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" disabled={!valid || busy} onClick={save}>{busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Submit result</button>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function RosterEditor({ d, onCancel, onSaved }) {
  const [team, setTeam] = useState(() => Object.fromEntries((d.members || []).map((p) => [p.id, teamOf(d.roster, p.id)])));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const teams = [0, 1].map((i) => Object.entries(team).filter(([, t]) => t === i).map(([id]) => id));
    try { await api("/api/teamcup", { method: "PUT", body: JSON.stringify({ teams }) }); onSaved(); }
    catch (e) { alert(e.message); setBusy(false); }
  };
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="sec-h" style={{ margin: 0 }}><Users size={15} /> Teams</div>
      {(d.members || []).map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span className="small">{p.name}</span>
          <div className="seg" style={{ flex: "none" }}>
            {[[0, TC_TEAMS[0].name], [1, TC_TEAMS[1].name], [-1, "—"]].map(([v, l]) => (
              <button key={v} type="button" className={team[p.id] === v ? "seg-on" : ""} style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => setTeam((x) => ({ ...x, [p.id]: v }))}>{l}</button>))}
          </div>
        </div>))}
      <p className="hint" style={{ margin: 0 }}>Results already entered stay; a match only counts while both players are on opposite teams.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" disabled={busy} onClick={save}><Save size={15} /> Save teams</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
