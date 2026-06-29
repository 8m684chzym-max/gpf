"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Calendar, AlertCircle, Lock, Plus, Loader2 } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";

export default function Weekend() {
  const router = useRouter();
  const { data: session } = useSession();
  const [d, setD] = useState(null);
  useEffect(() => { Promise.all([api("/api/rounds"), api("/api/config"), api("/api/leaderboard")]).then(([mine, cfg, lb]) => setD({ mine: mine.rounds, config: cfg.config, road: lb.road })).catch(() => {}); }, []);
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  const me = d.road.find((r) => r.name === session?.user?.name) || { hcp: null, qualified: false };
  const alw = d.config.handicapAllowance;
  const ph = me.hcp == null ? null : Math.round((me.hcp * alw) / 100);
  const r = (no) => d.mine.find((x) => x.type === "WEEKEND" && x.roundNo === no);
  const dt = (x) => (x ? String(x).slice(0, 10) : "TBC");
  return (
    <div className="stack">
      <h2 className="page-h">GPF Open 2026</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ background: "#f0f0f0", height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 12 }}>
            Isla Canela Links
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Day 1 — Saturday</div>
            <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
              <strong>Isla Canela Links</strong><br/>
              Huelva, Spain
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ background: "#f0f0f0", height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 12 }}>
            Golf Isla Canela
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Day 2 — Sunday</div>
            <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
              <strong>Golf Isla Canela</strong><br/>
              Huelva, Spain
            </div>
          </div>
        </div>
      </div>
      <div className="card weekend-info">
        <div className="wk-line"><Calendar size={15} /> {dt(d.config.weekendDates.r1)} & {dt(d.config.weekendDates.r2)} · Medal Net · {alw}% allowance</div>
        <div className="wk-line"><span className="muted">Your handicap</span> <b>{fmtHcp(me.hcp)}</b> <span className="muted">→ playing</span> <b>{ph ?? "—"}</b></div>
        {!me.qualified && <div className="warn-strip"><AlertCircle size={14} /> You're not qualified yet — finish your qualifying rounds first.</div>}
        {d.config.weekendLocked && <div className="warn-strip"><Lock size={14} /> Weekend scores are locked by the committee.</div>}
      </div>
      <div className="grid2">{[1, 2].map((no) => { const rd = r(no);
        return (<div key={no} className="card wk-round"><div className="muted small">Round {no} · {no === 1 ? "Saturday" : "Sunday"}</div>
          {rd ? (<><div className="hcp-big sm">{rd.gross}</div><div className="muted small">net {ph == null ? "—" : rd.gross - ph}</div>
            <span className={`badge badge-${rd.status === "APPROVED" ? "ok" : rd.status === "REJECTED" ? "bad" : "warn"}`}>{rd.status.toLowerCase()}</span></>)
            : (<button className="btn btn-ghost full" disabled={d.config.weekendLocked} onClick={() => router.push("/submit")}><Plus size={15} /> Enter score</button>)}
        </div>); })}</div>
    </div>
  );
}
