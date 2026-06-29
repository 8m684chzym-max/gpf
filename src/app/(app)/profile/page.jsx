"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";

export default function Profile() {
  const { data: session } = useSession();
  const [d, setD] = useState(null);
  useEffect(() => { Promise.all([api("/api/rounds"), api("/api/leaderboard"), api("/api/config")]).then(([mine, lb, cfg]) => setD({ mine: mine.rounds, road: lb.road, config: cfg.config })).catch(() => {}); }, []);
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  const me = d.road.find((r) => r.name === session?.user?.name) || { hcp: null, count: 0, qualified: false };
  return (
    <div className="stack">
      <div className="prof-head"><div className="avatar">{(session?.user?.name || "?").slice(0, 1).toUpperCase()}</div>
        <div><h2 className="page-h tight">{session?.user?.name}</h2><div className="muted small">{session?.user?.email} · {session?.user?.role?.toLowerCase()}</div></div></div>
      <div className="grid2">
        <div className="card stat"><div className="muted small">Handicap</div><div className="hcp-big sm">{fmtHcp(me.hcp)}</div></div>
        <div className="card stat"><div className="muted small">Qualifying</div><div className="hcp-big sm">{me.count}/{d.config.qualifyingRoundsRequired}</div><div>{me.qualified ? <span className="badge badge-ok">Qualified</span> : <span className="badge badge-warn">In progress</span>}</div></div>
      </div>
      <div className="sec-h">All rounds ({d.mine.length})</div>
      {d.mine.map((r) => (
        <div key={r.id} className="card row-card"><div><div className="row-title">{r.course?.name} · {r.tee?.name}</div><div className="muted small">{r.date?.slice(0, 10)} · {r.type === "WEEKEND" ? `Weekend R${r.roundNo}` : "Qualifying"}</div></div>
          <div className="row-right"><div className="gross">{r.gross}</div><span className={`badge badge-${r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "bad" : "warn"}`}>{r.status.toLowerCase()}</span></div></div>))}
    </div>
  );
}
