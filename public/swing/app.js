// GPF Swing Lab — served at app.gpf.golf/swing (members only, see src/proxy.js).
// MediaPipe is allowed by the /swing CSP in next.config.mjs.
import { phases, metrics, validatePhases } from './metrics.js';
import { detectPhases, findTop, buildReport } from './analysis.js';

const $ = id => document.getElementById(id);
const video = $('video'), canvas = $('overlay'), ctx = canvas.getContext('2d');
const lineCanvas = $('lines'), lctx = lineCanvas.getContext('2d');
let marks = {}, samples = {}, points = null, pose = null, url = null, loaded = false, busy = false, generation = 0, history = [];
let clip = null;      // { w, h, step, frames: [{t, lm}] } from the automatic analysis (memory only)
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
  // Hand path: backswing (green) and downswing (orange), from the automatic analysis.
  if (clip && marks.Address != null && marks.Topo != null) {
    const hand = lm => { const a = lm[15], b = lm[16]; const va = (a?.visibility ?? 0) >= .3, vb = (b?.visibility ?? 0) >= .3; if (va && vb) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; return va ? a : vb ? b : null; };
    const seg = (t0, t1, color) => {
      const pts = clip.frames.filter(f => f.t >= t0 - 1e-6 && f.t <= t1 + 1e-6).map(f => hand(f.lm)).filter(Boolean);
      if (pts.length < 2) return;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 6 * s; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 3.5 * s; ctx.stroke();
    };
    seg(marks.Address, marks.Topo, '#38c97f');
    seg(marks.Topo, marks.Impacto ?? marks.Topo, '#ff7a45');
  }
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
  loaded = false; marks = {}; samples = {}; points = null; clip = null; report = null; renderReport();
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
    let done = false; const fin = () => { if (done) return; done = true; video.removeEventListener('seeked', fin); res(); };
    video.addEventListener('seeked', fin); setTimeout(fin, 2500);
    video.currentTime = Math.max(0, Math.min(video.duration - 0.001, t));
  });
}
async function detectAt(t, maxSide) {
  await seekTo(t);
  const r = pose.detect(grabFrame(maxSide));
  return r.landmarks[0] ? r.landmarks[0].map(p => ({ x: p.x, y: p.y, visibility: p.visibility ?? 1 })) : null;
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
      const t = i * coarseStep, lm = await detectAt(t, 320);
      if (lm) coarse.push({ t, lm });
      prog.value = 0.35 * (i + 1) / nC; status(`A procurar o swing no vídeo… ${Math.round(prog.value * 100)}%`);
    }
    const top = findTop(coarse, w, h);
    if (top == null) { status('Não encontrei um swing (o corpo inteiro tem de estar visível e as mãos subir acima do peito).'); return; }
    const fps = Math.min(30, Math.max(10, Number($('fps').value) || 30)), step = 1 / fps;
    const t0 = Math.max(0, top - 2.2), t1 = Math.min(dur, top + 1.6);
    const frames = [], nF = Math.floor((t1 - t0) / step) + 1;
    for (let i = 0; i < nF; i++) {
      if (token !== generation) return;
      const t = t0 + i * step, lm = await detectAt(t, 480);
      if (lm) frames.push({ t, lm });
      prog.value = 0.35 + 0.65 * (i + 1) / nF; status(`A analisar o swing frame a frame… ${Math.round(prog.value * 100)}%`);
    }
    const res = detectPhases(frames, w, h);
    if (res.error) { status(res.error); return; }
    clip = { w, h, step, frames };
    marks = { ...res.times };
    let viewNote = '';
    if (res.view && res.view !== $('view').value) { $('view').value = res.view; viewNote = ` Perspetiva detetada: ${res.view === 'face-on' ? 'face-on' : 'down-the-line'}.`; }
    for (const p of phases) { const f = frames[res.index[p]]; samples[f.t.toFixed(3)] = { time: f.t, values: metrics(f.lm, w, h) }; }
    phaseUI(); refreshReport();
    await seekTo(marks.Address);
    status('Fases detetadas e relatório pronto. Pode corrigir qualquer fase com "Marcar".' + viewNote);
  } catch (error) {
    console.error(error); status('A análise não ficou disponível. Verifique a internet e tente novamente.');
    if (token === generation) await seekTo(keep);
  } finally { prog.hidden = true; busy = false; controls(); phaseUI(); update(); }
};

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
  if (report.view === 'down-the-line') host.append(el('p', 'legend', 'No vídeo: verde = mãos no backswing, laranja = mãos na descida.'));
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
}
$('view').onchange = () => { $('compare').value = ''; $('comparison').textContent = ''; if (clip) refreshReport(); };

// ---------- session / history ----------
function session() {
  const path = clip ? clip.frames.map(f => { const a = f.lm[15], b = f.lm[16]; return [+f.t.toFixed(3), +((a.x + b.x) / 2).toFixed(3), +((a.y + b.y) / 2).toFixed(3)]; }) : null;
  return { id: globalThis.crypto.randomUUID(), date: new Date().toISOString(), filename: $('filename').textContent, view: $('view').value, fps: Number($('fps').value),
    marks: { ...marks }, lines: structuredClone(lines), samples: structuredClone(samples), report: report ? structuredClone(report) : null, handPath: path, notes: $('notes').value,
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
let lines = [], draft = null, drawing = false, pointer = null, dragEnd = null;
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
  if (drawing) { video.pause(); status('Arraste sobre o vídeo para desenhar uma linha; arraste uma ponta para a ajustar.'); }
};
lineCanvas.onpointerdown = e => {
  if (!loaded || !drawing || pointer !== null || e.button !== 0) return;
  e.preventDefault(); video.pause(); pointer = e.pointerId; lineCanvas.setPointerCapture(pointer);
  dragEnd = hitEnd(e);
  if (!dragEnd) { const a = locationOnVideo(e); draft = { a, b: { ...a }, color: $('line-color').value }; }
  drawLines();
};
lineCanvas.onpointermove = e => {
  if (e.pointerId !== pointer) return;
  if (dragEnd) { const l = lines[dragEnd.i], other = l[dragEnd.k === 'a' ? 'b' : 'a']; l[dragEnd.k] = constrain(locationOnVideo(e), other, e); drawLines(); return; }
  if (draft) { draft.b = constrain(locationOnVideo(e), draft.a, e); drawLines(); }
};
lineCanvas.onpointerup = e => {
  if (e.pointerId !== pointer) return;
  if (draft) { draft.b = constrain(locationOnVideo(e), draft.a, e); if (Math.hypot((draft.b.x - draft.a.x) * lineCanvas.width, (draft.b.y - draft.a.y) * lineCanvas.height) >= 3 * cssScale(lineCanvas)) lines.push(draft); }
  cancelLine();
};
lineCanvas.onpointercancel = cancelLine;
lineCanvas.onlostpointercapture = () => { draft = null; dragEnd = null; pointer = null; drawLines(); };
$('undo-line').onclick = () => { cancelLine(); lines.pop(); drawLines(); };
$('clear-lines').onclick = () => { lines = []; cancelLine(); };
window.addEventListener('keydown', e => { if (e.key === 'Escape') cancelLine(); });

phaseUI(); historyUI();
