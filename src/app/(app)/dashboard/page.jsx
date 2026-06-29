"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, ListOrdered, Trophy, Flag, Check, CircleDot, ChevronRight, Loader2 } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";

export default function Dashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [d, setD] = useState(null);
  useEffect(() => {
    Promise.all([api("/api/leaderboard"), api("/api/rounds"), api("/api/config")])
      .then(([lb, mine, cfg]) => setD({ road: lb.road, mine: mine.rounds, config: cfg.config })).catch(() => {});
  }, []);
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  const me = d.road.find((r) => r.name === session?.user?.name) || { count: 0, hcp: null, qualified: false };
  const need = d.config.qualifyingRoundsRequired;
  return (
    <div className="stack">
      <div className="hello"><div className="muted small">Welcome back</div><h2 className="page-h">{session?.user?.name}</h2></div>
      <div className="card hcp-card">
        <div><div className="muted small">Competition handicap</div><div className="hcp-big">{fmtHcp(me.hcp)}</div>
          <div className="muted small">{me.hcp == null ? "Play qualifying rounds to set it" : "From your best qualifying rounds"}</div></div>
        <div className="hcp-meter"><div className="meter-label">Qualification</div>
          <div className="dots">{Array.from({ length: need }).map((_, i) => (<span key={i} className={`qdot ${i < me.count ? "on" : ""}`}>{i < me.count ? <Check size={13} /> : <CircleDot size={13} />}</span>))}</div>
          <div style={{ marginTop: 8 }}>{me.qualified ? <span className="badge badge-ok">Qualified</span> : <span className="badge badge-warn">{me.count}/{need} rounds</span>}</div></div>
      </div>
      <div className="grid2">
        <button className="quick" onClick={() => router.push("/submit")}><Plus size={18} /><span>Submit a round</span><ChevronRight size={16} className="chev" /></button>
        <button className="quick" onClick={() => router.push("/road")}><ListOrdered size={18} /><span>Road to GPF</span><ChevronRight size={16} className="chev" /></button>
        <button className="quick" onClick={() => router.push("/weekend")}><Trophy size={18} /><span>GPF Open 2026</span><ChevronRight size={16} className="chev" /></button>
        <button className="quick" onClick={() => router.push("/final")}><Flag size={18} /><span>Final standings</span><ChevronRight size={16} className="chev" /></button>
      </div>
      <div className="sec-h">Your recent rounds</div>
      {d.mine.length === 0 && <div className="card empty">No rounds yet. Submit your first qualifying round to start the road.</div>}
      {d.mine.slice(0, 5).map((r) => (
        <div key={r.id} className="card row-card">
          <div><div className="row-title">{r.course?.name} · {r.tee?.name}</div><div className="muted small">{r.date?.slice(0, 10)} · {r.type === "WEEKEND" ? `GPF Open 2026 R${r.roundNo}` : "Qualifying"}{r.source === "OCR" ? " · from scorecard" : ""}</div></div>
          <div className="row-right"><div className="gross">{r.gross}</div><span className={`badge badge-${r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "bad" : "warn"}`}>{r.status.toLowerCase()}</span>
            {r.status !== "REJECTED" && <button className="icon-btn" title="Reject this round" onClick={async () => { if (confirm(`Reject this round from ${r.date?.slice(0, 10)}?`)) { await api(`/api/rounds/${r.id}`, { method: "PATCH", body: JSON.stringify({ action: "userReject" }) }); location.reload(); } }} style={{ marginLeft: 8, color: "var(--text-danger)" }}>✕</button>}
          </div>
        </div>))}
    </div>
  );
}
