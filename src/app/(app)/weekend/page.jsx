"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Calendar, AlertCircle, Lock, Plus, Loader2 } from "lucide-react";
import { api, fmtHcp } from "@/lib/client";
import { MAJOR } from "@/lib/major";
import { openPlayingHandicap } from "@/lib/scoring";

export default function Weekend() {
  const router = useRouter();
  const { data: session } = useSession();
  const [d, setD] = useState(null);
  useEffect(() => {
    Promise.all([api("/api/rounds"), api("/api/config"), api("/api/leaderboard"), api("/api/courses").catch(() => ({ courses: [] }))])
      .then(([mine, cfg, lb, cs]) => setD({ mine: mine.rounds, config: cfg.config, road: lb.road, final: lb.final, courses: cs.courses || [] }))
      .catch(() => {});
  }, []);
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;

  const name = session?.user?.name;
  const me = d.road.find((r) => r.name === name) || { hcp: null, openIndex: null, qualified: false, bonus: 0 };
  const openIdx = me.openIndex ?? me.hcp;
  const myFinal = d.final.find((r) => r.name === name);
  const alw = d.config.handicapAllowance;
  const rd = d.mine.find((x) => x.type === "WEEKEND" && x.status !== "REJECTED") || d.mine.find((x) => x.type === "WEEKEND");
  const venue = d.courses.find((c) => c.name.toLowerCase().includes(MAJOR.course.toLowerCase()));
  const tees = (venue?.tees || []).slice().sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  return (
    <div className="stack">
      <h2 className="page-h">GPF Open</h2>
      <div className="card weekend-info">
        <div className="wk-line"><Calendar size={15} /> {MAJOR.dayLabel}, {MAJOR.dateLabel} · <a href={MAJOR.url} target="_blank" rel="noreferrer">{MAJOR.course}, {MAJOR.location}</a> · Single round · Medal Net · {alw}% allowance</div>
        <div className="wk-line"><span className="muted">Declared</span> <b>{fmtHcp(me.hcp)}</b>
          {me.perRound != null && <><span className="muted">· road form {me.perRound > 0 ? "+" : ""}{me.perRound}/round →</span> <span className="muted">Open handicap</span> <b>{fmtHcp(me.openIndex)}</b></>}
          {me.bonus ? <><span className="muted">· road bonus</span> <b>−{me.bonus}</b></> : null}</div>
        {!me.qualified && <div className="warn-strip"><AlertCircle size={14} /> You're not qualified yet — finish your qualifying rounds first.</div>}
        {d.config.weekendLocked && <div className="warn-strip"><Lock size={14} /> Open scores are locked by the committee.</div>}
      </div>

      {openIdx != null && tees.length > 0 && (
        <div className="card">
          <div className="muted small" style={{ marginBottom: 8 }}>Your playing handicap at {MAJOR.course}: course handicap on the tee × {alw}%</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
            {tees.map((t) => (
              <div key={t.id} style={{ padding: "6px 8px", borderRadius: 10, border: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
                <div className="muted small">{t.name}</div>
                <b className="num">{openPlayingHandicap(openIdx, t, d.config) ?? "—"}</b>
              </div>))}
          </div>
        </div>
      )}

      <div className="card wk-round">
        <div className="muted small">Your round · {MAJOR.course}{myFinal?.tee ? ` · ${myFinal.tee}` : ""}</div>
        {rd ? (<>
          <div className="hcp-big sm">{rd.gross}</div>
          <div className="muted small">
            {myFinal
              ? <>playing {myFinal.ph} · net {myFinal.net1}{myFinal.bonus ? ` · bonus −${myFinal.bonus}` : ""} · <b>total {myFinal.total}</b></>
              : "net shown once approved"}
          </div>
          <span className={`badge badge-${rd.status === "APPROVED" ? "ok" : rd.status === "REJECTED" ? "bad" : "warn"}`}>{rd.status.toLowerCase()}</span>
        </>) : (
          <button className="btn btn-ghost full" disabled={d.config.weekendLocked} onClick={() => router.push("/submit")}><Plus size={15} /> Enter score</button>
        )}
      </div>
    </div>
  );
}
