"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Loader2, Pencil, Check, Download, Trash2, KeyRound, Shield, X } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";

export default function Profile() {
  const { data: session } = useSession();
  const [d, setD] = useState(null);
  const [delErr, setDelErr] = useState("");
  const [hcp, setHcp] = useState(null);          // { declaredHandicap, overridden }
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const loadHcp = () => api("/api/profile").then((h) => { setHcp(h); setDraft(h.declaredHandicap ?? ""); }).catch(() => {});
  const loadAll = () => Promise.all([api("/api/rounds"), api("/api/leaderboard"), api("/api/config")])
    .then(([mine, lb, cfg]) => setD({ mine: mine.rounds, road: lb.road, config: cfg.config })).catch(() => {});
  useEffect(() => { loadAll(); loadHcp(); }, []);

  const delRound = async (r) => {
    if (!confirm(`Delete your ${r.gross} at ${r.course?.name ?? "this course"} on ${r.date?.slice(0, 10)}? This can't be undone.`)) return;
    setDelErr("");
    try { await api(`/api/rounds/${r.id}`, { method: "DELETE" }); await loadAll(); }
    catch (e) { setDelErr(e.message); }
  };

  if (!d || !hcp) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  const me = d.road.find((r) => r.name === session?.user?.name) || { hcp: null, count: 0, qualified: false };
  const required = d.config.qualifyingRoundsRequired;
  const resultsDriven = me.count >= required;

  const save = async () => {
    setErr(""); setSaving(true);
    try {
      await api("/api/profile", { method: "PATCH", body: JSON.stringify({ declaredHandicap: draft === "" ? null : draft }) });
      await loadHcp();
      setEditing(false);
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const rankPos = d.road.findIndex((r) => r.name === session?.user?.name);
  return (
    <div className="stack">
      <div className="page-top">
        <div className="eyebrow">My profile</div>
        <h1 className="page-h">{session?.user?.name}</h1>
        <p className="lede">{session?.user?.email}{session?.user?.role === "ADMIN" ? " · committee" : ""}</p>
        {session?.user?.role === "ADMIN" && <Link href="/admin" className="btn btn-ghost small-btn" style={{ alignSelf: "flex-start" }}><Shield size={14} /> Committee admin</Link>}
      </div>

      <div className="grid3" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        <div className="card stat"><div className="muted small">Current handicap</div><div className="hcp-big sm">{fmtHcp(me.hcp)}</div></div>
        <div className="card stat"><div className="muted small">Qualifying</div><div className="hcp-big sm">{me.count}/{required}</div>{me.qualified ? <span className="badge badge-ok">Qualified</span> : <span className="badge badge-warn">In progress</span>}</div>
        <div className="card stat"><div className="muted small">Rank</div><div className="hcp-big sm">{rankPos >= 0 ? `#${rankPos + 1}` : "—"}</div><Link href="/rank" className="link small">See Rank</Link></div>
      </div>

      <div className="sec-h">Submitted rounds ({d.mine.length})</div>
      <p className="hint" style={{ margin: 0 }}>Edit a round to correct a mistake. Edited rounds go back to <b>pending</b> until the committee approves them again.</p>
      {delErr && <div className="hint" style={{ color: "var(--bad)" }}>{delErr}</div>}
      {d.mine.length === 0 && <div className="card empty">No rounds yet. <Link href="/submit" className="link">Submit your first score</Link>.</div>}
      {d.mine.map((r) => {
        const locked = r.type === "WEEKEND" ? d.config.weekendLocked : d.config.qualifyingLocked;
        return <RoundRow key={r.id} r={r} locked={locked} onDelete={() => delRound(r)} onSaved={loadAll} />;
      })}

      <div className="sec-h">Handicap</div>
      <div className="card form">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="label">Self-declared handicap index</span>
          {!editing && <button className="link" type="button" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>}
        </div>
        {editing ? (
          <div className="btn-row" style={{ marginTop: 8, justifyContent: "flex-start" }}>
            <input className="input" inputMode="decimal" value={draft} placeholder="e.g. 18.4"
              onChange={(e) => setDraft(e.target.value)} style={{ maxWidth: 140 }} />
            <button className="btn btn-ghost" type="button" onClick={() => { setEditing(false); setDraft(hcp.declaredHandicap ?? ""); setErr(""); }} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>{saving ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Save</button>
          </div>
        ) : (
          <div className="hcp-big sm" style={{ marginTop: 4 }}>{fmtHcp(hcp.declaredHandicap)}</div>
        )}
        {err && <div className="hint" style={{ color: "var(--bad)" }}>{err}</div>}
        <div className="hint" style={{ marginTop: 8 }}>
          {hcp.overridden
            ? "The committee has set a manual handicap for you, so that value is used on the boards regardless of this one. Ask an admin to clear the override to let your declared index and results take over."
            : resultsDriven
              ? `You have ${me.count} qualifying rounds, so your handicap on the boards now comes from your results (best 3 score differentials). Your declared index is kept as a fallback.`
              : `Used as your handicap until you have ${required} approved qualifying rounds (${me.count}/${required} so far), after which results take over via the WHS method.`}
        </div>
      </div>

      <div className="sec-h">Your data</div>
      <Account />
      <div className="card form" style={{ gap: 10 }}>
        <div className="hint">Under GDPR you have the right to download all personal data we hold about you (Art. 20 — portability).</div>
        <div className="btn-row" style={{ justifyContent: "flex-start" }}>
          <a className="btn btn-ghost small-btn" href="/api/profile/export" download><Download size={14} /> Download my data (JSON)</a>
          <Link href="/privacy" className="btn btn-ghost small-btn">Privacy policy</Link>
        </div>
      </div>
    </div>
  );
}

const statusBadge = (s) => <span className={`badge badge-${s === "APPROVED" ? "ok" : s === "REJECTED" ? "bad" : "warn"}`}>{s.toLowerCase()}</span>;

// One submitted round, with an inline editor (date, course, tee, gross, hole scores, witness).
function RoundRow({ r, locked, onDelete, onSaved }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState(null);      // { courses, members }
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const hasCard = r.scorecard?.holes?.length === 18;

  const start = async () => {
    setErr(""); setOpen(true);
    setF({ date: r.date?.slice(0, 10), courseId: r.courseId, teeId: r.teeId, gross: String(r.gross), partnerId: r.partnerId || "",
           holes: hasCard ? r.scorecard.holes.map(String) : null });
    if (!opts) {
      const [cs, ms] = await Promise.all([api("/api/courses"), api("/api/members")]).catch(() => [{ courses: [] }, { members: [] }]);
      setOpts({ courses: cs.courses || [], members: (ms.members || []).filter((m) => m.role !== "ADMIN" && m.name !== session?.user?.name) });
    }
  };
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setHole = (i, v) => setF((x) => {
    const holes = x.holes.slice(); holes[i] = v.replace(/\D/g, "").slice(0, 2);
    const sum = holes.reduce((s, h) => s + (Number(h) || 0), 0);
    return { ...x, holes, gross: holes.every((h) => h !== "") ? String(sum) : x.gross };
  });
  const course = opts?.courses.find((c) => c.id === f?.courseId);

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      await api(`/api/rounds/${r.id}`, { method: "PATCH", body: JSON.stringify({
        action: "update", date: f.date, courseId: f.courseId, teeId: f.teeId, gross: Number(f.gross),
        ...(f.holes ? { holes: f.holes.map(Number) } : {}),
        ...(r.type === "QUALIFYING" ? { partnerId: f.partnerId } : {}),
      }) });
      setOpen(false); await onSaved();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="card row-card col">
      <div className="row-head">
        <div><div className="row-title">{r.course?.name} · {r.tee?.name}</div>
          <div className="muted small">{r.date?.slice(0, 10)} · {r.type === "WEEKEND" ? "GPF Open" : "Qualifying"}{r.partner?.name ? ` · witness ${r.partner.name}` : ""}{r.status === "REJECTED" && r.rejectReason ? ` · ${r.rejectReason}` : ""}</div></div>
        <div className="row-right"><div className="gross">{r.gross}</div>{statusBadge(r.status)}
          {!locked && !open && <button className="icon-btn" title="Edit this round" aria-label="Edit this round" onClick={start}><Pencil size={15} /></button>}
          {!locked && !open && <button className="icon-btn" title="Delete this round" aria-label="Delete this round" onClick={onDelete}><Trash2 size={15} /></button>}
          {open && <button className="icon-btn" title="Close" aria-label="Close editor" onClick={() => setOpen(false)}><X size={15} /></button>}
        </div>
      </div>
      {open && (!opts || !f ? <div className="muted small" style={{ paddingTop: 12 }}><Loader2 className="spin" size={14} /> Loading…</div> : (
        <div className="round-edit">
          <div className="row2">
            <label className="field"><span className="label">Date</span><input className="input" type="date" value={f.date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("date", e.target.value)} /></label>
            <label className="field"><span className="label">Gross</span><input className="input" inputMode="numeric" value={f.gross} disabled={!!f.holes} onChange={(e) => set("gross", e.target.value.replace(/\D/g, ""))} /></label>
          </div>
          <div className="row2">
            <label className="field"><span className="label">Course</span>
              <select className="input" value={f.courseId} onChange={(e) => { const c = opts.courses.find((x) => x.id === e.target.value); setF((x) => ({ ...x, courseId: e.target.value, teeId: c?.tees?.[0]?.id || "" })); }}>
                {opts.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
            <label className="field"><span className="label">Tee</span>
              <select className="input" value={f.teeId} onChange={(e) => set("teeId", e.target.value)}>
                {(course?.tees || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select></label>
          </div>
          {r.type === "QUALIFYING" && (
            <label className="field"><span className="label">Member witness</span>
              <select className="input" value={f.partnerId} onChange={(e) => set("partnerId", e.target.value)}>
                <option value="">Choose a member…</option>
                {opts.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select></label>)}
          {f.holes && (
            <div className="field"><span className="label">Hole scores <span className="muted">(gross is their total)</span></span>
              <div className="holes-grid">{f.holes.map((h, i) => (
                <label key={i} className="hole-cell"><span className="hole-no">{i + 1}</span>
                  <input className="hole-in" inputMode="numeric" value={h} onChange={(e) => setHole(i, e.target.value)} aria-label={`Hole ${i + 1}`} /></label>))}</div>
            </div>)}
          {err && <div className="inline-err">{err}</div>}
          <div className="btn-row">
            <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" type="button" onClick={save} disabled={busy || !f.gross || !f.teeId || (r.type === "QUALIFYING" && !f.partnerId)}>{busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Save · send for review</button>
          </div>
        </div>))}
    </div>
  );
}

// Change email / password. Both need the current password.
function Account() {
  const { data: session, update } = useSession();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: "", currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setMsg({ ok: "", err: "" });
    if (f.newPassword && f.newPassword !== f.confirm) return setMsg({ ok: "", err: "New passwords don't match." });
    setBusy(true);
    try {
      const r = await api("/api/profile/account", { method: "PATCH", body: JSON.stringify({
        currentPassword: f.currentPassword, email: f.email.trim() || undefined, newPassword: f.newPassword || undefined,
      }) });
      if (r.changed.includes("email")) await update({ refreshEmail: true });
      setMsg({ ok: `Updated your ${r.changed.join(" and ")}.`, err: "" });
      setF({ email: "", currentPassword: "", newPassword: "", confirm: "" });
      setOpen(false);
    } catch (e2) { setMsg({ ok: "", err: e2.message }); }
    setBusy(false);
  };

  return (
    <div className="card form">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="label">Account</span>
        {!open && <button className="link" type="button" onClick={() => { setOpen(true); setMsg({ ok: "", err: "" }); }}><KeyRound size={13} /> Change email or password</button>}
      </div>
      <div className="muted small">Email: <b>{session?.user?.email}</b></div>
      {open && (
        <form className="form" onSubmit={save} style={{ marginTop: 6 }}>
          <label className="field"><span className="label">New email <span className="muted">(leave blank to keep)</span></span>
            <input className="input" type="email" autoComplete="email" value={f.email} onChange={set("email")} placeholder={session?.user?.email} /></label>
          <label className="field"><span className="label">New password <span className="muted">(leave blank to keep)</span></span>
            <input className="input" type="password" autoComplete="new-password" value={f.newPassword} onChange={set("newPassword")} placeholder="At least 8 characters" /></label>
          {f.newPassword && <label className="field"><span className="label">Repeat new password</span>
            <input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} /></label>}
          <label className="field"><span className="label">Current password</span>
            <input className="input" type="password" autoComplete="current-password" required value={f.currentPassword} onChange={set("currentPassword")} /></label>
          <div className="btn-row">
            <button className="btn btn-ghost" type="button" onClick={() => { setOpen(false); setMsg({ ok: "", err: "" }); }} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={busy || (!f.email.trim() && !f.newPassword)}>{busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Save</button>
          </div>
        </form>
      )}
      {msg.err && <div className="hint" style={{ color: "var(--bad)" }}>{msg.err}</div>}
      {msg.ok && <div className="hint" style={{ color: "var(--ok)" }}>{msg.ok}</div>}
    </div>
  );
}
