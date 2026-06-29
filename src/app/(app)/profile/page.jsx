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
  const isAdmin = session?.user?.role === "ADMIN";
  
  useEffect(() => { 
    const roundsUrl = isAdmin ? "/api/rounds?scope=all" : "/api/rounds";
    Promise.all([api(roundsUrl), api("/api/leaderboard"), api("/api/config")]).then(([mine, lb, cfg]) => {
      setD({ mine: mine.rounds, road: lb.road, config: cfg.config });
    }).catch(() => {});
  }, [isAdmin]);
  
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  
  const toggleEdit = (roundId, currentGross) => {
    if (editing[roundId]) {
      setEditing({ ...editing, [roundId]: false });
    } else {
      setEditing({ ...editing, [roundId]: true });
      setEditValues({ ...editValues, [roundId]: currentGross });
    }
  };
  
  const saveEdit = async (roundId, isOwnRound) => {
    const action = isOwnRound ? "userEdit" : "adminEdit";
    await api(`/api/rounds/${roundId}`, { method: "PATCH", body: JSON.stringify({ action, gross: editValues[roundId] }) });
    location.reload();
  };
  
  const rejectRound = async (roundId, roundDate, isOwnRound) => {
    if (confirm(`Reject this round from ${roundDate?.slice(0, 10)}?`)) {
      const action = isOwnRound ? "userReject" : "adminReject";
      await api(`/api/rounds/${roundId}`, { method: "PATCH", body: JSON.stringify({ action, reason: "Admin rejected" }) });
      location.reload();
    }
  };
  
  const deleteRound = async (roundId, roundDate) => {
    if (confirm(`Permanently delete this round from ${roundDate?.slice(0, 10)}? This cannot be undone.`)) {
      await api(`/api/rounds/${roundId}`, { method: "DELETE" });
      location.reload();
    }
  };
  
  const me = d.road.find((r) => r.name === session?.user?.name) || { hcp: null, count: 0, qualified: false };
  const rounds = isAdmin ? d.mine : d.mine.filter(r => r.user?.name === session?.user?.name);
  
  // Group rounds by user if admin
  const groupedRounds = isAdmin 
    ? Object.groupBy(rounds, (r) => r.user?.name || "Unknown")
    : { [session?.user?.name]: rounds };
  
  return (
    <div className="stack">
      <div className="prof-head"><div className="avatar">{(session?.user?.name || "?").slice(0, 1).toUpperCase()}</div>
        <div><h2 className="page-h tight">{session?.user?.name}</h2><div className="muted small">{session?.user?.email} · {session?.user?.role?.toLowerCase()}</div></div></div>
      
      {!isAdmin && (
        <div className="grid2">
          <div className="card stat"><div className="muted small">Handicap</div><div className="hcp-big sm">{fmtHcp(me.hcp)}</div></div>
          <div className="card stat"><div className="muted small">Qualifying</div><div className="hcp-big sm">{me.count}/{d.config.qualifyingRoundsRequired}</div><div>{me.qualified ? <span className="badge badge-ok">Qualified</span> : <span className="badge badge-warn">In progress</span>}</div></div>
        </div>
      )}
      
      <div className="sec-h">{isAdmin ? "All rounds" : "Your rounds"} ({rounds.length})</div>
      
      {rounds.length === 0 && <div className="card empty">No rounds found.</div>}
      
      {isAdmin ? (
        // Admin view - grouped by user
        Object.keys(groupedRounds).map((userName) => (
          <div key={userName}>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8, color: "var(--text-secondary)" }}>
              {userName}
            </div>
            {groupedRounds[userName].map((r) => {
              const isOwnRound = r.user?.name === session?.user?.name;
              return (
                <div key={r.id} className="card row-card" style={{ marginBottom: 8 }}>
                  <div>
                    <div className="row-title">{r.course?.name} · {r.tee?.name}</div>
                    <div className="muted small">{r.date?.slice(0, 10)} · {r.type === "WEEKEND" ? `Open R${r.roundNo}` : "Qualifying"}</div>
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
                          onClick={() => saveEdit(r.id, isOwnRound)}
                        >
                          Save
                        </button>
                        <button className="btn-small" style={{ color: "var(--text-secondary)" }} onClick={() => toggleEdit(r.id, r.gross)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <div className="gross">{r.gross}</div>
                        <span className={`badge badge-${r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "bad" : "warn"}`}>{r.status.toLowerCase()}</span>
                        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
                          <button 
                            className="icon-btn" 
                            title="Edit score" 
                            onClick={() => toggleEdit(r.id, r.gross)}
                            style={{ color: "var(--text-secondary)" }}
                          >
                            ✎
                          </button>
                          {r.status !== "REJECTED" && (
                            <button 
                              className="icon-btn" 
                              title="Reject this round" 
                              onClick={() => rejectRound(r.id, r.date, isOwnRound)}
                              style={{ color: "var(--text-danger)" }}
                            >
                              ✕
                            </button>
                          )}
                          <button 
                            className="icon-btn" 
                            title="Delete this round" 
                            onClick={() => deleteRound(r.id, r.date)}
                            style={{ color: "#d32f2f" }}
                          >
                            🗑
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      ) : (
        // Regular user view - only their rounds
        d.mine.map((r) => (
          <div key={r.id} className="card row-card">
            <div>
              <div className="row-title">{r.course?.name} · {r.tee?.name}</div>
              <div className="muted small">{r.date?.slice(0, 10)} · {r.type === "WEEKEND" ? `Open R${r.roundNo}` : "Qualifying"}</div>
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
                    onClick={() => saveEdit(r.id, true)}
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
                        onClick={() => rejectRound(r.id, r.date, true)}
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
        ))
      )}
    </div>
  );
}
