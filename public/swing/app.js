// GPF Swing Lab — served at app.gpf.golf/swing (members only, see src/proxy.js).
// MediaPipe is allowed by the /swing CSP in next.config.mjs.
import { phases, metrics, validatePhases } from './metrics.js';
import { detectPhases, findTop, buildReport } from './analysis.js';
import { findShaft, average } from './club.js';

const $ = id => document.getElementById(id);
const video = $('video'), canvas = $('overlay'), ctx = canvas.getContext('2d');
const lineCanvas = $('lines'), lctx = lineCanvas.getContext('2d');
let marks = {}, samples = {}, points = null, pose = null, url = null, loaded = false, busy = false, generation = 0, history = [];
let clip = null;      // { w, h, step, frames: [{t, lm, g}], gw, gh } from the automatic analysis (memory only)
let club = null;      // { head0, hands0, sh0, hip0, L } address club/plane points (video px), adjustable
let report = null;    // last swing report
try { history = JSON.parse(localStorage.getItem('gpf-swings-v1') || '[]'); if (!Array.isArray(history)) history = []; history = history.filter(s => s && typeof s.id === 'string' && s.marks && s.samples); } catch {}

const status = t => { $('status').textContent = t; if (!loaded && url) $('empty-text').textContent = t; };
function stageMsg(title, text, tap = false) { $('empty').hidden = false; $('empty-title').textContent = title; $('empty-text').textContent = text; $('tap-load').hidden = !tap; }
function controls() {
  for (const id of ['play', 'back', 'next', 'seek', 'save', 'export', 'detect', 'auto', 'draw-line']) $(id).disabled = !loaded || busy;
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
function drawClub(s) {
  if (!club) return;
  const { head0, hands0, sh0 } = club;
  // club head → shoulders (plane top) and club head → hands → belly (shaft line)
  if (sh0) { const k = 1.25; strokeLine([head0, { x: head0.x + (sh0.x - head0.x) * k, y: head0.y + (sh0.y - head0.y) * k }], '#fff', 3, s, [9, 7]); }
  strokeLine(shaftLine(), '#ffdf45', 4, s);
  ctx.beginPath(); ctx.arc(hands0.x, hands0.y, Math.max(14 * s, club.L * 0.12), 0, Math.PI * 2);
  ctx.lineWidth = 5 * s; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.stroke(); ctx.lineWidth = 3 * s; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.beginPath(); ctx.arc(head0.x, head0.y, 7 * s, 0, Math.PI * 2); ctx.fillStyle = '#ffdf45'; ctx.fill(); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = '#1c1e24'; ctx.stroke();
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
  generation++; const token = generation;
  resetLines(); video.pause(); if (url) URL.revokeObjectURL(url);
  loaded = false; marks = {}; samples = {}; points = null; clip = null; club = null; report = null; renderReport();
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
$('drop').ondragover = e => e.preventDefault();
$('drop').ondrop = e => { e.preventDefault(); if (!busy) load([...(e.dataTransfer?.files || [])].find(isVideo)); };
function ready() {
  if (loaded || !video.videoWidth) return;
  if (!Number.isFinite(video.duration) || video.duration <= 0) return; // some files report the duration later
  clearTimeout(loadTimer); loaded = true; video.pause();
  $('empty').hidden = true; $('tap-load').hidden = true;
  $('stage').style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
  canvas.width = video.videoWidth; canvas.height = video.videoHeight; $('seek').max = video.duration;
  controls(); phaseUI(); requestAnimationFrame(resize);
  video.currentTime = Math.min(0.001, video.duration / 2); // Safari paints the first frame only after a seek
  update(); status('Vídeo pronto. Toque em "Detetar fases e analisar".');
}
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
async function detectAt(t, maxSide, withGray = false) {
  await seekTo(t);
  const r = pose.detect(grabFrame(maxSide));
  const lm = r.landmarks[0] ? r.landmarks[0].map(p => ({ x: p.x, y: p.y, visibility: p.visibility ?? 1 })) : null;
  return withGray ? { lm, ...grayFrame(400) } : { lm };
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
    console.error(error); status('A análise de pose não ficou disponível. Verifique a internet e tente novamente.');
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
    if (coarse.length < 3) { status(`O corpo só foi detetado em ${coarse.length} de ${nC} frames. Filme com o corpo inteiro visível, boa luz e o jogador maior no enquadramento.`); return; }
    const top = findTop(coarse, w, h);
    if (top == null) { status(`Corpo detetado em ${coarse.length} de ${nC} frames, mas não encontrei o topo do swing (as mãos têm de subir acima do peito e estar visíveis).`); return; }
    const fps = Math.min(30, Math.max(10, Number($('fps').value) || 30)), step = 1 / fps;
    // Sample at frame centres so consecutive samples are consecutive, distinct video frames.
    const f0 = Math.max(0, Math.round((top - 2.2) * fps)), f1 = Math.min(Math.floor(dur * fps) - 1, Math.round((top + 1.6) * fps));
    const t0 = (f0 + 0.5) / fps, t1 = (f1 + 0.5) / fps;
    const frames = [], nF = Math.max(1, f1 - f0 + 1);
    let gw = 0, gh = 0;
    for (let i = 0; i < nF; i++) {
      if (token !== generation) return;
      const t = t0 + i * step, r = await detectAt(t, 720, true);
      gw = r.gw; gh = r.gh;
      if (r.lm) frames.push({ t, lm: r.lm, g: r.g });
      prog.value = 0.35 + 0.65 * (i + 1) / nF; status(`A analisar o swing frame a frame… ${Math.round(prog.value * 100)}%`);
    }
    const res = detectPhases(frames, w, h);
    if (res.error) { status(`${res.error} (corpo detetado em ${frames.length} de ${nF} frames)`); return; }
    clip = { w, h, step, frames, gw, gh };
    marks = { ...res.times };
    let viewNote = '';
    if (res.view && res.view !== $('view').value) { $('view').value = res.view; viewNote = ` Perspetiva detetada: ${res.view === 'face-on' ? 'face-on' : 'down-the-line'}.`; }
    for (const p of phases) { const f = frames[res.index[p]]; samples[f.t.toFixed(3)] = { time: f.t, values: metrics(f.lm, w, h) }; }
    findClub(res.index.Address);
    phaseUI(); refreshReport();
    await seekTo(marks.Address);
    status((club?.guess ? 'Fases detetadas. Não encontrei o taco: ative ✎ Linhas e arraste o ponto amarelo para a cabeça do taco.' : 'Fases detetadas e relatório pronto. Para ajustar a cabeça do taco, as mãos ou os ombros, ative ✎ Linhas e arraste os pontos.') + ' Pode corrigir qualquer fase com "Marcar".' + viewNote);
  } catch (error) {
    console.error(error); status('A análise não ficou disponível. Verifique a internet e tente novamente.');
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
  for (const f of frames) delete f.g; // grayscale frames only serve the address shaft search
  if (shaft) club = { head0: { x: shaft.head.x * sx, y: shaft.head.y * sy }, hands0: { x: shaft.hands.x * sx, y: shaft.hands.y * sy }, sh0, hip0, L };
  else { // no shaft found: start from the body points so the user can place the club head
    const hd = m(15, 16), foot = Math.max(lm[27]?.y ?? 0, lm[28]?.y ?? 0) * h;
    club = { head0: { x: hd.x + (hd.x - hip0.x) * 0.8, y: foot || hip0.y + 1.9 * L }, hands0: hd, sh0, hip0, L, guess: true };
  }
}

// ---------- report ----------
function refreshReport() { report = clip ? buildReport(clip.frames, clip.w, clip.h, marks, $('view').value) : null; renderReport(); draw(); }
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
    const data = { perspetiva: $('view').value, fases: marks, relatorio_app: report, medicoes: Object.fromEntries(phases.filter(p => marks[p] != null).map(p => [p, Object.values(samples).find(s => Math.abs(s.time - marks[p]) < .001)?.values])), taco: club ? { cabeca_address: club.head0, maos_address: club.hands0, ombros_address: club.sh0, estimado: !club.guess } : null };
    const res = await fetch('/api/swing/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data, images }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Erro ' + res.status);
    renderText(out, j.text); report.ai = j.text;
  } catch (e) { out.replaceChildren(el('p', 'hint', 'Relatório AI indisponível: ' + e.message)); }
  finally { await seekTo(keep); busy = false; controls(); phaseUI(); update(); }
}
$('view').onchange = () => { $('compare').value = ''; $('comparison').textContent = ''; if (clip) refreshReport(); };

// ---------- session / history ----------
function session() {
  const path = clip ? clip.frames.map(f => { const a = f.lm[15], b = f.lm[16]; return [+f.t.toFixed(3), +((a.x + b.x) / 2).toFixed(3), +((a.y + b.y) / 2).toFixed(3)]; }) : null;
  return { id: globalThis.crypto.randomUUID(), date: new Date().toISOString(), filename: $('filename').textContent, view: $('view').value, fps: Number($('fps').value),
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
    const row = el('div', 'history-row'); const name = el('span', null, `${when} · ${s.filename} · ${s.view}${s.report?.plane ? ' · ' + s.report.plane.verdict : ''}`);
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
  drawing = !drawing; cancelLine(); lineCanvas.classList.toggle('drawing', drawing);
  $('draw-line').setAttribute('aria-pressed', String(drawing));
  draw();
  if (drawing) { video.pause(); if (club && marks.Address != null) seek(marks.Address); status(club ? 'Arraste os pontos brancos para ajustar a cabeça do taco, as mãos e os ombros; arraste noutro sítio para desenhar uma linha.' : 'Arraste para desenhar uma linha; arraste uma ponta para a ajustar.'); }
};
lineCanvas.onpointerdown = e => {
  if (!loaded || !drawing || pointer !== null || e.button !== 0) return;
  e.preventDefault(); video.pause(); pointer = e.pointerId; lineCanvas.setPointerCapture(pointer);
  if (club) {
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
  if (dragHead) { const what = dragHead; dragHead = false; club.guess = false; draw(); status({ head0: 'Cabeça do taco ajustada.', hands0: 'Posição das mãos ajustada.', sh0: 'Ponto dos ombros ajustado.' }[what]); cancelLine(); return; }
  if (draft) { draft.b = constrain(locationOnVideo(e), draft.a, e); if (Math.hypot((draft.b.x - draft.a.x) * lineCanvas.width, (draft.b.y - draft.a.y) * lineCanvas.height) >= 3 * cssScale(lineCanvas)) lines.push(draft); }
  cancelLine();
};
lineCanvas.onpointercancel = cancelLine;
lineCanvas.onlostpointercapture = () => { draft = null; dragEnd = null; dragHead = false; pointer = null; drawLines(); };
$('undo-line').onclick = () => { cancelLine(); lines.pop(); drawLines(); };
$('clear-lines').onclick = () => { lines = []; cancelLine(); };
window.addEventListener('keydown', e => { if (e.key === 'Escape') cancelLine(); });

phaseUI(); historyUI();
window.__swing = { get club() { return club; }, get marks() { return marks; } }; // debugging aid (console)
