"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Loader2, Pencil, Check, Download } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";

export default function Profile() {
  const { data: session } = useSession();
  const [d, setD] = useState(null);
  const [hcp, setHcp] = useState(null);          // { declaredHandicap, overridden }
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const loadHcp = () => api("/api/profile").then((h) => { setHcp(h); setDraft(h.declaredHandicap ?? ""); }).catch(() => {});
  useEffect(() => {
    Promise.all([api("/api/rounds"), api("/api/leaderboard"), api("/api/config")])
      .then(([mine, lb, cfg]) => setD({ mine: mine.rounds, road: lb.road, config: cfg.config })).catch(() => {});
    loadHcp();
  }, []);

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

  return (
    <div className="stack">
      <div className="prof-head"><div className="avatar">{(session?.user?.name || "?").slice(0, 1).toUpperCase()}</div>
        <div><h2 className="page-h tight">{session?.user?.name}</h2><div className="muted small">{session?.user?.email} · {session?.user?.role?.toLowerCase()}</div></div></div>
      <div className="grid2">
        <div className="card stat"><div className="muted small">Handicap</div><div className="hcp-big sm">{fmtHcp(me.hcp)}</div></div>
        <div className="card stat"><div className="muted small">Qualifying</div><div className="hcp-big sm">{me.count}/{required}</div><div>{me.qualified ? <span className="badge badge-ok">Qualified</span> : <span className="badge badge-warn">In progress</span>}</div></div>
      </div>

      <div className="card form">
        <div className="row-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="label">Self-declared handicap index</span>
          {!editing && <button className="link" type="button" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>}
        </div>
        {editing ? (
          <div className="btn-row" style={{ marginTop: 8 }}>
            <input className="input" inputMode="decimal" value={draft} placeholder="e.g. 18.4"
              onChange={(e) => setDraft(e.target.value)} style={{ maxWidth: 140 }} />
            <button className="btn btn-ghost" type="button" onClick={() => { setEditing(false); setDraft(hcp.declaredHandicap ?? ""); setErr(""); }} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>{saving ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Save</button>
          </div>
        ) : (
          <div className="hcp-big sm" style={{ marginTop: 4 }}>{fmtHcp(hcp.declaredHandicap)}</div>
        )}
        {err && <div className="hint" style={{ color: "var(--bad, #c0392b)" }}>{err}</div>}
        <div className="hint" style={{ marginTop: 8 }}>
          {hcp.overridden
            ? "The committee has set a manual handicap for you, so that value is used on the boards regardless of this one. Ask an admin to clear the override to let your declared index and results take over."
            : resultsDriven
              ? `You have ${me.count} qualifying rounds, so your handicap on the boards now comes from your results (best 3 score differentials). Your declared index is kept as a fallback.`
              : `Used as your handicap until you have ${required} approved qualifying rounds (${me.count}/${required} so far), after which results take over via the WHS method.`}
        </div>
      </div>
      <div className="sec-h">Your data &amp; privacy</div>
      <div className="card form" style={{ gap: 10 }}>
        <div className="hint">Under GDPR you have the right to download all personal data we hold about you (Art. 20 — portability).</div>
        <div className="btn-row" style={{ justifyContent: "flex-start" }}>
          <a className="btn btn-ghost small-btn" href="/api/profile/export" download><Download size={14} /> Download my data (JSON)</a>
          <Link href="/privacy" className="btn btn-ghost small-btn">Privacy policy</Link>
        </div>
      </div>
      <div className="sec-h">All rounds ({d.mine.length})</div>
      {d.mine.map((r) => (
        <div key={r.id} className="card row-card"><div><div className="row-title">{r.course?.name} · {r.tee?.name}</div><div className="muted small">{r.date?.slice(0, 10)} · {r.type === "WEEKEND" ? `Weekend R${r.roundNo}` : "Qualifying"}</div></div>
          <div className="row-right"><div className="gross">{r.gross}</div><span className={`badge badge-${r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "bad" : "warn"}`}>{r.status.toLowerCase()}</span></div></div>))}
    </div>
  );
}
