"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Calendar, ChevronDown, Crown, Dices, Flag, History, Loader2, Medal, Plus, Trash2, Trophy, Users, Wifi, X } from "lucide-react";
import { api } from "@/lib/client";
import { GAMES, newGame, holesPlayed, standings } from "@/lib/games";
import GameBoard from "@/components/games/Boards";
import GameIcon from "@/components/games/GameIcon";

export default function GamesPage() {
  const [ready, setReady] = useState(false);
  const [members, setMembers] = useState([]);
  const [live, setLive] = useState([]);
  const [history, setHistory] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [view, setView] = useState("play"); // "play" | "league"

  // create flow
  const [type, setType] = useState(null);   // null → mode grid; set → players screen
  const [picked, setPicked] = useState([]);
  const [guest, setGuest] = useState("");
  const [creating, setCreating] = useState(false);

  // open game
  const [game, setGameState] = useState(null);
  const [localHole, setLocalHole] = useState(1);
  const gameR = useRef(null); const holeR = useRef(1);
  const pending = useRef(new Set());
  useEffect(() => { gameR.current = game; }, [game]);
  useEffect(() => { holeR.current = localHole; }, [localHole]);

  const loadLive = () => api("/api/games").then((r) => setLive(r.games || [])).catch(() => {});
  const loadHistory = () => api("/api/games?status=finished").then((r) => setHistory(r.games || [])).catch(() => {});
  useEffect(() => {
    Promise.all([
      api("/api/members").then((r) => setMembers(r.members || [])).catch(() => {}),
      loadLive(),
      loadHistory(),
    ]).finally(() => setReady(true));
  }, []);

  // ---- open-game merge + polling ----
  const mergeServer = (sg) => setGameState((prev) => {
    if (!prev || prev.id !== sg.id) return prev;
    const holes = sg.holes.map((h, i) => (pending.current.has(i + 1) ? prev.holes[i] : h));
    return { ...prev, players: sg.players, status: sg.status, holes };
  });

  useEffect(() => {
    const id = game?.id;
    if (!id) return;
    let stop = false;
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try { const r = await api(`/api/games/${id}`); if (!stop && r?.game) mergeServer(r.game); } catch { /* keep last */ }
    };
    const iv = setInterval(tick, 4000);
    return () => { stop = true; clearInterval(iv); };
  }, [game?.id]);

  const writeHole = async (hole, data) => {
    pending.current.add(hole);
    setGameState((g) => { const holes = g.holes.slice(); holes[hole - 1] = data; return { ...g, holes }; });
    try {
      const r = await api(`/api/games/${gameR.current.id}`, { method: "PATCH", body: JSON.stringify({ hole, data }) });
      if (r?.game) mergeServer(r.game);
    } catch { /* reconcile on next poll */ }
    finally { pending.current.delete(hole); }
  };

  const setGame = (updater) => {
    const prev = { ...gameR.current, hole: holeR.current };
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (next.hole !== prev.hole) { setLocalHole(next.hole); return; }
    const i = next.holes.findIndex((h, idx) => JSON.stringify(h) !== JSON.stringify(prev.holes[idx]));
    if (i >= 0) writeHole(i + 1, next.holes[i]);
  };

  const openGame = (g) => { setGameState(g); setLocalHole(1); pending.current = new Set(); };
  const exit = () => { setGameState(null); loadLive(); };
  const finish = async () => {
    try { await api(`/api/games/${game.id}`, { method: "PATCH", body: JSON.stringify({ status: "FINISHED" }) }); } catch {}
    setGameState(null); loadLive(); loadHistory();
  };
  const deleteHistory = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this game from history? This can't be undone.")) return;
    try { await api(`/api/games/${id}`, { method: "DELETE" }); } catch {}
    setHistory((h) => h.filter((g) => g.id !== id));
  };

  // ---- create ----
  const meta = type ? GAMES[type] : null;
  const canStart = meta && picked.length >= meta.min && picked.length <= meta.max;
  const availableMembers = useMemo(
    () => members.filter((m) => !picked.some((p) => p.id === m.id)),
    [members, picked]
  );

  const league = useMemo(() => {
    const POS = [4, 3, 2, 1];
    const agg = new Map();
    for (const g of history) {
      if (holesPlayed(g) === 0) continue;
      const board = standings(g);
      if (!board.length || board[0].points <= 0) continue;
      board.forEach((p) => {
        const rank = board.filter((q) => q.points > p.points).length;
        const pts = POS[rank] ?? 0;
        const key = p.userId || `guest:${p.name.toLowerCase()}`;
        const cur = agg.get(key) || { name: p.name, points: 0, games: 0, wins: 0 };
        cur.points += pts; cur.games += 1; if (rank === 0) cur.wins += 1; cur.name = p.name;
        agg.set(key, cur);
      });
    }
    return [...agg.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
  }, [history]);

  const toggleMember = (m) => {
    if (picked.some((p) => p.id === m.id)) setPicked(picked.filter((p) => p.id !== m.id));
    else if (!meta || picked.length < meta.max) setPicked([...picked, { id: m.id, name: m.name }]);
  };
  const addGuest = () => {
    const name = guest.trim();
    if (!name || (meta && picked.length >= meta.max)) return;
    setPicked([...picked, { id: `guest_${Date.now()}`, name }]);
    setGuest("");
  };
  const remove = (id) => setPicked(picked.filter((p) => p.id !== id));
  const moveUp = (i) => { if (i === 0) return; const a = picked.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; setPicked(a); };
  const pickMode = (g) => { setType(g.key); setPicked((p) => (p.length > g.max ? p.slice(0, g.max) : p)); };
  const backToModes = () => setType(null);
  const start = async () => {
    setCreating(true);
    try {
      const payload = { type, players: picked.map((p) => ({ name: p.name, userId: p.id })) };
      const r = await api("/api/games", { method: "POST", body: JSON.stringify(payload) });
      if (r?.game) { setType(null); setPicked([]); openGame(r.game); }
    } catch (e) { alert(e.message || "Could not create game."); }
    finally { setCreating(false); }
  };

  if (!ready) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;

  /* ————— SCREEN 3 · IN-GAME (scoring + leaderboard) ————— */
  if (game) {
    return (
      <>
        <GameBoard game={{ ...game, hole: localHole }} setGame={setGame} onExit={exit} />
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="ocr-note"><Wifi size={14} /> Live · everyone on game {game.code} sees this. Browse holes freely.</div>
          <div className="g-foot">
            <button className="g-cta ghost" onClick={finish}><Flag size={17} /> Finish game for everyone</button>
          </div>
        </div>
      </>
    );
  }

  /* ————— SCREEN 2 · PLAYERS (dedicated) ————— */
  if (view === "play" && meta) {
    return (
      <div className="stack">
        <div className="g-top">
          <button className="g-back" onClick={backToModes} aria-label="Back"><ArrowLeft size={20} /></button>
          <div>
            <div className="muted small" style={{ letterSpacing: 1, textTransform: "uppercase" }}>{meta.name}</div>
            <h2 className="page-h tight" style={{ display: "flex", alignItems: "center", gap: 7 }}><Users size={18} /> Players</h2>
          </div>
          <span className="g-count">{picked.length}/{meta.min === meta.max ? meta.min : `${meta.min}–${meta.max}`}</span>
        </div>

        {picked.length > 0 && (
          <div className="stack" style={{ gap: 10 }}>
            {picked.map((p, i) => (
              <div key={p.id} className="p-row">
                <span className="p-idx">{i + 1}</span>
                <span className="p-name">{p.name}</span>
                {meta.ordered && i > 0 && <button className="p-mini" title="Move up (tee order)" onClick={() => moveUp(i)}><ArrowUp size={18} /></button>}
                <button className="p-mini" title="Remove" onClick={() => remove(p.id)}><X size={18} /></button>
              </div>
            ))}
            {meta.ordered && <div className="muted small">Order = tee order (used for the rotation).</div>}
          </div>
        )}

        {availableMembers.length > 0 && (
          <>
            <div className="sec-h">Add from the group</div>
            <div className="add-grid">
              {availableMembers.map((m) => (
                <button key={m.id} className="add-btn" disabled={picked.length >= meta.max} onClick={() => toggleMember(m)}>
                  <Plus size={16} /> {m.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="guest-row">
          <input className="input" placeholder="Add a guest…" value={guest}
            onChange={(e) => setGuest(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addGuest(); }}
            disabled={picked.length >= meta.max} />
          <button className="g-add" onClick={addGuest} disabled={!guest.trim() || picked.length >= meta.max}>+</button>
        </div>

        <div className="g-foot">
          <button className="g-cta primary" disabled={!canStart || creating} onClick={start}>
            {creating ? <Loader2 className="spin" size={18} /> : <Trophy size={18} />} Start {meta.name}
          </button>
          {!canStart && picked.length > 0 && (
            <div className="muted small" style={{ textAlign: "center", marginTop: 8 }}>
              {meta.min === meta.max ? `Need exactly ${meta.min} players.` : `Need ${meta.min}–${meta.max} players.`}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ————— SCREEN 1 · MODE GRID (+ live / league / history) ————— */
  return (
    <div className="stack">
      <div className="hello">
        <div className="muted small">On-course side games · live</div>
        <h2 className="page-h">Games</h2>
      </div>
      <div className="seg" style={{ marginBottom: 4 }}>
        <button className={view === "play" ? "seg-on" : ""} onClick={() => setView("play")}><Dices size={15} /> Play</button>
        <button className={view === "league" ? "seg-on" : ""} onClick={() => setView("league")}><Medal size={15} /> League</button>
      </div>

      {view === "league" ? (
        <>
          <div className="sec-h" style={{ display: "flex", alignItems: "center", gap: 7 }}><Trophy size={15} /> Points League</div>
          <p className="muted small">Position points from finished side games — 4 / 3 / 2 / 1 to the top four in each game. A season-long side ladder, separate from the Road to GPF Open.</p>
          {league.length === 0 ? (
            <div className="card muted small">No finished games yet. Play a game and tap &ldquo;Finish&rdquo; to put it on the board.</div>
          ) : (
            <div className="board">
              <div className="board-head" style={{ display: "grid", gridTemplateColumns: "30px 1fr 38px 38px 50px", gap: 6, padding: "10px 13px" }}>
                <span>#</span><span>Player</span>
                <span style={{ textAlign: "right" }}>Pld</span><span style={{ textAlign: "right" }}>W</span><span style={{ textAlign: "right" }}>Pts</span>
              </div>
              {league.map((r, i) => (
                <div key={r.name + i} className={`board-row ${i === 0 ? "lead" : ""}`} style={{ display: "grid", gridTemplateColumns: "30px 1fr 38px 38px 50px", gap: 6, padding: "10px 13px", alignItems: "center" }}>
                  <span className="bh-rank num">{i === 0 ? <Crown size={14} style={{ color: "var(--flag)" }} /> : i + 1}</span>
                  <span className="bh-name">{r.name}</span>
                  <span className="bh-c num" style={{ textAlign: "right" }}>{r.games}</span>
                  <span className="bh-c num" style={{ textAlign: "right" }}>{r.wins}</span>
                  <span className="bh-c tot num" style={{ textAlign: "right" }}>{r.points}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="ocr-note"><Flag size={14} /> Just for fun while you play — none of this counts toward the Road to GPF Open.</div>

          {live.length > 0 && (
            <>
              <div className="sec-h" style={{ display: "flex", alignItems: "center", gap: 7 }}><Wifi size={15} /> Live now</div>
              {live.map((g) => {
                const lead = standings(g)[0];
                return (
                  <div key={g.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="pill">{g.code}</span>
                    <div style={{ flex: 1 }}>
                      <div className="row-title">{GAMES[g.type]?.name}</div>
                      <div className="muted small">
                        {g.players.map((p) => p.name).join(", ")} · {holesPlayed(g)}/18
                        {lead?.points > 0 ? ` · leader ${lead.name}` : ""}
                      </div>
                    </div>
                    <button className="btn btn-primary" style={{ minHeight: 46 }} onClick={() => openGame(g)}>Join</button>
                  </div>
                );
              })}
            </>
          )}

          <div className="sec-h">Start a new game</div>
          <div className="tile-grid">
            {Object.values(GAMES).map((g) => (
              <button key={g.key} className={`tile ${type === g.key ? "sel" : ""}`} onClick={() => pickMode(g)}>
                <span className="tile-ic"><GameIcon type={g.key} size={30} /></span>
                <span className="tile-nm">{g.name}</span>
                <span className="tile-pl">{g.min === g.max ? `${g.min} players` : `${g.min}–${g.max} players`}</span>
              </button>
            ))}
          </div>

          {history.length > 0 && (
            <>
              <div className="sec-h" style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}><History size={15} /> History</div>
              {history.map((g) => {
                const board = standings(g);
                const winner = board[0];
                const open = openId === g.id;
                const date = new Date(g.updatedAt || g.createdAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
                return (
                  <div key={g.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <button className="quick" style={{ width: "100%", border: "none", borderRadius: 0, background: "transparent" }} onClick={() => setOpenId(open ? null : g.id)}>
                      <GameIcon type={g.type} size={20} />
                      <span style={{ flex: 1 }}>
                        <span style={{ display: "block", fontWeight: 700 }}>{GAMES[g.type]?.name}</span>
                        <span className="muted small" style={{ fontWeight: 400, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Calendar size={11} /> {date} · {g.players.length}p
                          {winner?.points > 0 ? <> · <Crown size={11} style={{ color: "var(--flag)" }} /> {winner.name}</> : null}
                        </span>
                      </span>
                      <ChevronDown size={16} className="chev" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                    </button>
                    {open && (
                      <div style={{ padding: "0 13px 13px" }}>
                        <div className="board">
                          <div className="board-head" style={{ display: "grid", gridTemplateColumns: "30px 1fr 52px", gap: 6, padding: "10px 13px" }}>
                            <span>#</span><span>Player</span><span style={{ textAlign: "right" }}>Pts</span>
                          </div>
                          {board.map((r, i) => (
                            <div key={r.id} className={`board-row ${i === 0 && r.points > 0 ? "lead" : ""}`} style={{ display: "grid", gridTemplateColumns: "30px 1fr 52px", gap: 6, padding: "10px 13px", alignItems: "center" }}>
                              <span className="bh-rank num">{i + 1}</span>
                              <span className="bh-name">{r.name}</span>
                              <span className="bh-c tot" style={{ textAlign: "right" }}>{r.points}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                          <span className="muted small">{holesPlayed(g)}/18 holes scored{g.createdBy ? ` · by ${g.createdBy}` : ""}</span>
                          <button className="btn btn-ghost small-btn" onClick={(e) => deleteHistory(g.id, e)}><Trash2 size={14} /> Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
