"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";

export default function Profile() {
  const { data: session } = useSession();
  const [d, setD] = useState(null);
  const [editing, setEditing] = useState({});
  const [editValues, setEditValues] = useState({});
  
  useEffect(() => { 
    Promise.all([api("/api/rounds"), api("/api/leaderboard"), api("/api/config")]).then(([mine, lb, cfg]) => setD({ mine: mine.rounds, road: lb.road, config: cfg.config })).catch(() => {}); 
  }, []);
  
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  const me = d.road.find((r) => r.name === session?.user?.name) || { hcp: null, count: 0, qualified: false };
  
  const toggleEdit = (roundId, currentGross) => {
    if (editing[roundId]) {
      setEditing({ ...editing, [roundId]: false });
    } else {
      setEditing({ ...editing, [roundId]: true });
      setEditValues({ ...editValues, [roundId]: currentGross });
    }
  };
  
  const saveEdit = async (roundId) => {
    await api(`/api/rounds/${roundId}`, { method: "PATCH", body: JSON.stringify({ action: "userEdit", gross: editValues[roundId] }) });
    location.reload();
  };
  
  const rejectRound = async (roundId, roundDate) => {
    if (confirm(`Reject this round from ${roundDate?.slice(0, 10)}?`)) {
      await api(`/api/rounds/${roundId}`, { method: "PATCH", body: JSON.stringify({ action: "userReject" }) });
      location.reload();
    }
  };
  
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
        <div key={r.id} className="card row-card">
          <div>
            <div className="row-title">{r.course?.name} · {r.tee?.name}</div>
            <div className="muted small">{r.date?.slice(0, 10)} · {r.type === "WEEKEND" ? `Weekend R${r.roundNo}` : "Qualifying"}</div>
          </div>
          <div className="row-right">
            {editing[r.id] ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input 
                  type="number" 
                  value={editValues[r.id]} 
                  onChange={(e) => setEditValues({ ...editValues, [r.id]: Number(e.target.value) })}
                  style={{ width: 60, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4 }}
                />
                <button 
                  className="btn-small" 
                  onClick={() => saveEdit(r.id)}
                >
                  Save
                </button>
                <button className="btn-small" style={{ color: "var(--text-secondary)" }} onClick={() => toggleEdit(r.id, r.gross)}>Cancel</button>
              </div>
            ) : (
              <>
                <div className="gross">{r.gross}</div>
                <span className={`badge badge-${r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "bad" : "warn"}`}>{r.status.toLowerCase()}</span>
                {r.status !== "REJECTED" && (
                  <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
                    <button 
                      className="icon-btn" 
                      title="Edit score" 
                      onClick={() => toggleEdit(r.id, r.gross)}
                      style={{ color: "var(--text-secondary)" }}
                    >
                      ✎
                    </button>
                    <button 
                      className="icon-btn" 
                      title="Reject this round" 
                      onClick={() => rejectRound(r.id, r.date)}
                      style={{ color: "var(--text-danger)" }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
