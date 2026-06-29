"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Loader2, AlertCircle, Sparkles, CircleCheck, Plus, Users, ChevronRight } from "lucide-react";
import { api } from "@/lib/client";

function fileToB64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
}
const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
const NEW_COURSE = "__new__";

export default function Submit() {
  const [tab, setTab] = useState("manual");
  const [members, setMembers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [done, setDone] = useState(false);
  const [addingCourse, setAddingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCoursePar, setNewCoursePar] = useState("");
  const blank = { type: "QUALIFYING", roundNo: 1, date: new Date().toISOString().slice(0, 10), courseId: "", teeId: "", gross: "", partnerId: "", points: "", holes: Array(18).fill(""), fairwaysPct: "", girPct: "", putts: "", source: "MANUAL" };
  const [f, setF] = useState(blank);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const loadCourses = async () => { const c = await api("/api/courses"); setCourses(c.courses); return c.courses; };

  useEffect(() => {
    Promise.all([api("/api/members"), loadCourses()]).then(([m, cs]) => {
      setMembers(m.members);
      const c0 = cs[0];
      setF((p) => ({ ...p, courseId: c0?.id || "", teeId: c0?.tees?.[0]?.id || "" }));
    }).catch(() => {});
  }, []);

  const course = courses.find((c) => c.id === f.courseId);
  const out = sum(f.holes.slice(0, 9)), inn = sum(f.holes.slice(9, 18));
  const filled = f.holes.filter((h) => h !== "").length;
  const valid = !addingCourse && f.date && f.courseId && f.teeId && f.gross !== "" && (f.type !== "QUALIFYING" || f.partnerId);

  const addNewCourse = async () => {
    if (!newCourseName.trim()) return;
    try {
      const r = await api("/api/courses", { method: "POST", body: JSON.stringify({ name: newCourseName.trim(), par: newCoursePar || undefined }) });
      await loadCourses();
      setF((p) => ({ ...p, courseId: r.course.id, teeId: r.course.tees?.[0]?.id || "" }));
      setAddingCourse(false); setNewCourseName(""); setNewCoursePar("");
    } catch (e) { alert(e.message); }
  };

  const submit = async () => {
    const holes = filled === 18 ? f.holes.map(Number) : [];
    try {
      await api("/api/rounds", { method: "POST", body: JSON.stringify({
        type: f.type, roundNo: f.roundNo, date: f.date, courseId: f.courseId, teeId: f.teeId, gross: Number(f.gross),
        partnerId: f.partnerId || null, source: f.source, holes, out: out || null, in: inn || null,
        points: f.points === "" ? null : Number(f.points), fairwaysPct: f.fairwaysPct === "" ? null : Number(f.fairwaysPct),
        girPct: f.girPct === "" ? null : Number(f.girPct), putts: f.putts === "" ? null : Number(f.putts),
      }) });
      setDone(true);
    } catch (e) { alert(e.message); }
  };

  if (done) return (
    <div className="stack"><div className="card success"><CircleCheck size={40} /><h3>Round added</h3>
      <p className="muted">It's on the boards now. The committee can still edit or remove it from Admin if anything looks off.</p>
      <button className="btn btn-primary" onClick={() => { setF(blank); setDone(false); }}>Submit another</button></div></div>
  );

  const memberOptions = members.filter((m) => m.role !== "ADMIN");
  return (
    <div className="stack">
      <h2 className="page-h">Submit a round</h2>
      <div className="seg">
        <button className={tab === "manual" ? "seg-on" : ""} onClick={() => setTab("manual")}>Enter manually</button>
        <button className={tab === "upload" ? "seg-on" : ""} onClick={() => setTab("upload")}>Upload scorecard</button>
      </div>
      {tab === "upload" && (
        <ScorecardUpload
          courses={courses}
          loadCourses={loadCourses}
          onApply={(data) => { setF((p) => ({ ...p, ...data, source: "OCR" })); setAddingCourse(false); setTab("manual"); }}
        />
      )}
      <div className="card form">
        <div className="grid2">
          <label className="field"><span className="label">Round type</span><select className="input" value={f.type} onChange={(e) => set("type", e.target.value)}>
            <option value="QUALIFYING">Qualifying (Road to GPF)</option><option value="WEEKEND">GPF Open 2026</option></select></label>
          {f.type === "WEEKEND" ? (
            <label className="field"><span className="label">Which round</span><select className="input" value={f.roundNo} onChange={(e) => set("roundNo", e.target.value)}>
              <option value={1}>Round 1 (Saturday)</option><option value={2}>Round 2 (Sunday)</option></select></label>
          ) : (
            <label className="field"><span className="label">Member witness</span><select className="input" value={f.partnerId} onChange={(e) => set("partnerId", e.target.value)}>
              <option value="">Select a member…</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          )}
        </div>
        <div className="grid2">
          <label className="field"><span className="label">Date</span><input className="input" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
          <label className="field"><span className="label">Course</span>
            <select className="input" value={addingCourse ? NEW_COURSE : f.courseId} onChange={(e) => {
              if (e.target.value === NEW_COURSE) { setAddingCourse(true); return; }
              setAddingCourse(false);
              const c = courses.find((x) => x.id === e.target.value);
              set("courseId", e.target.value); set("teeId", c?.tees?.[0]?.id || "");
            }}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NEW_COURSE}>+ Add a new course…</option>
            </select>
          </label>
        </div>
        {addingCourse && (
          <div className="card" style={{ background: "var(--paper)" }}>
            <div className="grid2">
              <label className="field"><span className="label">New course name</span><input className="input" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} placeholder="e.g. Penha Longa" /></label>
              <label className="field"><span className="label">Par (optional)</span><input className="input" inputMode="numeric" value={newCoursePar} onChange={(e) => setNewCoursePar(e.target.value)} placeholder="72" /></label>
            </div>
            <div className="hint">Creates one default tee. An admin can add the real tees, rating and slope afterwards under Admin → Courses.</div>
            <div className="btn-row"><button className="btn btn-ghost" onClick={() => { setAddingCourse(false); setNewCourseName(""); setNewCoursePar(""); }}>Cancel</button><button className="btn btn-primary" onClick={addNewCourse} disabled={!newCourseName.trim()}><Plus size={15} /> Add course</button></div>
          </div>
        )}
        <div className="grid2">
          <label className="field"><span className="label">Tee</span><select className="input" value={f.teeId} onChange={(e) => set("teeId", e.target.value)} disabled={addingCourse}>
            {course?.tees?.map((t) => <option key={t.id} value={t.id}>{t.name} · par {t.par}</option>)}</select></label>
          <label className="field"><span className="label">Gross score</span><input className="input" inputMode="numeric" value={f.gross} onChange={(e) => set("gross", e.target.value)} placeholder="e.g. 91" /></label>
        </div>
        <details className="more"><summary>Add hole-by-hole &amp; stats (optional)</summary>
          <div className="holes-grid">{f.holes.map((h, i) => (
            <div key={i} className="hole-cell"><span className="hole-no">{i + 1}</span>
              <input className="hole-in" inputMode="numeric" value={h} onChange={(e) => { const arr = [...f.holes]; arr[i] = e.target.value; set("holes", arr); }} /></div>))}</div>
          <div className="outin"><span>OUT <b>{out || "—"}</b></span><span>IN <b>{inn || "—"}</b></span><span>Total <b>{out + inn || "—"}</b></span>
            <button className="link" type="button" onClick={() => set("gross", String(out + inn))} disabled={!(out + inn)}>Use as gross</button></div>
          <div className="grid3">
            <label className="field"><span className="label">Points</span><input className="input" inputMode="numeric" value={f.points} onChange={(e) => set("points", e.target.value)} /></label>
            <label className="field"><span className="label">Fairways %</span><input className="input" inputMode="numeric" value={f.fairwaysPct} onChange={(e) => set("fairwaysPct", e.target.value)} /></label>
            <label className="field"><span className="label">GIR %</span><input className="input" inputMode="numeric" value={f.girPct} onChange={(e) => set("girPct", e.target.value)} /></label>
            <label className="field"><span className="label">Putts</span><input className="input" inputMode="numeric" value={f.putts} onChange={(e) => set("putts", e.target.value)} /></label>
          </div>
        </details>
        {f.source === "OCR" && <div className="ocr-note"><Sparkles size={14} /> Pre-filled from your scorecard image. Check every value, then submit.</div>}
        <button className="btn btn-primary full" disabled={!valid} onClick={submit}>Submit round</button>
        {!valid && <div className="hint center">Fill date, course, tee, gross{f.type === "QUALIFYING" ? " and a member witness" : ""}.</div>}
      </div>
    </div>
  );
}

function fuzzyMatchCourse(name, courses) {
  if (!name) return null;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = norm(name);
  if (!target) return null;
  return courses.find((c) => { const cn = norm(c.name); return cn === target || cn.includes(target) || target.includes(cn); }) || null;
}
function parseDetectedDate(d) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
}
function buildReviewData(shared, pl) {
  return {
    player: pl?.player ?? "", course: shared?.course ?? "", date: shared?.date ?? "",
    totalGross: pl?.totalGross ?? "", points: pl?.points ?? "", putts: pl?.putts ?? "",
    fairwaysPct: pl?.fairwaysPct ?? "", girPct: pl?.girPct ?? "",
    holes: Array.isArray(pl?.holes) ? pl.holes : [], out: pl?.out ?? "", inn: pl?.["in"] ?? "",
  };
}

function ScorecardUpload({ courses, loadCourses, onApply }) {
  const [state, setState] = useState("idle");
  const [preview, setPreview] = useState(null);
  const [extracted, setExtracted] = useState(null); // { date, course, players: [...] }
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef();
  const reset = () => { setExtracted(null); setData(null); setState("idle"); };
  const handleFile = async (file) => {
    if (!file) return;
    setErr(""); setState("reading"); setPreview(URL.createObjectURL(file));
    try {
      const imageBase64 = await fileToB64(file);
      const r = await api("/api/scorecard/extract", { method: "POST", body: JSON.stringify({ imageBase64, mediaType: file.type }) });
      const p = r.data;
      const shared = { date: p.date ?? null, course: p.course ?? null };
      const players = Array.isArray(p.players) && p.players.length > 0 ? p.players : [p];
      setExtracted({ ...shared, players });
      if (players.length > 1) {
        setState("select");
      } else {
        setData(buildReviewData(shared, players[0]));
        setState("review");
      }
    } catch (e) { setErr(e.message); setState("error"); }
  };
  const choosePlayer = (i) => {
    setData(buildReviewData(extracted, extracted.players[i]));
    setState("review");
  };
  const edit = (k, v) => setData((p) => ({ ...p, [k]: v }));
  const matched = fuzzyMatchCourse(data?.course, courses || []);
  const apply = async () => {
    const holes = Array.isArray(data.holes) && data.holes.length === 18 ? data.holes.map((x) => String(x)) : Array(18).fill("");
    const out = { gross: data.totalGross === "" ? "" : String(data.totalGross), points: data.points === "" ? "" : String(data.points), holes,
      fairwaysPct: data.fairwaysPct === "" ? "" : String(data.fairwaysPct), girPct: data.girPct === "" ? "" : String(data.girPct), putts: data.putts === "" ? "" : String(data.putts) };

    let courseId = matched?.id, teeId = matched?.tees?.[0]?.id;
    if (!matched && data.course?.trim()) {
      setCreating(true);
      try {
        const r = await api("/api/courses", { method: "POST", body: JSON.stringify({ name: data.course.trim() }) });
        await loadCourses();
        courseId = r.course.id; teeId = r.course.tees?.[0]?.id || "";
      } catch (e) {
        alert("Couldn't add that course automatically: " + e.message + ". You can pick or add it manually below.");
      }
      setCreating(false);
    }
    if (courseId) { out.courseId = courseId; out.teeId = teeId || ""; }

    const isoDate = parseDetectedDate(data.date);
    if (isoDate) out.date = isoDate;
    onApply(out);
  };
  return (
    <div className="card upload">
      {state === "idle" && (<>
        <div className="upload-drop" onClick={() => inputRef.current?.click()}>
          <Camera size={28} /><div className="upload-h">Upload a Hole19 scorecard</div>
          <div className="muted small">Snap or pick a screenshot — we'll read it and let you check every number before saving. If it shows several players, we'll ask which one is yours.</div>
          <button className="btn btn-ghost" type="button"><Upload size={15} /> Choose image</button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
      </>)}
      {state === "reading" && <div className="reading"><Loader2 className="spin" size={26} /><div>Reading your scorecard…</div></div>}
      {state === "error" && <div className="reading"><AlertCircle size={26} className="bad-ic" /><div className="center">{err}</div><button className="btn btn-ghost" onClick={reset}>Try another image</button></div>}
      {state === "select" && extracted && (
        <div className="review">
          <div className="review-top">{preview && <img src={preview} alt="scorecard" className="thumb" />}
            <div><div className="row-title"><Users size={15} style={{ verticalAlign: "-2px", marginRight: 5 }} />Multiple players found</div>
              <div className="muted small">{extracted.course || "Course unknown"} · {extracted.date || "date unknown"} — whose round is this?</div></div></div>
          <div className="stack">
            {extracted.players.map((pl, i) => (
              <button key={i} className="quick" onClick={() => choosePlayer(i)}>
                <span style={{ flex: 1 }}>{pl.player || `Player ${i + 1}`}</span>
                <span className="muted small">{pl.totalGross ?? "—"} gross{pl.points != null ? ` · ${pl.points} pts` : ""}</span>
                <ChevronRight size={16} className="chev" />
              </button>
            ))}
          </div>
          <div className="btn-row"><button className="btn btn-ghost" onClick={reset}>Cancel</button></div>
        </div>
      )}
      {state === "review" && data && (
        <div className="review">
          <div className="review-top">{preview && <img src={preview} alt="scorecard" className="thumb" />}
            <div><div className="row-title">Detected — please confirm</div><div className="muted small">Screenshots can be misread. Fix anything that's wrong.</div></div></div>
          <div className="grid2">
            <label className="field"><span className="label">Player</span><input className="input" value={data.player} onChange={(e) => edit("player", e.target.value)} /></label>
            <label className="field"><span className="label">Date</span><input className="input" value={data.date} onChange={(e) => edit("date", e.target.value)} placeholder="as read off the card" /></label>
            <label className="field" style={{ gridColumn: "1 / -1" }}><span className="label">Course</span><input className="input" value={data.course} onChange={(e) => edit("course", e.target.value)} /></label>
            <label className="field"><span className="label">Total gross</span><input className="input" value={data.totalGross} onChange={(e) => edit("totalGross", e.target.value)} /></label>
            <label className="field"><span className="label">Points</span><input className="input" value={data.points} onChange={(e) => edit("points", e.target.value)} /></label>
            <label className="field"><span className="label">Putts</span><input className="input" value={data.putts} onChange={(e) => edit("putts", e.target.value)} /></label>
            <label className="field"><span className="label">Fairways %</span><input className="input" value={data.fairwaysPct} onChange={(e) => edit("fairwaysPct", e.target.value)} /></label>
            <label className="field"><span className="label">GIR %</span><input className="input" value={data.girPct} onChange={(e) => edit("girPct", e.target.value)} /></label>
          </div>
          {data.course && (matched
            ? <div className="ocr-note"><Sparkles size={14} /> Matched to <b>{matched.name}</b> in your course list — it'll be pre-selected below.</div>
            : <div className="warn-strip"><AlertCircle size={14} /> "{data.course}" isn't in your saved courses yet — confirming will add it automatically with a default par. An admin can fix the real par/tees later under Admin → Courses.</div>)}
          {Array.isArray(data.holes) && data.holes.length > 0 && (
            <div className="detected-holes"><div className="muted small">Holes 1–18 · OUT {data.out || "—"} · IN {data.inn || "—"}</div>
              <div className="hole-chips">{data.holes.map((h, i) => <span key={i} className="hchip">{h}</span>)}</div></div>)}
          {extracted?.players?.length > 1 && (
            <button className="link" type="button" onClick={() => setState("select")}>← Not the right player? Choose again</button>
          )}
          <div className="warn-strip"><AlertCircle size={14} /> The round itself isn't saved yet. Confirming carries these values into the form for a final check.</div>
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={reset} disabled={creating}>Discard</button>
            <button className="btn btn-primary" onClick={apply} disabled={creating}>{creating ? <Loader2 className="spin" size={15} /> : null} Confirm &amp; continue</button>
          </div>
        </div>
      )}
    </div>
  );
}
