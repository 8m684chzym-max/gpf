"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Crosshair, LocateFixed, LocateOff, Pencil, X, Copy, RotateCcw, ArrowLeft, Check,
} from "lucide-react";
import { HOLES, COURSE_MAP } from "@/lib/holes";
import { api } from "@/lib/client";
import {
  distance, along, toWorld, fromWorld, toScreen, fromScreen, fitLine, worldPerMetre, frontBack,
} from "@/lib/geo";

// Esri World Imagery (free satellite tiles, attribution required).
const TILE_URL = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const MAX_TILE_Z = 19;
const MAX_K = 2 ** 21;            // closest zoom (screen px per world unit)
const MIN_K = 2 ** 13;
const PAD_TOP = 92, PAD_BOTTOM = 70;
const ARCS = [[50, "#a9c4ff"], [100, "#ff7a59"], [150, "#e4e4e4"], [200, "#6f9dff"], [250, "#f5c242"], [300, "#d58bff"]];
const LS_KEY = "gpf-holemap-v1";
const PLAYER_RANGE = 700;         // within this of the green you are "on the hole" and distances start from you

const loadOverrides = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } };
const saveOverrides = (o) => { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch { /* private mode */ } };
const m = (v) => (v == null ? "—" : Math.round(v));

export default function HoleMap() {
  const boxRef = useRef(null);
  const [size, setSize] = useState(null);
  const [overrides, setOverrides] = useState({}); // this phone's edits not yet saved to the server
  const [shared, setShared] = useState({});       // tee/green positions everyone shares (from /api/holes)
  const [loaded, setLoaded] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [idx, setIdx] = useState(0);
  const [view, setView] = useState(null);
  const [target, setTarget] = useState(null);
  const [gps, setGps] = useState(null);           // { pos:[lat,lng], acc }
  const [gpsOn, setGpsOn] = useState(true);
  const [gpsErr, setGpsErr] = useState(null);
  const [edit, setEdit] = useState(null);         // null | "tee" | "green"
  const [copied, setCopied] = useState(false);
  const userMoved = useRef(false);
  const fitOrigin = useRef(null);

  const refreshShared = useCallback(() => api("/api/holes").then((r) => setShared(r.holes || {})).catch(() => {}), []);
  useEffect(() => {
    setOverrides(loadOverrides());
    refreshShared().finally(() => setLoaded(true));
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
    const h = HOLES[idx], o = overrides[h.n] || {}, sv = shared[h.n] || {};
    const green = o.green ?? sv.green ?? h.green;
    return { ...h, tee: o.tee ?? sv.tee ?? h.tee, green, greenPoly: green === h.green ? h.greenPoly : null, by: sv.by };
  }, [idx, overrides, shared]);
  const mapped = !!(hole.tee && hole.green);
  const holeLen = mapped ? distance(hole.tee, hole.green) : null;

  const playerOnHole = !!(gps && mapped && distance(gps.pos, hole.green) < Math.min(PLAYER_RANGE, holeLen + 80));
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
      const c = toWorld(hole.tee || hole.green || gps?.pos || COURSE_MAP.centre);
      setView({ cx: c[0], cy: c[1], k: 2 ** 17, r: 0, ax: size.W / 2, ay: size.H / 2 });
    }
    if (force) userMoved.current = false;
  }, [size, origin, hole.green, hole.tee, gps, view]);

  // New hole: start fresh; open setup straight away if it isn't mapped yet.
  useEffect(() => {
    userMoved.current = false;
    fitOrigin.current = null;
    if (loaded) setEdit(mapped ? null : "tee");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, loaded]);
  // Suggest a target (driving / lay-up distance) on long holes.
  useEffect(() => {
    if (!origin || !hole.green) { setTarget(null); return; }
    const len = distance(origin, hole.green);
    setTarget(len >= 240 ? along(origin, hole.green, Math.min(230, len - 70)) : null);
    // Only when the hole (or its mapping) changes — not every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, hole.tee?.[0], hole.green?.[0]]);
  useEffect(() => { fit(false); }, [fit]);
  useEffect(() => { fitOrigin.current = null; fit(true); /* refit on resize / new hole */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size?.W, size?.H, idx, mapped]);

  const editLocal = (n, fn) => setOverrides((prev) => { const next = fn({ ...prev }); saveOverrides(next); return next; });
  // Show the change at once, then share it. If the save fails it stays on this phone.
  const setPoint = (which, p) => {
    const n = hole.n;
    editLocal(n, (o) => ({ ...o, [n]: { ...(o[n] || {}), [which]: p } }));
    api("/api/holes", { method: "POST", body: JSON.stringify({ n, [which]: p }) })
      .then(() => refreshShared())
      .then(() => { setSaveErr(null); editLocal(n, (o) => { if (o[n]) { delete o[n][which]; if (!Object.keys(o[n]).length) delete o[n]; } return o; }); })
      .catch((e) => setSaveErr(`Saved on this phone only (${e.message})`));
  };
  const resetHole = () => {
    const n = hole.n;
    editLocal(n, (o) => { delete o[n]; return o; });
    if (shared[n]) api("/api/holes", { method: "POST", body: JSON.stringify({ n, reset: true }) }).then(refreshShared).catch((e) => setSaveErr(e.message));
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

  // ── Gestures: drag = pan (or move the target if you grab it), pinch/wheel = zoom, tap = set target ──
  const ptrs = useRef(new Map());
  const gesture = useRef(null);
  const local = (e) => { const b = boxRef.current.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };

  const onDown = (e) => {
    if (!view) return;
    boxRef.current.setPointerCapture?.(e.pointerId);
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size === 1) {
      const ts = target ? toScreen(view, toWorld(target)) : null;
      const onTarget = !edit && ts && Math.hypot(ts[0] - p[0], ts[1] - p[1]) < 34;
      gesture.current = { kind: onTarget ? "target" : "pan", start: p, t: Date.now(), view, moved: false };
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
    if (g.kind === "target") setTarget(fromWorld(fromScreen(view, p)));
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
        if (edit) {
          setPoint(edit, at);
          if (edit === "tee" && !hole.green) setEdit("green");
        } else if (mapped) setTarget(at);
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
  const toTarget = origin && target ? distance(origin, target) : null;
  const targetToGreen = target && hole.green ? distance(target, hole.green) : null;

  return (
    <div ref={boxRef} className="hm"
         onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
      {view && size && <Tiles view={view} size={size} />}
      {view && size && (
        <Overlay view={view} size={size} hole={hole} origin={origin} target={target} gps={gps}
                 playerOnHole={playerOnHole} toTarget={toTarget} targetToGreen={targetToGreen} edit={edit} />
      )}

      {/* Top-left: distance to the green */}
      <div className="hm-hud" onPointerDown={(e) => e.stopPropagation()}>
        <Link href="/open" className="hm-back" aria-label="Back to GPF Open"><ArrowLeft size={16} /></Link>
        {mapped ? (
          <div className="hm-green">
            <div className="hm-green-num num">{m(toGreen)}<span>m</span></div>
            <div className="hm-green-sub">
              {fb ? <>F {m(fb.front)} · B {m(fb.back)}</> : "to centre of green"}
              <br />{playerOnHole ? <>from you{gps.acc ? ` (±${Math.round(gps.acc)} m)` : ""}</> : "from the tee"}
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
        <button className={`hm-btn ${edit ? "on" : ""}`} onClick={() => setEdit(edit ? null : "tee")} title="Adjust tee / green"><Pencil size={17} /></button>
        {target && !edit && <button className="hm-btn" onClick={() => setTarget(null)} title="Clear target"><X size={18} /></button>}
      </div>

      {gpsOn && gpsErr && <div className="hm-toast" onPointerDown={(e) => e.stopPropagation()}>{gpsErr}</div>}

      {edit && (
        <div className="hm-edit" onPointerDown={(e) => e.stopPropagation()}>
          <div className="hm-edit-h">
            {!mapped && <>Hole {hole.n} isn&rsquo;t mapped yet. </>}
            Tap the map to place the <b>{edit === "tee" ? "tee" : "centre of the green"}</b>. Saved for everyone.
            {hole.by && <div className="muted small">Last set by {hole.by}</div>}
            {saveErr && <div className="small" style={{ color: "var(--bad)" }}>{saveErr}</div>}
          </div>
          <div className="hm-edit-row">
            <button className={`hm-chip ${edit === "tee" ? "on" : ""}`} onClick={() => setEdit("tee")}>Tee</button>
            <button className={`hm-chip ${edit === "green" ? "on" : ""}`} onClick={() => setEdit("green")}>Green</button>
            {gps && <button className="hm-chip" onClick={() => { setPoint(edit, gps.pos); if (edit === "tee" && !hole.green) setEdit("green"); }}>Use my spot</button>}
            {(overrides[hole.n] || shared[hole.n]) && <button className="hm-chip" onClick={resetHole} title="Put this hole back to the course file"><RotateCcw size={13} /></button>}
            <button className="hm-chip" onClick={copyLayout} title="Copy all holes for the course file">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
            {mapped && <button className="hm-chip ok" onClick={() => { setEdit(null); fit(true); }}>Done</button>}
          </div>
        </div>
      )}

      {/* Bottom: hole selector */}
      <div className="hm-bar" onPointerDown={(e) => e.stopPropagation()}>
        <button className="hm-nav" onClick={() => setIdx((idx + 17) % 18)} aria-label="Previous hole"><ChevronLeft size={24} /></button>
        <div className="hm-hole">
          <span className="hm-hole-n num">{String(hole.n).padStart(2, "0")}</span>
          <span className="hm-hole-meta"><b>PAR {hole.par}</b><br />S.I. {hole.si}{holeLen ? <> · {Math.round(holeLen)} m</> : null}</span>
        </div>
        <button className="hm-nav" onClick={() => setIdx((idx + 1) % 18)} aria-label="Next hole"><ChevronRight size={24} /></button>
      </div>
      <div className="hm-attr">Imagery © Esri, Maxar, Earthstar Geographics</div>
    </div>
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
function Overlay({ view, size, hole, origin, target, gps, playerOnHole, toTarget, targetToGreen, edit }) {
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
    const pts = target ? [o, S(target), g] : [o, g];
    els.push(<polyline key="line" points={pts.map((p) => p.join(",")).join(" ")} stroke="#fff" strokeWidth={3} fill="none" strokeLinejoin="round" />);

    if (target) {
      const t = S(target);
      els.push(<circle key="tc" cx={t[0]} cy={t[1]} r={30} stroke="#fff" strokeWidth={4} fill="rgba(255,255,255,.08)" />);
      els.push(<circle key="td" cx={t[0]} cy={t[1]} r={2.5} fill="#fff" />);
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      labels.push(<DistTag key="l1" at={mid(o, t)} value={toTarget} dir="down" />);
      labels.push(<DistTag key="l2" at={mid(t, g)} value={targetToGreen} dir="up" />);
    }
    if (playerOnHole && hole.tee) {
      const te = S(hole.tee);
      els.push(<circle key="tee" cx={te[0]} cy={te[1]} r={5} fill="#f5c242" stroke="#000" strokeWidth={1} />);
    }
  } else {
    if (hole.tee) { const te = S(hole.tee); els.push(<circle key="tee" cx={te[0]} cy={te[1]} r={8} fill="#f5c242" stroke="#000" strokeWidth={1.5} />); }
  }

  if (hole.greenPoly) {
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
      <svg className="hm-svg" width={size.W} height={size.H} aria-hidden style={{ cursor: edit ? "crosshair" : "default" }}>{els}</svg>
      <div className="hm-labels">{labels}</div>
    </>
  );
}

function DistTag({ at, value, dir }) {
  return (
    <div className="hm-tag" style={{ left: at[0] + 16, top: at[1] }}>
      <span className="num">{m(value)}</span><small>m {dir === "up" ? "↑" : "↓"}</small>
    </div>
  );
}
