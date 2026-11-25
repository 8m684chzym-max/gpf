// GPF Swing Lab — served at app.gpf.golf/swing (members only, see src/proxy.js).
// MediaPipe is allowed by the /swing CSP in next.config.mjs.
import { phases, metrics, validatePhases } from './metrics.js';
import { detectPhases, findTop, buildReport } from './analysis.js';
import { findShaft, average, trackHead } from './club.js';
import { clubPath, attackAngle, focal, vanishing, pathGuide, impactFromTrack, findBall, trackBallFlight, ballLaunch, tracerCurve } from './path.js';
import { createTracker, ballRadius, analyzePutt, BALL_MM } from './putt.js';

const $ = id => document.getElementById(id);
const video = $('video'), canvas = $('overlay'), ctx = canvas.getContext('2d');
const lineCanvas = $('lines'), lctx = lineCanvas.getContext('2d');
let marks = {}, samples = {}, points = null, pose = null, url = null, loaded = false, busy = false, generation = 0, history = [];
let clip = null;      // { w, h, step, frames: [{t, lm, g}], gw, gh } from the automatic analysis (memory only)
let club = null;      // { head0, hands0, sh0, hip0, L } address club/plane points (video px), adjustable
let report = null;    // last swing report
let mode = 'swing';   // 'swing' | 'putt'
let marking = false;  // putt: waiting for taps on the putter head and the ball
let putt = { taps: [], t0: null, head: null, ball: null, cmPerPx: null, res: null };
let fpsProbe = null;  // frame-rate detection running after a video opens
let landing = false;  // swing: waiting for a tap where the ball lands
try { history = JSON.parse(localStorage.getItem('gpf-swings-v1') || '[]'); if (!Array.isArray(history)) history = []; history = history.filter(s => s && typeof s.id === 'string' && s.marks && s.samples); } catch {}

const status = t => { $('status').textContent = t; if (!loaded && url) $('empty-text').textContent = t; };
function stageMsg(title, text, tap = false) { $('empty').hidden = false; $('empty-title').textContent = title; $('empty-text').textContent = text; $('tap-load').hidden = !tap; }
function controls() {
  for (const id of ['play', 'back', 'next', 'seek', 'save', 'export', 'detect', 'auto', 'draw-line', 'putt-mark']) $(id).disabled = !loaded || busy;
  $('putt-run').disabled = !loaded || busy || !putt.taps.length;
  $('ball-land').disabled = !loaded || busy || !clip || !clip.ball;
  document.querySelectorAll('[data-mark]').forEach(b => b.disabled = !loaded || busy);
}
const fmt = t => t.toFixed(2) + ' s';

// ---------- phases ----------
function phaseUI() {
  const host = $('phases'); host.replaceChildren();
  for (const phase of phases) {
    const row = document.createElement('div'); row.className = 'phase';
    const label = document.createElement('span'); label.textContent = phase;
    const jump = document.createElement('button'); jump.className = 'phase-time';
    jump.textContent = marks[phase] != null ? fmt(marks[phase]) : '—';
    jump.disabled = marks[phase] == null || !loaded || busy; jump.onclick = () => seek(marks[phase]);
    const mark = document.createElement('button'); mark.textContent = 'Marcar'; mark.dataset.mark = phase; mark.disabled = !loaded || busy;
    mark.onclick = () => {
      const next = { ...marks, [phase]: video.currentTime };
      if (!validatePhases(next)) { status('As fases devem seguir a ordem cronológica e ter tempos distintos.'); return; }
      marks = next; phaseUI(); refreshReport(); status(phase + ' marcado.');
    };
    row.append(label, jump, mark); host.append(row);
  }
}
function seek(t) { video.pause(); video.currentTime = Math.max(0, Math.min(video.duration, t)); }

// Nearest analysed frame (automatic analysis) for the current time.
function nearestFrame(t) {
  if (!clip) return null;
  let best = null, d = Infinity;
  for (const f of clip.frames) { const e = Math.abs(f.t - t); if (e < d) { d = e; best = f; } }
  return d <= clip.step * 0.6 ? best : null;
}
function update() {
  $('time').textContent = `${video.currentTime.toFixed(3)} / ${(Number.isFinite(video.duration) ? video.duration : 0).toFixed(3)} s`;
  $('seek').value = video.currentTime;
  const f = nearestFrame(video.currentTime);
  points = f && f.lm;
  if (points) displayMetrics(metrics(points, clip.w, clip.h)); else $('metrics').textContent = 'Analise este frame para obter medições.';
  draw();
}

// ---------- overlay (skeleton + hand path) ----------
const cssScale = c => { const r = c.getBoundingClientRect(); return r.width ? c.width / r.width : 1; }; // canvas px per CSS px
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!$('show').checked || !loaded) return;
  const s = cssScale(canvas), W = canvas.width, H = canvas.height;
  if (mode === 'putt') { drawPutt(s); return; }
  drawClub(s);
  if (!points) return;
  const ok = i => points[i] && (points[i].visibility ?? 1) >= .5;
  ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
  for (const [a, b] of [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]]) {
    if (!ok(a) || !ok(b)) continue;
    ctx.strokeStyle = ([11, 23].includes(a) && b === a + 1) ? '#e6ed9a' : '#81e5b6';
    ctx.beginPath(); ctx.moveTo(points[a].x * W, points[a].y * H); ctx.lineTo(points[b].x * W, points[b].y * H); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  for (let i = 11; i <= 28; i++) { if (!ok(i)) continue; ctx.beginPath(); ctx.arc(points[i].x * W, points[i].y * H, 4 * s, 0, Math.PI * 2); ctx.fill(); }
}
// Club overlay: address shaft line (club head → hands → belly), shoulder line (DTL),
// circle on the address hands, club head trail (green backswing, red downswing).
function strokeLine(pts, color, width, s, dash) {
  if (pts.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (dash) ctx.setLineDash(dash.map(d => d * s));
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = (width + 2.5) * s; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = width * s; ctx.stroke(); ctx.restore();
}
function shaftLine() {
  const { head0: o, hands0: hd } = club, hipY = club.hip0 ? club.hip0.y : hd.y - (o.y - hd.y) * 0.35;
  const dy = hd.y - o.y; if (Math.abs(dy) < 1) return [o, hd];
  const k = Math.max(1.3, (hipY - o.y) / dy); // always extend past the hands, at least to belt height
  return [o, { x: o.x + (hd.x - o.x) * k, y: o.y + dy * k }];
}
const HANDLES = { head0: 'cabeça do taco', hands0: 'mãos', sh0: 'ombros' };
// Ball tracer: glowing red ribbon with a white core.
function tracerStroke(pts, s) {
  if (pts.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  for (const [wd, a] of [[16, 0.1], [10, 0.2], [6, 0.35]]) { ctx.globalAlpha = a; ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = wd * s; ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 3.5 * s; ctx.stroke();
  ctx.strokeStyle = '#ffd6d2'; ctx.lineWidth = 1.3 * s; ctx.stroke(); ctx.restore();
}
function arrow(a, b, color, s) {
  strokeLine([a, b], color, 4, s);
  const ang = Math.atan2(b.y - a.y, b.x - a.x), k = 14 * s;
  strokeLine([{ x: b.x - k * Math.cos(ang - 0.45), y: b.y - k * Math.sin(ang - 0.45) }, b, { x: b.x - k * Math.cos(ang + 0.45), y: b.y - k * Math.sin(ang + 0.45) }], color, 4, s);
}
// Putt overlay: taps, putter head trail (green back, red to impact, white after), ball, target line.
function drawPutt(s) {
  const r = putt.res, T = r && !r.error ? r.track : null;
  if (T && T.length > 1) {
    const seg = (a, b) => T.filter(p => p.t >= a - 1e-6 && p.t <= b + 1e-6);
    const line = lines[0] ? [{ x: lines[0].a.x * canvas.width, y: lines[0].a.y * canvas.height }, { x: lines[0].b.x * canvas.width, y: lines[0].b.y * canvas.height }] : null;
    const L = Math.max(canvas.width, canvas.height) * 0.35;
    if (!line) strokeLine([{ x: r.p0.x - r.target.x * L * 0.4, y: r.p0.y - r.target.y * L * 0.4 }, { x: r.p0.x + r.target.x * L, y: r.p0.y + r.target.y * L }], '#5ad1ff', 2.5, s, [10, 7]);
    strokeLine(seg(-Infinity, r.times.top), '#6fe0a2', 3.5, s);
    strokeLine(seg(r.times.top, r.times.impact), '#ff6b5b', 3.5, s);
    strokeLine(seg(r.times.impact, Infinity), 'rgba(255,255,255,.85)', 3, s, [6, 6]);
  }
  if (putt.ball && $('tracer').checked) {
    const b = putt.ball.filter(p => p.ok), tImp = r && !r.error ? r.times.impact : Infinity;
    if (video.currentTime < tImp - 1e-3) strokeLine(b, 'rgba(255,223,69,.7)', 2, s, [5, 6]);
    else tracerStroke(b.filter(p => p.t <= video.currentTime + 1e-3), s);
  }
  putt.taps.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, (i ? 9 : 12) * s, 0, Math.PI * 2);
    ctx.lineWidth = 5 * s; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke(); ctx.lineWidth = 3 * s; ctx.strokeStyle = i ? '#ffdf45' : '#6fe0a2'; ctx.stroke();
  });
}
function drawClub(s) {
  if (!club) return;
  const { head0, hands0, sh0 } = club;
  // club head → shoulders (plane top) and club head → hands → belly (shaft line)
  if (sh0) { const k = 1.25; strokeLine([head0, { x: head0.x + (sh0.x - head0.x) * k, y: head0.y + (sh0.y - head0.y) * k }], '#fff', 3, s, [9, 7]); }
  strokeLine(shaftLine(), '#ffdf45', 4, s);
  ctx.beginPath(); ctx.arc(hands0.x, hands0.y, Math.max(14 * s, club.L * 0.12), 0, Math.PI * 2);
  ctx.lineWidth = 5 * s; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.stroke(); ctx.lineWidth = 3 * s; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.beginPath(); ctx.arc(head0.x, head0.y, 7 * s, 0, Math.PI * 2); ctx.fillStyle = '#ffdf45'; ctx.fill(); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = '#1c1e24'; ctx.stroke();
  // Club head trace ("swing path"): green backswing, red downswing, white after impact.
  const tr = clip && clip.track;
  if (tr && tr.length > 1) {
    const seg = (a, b) => tr.filter(p => p.t >= a - 1e-6 && p.t <= b + 1e-6);
    const tT = marks.Topo ?? Infinity, tI = marks.Impacto ?? Infinity;
    strokeLine(seg(-Infinity, tT), '#6fe0a2', 3, s);
    strokeLine(seg(tT, tI), '#ff6b5b', 3, s);
    strokeLine(seg(tI, Infinity), 'rgba(255,255,255,.85)', 2.5, s, [6, 6]);
  }
  if (clip && clip.dense) for (const p of clip.dense) if (p.ok) { ctx.beginPath(); ctx.arc(p.x, p.y, 3.2 * s, 0, Math.PI * 2); ctx.fillStyle = '#ff9f1a'; ctx.fill(); }
  const pg = clip && clip.path;
  if (pg && pg.guide) { strokeLine(pg.guide.target, '#5ad1ff', 3, s, [10, 7]); arrow(pg.guide.path[0], pg.guide.path[1], '#ff9f1a', s); }
  if (pg && pg.dir) { const k = 0.4 * Math.hypot(hands0.x - head0.x, hands0.y - head0.y); arrow(head0, { x: head0.x + pg.dir.x * k, y: head0.y + pg.dir.y * k }, '#ff9f1a', s); }
  if (pg && pg.low) { ctx.beginPath(); ctx.arc(pg.low.x, pg.low.y, 8 * s, 0, Math.PI * 2); ctx.lineWidth = 3 * s; ctx.strokeStyle = '#5ad1ff'; ctx.stroke(); }
  const b = clip && clip.ball;
  if (b && b.curve && $('tracer').checked && marks.Impacto != null) {
    const p = (video.currentTime - marks.Impacto) / 2.5; // video seconds for the whole flight
    if (p >= 0) { const sF = 1 - Math.pow(1 - Math.min(1, p), 2.2); tracerStroke(b.curve.slice(0, Math.max(2, Math.round(sF * (b.curve.length - 1)) + 1)), s); }
    for (const q of b.pts) if (q.t <= video.currentTime + 1e-3) { ctx.beginPath(); ctx.arc(q.x, q.y, 3 * s, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); }
    if (b.land) { ctx.beginPath(); ctx.arc(b.land.x, b.land.y, 9 * s, 0, Math.PI * 2); ctx.lineWidth = 3 * s; ctx.strokeStyle = '#ff3b30'; ctx.stroke(); }
  }
  // In edit mode: draggable handles on the three points.
  if (drawing) for (const k of Object.keys(HANDLES)) {
    const p = club[k]; if (!p) continue;
    ctx.beginPath(); ctx.arc(p.x, p.y, 12 * s, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fill();
    ctx.lineWidth = 3.5 * s; ctx.strokeStyle = k === 'sh0' ? '#1c1e24' : '#e0a800'; ctx.stroke();
  }
}

function resize() {
  if (!loaded) return;
  const scale = Math.min(video.clientWidth / video.videoWidth, video.clientHeight / video.videoHeight);
  const w = video.videoWidth * scale + 'px', h = video.videoHeight * scale + 'px';
  canvas.style.width = lineCanvas.style.width = w; canvas.style.height = lineCanvas.style.height = h;
  lineCanvas.width = video.videoWidth; lineCanvas.height = video.videoHeight;
  drawLines(); draw();
}
function displayMetrics(values) {
  $('metrics').replaceChildren();
  for (const [name, value] of Object.entries(values)) {
    const row = document.createElement('div'); row.className = 'measure';
    const label = document.createElement('span'); label.textContent = name;
    const n = document.createElement('b'); n.textContent = value == null ? '—' : value.toFixed(1) + '°';
    row.append(label, n); $('metrics').append(row);
  }
}

// ---------- loading ----------
const isVideo = f => f.type.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(f.name || '');
let loadTimer = null;
function load(file) {
  if (!file) return;
  if (!isVideo(file)) { status('Escolha um ficheiro de vídeo (MP4, MOV ou WebM).'); return; }
  if (file.size > 1024 * 1024 * 1024) { status('O vídeo excede 1 GB. Encurte o clip antes de carregar.'); return; }
  generation++; const token = generation; delete video.dataset.fix;
  resetLines(); video.pause(); if (url) URL.revokeObjectURL(url);
  loaded = false; marks = {}; samples = {}; points = null; clip = null; club = null; report = null; renderReport(); renderPath();
  putt = { taps: [], t0: null, head: null, ball: null, cmPerPx: null, res: null }; setMarking(false); renderPutt(); landing = false; $('ball-land').setAttribute('aria-pressed', 'false');
  $('notes').value = ''; $('filename').textContent = file.name; url = URL.createObjectURL(file);
  // iPhone/iPad Safari ignores preload="metadata" for a fresh blob: an explicit load() makes it read the file.
  video.preload = 'auto'; video.src = url; video.load();
  $('stage').style.aspectRatio = ''; controls(); phaseUI(); stageMsg('A abrir o vídeo…', file.name); status('A carregar vídeo…');
  // iPhone (e.g. Low Power Mode) may refuse to read the file until the video is played.
  video.play().catch(() => {});
  setTimeout(() => { if (!loaded && token === generation) stageMsg('Vídeo carregado', 'O iPhone só mostra o vídeo depois de um toque.', true); }, 1500);
  clearTimeout(loadTimer);
  loadTimer = setTimeout(() => { if (!loaded && token === generation) status('O vídeo está a demorar a abrir. Se não aparecer, este navegador pode não suportar o formato (ex.: HEVC/MOV no Chrome em Windows). Experimente o Safari ou exporte o clip em MP4 H.264.'); }, 12000);
}
$('file').onchange = e => { load(e.target.files[0]); e.target.value = ''; };
// Film here: in-app camera with the player's silhouette (camera.js). The view picked on camera
// (por trás / de frente) becomes the Perspetiva.
$('cam').onclick = () => {
  if (busy) return;
  if (!window.GPFCam) { $('file').click(); return; }
  window.GPFCam.open({
    tool: mode === 'putt' ? 'putt' : 'swing', view: mode === 'putt' ? 'face-on' : $('view').value, audio: false,
    onPickFile: () => $('file').click(),
    onVideo: (file, info) => { if (mode === 'swing' && info.view && info.view !== $('view').value) $('view').value = info.view; if (info.lefty != null && mode === 'putt') $('hand').value = info.lefty ? 'l' : 'r'; load(file); },
  });
};
$('drop').ondragover = e => e.preventDefault();
$('drop').ondrop = e => { e.preventDefault(); if (!busy) load([...(e.dataTransfer?.files || [])].find(isVideo)); };
function ready() {
  if (loaded || !video.videoWidth) return;
  // Clips recorded in the browser (WebM in Chrome) only learn their length after a seek to the end.
  if (video.duration === Infinity) { if (!video.dataset.fix) { video.dataset.fix = '1'; video.currentTime = 1e101; } return; }
  if (!Number.isFinite(video.duration) || video.duration <= 0) return; // some files report the duration later
  clearTimeout(loadTimer); loaded = true; video.pause();
  $('empty').hidden = true; $('tap-load').hidden = true;
  $('stage').style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
  canvas.width = video.videoWidth; canvas.height = video.videoHeight; $('seek').max = video.duration;
  controls(); phaseUI(); requestAnimationFrame(resize);
  video.currentTime = Math.min(0.001, video.duration / 2); // Safari paints the first frame only after a seek
  update(); status(mode === 'putt' ? 'Vídeo pronto. Pare no address e toque em "◎ Tocar no putter e na bola".' : 'Vídeo pronto. Toque em "Detetar fases e analisar".');
  const token = generation;
  fpsProbe = detectFps().then(f => {
    if (token !== generation) return;
    if (f) { $('fps').value = f; if (f >= 100) $('slow').value = '1'; }
    return seekTo(0.001);
  }).catch(() => {}).finally(() => { if (token === generation) { fpsProbe = null; update(); } });
}
// Frame rate of the file: play a moment at 0.25× and read the media time of each presented
// frame (requestVideoFrameCallback). Snaps to the usual rates. null if not available.
async function detectFps() {
  if (!video.requestVideoFrameCallback) return null;
  const rate = video.playbackRate, times = [];
  video.playbackRate = 0.25;
  const done = new Promise(res => {
    const cb = (now, md) => { times.push(md.mediaTime); if (times.length < 14) video.requestVideoFrameCallback(cb); else res(); };
    video.requestVideoFrameCallback(cb); setTimeout(res, 2500);
  });
  try { await video.play(); } catch { video.playbackRate = rate; return null; }
  await done; video.pause(); video.playbackRate = rate;
  const d = []; for (let i = 1; i < times.length; i++) { const x = times[i] - times[i - 1]; if (x > 1e-4) d.push(x); }
  if (d.length < 4) return null;
  d.sort((a, b) => a - b);
  const raw = 1 / d[Math.floor(d.length * 0.25)]; // lower quartile: dropped frames only make gaps longer
  const best = [24, 25, 30, 48, 50, 60, 90, 100, 120, 240].reduce((a, b) => Math.abs(b - raw) / b < Math.abs(a - raw) / a ? b : a);
  return Math.abs(best - raw) / best < 0.12 ? best : Math.round(raw);
}
const slowF = () => Number($('slow').value) || 1;
const fileFps = () => Math.min(240, Math.max(10, Number($('fps').value) || 30));
video.onloadedmetadata = ready; video.ondurationchange = ready; video.onloadeddata = ready;
video.onerror = () => {
  if (!video.getAttribute('src')) return;
  clearTimeout(loadTimer); loaded = false; stageMsg('Não foi possível abrir o vídeo', ''); controls(); phaseUI();
  status('Este navegador não consegue abrir este vídeo. Vídeos HEVC/MOV do iPhone abrem no Safari; noutros navegadores exporte o clip em MP4 H.264.');
};
video.ontimeupdate = update; video.onseeked = update;
video.onplay = () => $('play').textContent = 'Pausar'; video.onpause = () => $('play').textContent = 'Reproduzir';
$('tap-load').onclick = () => { $('empty-text').textContent = 'A abrir…'; video.play().catch(e => { if (loaded || (e && e.name === 'AbortError')) return; status('O vídeo não abriu (' + (e && e.name || 'erro') + '). Experimente outro vídeo ou exporte em MP4.'); }); };
$('play').onclick = async () => { if (video.paused) { try { await video.play(); } catch { status('Não foi possível reproduzir este vídeo.'); } } else video.pause(); };
for (const [id, dir] of [['back', -1], ['next', 1]]) $(id).onclick = () => {
  const fps = Number($('fps').value);
  if (!Number.isFinite(fps) || fps < 1 || fps > 240) { status('Indique um FPS entre 1 e 240.'); return; }
  seek(video.currentTime + dir / fps);
};
$('seek').oninput = e => seek(Number(e.target.value));
$('speed').onchange = e => video.playbackRate = Number(e.target.value);
$('show').onchange = draw;
window.addEventListener('resize', resize);

// ---------- pose model ----------
async function model() {
  if (pose) return pose;
  const { FilesetResolver, PoseLandmarker } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs');
  pose = await PoseLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'), {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' },
    runningMode: 'IMAGE', numPoses: 1, minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5,
  });
  return pose;
}
const work = document.createElement('canvas'), wctx = work.getContext('2d', { willReadFrequently: true });
function grabFrame(maxSide) {
  const k = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  work.width = Math.round(video.videoWidth * k); work.height = Math.round(video.videoHeight * k);
  wctx.drawImage(video, 0, 0, work.width, work.height);
  return work;
}
function seekTo(t) {
  return new Promise(res => {
    let done = false; const fin = () => { if (done) return; done = true; video.removeEventListener('seeked', onSeeked); res(); };
    // After 'seeked', wait for the new frame to be presented (Safari can still show the old one).
    const onSeeked = () => { if (video.requestVideoFrameCallback) { video.requestVideoFrameCallback(() => fin()); setTimeout(fin, 300); } else requestAnimationFrame(() => fin()); };
    video.addEventListener('seeked', onSeeked); setTimeout(fin, 3000);
    video.currentTime = Math.max(0, Math.min(video.duration - 0.001, t));
  });
}
const small = document.createElement('canvas'), sctx = small.getContext('2d', { willReadFrequently: true });
function grayFrame(maxSide) {
  const k = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  small.width = Math.round(video.videoWidth * k); small.height = Math.round(video.videoHeight * k);
  sctx.drawImage(video, 0, 0, small.width, small.height);
  const d = sctx.getImageData(0, 0, small.width, small.height).data, g = new Uint8Array(small.width * small.height);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  return { g, gw: small.width, gh: small.height };
}
let diag = { frames: 0, dark: 0, bodies: 0 };
// Mean brightness of a grabbed frame (Safari can hand back black frames after a seek).
function brightness(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 97) { sum += d[i] + d[i + 1] + d[i + 2]; n++; }
  return n ? sum / n / 3 : 0;
}
async function detectAt(t, maxSide, withGray = false, graySide = 400) {
  await seekTo(t);
  const img = grabFrame(maxSide);
  diag.frames++; if (brightness(img) < 6) diag.dark++;
  const r = pose.detect(img);
  if (r.landmarks[0]) diag.bodies++;
  const lm = r.landmarks[0] ? r.landmarks[0].map(p => ({ x: p.x, y: p.y, visibility: p.visibility ?? 1 })) : null;
  return withGray ? { lm, ...grayFrame(graySide) } : { lm };
}

$('detect').onclick = async () => {
  if (!loaded || busy) return;
  video.pause();
  if (video.seeking || video.readyState < 2) { status('Aguarde que o frame termine de carregar.'); return; }
  busy = true; controls(); phaseUI();
  const token = generation, frameTime = video.currentTime;
  status('A preparar o modelo e a analisar o frame…');
  try {
    await model();
    const r = pose.detect(grabFrame(960));
    if (token !== generation) return;
    const lm = r.landmarks[0];
    if (!lm) { status('Não foi detetado um corpo com confiança suficiente. Escolha outro frame ou melhore o enquadramento.'); return; }
    const values = metrics(lm, video.videoWidth, video.videoHeight);
    samples[frameTime.toFixed(3)] = { time: frameTime, values };
    points = lm; displayMetrics(values); draw();
    status('Frame analisado. Medições 2D guardadas na sessão.');
  } catch (error) {
    console.error(error); status(`A análise falhou${pose ? '' : ' ao carregar o modelo de pose (é preciso internet)'}: ${error?.name || 'Erro'} — ${String(error?.message || error).slice(0, 160)}`);
  } finally { busy = false; controls(); phaseUI(); }
};

// Automatic analysis: coarse pass over the clip to find the swing, then every frame
// (up to 30 fps) around it; phases and the report come from the hand/body path.
$('auto').onclick = async () => {
  if (!loaded || busy) return;
  video.pause(); busy = true; controls(); phaseUI();
  const token = generation, prog = $('progress'), keep = video.currentTime;
  const w = video.videoWidth, h = video.videoHeight, dur = video.duration;
  prog.hidden = false; prog.value = 0;
  try {
    if (fpsProbe) await fpsProbe;
    diag = { frames: 0, dark: 0, bodies: 0 };
    status('A preparar o modelo de pose…'); await model();
    const coarseStep = dur > 30 ? 0.33 : dur > 12 ? 0.2 : 0.125;
    const coarse = [];
    const nC = Math.floor(dur / coarseStep) + 1;
    for (let i = 0; i < nC; i++) {
      if (token !== generation) return;
      const t = i * coarseStep, { lm } = await detectAt(t, 640);
      if (lm) coarse.push({ t, lm });
      prog.value = 0.35 * (i + 1) / nC; status(`A procurar o swing no vídeo… ${Math.round(prog.value * 100)}%`);
    }
    if (diag.dark > diag.frames * 0.8) { status(`O navegador devolveu imagens pretas do vídeo (${diag.dark} de ${diag.frames} frames), por isso não há nada para analisar. Toque em Reproduzir uma vez, pause e tente de novo; se continuar, grave sem HDR (Definições › Câmara › Gravar vídeo › HDR desligado) ou exporte o clip.`); return; }
    if (coarse.length < 3) { status(`O corpo só foi detetado em ${coarse.length} de ${nC} frames. Filme com o corpo inteiro visível, boa luz e o jogador maior no enquadramento.`); return; }
    const top = findTop(coarse, w, h);
    if (top == null) { status(`Corpo detetado em ${coarse.length} de ${nC} frames, mas não encontrei o topo do swing (as mãos têm de subir acima do peito e estar visíveis).`); return; }
    // Phases at up to 30 real frames per second: every k-th video frame. A slow-motion clip
    // (slow = 4 or 8) is k = slow frames apart on a 30 fps timeline; times stay video times
    // and are divided by slow for the analysis (real seconds).
    const slow = slowF(), fps = fileFps(), k = Math.max(1, Math.ceil(fps * slow / 30 - 1e-6)), step = k / fps;
    // Sample at frame centres so consecutive samples are distinct video frames.
    const f0 = Math.max(0, Math.round((top - 2.2 * slow) * fps)), f1 = Math.min(Math.floor(dur * fps) - 1, Math.round((top + 1.6 * slow) * fps));
    const frames = [], nF = Math.max(1, Math.floor((f1 - f0) / k) + 1);
    let gw = 0, gh = 0;
    for (let i = 0; i < nF; i++) {
      if (token !== generation) return;
      const t = (f0 + i * k + 0.5) / fps, r = await detectAt(t, 720, true);
      gw = r.gw; gh = r.gh;
      if (r.lm) frames.push({ t, lm: r.lm, g: r.g });
      prog.value = 0.35 + 0.5 * (i + 1) / nF; status(`A analisar o swing frame a frame… ${Math.round(prog.value * 100)}%`);
    }
    const res = detectPhases(frames.map(f => ({ t: f.t / slow, lm: f.lm })), w, h);
    if (res.error) { status(`${res.error} (corpo detetado em ${frames.length} de ${nF} frames)`); return; }
    clip = { w, h, step, frames, gw, gh, slow, fps, phaseFps: fps * slow / k, track: null, dense: null, path: null };
    marks = Object.fromEntries(Object.entries(res.times).map(([p, t]) => [p, t * slow]));
    let viewNote = '';
    if (res.view && res.view !== $('view').value) { $('view').value = res.view; viewNote = ` Perspetiva detetada: ${res.view === 'face-on' ? 'face-on' : 'down-the-line'}.`; }
    for (const p of phases) { const f = frames[res.index[p]]; samples[f.t.toFixed(3)] = { time: f.t, values: metrics(f.lm, w, h) }; }
    findClub(res.index.Address);
    clubTrack(res.index.Address, res.index['Follow-through']);
    if (k > 1 && club) { status('A seguir a cabeça do taco junto ao impacto, frame a frame…'); await densePass(token, prog); }
    if (club) { status('A procurar a bola e o voo depois do impacto…'); await ballPass(token); }
    phaseUI(); refreshReport();
    await seekTo(marks.Address);
    status((club?.guess ? 'Fases detetadas. Não encontrei o taco: ative ✎ Linhas e arraste o ponto amarelo para a cabeça do taco.' : 'Fases detetadas e relatório pronto. Para ajustar a cabeça do taco, as mãos ou os ombros, ative ✎ Linhas e arraste os pontos.') + ' Pode corrigir qualquer fase com "Marcar".' + viewNote);
  } catch (error) {
    console.error(error); status(`A análise falhou${pose ? '' : ' ao carregar o modelo de pose (é preciso internet)'}: ${error?.name || 'Erro'} — ${String(error?.message || error).slice(0, 160)} [frames ${diag.frames}, corpos ${diag.bodies}, pretos ${diag.dark}]`);
    if (token === generation) await seekTo(keep);
  } finally { prog.hidden = true; busy = false; controls(); phaseUI(); update(); }
};

// ---------- club ----------
function findClub(iA) {
  club = null;
  const { frames, gw, gh, w, h } = clip, sx = w / gw, sy = h / gh;
  const still = frames.slice(Math.max(0, iA - 4), iA + 1).filter(f => f.g);
  const lm = frames[iA].lm, m = (a, b) => ({ x: (lm[a].x + lm[b].x) / 2 * w, y: (lm[a].y + lm[b].y) / 2 * h });
  const sh0 = m(11, 12), hip0 = m(23, 24), L = Math.hypot(sh0.x - hip0.x, sh0.y - hip0.y);
  const shaft = still.length ? findShaft(average(still.map(f => f.g)), gw, gh, lm, $('view').value) : null;
  if (shaft) club = { head0: { x: shaft.head.x * sx, y: shaft.head.y * sy }, hands0: { x: shaft.hands.x * sx, y: shaft.hands.y * sy }, sh0, hip0, L };
  else { // no shaft found: start from the body points so the user can place the club head
    const hd = m(15, 16), foot = Math.max(lm[27]?.y ?? 0, lm[28]?.y ?? 0) * h;
    club = { head0: { x: hd.x + (hd.x - hip0.x) * 0.8, y: foot || hip0.y + 1.9 * L }, hands0: hd, sh0, hip0, L, guess: true };
  }
}

// Club head through the swing (phase frames, every analysed frame from address on).
function clubTrack(iA, iF) {
  const { frames, gw, gh, w, h } = clip, sx = w / gw, sy = h / gh;
  if (club && frames[iA] && frames[iA].g) {
    const tr = trackHead(frames, gw, gh, iA, Math.min(frames.length - 1, iF + 3), { x: club.head0.x / sx, y: club.head0.y / sy }, { x: club.hands0.x / sx, y: club.hands0.y / sy });
    clip.track = tr.map(p => ({ t: p.t, x: p.x * sx, y: p.y * sy, ok: p.ok }));
  }
  for (const f of frames) delete f.g; // grayscale frames are only needed for the club
}
// Every video frame around impact (slow motion / high fps), at a higher resolution, for the
// club head direction at impact. Then the impact time is refined on the club head.
async function densePass(token, prog) {
  const { slow, fps, w, h } = clip, tI = marks.Impacto;
  const fa = Math.max(0, Math.floor((tI - 0.08 * slow) * fps)), fb = Math.min(Math.floor(video.duration * fps) - 1, Math.ceil((tI + 0.04 * slow) * fps));
  const n = Math.max(0, Math.min(90, fb - fa + 1)), dense = [];
  let gw = 0, gh = 0;
  for (let i = 0; i < n; i++) {
    if (token !== generation) return;
    const t = (fa + i + 0.5) / fps, r = await detectAt(t, 720, true, 640);
    gw = r.gw; gh = r.gh; dense.push({ t, lm: r.lm, g: r.g });
    prog.value = 0.85 + 0.15 * (i + 1) / n;
  }
  // frames without a body borrow the nearest pose (the hands barely move between frames)
  for (let i = 0; i < dense.length; i++) if (!dense[i].lm) { for (let d = 1; d < dense.length; d++) { const q = dense[i - d]?.lm || dense[i + d]?.lm; if (q) { dense[i].lm = q; break; } } }
  const usable = dense.filter(f => f.lm);
  if (usable.length >= 3) {
    const sx = w / gw, sy = h / gh;
    const tr = trackHead(usable, gw, gh, 0, usable.length - 1, { x: club.head0.x / sx, y: club.head0.y / sy }, { x: club.hands0.x / sx, y: club.hands0.y / sy }, false);
    clip.dense = tr.map(p => ({ t: p.t, x: p.x * sx, y: p.y * sy, ok: p.ok }));
    const tNew = impactFromTrack(clip.dense, club.head0, tI, 0.05 * slow);
    if (tNew != null && tNew > (marks.Downswing ?? -Infinity) && tNew < (marks['Follow-through'] ?? Infinity)) marks.Impacto = tNew;
  }
  for (const f of dense) delete f.g;
}

// ---------- ball: position at address and flight after impact ----------
async function ballPass(token) {
  const { slow, fps, w, h } = clip;
  await seekTo(marks.Address);
  const A = grayFrame(640), gw = A.gw, gh = A.gh, sx = w / gw, sy = h / gh;
  const S = Math.hypot(club.hands0.x - club.head0.x, club.hands0.y - club.head0.y) / sx;
  const b = findBall(A.g, gw, gh, { x: club.head0.x / sx, y: club.head0.y / sy }, S, ballRadius);
  clip.ball = { p0: b ? { x: b.x * sx, y: b.y * sy } : { ...club.head0 }, r: b ? b.r * sx : null, found: !!b, pts: [], land: null };
  if (b && fps * slow >= 100 && marks.Impacto != null) {
    const fa = Math.max(0, Math.floor(marks.Impacto * fps) - 1), n = Math.min(70, Math.ceil(0.15 * slow * fps) + 2), frames = [];
    for (let i = 0; i < n; i++) {
      if (token !== generation) return;
      const t = (fa + i + 0.5) / fps; if (t >= video.duration) break;
      await seekTo(t); frames.push({ t, g: grayFrame(640).g });
    }
    clip.ball.pts = trackBallFlight(frames, gw, gh, b, S).map(p => ({ t: p.t, x: p.x * sx, y: p.y * sy }));
  }
}
// Camera geometry shared by club path, attack angle and the ball: vanishing point of the target
// line (DTL) and the ground direction towards the target (face-on).
function geo() {
  const W = clip.w, H = clip.h;
  let vp = { x: W / 2, y: H / 2 }, vpFrom = 'câmara nivelada e apontada ao alvo';
  if (lines.length >= 2 && club) {
    const px = l => ({ a: { x: l.a.x * W, y: l.a.y * H }, b: { x: l.b.x * W, y: l.b.y * H } });
    const v = vanishing(px(lines[0]), px(lines[1]));
    if (v && v.y < club.head0.y - 20) { vp = v; vpFrom = 'as duas primeiras linhas desenhadas'; }
  }
  const lmA = clip.frames[nearestIdx(marks.Address ?? clip.frames[0].t)].lm;
  const okp = i => lmA[i] && (lmA[i].visibility ?? 1) >= 0.3;
  let ground = { x: 1, y: 0 };
  for (const [a, b] of [[31, 32], [29, 30], [27, 28]]) if (okp(a) && okp(b)) { const v = { x: (lmA[a].x - lmA[b].x) * W, y: (lmA[a].y - lmA[b].y) * H }, n = Math.hypot(v.x, v.y); if (n > 5) { ground = { x: v.x / n, y: v.y / n }; break; } }
  const hx = f => (f.lm[15].x + f.lm[16].x) / 2;
  const fT = clip.frames[nearestIdx(marks.Topo ?? marks.Address ?? 0)], fF = clip.frames[nearestIdx(marks['Follow-through'] ?? marks.Impacto ?? 0)];
  const tdir = Math.sign(hx(fF) - hx(fT)) || 1;
  if (ground.x * tdir < 0) ground = { x: -ground.x, y: -ground.y };
  return { vp, vpFrom, ground, tdir };
}
function computeBall() {
  const b = clip && clip.ball; if (!b) return;
  const g = geo(), view = $('view').value, fpsReal = clip.fps * clip.slow;
  b.launch = fpsReal < 100 ? null : ballLaunch(b.pts.map(p => ({ ...p, t: p.t / clip.slow })), b.p0, view, { ground: g.ground, vp: g.vp, cmPerPx: b.r ? 4.267 / (2 * b.r) : null });
  // tracer: leaves along the measured direction (or a typical one) towards the landing point
  const W = clip.w, H = clip.h;
  const dir = b.launch && b.launch.dir ? b.launch.dir
    : view === 'down-the-line' ? (() => { const v = { x: g.vp.x - b.p0.x, y: (g.vp.y - b.p0.y) * 1.8 }, n = Math.hypot(v.x, v.y) || 1; return { x: v.x / n, y: v.y / n }; })()
      : { x: g.tdir * 0.94, y: -0.34 };
  const land = b.land || (view === 'down-the-line' ? { x: g.vp.x, y: g.vp.y + 0.02 * H } : { x: g.tdir > 0 ? W * 1.05 : -0.05 * W, y: Math.max(0, b.p0.y - 0.5 * H) });
  b.curve = tracerCurve(b.p0, dir, land);
}

// ---------- club path / attack angle ----------
const realTrack = () => [...(clip.track || []), ...(clip.dense || [])].map(p => ({ ...p, t: p.t / clip.slow })).sort((a, b) => a.t - b.t);
function nearestIdx(t) { let b = 0, d = Infinity; clip.frames.forEach((f, i) => { const e = Math.abs(f.t - t); if (e < d) { d = e; b = i; } }); return b; }
function computePath() {
  if (!clip) return;
  clip.path = null;
  if (!club || !clip.track || marks.Impacto == null) return;
  const all = realTrack(), fpsReal = clip.dense ? clip.fps * clip.slow : clip.phaseFps;
  const tImp = marks.Impacto / clip.slow, S = Math.hypot(club.hands0.x - club.head0.x, club.hands0.y - club.head0.y);
  const view = $('view').value, G = geo();
  if (view === 'down-the-line') {
    const side = Math.sign(club.hands0.x - club.hip0.x) || 1, vp = G.vp, vpFrom = G.vpFrom;
    const o = { head0: club.head0, side, f: focal(clip.w, clip.h, $('lens').value), vp, tImp, S, fpsReal };
    const r = clubPath(all, o);
    clip.path = { view, ...r, vpFrom, guide: r.deg != null ? pathGuide(o, r.deg) : null };
  } else {
    clip.path = { view, ...attackAngle(all, { head0: club.head0, ground: G.ground, tImp, S, L: club.L, fpsReal }) };
  }
}
const PATH_SRC = {
  path: { label: 'TrackMan — Club Path', url: 'https://support.trackmangolf.com/hc/en-us/articles/39724275421211-Parameters-Club-Path-Tee-to-Green' },
  attack: { label: 'TrackMan — Attack Angle', url: 'https://trackman.com/blog/golf/attack-angle' },
  face: { label: 'Titleist — face vs path', url: 'https://www.titleist.com/learning-lab/performance/golf-club-path' },
};
function srcLine(list) { const p = el('p', 'srcs', 'Fontes: '); list.forEach((s, i) => { const a = el('a', null, s.label); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.append(i ? ' · ' : '', a); }); return p; }
function renderPath() {
  const host = $('path'); if (!host) return; host.replaceChildren();
  if (!clip) { host.append(el('p', 'hint', 'Use "Detetar fases e analisar". Down-the-line: caminho do taco (in-to-out / out-to-in). Face-on: ângulo de ataque.')); return; }
  const p = clip.path;
  if (!p) { host.append(el('p', 'hint', club?.guess ? 'Taco não encontrado no address: ative ✎ Linhas, arraste o ponto amarelo para a cabeça do taco e analise de novo.' : 'Sem seguimento da cabeça do taco neste vídeo.')); return; }
  if (p.quality) host.append(el('p', 'legend', 'Frame rate no impacto: ' + p.quality.text + (clip.slow > 1 ? ` (câmara lenta ${clip.slow}×)` : '')));
  if (p.error) {
    const v = el('div', 'verdict neutral'); v.append(el('b', null, p.view === 'down-the-line' ? 'Caminho do taco: indisponível' : 'Ângulo de ataque: indisponível'), el('p', null, p.error));
    host.append(v);
  }
  else if (p.view === 'down-the-line') {
    const v = el('div', 'verdict ' + (p.verdict === 'neutro' ? 'ok' : 'neutral'));
    v.append(el('b', null, `Caminho do taco: ${p.deg > 0 ? '+' : ''}${p.deg.toFixed(1)}° ${p.verdict}`));
    v.append(el('p', null, p.verdict === 'in-to-out' ? 'A cabeça do taco vem de dentro para fora da linha do alvo no impacto — favorece draw/hook (ou push).'
      : p.verdict === 'out-to-in' ? 'A cabeça do taco vem de fora para dentro da linha do alvo no impacto — favorece fade/slice (ou pull). Coerente com over the top.'
        : 'Caminho praticamente na linha do alvo no impacto.'));
    host.append(v);
    host.append(el('p', 'hint', `${p.n} posições da cabeça do taco junto à bola. Linha do alvo a partir de: ${p.vpFrom}. Lente ${$('lens').value}×. No vídeo: tracejado azul = linha do alvo, seta laranja = caminho medido.`));
    host.append(el('p', 'hint', 'Para calibrar, desenhe com ✎ Linhas duas linhas paralelas ao alvo (ex.: bastão de alinhamento e linha dos pés). A direção de saída depende sobretudo da face (~75 % nos ferros), que não é medida.'));
    host.append(srcLine([PATH_SRC.path, PATH_SRC.face]));
  } else {
    const v = el('div', 'verdict neutral');
    v.append(el('b', null, `Ângulo de ataque: ${p.deg > 0 ? '+' : ''}${p.deg.toFixed(1)}°`));
    v.append(el('p', null, (p.deg < 0 ? 'A descer na bola' : 'A subir na bola') + '. Médias PGA Tour (TrackMan): ferro 6 −3,7°, driver −0,9°. Bolas na relva pedem ataque negativo; com driver, positivo dá mais distância.'));
    host.append(v);
    if (p.low) host.append(el('p', 'hint', `Ponto mais baixo da cabeça do taco: ${p.low.along >= 0 ? 'à frente' : 'atrás'} da posição de address (${Math.abs(Math.round(p.low.along * 100))} % do tronco)${p.low.along < 0 ? ' — risco de bater no chão antes da bola' : ''}. Círculo azul no vídeo.`));
    host.append(el('p', 'hint', `${p.n} posições da cabeça do taco junto à bola. Seta laranja = direção medida.`));
    host.append(srcLine([PATH_SRC.attack]));
  }
  host.append(el('p', 'legend', 'Traço da cabeça do taco: verde = backswing, vermelho = downswing, branco = após o impacto; pontos laranja = frames em câmara lenta junto à bola.'));
  renderBall(host);
}
function renderBall(host) {
  const b = clip.ball; if (!b) return;
  host.append(el('h4', 'sub', 'Bola e tracer'));
  const L = b.launch;
  if (!b.found) host.append(el('p', 'hint', 'Bola não encontrada no address: o tracer parte da cabeça do taco.'));
  if (!L) host.append(el('p', 'hint', 'Para medir a saída da bola filme em câmara lenta (120/240 fps). O tracer usa uma saída típica e o destino que marcar.'));
  else if (L.error) host.append(el('p', 'hint', L.error + ' O tracer usa uma saída típica.'));
  else if (L.launch != null) {
    const row = (label, value, text) => { const r = el('div', 'finding'), t = el('div', 'finding-top'); t.append(el('span', null, label), el('b', null, value)); r.append(t); if (text) r.append(el('p', null, text)); host.append(r); };
    row('Ângulo de lançamento (vertical)', `${L.launch.toFixed(1)}°`, `Medido em ${L.n} frames depois do impacto.`);
    if (L.speed) row('Velocidade da bola (aprox.)', `${Math.round(L.speed * 3.6)} km/h`, 'No plano da imagem, com a escala do diâmetro da bola — subestima se a bola sair inclinada para a câmara.');
  } else {
    const a = L.screen;
    const r = el('div', 'finding'), t = el('div', 'finding-top'); t.append(el('span', null, 'Saída da bola (no ecrã)'), el('b', null, Math.abs(a) < 2 ? 'na linha' : `${Math.abs(a).toFixed(0)}° ${a > 0 ? 'à direita' : 'à esquerda'}`));
    r.append(t, el('p', null, `Medido em ${L.n} frames. Ângulo no ecrã em relação à linha do alvo, não em graus reais: a bola também sobe. A direção de saída depende sobretudo da face do taco.`)); host.append(r);
  }
  host.append(el('p', 'legend', `Tracer vermelho animado a partir do impacto${b.pts.length ? '; pontos brancos = bola medida' : ''}. Toque em "⛳ Destino da bola" e depois onde a bola cai (ou sai do enquadramento).`));
}

// ---------- report ----------
function refreshReport() {
  if (clip) {
    const slow = clip.slow || 1, rm = Object.fromEntries(Object.entries(marks).map(([p, t]) => [p, t / slow]));
    const clubR = club && clip.track ? { head0: club.head0, hands0: club.hands0, sh0: club.sh0, track: realTrack() } : null;
    report = buildReport(clip.frames.map(f => ({ t: f.t / slow, lm: f.lm })), clip.w, clip.h, rm, $('view').value, clubR);
    computePath(); computeBall();
  } else report = null;
  renderReport(); renderPath(); draw();
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function renderReport() {
  const host = $('report'); host.replaceChildren();
  if (!report) { host.append(el('p', 'hint', 'Use "Detetar fases e analisar" para obter o relatório.')); return; }
  if (report.error) { host.append(el('p', 'hint', report.error)); return; }
  const v = el('div', 'verdict ' + (report.plane.verdict === 'no plano' ? 'ok' : report.plane.verdict === 'over the top' || report.plane.verdict.startsWith('inside') ? 'bad' : 'neutral'));
  v.append(el('b', null, report.plane.verdict === 'só em down-the-line' ? 'Face-on' : 'Plano: ' + report.plane.verdict));
  v.append(el('p', null, report.plane.text));
  host.append(v);
  host.append(el('p', 'legend', 'No vídeo (address): linha amarela = cabeça do taco → mãos → ventre; tracejado branco = cabeça do taco → ombros; círculo = mãos. Ajuste com ✎ Linhas.'));
  for (const f of report.findings) {
    const row = el('div', 'finding' + (f.flag ? ' flag' : ''));
    const top = el('div', 'finding-top'); top.append(el('span', null, f.label), el('b', null, f.value));
    row.append(top, el('p', null, (f.flag ? '⚠ ' : '✓ ') + f.text)); host.append(row);
  }
  for (const c of report.causes) {
    const box = el('details', 'causes'); box.open = true; box.append(el('summary', null, c.title));
    const ul = el('ul');
    for (const it of c.items) {
      const li = el('li', null, it.text + ' ');
      it.sources.forEach((s, i) => { const a = el('a', null, s.label); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(i ? ' · ' : '— ', a); });
      ul.append(li);
    }
    box.append(ul); host.append(box);
  }
  if (!report.causes.length && report.plane.verdict === 'no plano') host.append(el('p', 'hint', 'Nenhum indicador fora do normal neste swing.'));
  host.append(el('p', 'hint', report.note));
  const ai = el('button', 'primary ai-btn', '✦ Relatório AI'); ai.type = 'button'; ai.onclick = aiReport; host.append(ai);
  const out = el('div', 'ai-out'); out.id = 'ai-out'; host.append(out);
}
// AI report: key frames with the overlays + measurements → /api/swing/report (Claude, server-side).
async function frameJpeg(t) {
  await seekTo(t); update();
  const k = Math.min(1, 768 / Math.max(video.videoWidth, video.videoHeight)), c = document.createElement('canvas');
  c.width = Math.round(video.videoWidth * k); c.height = Math.round(video.videoHeight * k);
  const g = c.getContext('2d'); g.drawImage(video, 0, 0, c.width, c.height); g.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8).split(',')[1];
}
function renderText(host, text) {
  host.replaceChildren();
  let ul = null;
  for (const line of text.split('\n')) {
    const l = line.trim(); if (!l) { ul = null; continue; }
    if (l.startsWith('## ')) { ul = null; host.append(el('h4', null, l.slice(3).replace(/\*\*/g, ''))); }
    else if (/^[-•*] /.test(l)) { if (!ul) { ul = el('ul'); host.append(ul); } ul.append(el('li', null, l.slice(2).replace(/\*\*/g, ''))); }
    else { ul = null; host.append(el('p', null, l.replace(/\*\*/g, ''))); }
  }
}
async function aiReport() {
  const out = $('ai-out'); if (!out || busy) return;
  busy = true; controls(); out.replaceChildren(el('p', 'hint', 'A preparar os frames-chave…'));
  const keep = video.currentTime;
  try {
    const images = [];
    for (const p of ['Address', 'Topo', 'Downswing', 'Impacto', 'Follow-through']) if (marks[p] != null) images.push({ label: p, base64: await frameJpeg(marks[p]) });
    out.replaceChildren(el('p', 'hint', 'A pedir a análise ao Claude… (10–30 s)'));
    const data = { perspetiva: $('view').value, fases: marks, relatorio_app: report, medicoes: Object.fromEntries(phases.filter(p => marks[p] != null).map(p => [p, Object.values(samples).find(s => Math.abs(s.time - marks[p]) < .001)?.values])), taco: club ? { cabeca_address: club.head0, maos_address: club.hands0, ombros_address: club.sh0, estimado: !club.guess } : null, caminho_taco: clip?.path ? { perspetiva: clip.path.view, graus: clip.path.deg ?? null, veredito: clip.path.verdict ?? null, erro: clip.path.error ?? null, fps_impacto: clip.path.quality?.text } : null };
    const res = await fetch('/api/swing/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data, images }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Erro ' + res.status);
    renderText(out, j.text); report.ai = j.text;
  } catch (e) { out.replaceChildren(el('p', 'hint', 'Relatório AI indisponível: ' + e.message)); }
  finally { await seekTo(keep); busy = false; controls(); phaseUI(); update(); }
}
$('view').onchange = () => { if (mode === 'putt') { reanalyzePutt(); return; } $('compare').value = ''; $('comparison').textContent = ''; if (clip) refreshReport(); };
$('lens').onchange = () => { if (clip) { computePath(); renderPath(); draw(); } };
$('hand').onchange = () => reanalyzePutt();
$('slow').onchange = () => { if (mode === 'putt') reanalyzePutt(); else if (clip) status('Câmara lenta alterada: toque de novo em "Detetar fases e analisar".'); };

// ---------- session / history ----------
function session() {
  const path = clip ? clip.frames.map(f => { const a = f.lm[15], b = f.lm[16]; return [+f.t.toFixed(3), +((a.x + b.x) / 2).toFixed(3), +((a.y + b.y) / 2).toFixed(3)]; }) : null;
  if (mode === 'putt') return { id: globalThis.crypto.randomUUID(), date: new Date().toISOString(), mode: 'putt', filename: $('filename').textContent, view: $('view').value, fps: Number($('fps').value), slow: slowF(),
    marks: {}, samples: {}, lines: structuredClone(lines), putt: putt.res && !putt.res.error ? { times: putt.res.times, findings: putt.res.findings, impactBy: putt.res.impactBy, path: putt.res.path ?? null, start: putt.res.start ?? null, attack: putt.res.attack ?? null, scale: putt.cmPerPx ? 'bola' : null } : null, notes: $('notes').value,
    limitations: 'Seguimento 2D do putter e da bola por imagem; a face do putter não é medida. Vídeo não incluído.' };
  return { id: globalThis.crypto.randomUUID(), date: new Date().toISOString(), filename: $('filename').textContent, view: $('view').value, fps: Number($('fps').value), slow: slowF(), clubPath: clip?.path ? { view: clip.path.view, deg: clip.path.deg ?? null, verdict: clip.path.verdict ?? null, error: clip.path.error ?? null } : null,
    marks: { ...marks }, lines: structuredClone(lines), samples: structuredClone(samples), report: report ? structuredClone(report) : null, handPath: path, club: club ? { head0: club.head0, hands0: club.hands0, sh0: club.sh0 } : null, notes: $('notes').value,
    limitations: 'Projeções 2D; sem deteção do taco ou da bola; plano = caminho das mãos. Fases detetadas automaticamente e/ou corrigidas à mão. Vídeo não incluído.' };
}
function persist() { try { localStorage.setItem('gpf-swings-v1', JSON.stringify(history)); return true; } catch { status('Sem espaço ou acesso ao armazenamento local. Exporte o relatório para não perder os dados.'); return false; } }
$('save').onclick = () => { const s = session(); history.unshift(s); if (!persist()) { history.shift(); return; } historyUI(); status('Sessão guardada neste navegador, sem o ficheiro de vídeo.'); };
$('export').onclick = () => { const blob = new Blob([JSON.stringify(session(), null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = 'gpf-swing-report.json'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
function historyUI() {
  const host = $('history'); host.replaceChildren();
  $('compare').replaceChildren(new Option('Comparar com uma sessão…', ''));
  for (const s of history) {
    const when = new Date(s.date).toLocaleString('pt-PT');
    $('compare').add(new Option(`${when} · ${s.filename}`, s.id));
    const row = el('div', 'history-row'); const name = el('span', null, s.mode === 'putt' ? `${when} · ${s.filename} · putt ${s.view}${s.putt?.findings?.[0] ? ' · tempo ' + s.putt.findings[0].value : ''}`
      : `${when} · ${s.filename} · ${s.view}${s.report?.plane ? ' · ' + s.report.plane.verdict : ''}${s.clubPath?.deg != null ? ` · ${s.clubPath.view === 'down-the-line' ? 'caminho' : 'ataque'} ${s.clubPath.deg.toFixed(1)}°` : ''}`);
    const open = el('button', null, 'Ver');
    open.onclick = () => { const win = window.open('', '_blank'); if (win) { win.opener = null; win.document.title = 'Relatório GPF'; const pre = win.document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; pre.textContent = JSON.stringify(s, null, 2); win.document.body.append(pre); } };
    const del = el('button', null, 'Eliminar');
    del.onclick = () => { const previous = history; history = history.filter(v => v.id !== s.id); if (!persist()) history = previous; historyUI(); $('comparison').textContent = ''; };
    row.append(name, open, del); host.append(row);
  }
}
$('compare').onchange = () => {
  const old = history.find(s => s.id === $('compare').value), host = $('comparison'); host.replaceChildren();
  if (!old) return;
  if (old.mode === 'putt' || mode === 'putt') { host.textContent = 'Comparação disponível só para swings. Veja a sessão de putt em "Ver".'; return; }
  if (old.view !== $('view').value) { host.textContent = 'Perspetivas diferentes: comparação não disponível.'; return; }
  host.append(el('p', null, 'Comparação por fase · atual / anterior (diferença)'));
  let count = 0;
  for (const phase of phases) {
    const a = marks[phase], b = old.marks[phase]; if (a == null || b == null) continue;
    const sa = Object.values(samples).find(s => Math.abs(s.time - a) < .001), sb = Object.values(old.samples).find(s => Math.abs(s.time - b) < .001);
    if (!sa || !sb) continue;
    for (const [name, v] of Object.entries(sa.values)) { const prev = sb.values[name]; if (v == null || prev == null) continue; host.append(el('div', null, `${phase} · ${name}: ${v.toFixed(1)}° / ${prev.toFixed(1)}° (${(v - prev).toFixed(1)}°)`)); count++; }
  }
  if (!count) host.append(document.createTextNode('Sem medições coincidentes. Analise as fases em ambas as sessões.'));
};

// ---------- reference lines (normalised to the video; endpoints can be dragged) ----------
let lines = [], draft = null, drawing = false, pointer = null, dragEnd = null, dragHead = false;
function lineControls() { $('undo-line').disabled = !lines.length; $('clear-lines').disabled = !lines.length; }
function drawLines() {
  const W = lineCanvas.width, H = lineCanvas.height, s = cssScale(lineCanvas);
  lctx.clearRect(0, 0, W, H); lctx.lineCap = 'round';
  for (const line of [...lines, ...(draft ? [draft] : [])]) {
    const ax = line.a.x * W, ay = line.a.y * H, bx = line.b.x * W, by = line.b.y * H;
    lctx.strokeStyle = 'rgba(0,0,0,.5)'; lctx.lineWidth = 6.5 * s; lctx.beginPath(); lctx.moveTo(ax, ay); lctx.lineTo(bx, by); lctx.stroke();
    lctx.strokeStyle = line.color; lctx.lineWidth = 4 * s; lctx.stroke();
    if (drawing) for (const [x, y] of [[ax, ay], [bx, by]]) {
      lctx.beginPath(); lctx.arc(x, y, 9 * s, 0, Math.PI * 2); lctx.fillStyle = 'rgba(255,255,255,.95)'; lctx.fill();
      lctx.lineWidth = 3 * s; lctx.strokeStyle = line.color; lctx.stroke();
    }
  }
  lineControls();
}
function cancelLine() { draft = null; dragEnd = null; if (pointer !== null && lineCanvas.hasPointerCapture(pointer)) lineCanvas.releasePointerCapture(pointer); pointer = null; drawLines(); }
function resetLines() { lines = []; drawing = false; cancelLine(); lineCanvas.classList.remove('drawing'); $('draw-line').setAttribute('aria-pressed', 'false'); }
function locationOnVideo(e) { const r = lineCanvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; }
function constrain(p, from, e) { if (e.shiftKey) { if (Math.abs(p.x - from.x) * lineCanvas.width > Math.abs(p.y - from.y) * lineCanvas.height) p.y = from.y; else p.x = from.x; } return p; }
function hitEnd(e) {
  const r = lineCanvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, tol = e.pointerType === 'touch' ? 28 : 16;
  let best = null, d = tol;
  lines.forEach((l, i) => ['a', 'b'].forEach(k => { const e2 = Math.hypot(l[k].x * r.width - px, l[k].y * r.height - py); if (e2 < d) { d = e2; best = { i, k }; } }));
  return best;
}
$('draw-line').onclick = () => {
  if (marking) setMarking(false);
  drawing = !drawing; cancelLine(); lineCanvas.classList.toggle('drawing', drawing);
  $('draw-line').setAttribute('aria-pressed', String(drawing));
  draw();
  if (drawing && mode === 'putt') { video.pause(); status('Desenhe a linha do alvo (a primeira linha é usada como linha do alvo).'); return; }
  if (drawing) { video.pause(); if (club && marks.Address != null) seek(marks.Address); status(club ? 'Arraste os pontos brancos para ajustar a cabeça do taco, as mãos e os ombros; arraste noutro sítio para desenhar uma linha.' : 'Arraste para desenhar uma linha; arraste uma ponta para a ajustar.'); }
};
lineCanvas.onpointerdown = e => {
  if (loaded && marking && e.button === 0) { e.preventDefault(); puttTap(e); return; }
  if (loaded && landing && e.button === 0 && clip && clip.ball) {
    e.preventDefault(); const r = lineCanvas.getBoundingClientRect();
    clip.ball.land = { x: (e.clientX - r.left) / r.width * clip.w, y: (e.clientY - r.top) / r.height * clip.h };
    landing = false; lineCanvas.classList.toggle('drawing', drawing); $('ball-land').setAttribute('aria-pressed', 'false');
    computeBall(); draw(); status('Destino marcado. Reproduza o vídeo a partir do impacto para ver o tracer.'); return;
  }
  if (!loaded || !drawing || pointer !== null || e.button !== 0) return;
  e.preventDefault(); video.pause(); pointer = e.pointerId; lineCanvas.setPointerCapture(pointer);
  if (club && mode === 'swing') {
    const r = lineCanvas.getBoundingClientRect(), k = r.width / clip.w, px = e.clientX - r.left, py = e.clientY - r.top;
    let best = null, d = e.pointerType === 'touch' ? 32 : 18;
    for (const key of Object.keys(HANDLES)) { const q = club[key]; if (!q) continue; const e2 = Math.hypot(q.x * k - px, q.y * k - py); if (e2 < d) { d = e2; best = key; } }
    if (best) { dragHead = best; return; }
  }
  dragEnd = hitEnd(e);
  if (!dragEnd) { const a = locationOnVideo(e); draft = { a, b: { ...a }, color: $('line-color').value }; }
  drawLines();
};
lineCanvas.onpointermove = e => {
  if (e.pointerId !== pointer) return;
  if (dragHead) { const p = locationOnVideo(e); club[dragHead] = { x: p.x * clip.w, y: p.y * clip.h }; draw(); return; }
  if (dragEnd) { const l = lines[dragEnd.i], other = l[dragEnd.k === 'a' ? 'b' : 'a']; l[dragEnd.k] = constrain(locationOnVideo(e), other, e); drawLines(); return; }
  if (draft) { draft.b = constrain(locationOnVideo(e), draft.a, e); drawLines(); }
};
lineCanvas.onpointerup = e => {
  if (e.pointerId !== pointer) return;
  if (dragHead) { const what = dragHead; dragHead = false; club.guess = false; computePath(); renderPath(); draw(); status({ head0: 'Cabeça do taco ajustada.', hands0: 'Posição das mãos ajustada.', sh0: 'Ponto dos ombros ajustado.' }[what]); cancelLine(); return; }
  const changed = !!(draft || dragEnd);
  if (draft) { draft.b = constrain(locationOnVideo(e), draft.a, e); if (Math.hypot((draft.b.x - draft.a.x) * lineCanvas.width, (draft.b.y - draft.a.y) * lineCanvas.height) >= 3 * cssScale(lineCanvas)) lines.push(draft); }
  cancelLine();
  if (changed) linesChanged();
};
// Lines also calibrate: the first two = target-line vanishing point (club path, DTL); the
// first = target line (putt).
function linesChanged() {
  if (mode === 'putt') { reanalyzePutt(); return; }
  if (clip && $('view').value === 'down-the-line') { computePath(); renderPath(); draw(); }
}
lineCanvas.onpointercancel = cancelLine;
lineCanvas.onlostpointercapture = () => { draft = null; dragEnd = null; dragHead = false; pointer = null; drawLines(); };
$('ball-land').onclick = () => {
  if (!clip || !clip.ball) return;
  if (drawing) $('draw-line').click();
  landing = !landing; $('ball-land').setAttribute('aria-pressed', String(landing)); lineCanvas.classList.toggle('drawing', landing || drawing);
  if (landing) { video.pause(); status('Toque onde a bola cai (ou onde sai do enquadramento).'); }
};
$('tracer').onchange = draw;
$('undo-line').onclick = () => { cancelLine(); lines.pop(); drawLines(); linesChanged(); };
$('clear-lines').onclick = () => { lines = []; cancelLine(); linesChanged(); };
window.addEventListener('keydown', e => { if (e.key === 'Escape') cancelLine(); });

// ---------- putt ----------
const VIEWS = {
  swing: [['face-on', 'Face-on · de frente'], ['down-the-line', 'Down-the-line · por trás']],
  putt: [['face-on', 'De frente · à altura da bola'], ['overhead', 'De cima · por cima da bola']],
};
const viewPref = { swing: 'face-on', putt: 'face-on' };
function setMode(m) {
  if (m === mode || busy) return;
  viewPref[mode] = $('view').value; mode = m;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  document.querySelectorAll('[data-swing]').forEach(e => e.hidden = m !== 'swing');
  document.querySelectorAll('[data-putt]').forEach(e => e.hidden = m !== 'putt');
  $('view').replaceChildren(...VIEWS[m].map(([v, t]) => new Option(t, v)));
  $('view').value = viewPref[m];
  if (drawing) $('draw-line').click();
  landing = false; $('ball-land').setAttribute('aria-pressed', 'false');
  setMarking(false); controls(); draw();
  status(m === 'putt' ? (loaded ? 'Modo putt: pare no address e toque em "◎ Tocar no putter e na bola".' : 'Modo putt: carregue ou filme um putt.') : (loaded ? 'Modo swing.' : 'Carregue um vídeo para começar.'));
}
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
function setMarking(on) {
  marking = on; $('putt-mark').setAttribute('aria-pressed', String(on));
  lineCanvas.classList.toggle('drawing', on || drawing);
}
$('putt-mark').onclick = () => {
  if (!loaded || busy) return;
  if (drawing) $('draw-line').click();
  if (marking) { setMarking(false); controls(); status(putt.taps.length ? 'Pronto. Toque em "Analisar putt".' : 'Marcação cancelada.'); return; }
  video.pause(); putt.taps = []; putt.res = null; putt.head = putt.ball = null; renderPutt();
  setMarking(true); controls(); draw();
  status('Toque no centro da cabeça do putter (frame parado, antes do putt).');
};
function puttTap(e) {
  const r = lineCanvas.getBoundingClientRect();
  const p = { x: (e.clientX - r.left) / r.width * video.videoWidth, y: (e.clientY - r.top) / r.height * video.videoHeight };
  if (!putt.taps.length) { putt.t0 = video.currentTime; putt.taps = [p]; status('Agora toque na bola (dá a escala em cm e o momento do impacto) — ou toque em "Analisar putt" sem bola.'); }
  else { putt.taps[1] = p; setMarking(false); status('Putter e bola marcados. Toque em "Analisar putt".'); }
  controls(); draw();
}
$('putt-run').onclick = async () => {
  if (!loaded || busy || !putt.taps.length) return;
  if (fpsProbe) await fpsProbe;
  setMarking(false); video.pause(); busy = true; controls();
  const token = generation, prog = $('progress'), w = video.videoWidth, h = video.videoHeight;
  prog.hidden = false; prog.value = 0;
  try {
    const slow = slowF(), fps = fileFps(), k = Math.max(1, Math.ceil(fps * slow / 60 - 1e-6)); // up to 60 real fps
    const t0 = putt.t0, tEnd = Math.min(video.duration - 0.001, t0 + 10 * slow);
    await seekTo(t0);
    const G = grayFrame(640), gw = G.gw, gh = G.gh, sx = w / gw, sy = h / gh, M = Math.max(gw, gh);
    const hp = { x: putt.taps[0].x / sx, y: putt.taps[0].y / sy };
    const T = createTracker(G.g, gw, gh, hp.x, hp.y, Math.max(6, Math.round(0.022 * M)), { search: 10, maxSearch: 50 });
    let B = null, br = null; putt.cmPerPx = null;
    if (putt.taps[1]) {
      br = ballRadius(G.g, gw, gh, Math.round(putt.taps[1].x / sx), Math.round(putt.taps[1].y / sy), Math.round(0.04 * M));
      if (br) { putt.cmPerPx = BALL_MM / 10 / (2 * br.r * sx); B = createTracker(G.g, gw, gh, br.x, br.y, Math.max(4, Math.round(br.r * 1.6)), { adapt: 0, minScore: 0.55, maxSearch: 70 }); }
    }
    const head = [{ t: t0, x: putt.taps[0].x, y: putt.taps[0].y, ok: true }];
    const ball = br ? [{ t: t0, x: br.x * sx, y: br.y * sy, ok: true }] : null;
    if (ball) ball.r = br.r * sx;
    const fa = Math.round(t0 * fps), nMax = Math.floor((tEnd - t0) * fps / k);
    const stillN = Math.max(4, Math.ceil(0.6 * fps * slow / k)); // 0.6 s of stillness ends the stroke
    let moved = false, movedAt = null, ballOn = !!B, ballMovedAt = null, lost = 0;
    for (let i = 1; i <= nMax; i++) {
      if (token !== generation) return;
      const t = (fa + i * k + 0.5) / fps; await seekTo(t);
      const { g } = grayFrame(640);
      const r = T.step(g); head.push({ t, x: r.x * sx, y: r.y * sy, ok: r.ok });
      lost = r.ok ? 0 : lost + 1;
      if (ballOn) {
        const b = B.step(g); ball.push({ t, x: b.x * sx, y: b.y * sy, ok: b.ok });
        if (ballMovedAt == null && b.ok && Math.hypot(b.x - br.x, b.y - br.y) > 0.6 * br.r) ballMovedAt = t;
        if (!b.ok && ballMovedAt != null) ballOn = false; // out of frame
        if (ballMovedAt != null && t - ballMovedAt > 0.3 * slow) { // stopped?
          const last = ball.slice(-stillN).filter(q => q.ok);
          if (last.length >= stillN - 1) { const xs = last.map(q => q.x), ys = last.map(q => q.y); if (Math.max(...xs) - Math.min(...xs) < 1.5 * sx && Math.max(...ys) - Math.min(...ys) < 1.5 * sy) { ballOn = false; ball.stopped = true; } }
        }
      }
      if (!moved && Math.hypot(r.x - hp.x, r.y - hp.y) > 0.012 * M) { moved = true; movedAt = t; }
      prog.value = i / nMax; status(`A seguir o putter${B ? ' e a bola' : ''}… ${Math.round(prog.value * 100)}%`);
      if (lost >= 8) break;
      if (moved && head.length > stillN && (!ballOn || t - movedAt > 8 * slow)) { // stroke over: the putter has stopped
        const last = head.slice(-stillN).filter(p => p.ok);
        if (last.length >= stillN - 1) { const xs = last.map(p => p.x), ys = last.map(p => p.y); if (Math.max(...xs) - Math.min(...xs) < 2 * sx && Math.max(...ys) - Math.min(...ys) < 2 * sy) break; }
      }
    }
    putt.head = head; putt.ball = ball;
    reanalyzePutt(false);
    if (putt.res && !putt.res.error && $('view').value === 'face-on') await headStability(token);
    renderPutt(); draw();
    if (putt.res && !putt.res.error) { await seekTo(putt.res.times.impact); status(`Putt analisado (impacto detetado pel${putt.res.impactBy === 'bola' ? 'a bola' : 'o putter'}). Desenhe a linha do alvo com ✎ Linhas para a definir.`); }
  } catch (error) {
    console.error(error); status(`A análise do putt falhou: ${error?.name || 'Erro'} — ${String(error?.message || error).slice(0, 160)}`);
  } finally { prog.hidden = true; busy = false; controls(); update(); }
};
function reanalyzePutt(render = true) {
  if (!putt.head) return;
  const line = lines[0] ? { a: { x: lines[0].a.x * video.videoWidth, y: lines[0].a.y * video.videoHeight }, b: { x: lines[0].b.x * video.videoWidth, y: lines[0].b.y * video.videoHeight } } : null;
  const keep = putt.res?.headMove;
  putt.res = analyzePutt({ head: putt.head, ball: putt.ball, view: $('view').value, lefty: $('hand').value === 'l', line, cmPerPx: putt.cmPerPx, slow: slowF(), minPx: 0.012 * Math.max(video.videoWidth, video.videoHeight) });
  if (keep && !putt.res.error) addHeadFinding(keep);
  if (render) { renderPutt(); draw(); }
}
// Face-on: how much the head moves from the start of the stroke to impact (pose model).
async function headStability(token) {
  try {
    await model();
    const at = async t => { const { lm } = await detectAt(t, 720); return lm; };
    const a = await at(putt.res.times.start), b = await at(putt.res.times.impact);
    if (token !== generation || !a || !b || (a[0].visibility ?? 1) < 0.5 || (b[0].visibility ?? 1) < 0.5) return;
    const W = video.videoWidth, H = video.videoHeight;
    const px = Math.hypot((b[0].x - a[0].x) * W, (b[0].y - a[0].y) * H);
    const torso = Math.hypot(((a[11].x + a[12].x) - (a[23].x + a[24].x)) / 2 * W, ((a[11].y + a[12].y) - (a[23].y + a[24].y)) / 2 * H);
    const hm = { px, cm: putt.cmPerPx ? px * putt.cmPerPx : null, rel: torso ? px / torso : null };
    putt.res.headMove = hm; addHeadFinding(hm);
  } catch (e) { console.warn('head stability', e); }
}
function addHeadFinding(hm) {
  putt.res.headMove = hm;
  const flag = hm.cm != null ? hm.cm > 2 : hm.rel != null && hm.rel > 0.05;
  putt.res.findings.push({ label: 'Movimento da cabeça até ao impacto', value: hm.cm != null ? `${hm.cm.toFixed(1)} cm` : hm.rel != null ? `${Math.round(hm.rel * 100)} % do tronco` : `${Math.round(hm.px)} px`, flag,
    text: flag ? 'A cabeça mexe-se durante o stroke — costuma arrastar os ombros e mudar o caminho e a face.' : 'Cabeça estável até ao impacto.', sources: [] });
}
function renderPutt() {
  const host = $('putt'); host.replaceChildren();
  const r = putt.res;
  if (!r) { host.append(el('p', 'hint', '1. Pare o vídeo no address (antes do putt). 2. Toque em "◎ Tocar no putter e na bola" e toque no centro da cabeça do putter e depois na bola. 3. "Analisar putt".')); return; }
  if (r.error) { host.append(el('p', 'hint', r.error)); return; }
  const jumps = el('div', 'jumps');
  for (const [k, label] of [['start', 'Início'], ['top', 'Topo'], ['impact', 'Impacto'], ['finish', 'Fim']]) { const b = el('button', null, `${label} ${r.times[k].toFixed(2)}s`); b.type = 'button'; b.onclick = () => seek(r.times[k]); jumps.append(b); }
  host.append(jumps);
  for (const f of r.findings) {
    const row = el('div', 'finding' + (f.flag ? ' flag' : ''));
    const top = el('div', 'finding-top'); top.append(el('span', null, f.label), el('b', null, f.value));
    row.append(top, el('p', null, (f.flag ? '⚠ ' : '✓ ') + f.text));
    if (f.sources && f.sources.length) row.append(srcLine(f.sources));
    host.append(row);
  }
  host.append(el('p', 'legend', `No vídeo: verde = backswing, vermelho = até ao impacto, branco = follow-through; amarelo = bola; tracejado azul = linha do alvo${lines[0] ? ' (a sua linha)' : ' assumida'}.${putt.cmPerPx ? '' : ' Sem bola marcada: medidas em píxeis.'}`));
  host.append(el('p', 'hint', r.note));
}

phaseUI(); historyUI();
window.__swing = { get club() { return club; }, get marks() { return marks; } }; // debugging aid (console)
