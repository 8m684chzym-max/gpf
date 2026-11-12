"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Crosshair, LocateFixed, LocateOff, Pencil, X, Copy, RotateCcw, ArrowLeft, Check, ClipboardList,
} from "lucide-react";
import { courseBySlug, courseMapFor, DEFAULT_COURSE } from "@/lib/holes";
import { api } from "@/lib/client";
import { CARD_HOLES, loadLive, saveLive, holePoints, holesOf, setStroke, totals, strokesOn, parOf, siOf } from "@/lib/liveRound";
import {
  distance, along, toWorld, fromWorld, toScreen, fromScreen, fitLine, worldPerMetre, frontBack,
} from "@/lib/geo";

// Esri World Imagery (free satellite tiles, attribution required): the base map for holes
// with no traced sketch (e.g. Lisbon Sports Club).
const TILE_URL = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const MAX_TILE_Z = 19;
const MAX_K = 2 ** 21;            // closest zoom (screen px per world unit)
const MIN_K = 2 ** 13;
const PAD_TOP = 165, PAD_BOTTOM = 70;   // keep the whole green clear of the distance card
const ARCS = [[50, "#5b8fd9"], [100, "#c8553d"], [150, "#7d7468"], [200, "#3d6fc4"], [250, "#d39a1c"], [300, "#8a5bbf"]]; // readable on the paper yardage book
// This phone's unsaved tee/green edits, per course (Pinheirinho keeps the original key).
const lsKey = (cm) => (cm.slug === DEFAULT_COURSE.slug ? "gpf-holemap-v1" : `gpf-holemap-v1:${cm.slug}`);
const PLAYER_RANGE = 700;         // within this of the green you are "on the hole" and distances start from you

const loadOverrides = (cm) => { try { return JSON.parse(localStorage.getItem(lsKey(cm)) || "{}"); } catch { return {}; } };
const saveOverrides = (cm, o) => { try { localStorage.setItem(lsKey(cm), JSON.stringify(o)); } catch { /* private mode */ } };
const m = (v) => (v == null ? "—" : Math.round(v));

// Which course: /play/map?course=<slug>, else the course of the round in progress,
// else Pinheirinho (old links from the Open keep working).
export default function HoleMap() {
  const [cm, setCm] = useState(null);
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("course");
    const live = loadLive();
    setCm(courseBySlug(slug) || (live && courseMapFor(live.courseName)) || DEFAULT_COURSE);
  }, []);
  if (!cm) return null;
  return <HoleMapInner key={cm.slug} cm={cm} />;
}

function HoleMapInner({ cm }) {
  const HOLES = cm.holes;
  const boxRef = useRef(null);
  const [size, setSize] = useState(null);
  const [overrides, setOverrides] = useState({}); // this phone's edits not yet saved to the server
  const [shared, setShared] = useState({});       // tee/green positions everyone shares (from /api/holes)
  const [loaded, setLoaded] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [idx, setIdx] = useState(0);              // card hole (0-based); a 9-hole map is played twice
  const [view, setView] = useState(null);
  const [targets, setTargets] = useState([]);   // up to 2 aim points on the line of play
  const [gps, setGps] = useState(null);           // { pos:[lat,lng], acc }
  const [gpsOn, setGpsOn] = useState(true);
  const [gpsErr, setGpsErr] = useState(null);
  const [edit, setEdit] = useState(null);         // null | "tee" | "green"
  const [copied, setCopied] = useState(false);
  const [sketches, setSketches] = useState(null);
  const [live, setLive] = useState(null);           // individual round in progress (lib/liveRound.js)
  const liveHere = !!(live && courseMapFor(live.courseName)?.slug === cm.slug);
  const nav = liveHere ? CARD_HOLES : HOLES.length; // holes you step through
  // Opened from score entry: /play/map?hole=N
  useEffect(() => {
    const l = loadLive();
    setLive(l);
    const max = l && courseMapFor(l.courseName)?.slug === cm.slug ? CARD_HOLES : HOLES.length;
    const n = Number(new URLSearchParams(window.location.search).get("hole"));
    if (n >= 1 && n <= max) setIdx(n - 1);
  }, [cm.slug, HOLES.length]);
  const userMoved = useRef(false);
  const fitOrigin = useRef(null);

  const refreshShared = useCallback(() => api(`/api/holes?course=${cm.slug}`).then((r) => setShared(r.holes || {})).catch(() => {}), [cm.slug]);
  useEffect(() => {
    setOverrides(loadOverrides(cm));
    const sk = cm.sketchUrl
      ? fetch(cm.sketchUrl).then((r) => (r.ok ? r.json() : {})).then(setSketches).catch(() => setSketches({}))
      : Promise.resolve(setSketches({}));
    Promise.allSettled([refreshShared(), sk]).then(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshShared]);
  useEffect(() => { if (loaded) refreshShared(); }, [idx, loaded, refreshShared]);

  // Fill the space between the top bar and the tab bar.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const top = document.querySelector(".topbar")?.offsetHeight ?? 54;
    const bottom = document.querySelector(".tabbar")?.offsetHeight ?? 64;
    el.style.top = `${top}px`;
    el.style.bottom = `${bottom}px`;
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the screen awake while the map is open (where supported).
  useEffect(() => {
    let lock = null;
    const req = () => navigator.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    req();
    const vis = () => { if (document.visibilityState === "visible") req(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); lock?.release?.().catch(() => {}); };
  }, []);

  // GPS tracking.
  useEffect(() => {
    if (!gpsOn) { setGps(null); return; }
    if (!navigator.geolocation) { setGpsErr("GPS not available on this device"); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => { setGpsErr(null); setGps({ pos: [p.coords.latitude, p.coords.longitude], acc: p.coords.accuracy }); },
      (e) => setGpsErr(e.code === 1 ? "Location permission denied" : "Waiting for GPS…"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [gpsOn]);

  const hole = useMemo(() => {
    const h = HOLES[idx % HOLES.length], o = overrides[h.n] || {}, sv = shared[h.n] || {};
    const green = o.green ?? sv.green ?? h.green;
    const tee = o.tee ?? sv.tee ?? h.tee;
    const sketch = sketches?.[h.n] || null;
    const cardN = idx + 1;   // number on the card (10–18 on the second loop of a 9-hole course)
    const par = liveHere ? parOf(live, idx) : h.par, si = liveHere ? siOf(live, idx) : h.si;
    const base = { ...h, cardN, par, si, tee, green, greenPoly: green === h.green ? h.greenPoly : null, by: sv.by, sketch, virtual: false, realTee: !!tee, realGreen: !!green };
    // Until both the real tee and green are set, lay the sketch out at a stand-in spot
    // so yardage-book distances work from the tee. GPS needs the real tee and green.
    let out = base;
    if (!(tee && green) && sketch) {
      const vt = cm.centre;
      out = { ...base, virtual: true, tee: vt, green: sketchFrame(vt, null, sketch.green)(sketch.green) };
    }
    // Traced green outline → front / back distances along the line of play.
    if (sketch?.greenPoly && out.tee && out.green) {
      const f = sketchFrame(out.tee, out.virtual ? null : out.green, sketch.green);
      out = { ...out, greenPoly: sketch.greenPoly.map(f) };
    }
    return out;
  }, [idx, overrides, shared, sketches, HOLES, cm.centre, liveHere, live]);
  const mapped = !!(hole.tee && hole.green);
  const teeKey = liveHere && hole.lens ? Object.keys(hole.lens).find((t) => live.teeName?.toLowerCase().startsWith(t.toLowerCase())) : null;
  const cardLen = (teeKey && hole.lens[teeKey]) ?? hole.len;
  const holeLen = mapped ? distance(hole.tee, hole.green) : null;

  const playerOnHole = !!(gps && mapped && !hole.virtual && distance(gps.pos, hole.green) < Math.min(PLAYER_RANGE, holeLen + 80));
  const origin = mapped ? (playerOnHole ? gps.pos : hole.tee) : null;

  const fit = useCallback((force) => {
    if (!size) return;
    if (origin && hole.green) {
      if (!force && userMoved.current) return;
      if (!force && fitOrigin.current && distance(fitOrigin.current, origin) < 12) return;
      fitOrigin.current = origin;
      setView(fitLine(origin, hole.green, size.W, size.H, PAD_TOP, PAD_BOTTOM, MAX_K));
    } else {
      if (!force && view) return;
      const c = toWorld(hole.tee || hole.green || gps?.pos || cm.centre);
      setView({ cx: c[0], cy: c[1], k: 2 ** 17, r: 0, ax: size.W / 2, ay: size.H / 2 });
    }
    if (force) userMoved.current = false;
  }, [size, origin, hole.green, hole.tee, gps, view, cm.centre]);

  // New hole: start fresh; open setup straight away if it isn't mapped yet.
  useEffect(() => {
    userMoved.current = false;
    fitOrigin.current = null;
    if (loaded) setEdit(mapped ? null : "tee");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, loaded]);
  // Suggest a target (driving / lay-up distance) on long holes.
  useEffect(() => {
    if (!origin || !hole.green) { setTargets([]); return; }
    const len = distance(origin, hole.green);
    setTargets(len >= 240 ? [along(origin, hole.green, Math.min(230, len - 70))] : []);
    // Only when the hole (or its mapping) changes — not every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, hole.tee?.[0], hole.green?.[0]]);
  useEffect(() => { fit(false); }, [fit]);
  useEffect(() => { fitOrigin.current = null; fit(true); /* refit on resize / new hole */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size?.W, size?.H, idx, mapped]);

  const editLocal = (n, fn) => setOverrides((prev) => { const next = fn({ ...prev }); saveOverrides(cm, next); return next; });
  // Show the change at once, then share it. If the save fails it stays on this phone.
  const setPoint = (which, p) => {
    const n = hole.n;
    editLocal(n, (o) => ({ ...o, [n]: { ...(o[n] || {}), [which]: p } }));
    api("/api/holes", { method: "POST", body: JSON.stringify({ course: cm.slug, n, [which]: p }) })
      .then(() => refreshShared())
      .then(() => { setSaveErr(null); editLocal(n, (o) => { if (o[n]) { delete o[n][which]; if (!Object.keys(o[n]).length) delete o[n]; } return o; }); })
      .catch((e) => setSaveErr(`Saved on this phone only (${e.message})`));
  };
  const resetHole = () => {
    const n = hole.n;
    editLocal(n, (o) => { delete o[n]; return o; });
    if (shared[n]) api("/api/holes", { method: "POST", body: JSON.stringify({ course: cm.slug, n, reset: true }) }).then(refreshShared).catch((e) => setSaveErr(e.message));
  };
  const copyLayout = async () => {
    const r6 = (p) => (p ? [+p[0].toFixed(6), +p[1].toFixed(6)] : null);
    const rows = HOLES.map((h) => {
      const o = overrides[h.n] || {}, sv = shared[h.n] || {};
      const green = o.green ?? sv.green ?? h.green;
      return `  /* ${String(h.n).padStart(2)} */ [${JSON.stringify(r6(o.tee ?? sv.tee ?? h.tee))}, ${JSON.stringify(r6(green))}, ${green === h.green ? JSON.stringify(h.greenPoly) : "null"}],`;
    });
    const text = rows.join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt("Copy the hole layout:", text); }
  };

  // ── Gestures: drag = pan (or move a target if you grab it), pinch/wheel = zoom,
  //    tap = add a target (max 2; with 2, the nearer one moves there), tap a target = remove it ──
  const ptrs = useRef(new Map());
  const gesture = useRef(null);
  const local = (e) => { const b = boxRef.current.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };

  const onDown = (e) => {
    if (!view) return;
    boxRef.current.setPointerCapture?.(e.pointerId);
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size === 1) {
      let ti = -1, best = 34;
      targets.forEach((t, i) => { const ts = toScreen(view, toWorld(t)); const d = Math.hypot(ts[0] - p[0], ts[1] - p[1]); if (d < best) { best = d; ti = i; } });
      gesture.current = { kind: ti >= 0 ? "target" : "pan", ti, start: p, t: Date.now(), view, moved: false };
    } else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      gesture.current = { kind: "pinch", view, dist: Math.hypot(a[0] - b[0], a[1] - b[1]), anchorW: fromScreen(view, mid), moved: true };
    }
  };
  const onMove = (e) => {
    const g = gesture.current;
    if (!g || !ptrs.current.has(e.pointerId)) return;
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    if (g.kind === "pinch" && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const k = Math.min(MAX_K, Math.max(MIN_K, g.view.k * (Math.hypot(a[0] - b[0], a[1] - b[1]) / g.dist)));
      userMoved.current = true;
      setView({ ...g.view, k, cx: g.anchorW[0], cy: g.anchorW[1], ax: mid[0], ay: mid[1] });
      return;
    }
    const dx = p[0] - g.start[0], dy = p[1] - g.start[1];
    if (!g.moved && Math.hypot(dx, dy) < 7) return;
    g.moved = true;
    if (g.kind === "target") { const at = fromWorld(fromScreen(view, p)); setTargets((ts) => ts.map((t, i) => (i === g.ti ? at : t))); }
    else if (g.kind === "pan") { userMoved.current = true; setView({ ...g.view, ax: g.view.ax + dx, ay: g.view.ay + dy }); }
  };
  const onUp = (e) => {
    const g = gesture.current;
    const p = ptrs.current.get(e.pointerId) || local(e);
    ptrs.current.delete(e.pointerId);
    if (!g) return;
    if (ptrs.current.size === 0) {
      if (!g.moved && g.kind !== "pinch" && Date.now() - g.t < 500 && view) {
        const at = fromWorld(fromScreen(view, p));
        if (mapped) {
          if (g.kind === "target") setTargets((ts) => ts.filter((_, i) => i !== g.ti));
          else setTargets((ts) => {
            if (ts.length < 2) return [...ts, at];
            const near = distance(ts[0], at) <= distance(ts[1], at) ? 0 : 1;
            return ts.map((t, i) => (i === near ? at : t));
          });
        }
      }
      gesture.current = null;
    } else if (g.kind === "pinch") {
      // One finger left: continue as a pan from here.
      const [q] = [...ptrs.current.values()];
      gesture.current = { kind: "pan", start: q, t: 0, view, moved: true };
    }
  };
  const onWheel = (e) => {
    if (!view) return;
    const p = local(e);
    const w = fromScreen(view, p);
    const k = Math.min(MAX_K, Math.max(MIN_K, view.k * Math.exp(-e.deltaY * 0.0015)));
    userMoved.current = true;
    setView({ ...view, k, cx: w[0], cy: w[1], ax: p[0], ay: p[1] });
  };
  const zoomBy = (f) => {
    if (!view || !size) return;
    const p = [size.W / 2, size.H / 2], w = fromScreen(view, p);
    userMoved.current = true;
    setView({ ...view, k: Math.min(MAX_K, Math.max(MIN_K, view.k * f)), cx: w[0], cy: w[1], ax: p[0], ay: p[1] });
  };

  // ── Derived distances ──
  const toGreen = origin && hole.green ? distance(origin, hole.green) : null;
  const fb = origin ? frontBack(origin, hole.green, hole.greenPoly) : null;
  const showSketch = !!hole.sketch;
  // Targets in playing order (nearest the ball first), then each leg: ball → t1 (→ t2) → green.
  const aims = origin ? [...targets].sort((a, b) => distance(origin, a) - distance(origin, b)) : [];
  const legs = origin && hole.green && aims.length
    ? [origin, ...aims, hole.green].slice(1).map((q, i, arr) => distance(i === 0 ? origin : arr[i - 1], q))
    : [];

  return (
    <div ref={boxRef} className={`hm ${showSketch ? "hm-sk" : ""}`}
         onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
      {view && size && showSketch && <Sketch view={view} size={size} hole={hole} />}
      {view && size && !showSketch && <Tiles view={view} size={size} />}
      {view && size && (
        <Overlay view={view} size={size} hole={hole} origin={origin} aims={aims} gps={gps}
                 playerOnHole={playerOnHole} legs={legs} edit={edit} />
      )}

      {/* Top-left: distance to the green */}
      <div className="hm-hud" onPointerDown={(e) => e.stopPropagation()}>
        <Link href="/play" className="hm-back" aria-label="Back to Play"><ArrowLeft size={16} /></Link>
        {mapped ? (
          <div className="hm-green">
            <div className="hm-green-num num">{m(toGreen)}<span>m</span></div>
            <div className="hm-green-sub">
              {fb ? <>F {m(fb.front)} · B {m(fb.back)}</> : "to centre of green"}
              <br />{playerOnHole ? <>from you{gps.acc ? ` (±${Math.round(gps.acc)} m)` : ""}</> : "from the tee"}
              {hole.virtual && <><br /><span className="hm-warn">Sketch only · no GPS yet</span></>}
            </div>
          </div>
        ) : <div className="hm-green"><div className="hm-green-sub">Hole {hole.n} isn&rsquo;t mapped yet</div></div>}
      </div>

      {/* Right-hand controls */}
      <div className="hm-ctl" onPointerDown={(e) => e.stopPropagation()}>
        <button className={`hm-btn ${gpsOn ? "on" : ""}`} onClick={() => setGpsOn((v) => !v)} title={gpsOn ? "GPS on" : "GPS off"}>
          {gpsOn ? <LocateFixed size={19} /> : <LocateOff size={19} />}
        </button>
        <button className="hm-btn" onClick={() => fit(true)} title="Recentre hole"><Crosshair size={19} /></button>
        <button className="hm-btn" onClick={() => zoomBy(1.5)} title="Zoom in">+</button>
        <button className="hm-btn" onClick={() => zoomBy(1 / 1.5)} title="Zoom out">−</button>
        <button className={`hm-btn ${edit ? "on" : ""}`} onClick={() => setEdit(edit ? null : "tee")} title="GPS setup (tee & green)"><Pencil size={17} /></button>
        {targets.length > 0 && <button className="hm-btn" onClick={() => setTargets([])} title={targets.length > 1 ? "Clear targets" : "Clear target"}><X size={18} /></button>}
      </div>

      {gpsOn && gpsErr && <div className="hm-toast" onPointerDown={(e) => e.stopPropagation()}>{gpsErr}</div>}

      {edit && (
        <div className="hm-edit" onPointerDown={(e) => e.stopPropagation()}>
          <div className="hm-edit-h">
            <b>GPS setup · hole {hole.n}</b> — stand on the tee and press <b>Tee is here</b>, then on the green press <b>Green is here</b>. Saved for everyone; GPS distances switch on once both are set.
            <div className="small" style={{ marginTop: 4 }}>
              Tee {hole.realTee ? "✓" : "—"} · Green {hole.realGreen ? "✓" : "—"}{gps ? <span className="muted"> · GPS ±{Math.round(gps.acc || 0)} m</span> : <span style={{ color: "var(--bad)" }}> · waiting for GPS</span>}
            </div>
            {hole.by && <div className="muted small">Last set by {hole.by}</div>}
            {saveErr && <div className="small" style={{ color: "var(--bad)" }}>{saveErr}</div>}
          </div>
          <div className="hm-edit-row">
            <button className="hm-chip on" disabled={!gps} onClick={() => setPoint("tee", gps.pos)}>Tee is here</button>
            <button className="hm-chip on" disabled={!gps} onClick={() => setPoint("green", gps.pos)}>Green is here</button>
            {(overrides[hole.n] || shared[hole.n]) && <button className="hm-chip" onClick={resetHole} title="Clear this hole's tee and green"><RotateCcw size={13} /></button>}
            <button className="hm-chip" onClick={copyLayout} title="Copy all holes for the course file">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
            <button className="hm-chip ok" onClick={() => { setEdit(null); fit(true); }}>Done</button>
          </div>
        </div>
      )}

      {/* Bottom: hole selector */}
      <div className="hm-bar" onPointerDown={(e) => e.stopPropagation()}>
        <button className="hm-nav" onClick={() => setIdx((idx + nav - 1) % nav)} aria-label="Previous hole"><ChevronLeft size={24} /></button>
        <div className="hm-hole">
          <span className="hm-hole-n num">{String(hole.cardN).padStart(2, "0")}</span>
          <span className="hm-hole-meta"><b>PAR {hole.par}</b><br />S.I. {hole.si}{holeLen && !hole.virtual ? <> · {Math.round(holeLen)} m</> : cardLen ? <> · {cardLen} m</> : holeLen ? <> · {Math.round(holeLen)} m</> : null}</span>
        </div>
        {liveHere ? (
          <LiveScore live={live} i={idx} onChange={(r) => { saveLive(r); setLive(r); }} />
        ) : (
          <Link href={`/play/round?course=${cm.slug}`} className="hm-score" aria-label="Start an individual round"><ClipboardList size={17} /><span>Score</span></Link>
        )}
        <button className="hm-nav" onClick={() => setIdx((idx + 1) % nav)} aria-label="Next hole"><ChevronRight size={24} /></button>
      </div>
      <div className="hm-attr">{showSketch ? <>{cm.name} · GPF yardage book · approximate</> : <>{cm.name} · Imagery © Esri, Maxar, Earthstar Geographics</>}</div>
    </div>
  );
}

// Live round: strokes on this hole (− / +), Stableford points, link to the card.
// One player: inline in the bar. A group: a "Scores" button opens a panel with a row per player.
function LiveScore({ live, i, onChange }) {
  const [open, setOpen] = useState(false);
  const P = live.players;
  const t = totals(live, 0);
  if (P.length === 1) return (
    <div className="hm-live">
      <StrokeStepper live={live} i={i} p={0} onChange={onChange} />
      <Link href="/play/round" className="hm-card" aria-label="Scorecard"><span className="num">{t.points}</span><small>card</small></Link>
    </div>
  );
  const entered = P.filter((_, p) => holesOf(live, p)[i]).length;
  return (
    <div className="hm-live">
      {open && (
        <div className="hm-sheet">
          {P.map((pl, p) => {
            const rx = Math.max(0, strokesOn(live, i, p));
            return (
              <div key={p} className="hm-sheet-row">
                <span className="hm-sheet-name">{pl.name.split(" ")[0]}{rx > 0 && <span className="hm-dots"> {"•".repeat(rx)}</span>}
                  <small>{totals(live, p).points} pts</small></span>
                <StrokeStepper live={live} i={i} p={p} onChange={onChange} />
              </div>);
          })}
        </div>)}
      <button className={`hm-strokes ${open ? "on" : ""}`} aria-expanded={open} aria-label="Scores for the group on this hole" onClick={() => setOpen((v) => !v)}>
        <span className="num">{entered}/{P.length}</span><small>scores</small>
      </button>
      <Link href="/play/round" className="hm-card" aria-label="Scorecard"><span className="num">{t.points}</span><small>card</small></Link>
    </div>
  );
}

function StrokeStepper({ live, i, p, onChange }) {
  const s = holesOf(live, p)[i];
  const setS = (v) => onChange(setStroke(live, p, i, v));
  const pts = holePoints(live, i, p);
  const base = parOf(live, i) + Math.max(0, strokesOn(live, i, p));
  const who = live.players[p]?.name || "";
  return (
    <>
      <button className="hm-step" aria-label={`${who}: one stroke less`} onClick={() => setS(s ? (s > 1 ? s - 1 : null) : base)}>−</button>
      <button className="hm-strokes" aria-label={`${who}: strokes on hole ${i + 1}`} onClick={() => !s && setS(base)}>
        <span className="num">{s ?? "–"}</span><small>{pts != null ? `${pts} pt${pts === 1 ? "" : "s"}` : "tap"}</small>
      </button>
      <button className="hm-step" aria-label={`${who}: one stroke more`} onClick={() => setS(Math.min(20, (s ?? base - 1) + 1))}>+</button>
    </>
  );
}

// Satellite tiles for the current view, drawn in a rotated/scaled layer.
// A coarser layer sits underneath so there is something to see while the sharp tiles load.
function Tiles({ view, size }) {
  const zFine = Math.max(3, Math.min(MAX_TILE_Z, Math.ceil(Math.log2(view.k))));
  return (
    <div className="hm-tiles" aria-hidden>
      <TileLayer view={view} size={size} z={Math.max(3, zFine - 3)} />
      <TileLayer view={view} size={size} z={zFine} />
    </div>
  );
}

function TileLayer({ view, size, z }) {
  const n = 2 ** z, unit = 256 / n;       // world units per tile
  const corners = [[0, 0], [size.W, 0], [0, size.H], [size.W, size.H]].map((p) => fromScreen(view, p));
  const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
  const x0 = Math.floor(Math.min(...xs) / unit), x1 = Math.floor(Math.max(...xs) / unit);
  const y0 = Math.max(0, Math.floor(Math.min(...ys) / unit)), y1 = Math.min(n - 1, Math.floor(Math.max(...ys) / unit));
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 120) return null; // zoomed way out — skip rather than flood requests

  // Tiles are laid out in px relative to a base tile near the centre (keeps CSS numbers small).
  const bx = Math.floor(view.cx / unit), by = Math.floor(view.cy / unit);
  const s = view.k / (2 ** z);    // screen px per tile px
  const cs = Math.cos(view.r), sn = Math.sin(view.r);
  const a = s * cs, b = s * sn, c = -s * sn, d = s * cs;
  const Cx = (view.cx / unit - bx) * 256, Cy = (view.cy / unit - by) * 256; // centre in layer px
  const e = view.ax - (a * Cx + c * Cy), f = view.ay - (b * Cx + d * Cy);

  const imgs = [];
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const wx = ((tx % n) + n) % n;
    imgs.push(
      <img key={`${z}/${tx}/${ty}`} src={TILE_URL(z, wx, ty)} alt="" draggable={false}
           onError={(ev) => { ev.currentTarget.style.visibility = "hidden"; }}
           style={{ left: (tx - bx) * 256, top: (ty - by) * 256 }} />,
    );
  }
  return <div className="hm-layer" style={{ transform: `matrix(${a},${b},${c},${d},${e},${f})` }}>{imgs}</div>;
}

// Lines, distance arcs, markers and distance labels, in screen space.
function Overlay({ view, size, hole, origin, aims, gps, playerOnHole, legs, edit }) {
  const S = (p) => toScreen(view, toWorld(p));
  const pxPerM = (lat) => worldPerMetre(lat) * view.k;
  const els = [], labels = [];

  if (origin && hole.green) {
    const o = S(origin), g = S(hole.green);
    const ang = Math.atan2(g[1] - o[1], g[0] - o[0]);
    const total = distance(origin, hole.green);
    const ppm = pxPerM(origin[0]);
    for (const [r, col] of ARCS) {
      if (r > total - 15) break;
      const rp = r * ppm;
      const half = Math.min(Math.PI / 3, Math.asin(Math.min(1, (size.W * 0.36) / rp)));
      const p1 = [o[0] + rp * Math.cos(ang - half), o[1] + rp * Math.sin(ang - half)];
      const p2 = [o[0] + rp * Math.cos(ang + half), o[1] + rp * Math.sin(ang + half)];
      els.push(<path key={`a${r}`} d={`M${p1[0]},${p1[1]} A${rp},${rp} 0 0 1 ${p2[0]},${p2[1]}`} stroke={col} strokeWidth={3.5} fill="none" strokeLinecap="round" opacity={0.95} />);
      const lp = [o[0] + rp * Math.cos(ang), o[1] + rp * Math.sin(ang)];
      els.push(<text key={`t${r}`} x={lp[0]} y={lp[1] + 18} className="hm-arc-t" textAnchor="middle">{r}</text>);
    }
    const ts = aims.map(S);
    const pts = [o, ...ts, g];
    const line = pts.map((p) => p.join(",")).join(" ");
    els.push(<polyline key="line-h" points={line} stroke="#f7efdc" strokeWidth={6} fill="none" strokeLinejoin="round" opacity={0.85} />);
    els.push(<polyline key="line" points={line} stroke="#1e3b28" strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeDasharray="10 5" />);

    ts.forEach((t, i) => {
      els.push(<circle key={`tch${i}`} cx={t[0]} cy={t[1]} r={30} stroke="#f7efdc" strokeWidth={7} fill="rgba(240,168,24,.12)" />);
      els.push(<circle key={`tc${i}`} cx={t[0]} cy={t[1]} r={30} stroke="#1e3b28" strokeWidth={3} fill="none" />);
      els.push(<circle key={`td${i}`} cx={t[0]} cy={t[1]} r={3} fill="#1e3b28" />);
      if (ts.length > 1) els.push(<text key={`tn${i}`} x={t[0]} y={t[1] - 36} className="hm-arc-t" textAnchor="middle">{i + 1}</text>);
    });
    if (ts.length) {
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      legs.forEach((v, i) => {
        const dir = i === 0 ? "down" : i === legs.length - 1 ? "up" : "mid";
        labels.push(<DistTag key={`l${i}`} at={mid(pts[i], pts[i + 1])} value={v} dir={dir} />);
      });
    }
    if (playerOnHole && hole.tee) {
      const te = S(hole.tee);
      els.push(<circle key="tee" cx={te[0]} cy={te[1]} r={5} fill="#f5c242" stroke="#000" strokeWidth={1} />);
    }
  } else {
    if (hole.tee) { const te = S(hole.tee); els.push(<circle key="tee" cx={te[0]} cy={te[1]} r={8} fill="#f5c242" stroke="#000" strokeWidth={1.5} />); }
  }

  if (hole.greenPoly && !hole.sketch) {
    els.push(<polygon key="gp" points={hole.greenPoly.map((p) => S(p).join(",")).join(" ")} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={1.5} strokeDasharray="4 4" />);
  }
  if (hole.green) {
    const g = S(hole.green);
    labels.push(<div key="flag" className="hm-flag" style={{ left: g[0], top: g[1] }}><span /></div>);
  }

  if (gps) {
    const p = S(gps.pos), accPx = (gps.acc || 0) * pxPerM(gps.pos[0]);
    if (accPx > 10) els.push(<circle key="acc" cx={p[0]} cy={p[1]} r={Math.min(accPx, 400)} fill="rgba(80,140,255,.18)" stroke="rgba(80,140,255,.5)" strokeWidth={1} />);
    els.push(<circle key="me" cx={p[0]} cy={p[1]} r={8} fill="#3b7bff" stroke="#fff" strokeWidth={3} />);
  }

  return (
    <>
      <svg className="hm-svg" width={size.W} height={size.H} aria-hidden>{els}</svg>
      <div className="hm-labels">{labels}</div>
    </>
  );
}

function DistTag({ at, value, dir }) {
  return (
    <div className="hm-tag" style={{ left: at[0] + 16, top: at[1] }}>
      <span className="num">{m(value)}</span><small>m {dir === "up" ? "↑" : dir === "down" ? "↓" : "→"}</small>
    </div>
  );
}

// Similarity transform from a sketch's local frame (metres; tee at 0,0, y up the
// screenshot) to [lat, lng], pinned by the real tee and green. With no green it
// lays the sketch out north-up at true scale (stand-in position).
function sketchFrame(tee, green, gLocal) {
  const kx = 111320 * Math.cos((tee[0] * Math.PI) / 180), ky = 110574;
  let s = 1, th = 0;
  if (green) {
    const ex = (green[1] - tee[1]) * kx, ny = (green[0] - tee[0]) * ky;
    s = Math.hypot(ex, ny) / (Math.hypot(gLocal[0], gLocal[1]) || 1);
    th = Math.atan2(ny, ex) - Math.atan2(gLocal[1], gLocal[0]);
  }
  const cs = Math.cos(th) * s, sn = Math.sin(th) * s;
  return ([x, y]) => [tee[0] + (x * sn + y * cs) / ky, tee[1] + (x * cs - y * sn) / kx];
}

const ringsPath = (polys) => polys.map((rings) => rings.map((r) => `M${r.map((p) => p.join(",")).join("L")}Z`).join("")).join("");

// Hole sketch in GPF colours, drawn in its own metre frame and placed with one SVG matrix.
function Sketch({ view, size, hole }) {
  const sk = hole.sketch;
  const paths = useMemo(() => ({
    woods: ringsPath(sk.woods || []), grass: ringsPath(sk.grass || []),
    water: ringsPath(sk.water || []), sand: ringsPath(sk.sand || []),
  }), [sk]);
  const toLL = sketchFrame(hole.tee, hole.virtual ? null : hole.green, sk.green);
  const P = (p) => toScreen(view, toWorld(toLL(p)));
  const o = P([0, 0]), px = P([100, 0]), py = P([0, 100]);
  const a = (px[0] - o[0]) / 100, b = (px[1] - o[1]) / 100, c = (py[0] - o[0]) / 100, d = (py[1] - o[1]) / 100;
  const [gx, gy] = sk.green;
  const gAng = (Math.atan2(gx, gy) * 180) / Math.PI;     // green oval follows the line of play
  return (
    <svg className="hm-svg" width={size.W} height={size.H} aria-hidden>
      <g transform={`matrix(${a},${b},${c},${d},${o[0]},${o[1]})`}>
        {sk.img ? (
          // Engraved yardage-book drawing, placed in the same metre frame (y up, so flip it).
          <image href={sk.img.src} x={sk.img.x0} y={-sk.img.y1} width={sk.img.x1 - sk.img.x0} height={sk.img.y1 - sk.img.y0}
                 transform="scale(1,-1)" preserveAspectRatio="none" />
        ) : <>
        <path d={paths.woods} className="sk-woods" fillRule="evenodd" />
        <path d={paths.grass} className="sk-grass" fillRule="evenodd" />
        <path d={paths.water} className="sk-water" fillRule="evenodd" />
        <path d={paths.sand} className="sk-sand" fillRule="evenodd" />
        {(sk.trees || []).map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={Math.max(1.5, r)} className="sk-tree" />)}
        {sk.greenPoly
          ? <path d={`M${sk.greenPoly.map((p) => p.join(",")).join("L")}Z`} className="sk-green" />
          : <ellipse cx={gx} cy={gy} rx={13} ry={16} transform={`rotate(${-gAng} ${gx} ${gy})`} className="sk-green" />}
        <rect x={-4} y={-2.5} width={8} height={5} rx={1.5} className="sk-tee" />
        </>}
      </g>
    </svg>
  );
}
