"use client";
import { useEffect, useState, useCallback } from "react";
import { Shield, Check, X, Pencil, Lock, Unlock, Download, Plus, Sparkles, History, Loader2, KeyRound } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";

const ROUNDING = { round: "Nearest whole (0.5 up)", floor: "Round down", ceil: "Round up", dp1: "One decimal" };
const TIEBREAK = { "final-net": "Lowest final-round net", back9: "Lowest final-round back 9", manual: "Committee decision" };

export default function Admin() {
  const [tab, setTab] = useState("rounds");
  const [d, setD] = useState(null);
  const load = useCallback(() => {
    Promise.all([api("/api/rounds?scope=all"), api("/api/members"), api("/api/courses"), api("/api/config")])
      .then(([r, m, c, cfg]) => setD({ rounds: r.rounds, members: m.members, courses: c.courses, config: cfg.config })).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  const pending = d.rounds.filter((r) => r.status === "PENDING");
  const recent = d.rounds.slice(0, 30);

  const act = async (id, body) => { await api(`/api/rounds/${id}`, { method: "PATCH", body: JSON.stringify(body) }); load(); };
  const cfgPatch = async (patch) => { await api("/api/config", { method: "PATCH", body: JSON.stringify(patch) }); load(); };

  return (
    <div className="stack">
      <div className="admin-head"><Shield size={18} /><h2 className="page-h tight">Committee panel</h2></div>
      <div className="adm-tabs">
        {[["rounds", "Rounds"], ["members", "Members"], ["config", "Competition"], ["courses", "Courses"]].map(([k, l]) => (
          <button key={k} className={tab === k ? "adm-on" : ""} onClick={() => setTab(k)}>{l}{k === "rounds" && pending.length ? <span className="pill">{pending.length}</span> : null}</button>))}
      </div>

      {tab === "rounds" && (<div className="stack">
        <p className="muted small">Rounds are added to the boards automatically as soon as they're submitted. Use Edit or Reject here to fix a mistake.</p>
        {recent.length === 0 && <div className="card empty">No rounds submitted yet.</div>}
        {recent.map((r) => (
          <div key={r.id} className="card approve-card">
            <div><div className="row-title">{r.user?.name} · {r.gross} <span className={`badge badge-${r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "bad" : "warn"}`}>{r.status.toLowerCase()}</span></div>
              <div className="muted small">{r.course?.name} {r.tee?.name} · {r.date?.slice(0, 10)} · {r.type === "WEEKEND" ? `Weekend R${r.roundNo}` : "Qualifying"}{r.source === "OCR" ? " · scorecard" : ""}</div>
              {r.type === "QUALIFYING" && <div className="muted small">Witness: {r.partner?.name || "—"}</div>}</div>
            <div className="btn-row">
              {r.status !== "REJECTED" && <button className="btn btn-ghost" onClick={() => act(r.id, { action: "reject", reason: prompt("Reason?") || "rejected" })}><X size={15} /> Reject</button>}
              <button className="btn btn-ghost" onClick={() => { const g = prompt("Edit gross", r.gross); if (g) act(r.id, { action: "edit", gross: g }); }}><Pencil size={15} /> Edit</button>
              {r.status !== "APPROVED" && <button className="btn btn-primary" onClick={() => act(r.id, { action: "approve" })}><Check size={15} /> Approve</button>}
            </div>
          </div>))}
      </div>)}

      {tab === "members" && <Members members={d.members} reload={load} />}

      {tab === "config" && (<div className="card form">
        <div className="grid2">
          <label className="field"><span className="label">Qualifying rounds required</span><input className="input" type="number" defaultValue={d.config.qualifyingRoundsRequired} onBlur={(e) => cfgPatch({ qualifyingRoundsRequired: e.target.value })} /></label>
          <label className="field"><span className="label">Handicap allowance %</span><input className="input" type="number" defaultValue={d.config.handicapAllowance} onBlur={(e) => cfgPatch({ handicapAllowance: e.target.value })} /></label>
          <label className="field"><span className="label">Handicap rounding</span><select className="input" value={d.config.roundingMode} onChange={(e) => cfgPatch({ roundingMode: e.target.value })}>{Object.entries(ROUNDING).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field"><span className="label">Tiebreak rule</span><select className="input" value={d.config.tiebreak} onChange={(e) => cfgPatch({ tiebreak: e.target.value })}>{Object.entries(TIEBREAK).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field"><span className="label">Weekend round 1 date</span><input className="input" type="date" defaultValue={d.config.weekendDates.r1 ? String(d.config.weekendDates.r1).slice(0, 10) : ""} onBlur={(e) => cfgPatch({ r1Date: e.target.value })} /></label>
          <label className="field"><span className="label">Weekend round 2 date</span><input className="input" type="date" defaultValue={d.config.weekendDates.r2 ? String(d.config.weekendDates.r2).slice(0, 10) : ""} onBlur={(e) => cfgPatch({ r2Date: e.target.value })} /></label>
        </div>
        <div className="lock-row">
          <button className="btn btn-ghost" onClick={() => cfgPatch({ qualifyingLocked: !d.config.qualifyingLocked })}>{d.config.qualifyingLocked ? <Unlock size={15} /> : <Lock size={15} />} {d.config.qualifyingLocked ? "Unlock" : "Lock"} qualifying</button>
          <button className="btn btn-ghost" onClick={() => cfgPatch({ weekendLocked: !d.config.weekendLocked })}>{d.config.weekendLocked ? <Unlock size={15} /> : <Lock size={15} />} {d.config.weekendLocked ? "Unlock" : "Lock"} weekend</button>
        </div>
        <div className="lock-row">
          <a className="btn btn-accent" href="/api/export?type=standings"><Download size={15} /> Export standings</a>
          <a className="btn btn-accent" href="/api/export?type=road"><Download size={15} /> Export Road to GPF</a>
        </div>
      </div>)}

      {tab === "courses" && <Courses courses={d.courses} reload={load} />}
    </div>
  );
}

function Members({ members, reload }) {
  const [f, setF] = useState({ name: "", email: "", password: "", role: "MEMBER" });
  const [msg, setMsg] = useState("");
  const add = async () => {
    try { await api("/api/members", { method: "POST", body: JSON.stringify(f) }); setMsg(`Added ${f.name}. Temp password: ${f.password || "welcome123"}`); setF({ name: "", email: "", password: "", role: "MEMBER" }); reload(); }
    catch (e) { setMsg(e.message); }
  };
  return (
    <div className="stack">
      <div className="card form"><div className="row-title">Add a member</div>
        <div className="grid2">
          <input className="input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input className="input" placeholder="Temp password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="MEMBER">Member</option><option value="ADMIN">Admin</option></select>
        </div>
        <button className="btn btn-primary full" onClick={add}><Plus size={15} /> Add member</button>
        {msg && <div className="hint center">{msg}</div>}
      </div>
      {members.map((u) => (
        <div key={u.id} className="card row-card">
          <div><div className="row-title">{u.name} {u.role === "ADMIN" && <span className="badge badge-accent">admin</span>}</div><div className="muted small">{u.email}</div></div>
          <div className="member-ctl">
            <input className="input mini" placeholder="auto" defaultValue={u.manualHandicap ?? ""} title="Manual handicap override"
              onBlur={async (e) => { await api(`/api/members/${u.id}`, { method: "PATCH", body: JSON.stringify({ manualHandicap: e.target.value }) }); }} />
            <button className="icon-btn" title="Reset password" onClick={async () => {
              if (!confirm(`Reset ${u.name}'s password? They'll need the new temporary password to log in.`)) return;
              const r = await api(`/api/members/${u.id}`, { method: "PATCH", body: JSON.stringify({ resetPassword: true }) });
              alert(`New temporary password for ${u.name}: ${r.tempPassword}\n\nShare this with them directly — it won't be shown again.`);
            }}><KeyRound size={15} /></button>
            {u.role !== "ADMIN" && <button className="icon-btn" onClick={async () => { if (confirm(`Remove ${u.name}?`)) { await api(`/api/members/${u.id}`, { method: "DELETE" }); reload(); } }}><X size={15} /></button>}
          </div>
        </div>))}
    </div>
  );
}

function Courses({ courses, reload }) {
  const [f, setF] = useState({ name: "", par: 72, tee: "White", rating: "", slope: "" });
  const add = async () => {
    if (!f.name) return;
    await api("/api/courses", { method: "POST", body: JSON.stringify({ name: f.name, par: f.par, tees: [{ name: f.tee, par: f.par, rating: f.rating || null, slope: f.slope || null }] }) });
    setF({ name: "", par: 72, tee: "White", rating: "", slope: "" }); reload();
  };
  return (
    <div className="stack">
      <div className="card form"><div className="row-title">Add a course</div>
        <div className="grid2">
          <input className="input" placeholder="Course name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input" type="number" placeholder="Par" value={f.par} onChange={(e) => setF({ ...f, par: e.target.value })} />
          <input className="input" placeholder="Tee" value={f.tee} onChange={(e) => setF({ ...f, tee: e.target.value })} />
          <input className="input" type="number" placeholder="Rating" value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })} />
          <input className="input" type="number" placeholder="Slope" value={f.slope} onChange={(e) => setF({ ...f, slope: e.target.value })} />
        </div>
        <button className="btn btn-primary full" onClick={add}><Plus size={15} /> Add course</button>
      </div>
      {courses.map((c) => (<div key={c.id} className="card row-card"><div><div className="row-title">{c.name}</div><div className="muted small">Par {c.par} · {c.tees.map((t) => t.name).join(", ")}</div></div></div>))}
    </div>
  );
}
