/* GPF in-app camera — shared by Swing Lab (/swing/camera.js) and the Shot Tracer (inlined into
   public/tracer/index.html by scripts/sync-tracer-camera.mjs, because tracer.gpf.golf serves only
   its single page). Edit this file, then run `node scripts/sync-tracer-camera.mjs`.

   GPFCam.open({ tool, view, audio, live, onVideo })
     view     'down-the-line' (por trás) | 'face-on' (de frente) — the player picks it on camera
     audio    record sound (the tracer needs it: the live trace fires on the impact sound)
     live     optional real-time tracer: { draw(ctx, W, H, t, ball, land, view), duration() }
     liveOn   start with the live trace on (true) or off (false); default: last choice
     onVideo  (file, info) → the clip goes into the tool; info = { view, lefty, impact, ball, land }
   Everything stays in the browser: nothing is uploaded. */
(function () {
  if (window.GPFCam) return;
  const SIL = {"face": "<circle cx=\"146\" cy=\"66\" r=\"25\"/> <path d=\"M140 92 h14 v16 h-14z\"/> <path d=\"M104 112 Q150 98 196 112 L188 168 Q184 210 180 240 L120 240 Q116 210 112 168 Z\"/> <path d=\"M122 238 L178 238 L184 262 L116 262 Z\"/> <path d=\"M112 118 L150 262\" stroke-width=\"22\"/> <path d=\"M188 118 L162 262\" stroke-width=\"22\"/> <path d=\"M132 250 L116 338 L106 432\" stroke-width=\"30\"/> <path d=\"M168 250 L184 338 L194 432\" stroke-width=\"30\"/> <path d=\"M84 444 h30\" stroke-width=\"16\"/><path d=\"M186 444 h30\" stroke-width=\"16\"/> <circle cx=\"156\" cy=\"268\" r=\"13\"/> <path d=\"M156 270 L158 436\" stroke-width=\"5\"/> <path d=\"M146 438 h24\" stroke-width=\"9\"/>", "dtl": "<circle cx=\"200\" cy=\"96\" r=\"25\"/> <path d=\"M178 112 l14 14 -12 10 -12 -12z\"/> <path d=\"M150 112 Q178 108 192 132 L158 214 Q140 254 124 262 L78 262 Q70 236 84 210 Z\"/> <path d=\"M104 250 L142 338\" stroke-width=\"40\"/> <path d=\"M142 338 L130 432\" stroke-width=\"28\"/> <path d=\"M112 444 h48\" stroke-width=\"16\"/> <path d=\"M172 136 L180 262\" stroke-width=\"22\"/> <circle cx=\"182\" cy=\"268\" r=\"13\"/> <path d=\"M184 272 L238 434\" stroke-width=\"5\"/> <path d=\"M230 438 h20\" stroke-width=\"9\"/>"};
  const SIL_BALL = { 'face-on': [160, 444], 'down-the-line': [246, 444] };
  const LS = 'gpf.cam';
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem(LS, JSON.stringify(prefs)); } catch (e) {} };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const CSS = `
.gcam{position:fixed;inset:0;z-index:1000;background:#000;color:#fff;display:flex;flex-direction:column;font:14px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}
.gcam [hidden]{display:none !important}
.gcam button{font:inherit;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:8px 13px;min-height:38px;cursor:pointer;white-space:nowrap;touch-action:manipulation;filter:none;opacity:1}
.gcam button:disabled{opacity:.4}
.gcam button.on{background:#fff;color:#111;border-color:#fff}
.gcam .gc-top{display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top)) 12px 10px;flex-wrap:wrap}
.gcam .gc-x{width:40px;padding:0;font-size:20px;line-height:1}
.gcam .gc-seg{display:flex;background:rgba(255,255,255,.14);border-radius:999px;padding:3px;gap:2px}
.gcam .gc-seg button{background:none;border:0;min-height:32px;padding:6px 13px}
.gcam .gc-seg button.on{background:#fff;color:#111}
.gcam .gc-sp{flex:1}
.gcam .gc-chips{display:flex;gap:8px}
.gcam .gc-stage{position:relative;flex:1;min-height:0;overflow:hidden}
.gcam video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}
.gcam .gc-sil{position:absolute;pointer-events:none;transition:opacity .2s}
.gcam .gc-sil.mir{transform:scaleX(-1)}
.gcam canvas{position:absolute;touch-action:none}
.gcam .gc-msg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:30px;text-align:center;color:#ddd}
.gcam .gc-msg b{font-size:17px;color:#fff}
.gcam .gc-rec{position:absolute;top:10px;left:50%;transform:translateX(-50%);background:#d4442f;color:#fff;border-radius:999px;padding:3px 10px;font:600 12px ui-monospace,"SF Mono",Menlo,monospace;font-variant-numeric:tabular-nums}
.gcam .gc-bot{padding:10px 14px calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px;align-items:center}
.gcam .gc-hint{font-size:12.5px;color:#cfcfd4;text-align:center;max-width:560px}
.gcam .gc-row{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;flex-wrap:wrap}
.gcam .gc-shut{width:70px;height:70px;min-height:70px;padding:0;border-radius:50%;border:4px solid #fff;background:transparent;display:grid;place-items:center}
.gcam .gc-shut i{display:block;width:54px;height:54px;border-radius:50%;background:#d4442f;transition:all .15s}
.gcam .gc-shut.rec i{width:26px;height:26px;border-radius:6px}
.gcam .gc-side{flex:1;display:flex;gap:8px;align-items:center}
.gcam .gc-side.r{justify-content:flex-end}
.gcam .gc-fire{background:#ffdf45;color:#111;border-color:#ffdf45;font-weight:650}
.gcam .gc-meter{width:46px;height:6px;border-radius:3px;background:rgba(255,255,255,.2);overflow:hidden}
.gcam .gc-meter i{display:block;height:100%;width:0;background:#30d158}
.gcam .gc-res{position:absolute;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px}
.gcam .gc-res video{position:static;max-height:calc(100% - 120px);width:auto;max-width:100%;border-radius:10px}
.gcam .gc-res .gc-row button.pri{background:#fff;color:#111;font-weight:650}
@media (max-width:640px){.gcam .gc-top{gap:6px;padding-left:8px;padding-right:8px}.gcam .gc-chips{order:5;width:100%;justify-content:center}.gcam .gc-x,.gcam .gc-flip{width:38px;padding:0}.gcam .gc-top button{padding:7px 10px;font-size:13px}.gcam .gc-seg button{padding:6px 10px}}
`;

  function pickMime(list) {
    if (!window.MediaRecorder) return null;
    return list.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
  }
  const MIMES = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };

  function open(opts) {
    opts = opts || {};
    if (!document.getElementById('gcam-css')) { const st = el('style'); st.id = 'gcam-css'; st.textContent = CSS; document.head.appendChild(st); }
    const live = opts.live || null;
    let view = opts.view || prefs.view || 'down-the-line';
    let lefty = !!prefs.lefty, showSil = prefs.sil !== false, liveOn = live ? (opts.liveOn != null ? !!opts.liveOn : prefs.live !== false) : false;
    let sens = prefs.sens || 'med';                   // impact-sound sensitivity
    let facing = 'environment', stream = null, closed = false;
    let ball = null, land = null, ballSet = false, landSet = false;
    let trig = null, recStart = 0, impacts = [], rawRec = null, compRec = null, recording = false;
    let actx = null, analyser = null, abuf = null, noise = 0.01, armedAt = 0, level = 0;
    if (live && opts.audio !== false) {
      // Created inside the tap that opened the camera, so iOS lets it run.
      try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); } catch (e) { actx = null; }
    }

    // ---------- DOM ----------
    const root = el('div', 'gcam'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Câmara');
    const top = el('div', 'gc-top');
    const bX = el('button', 'gc-x', '×'); bX.setAttribute('aria-label', 'Fechar câmara');
    const seg = el('div', 'gc-seg');
    const bBack = el('button', '', 'Por trás'), bFront = el('button', '', 'De frente');
    seg.append(bBack, bFront);
    const bLefty = el('button', '', 'Canhoto'), bSil = el('button', '', 'Silhueta'), bFlip = el('button', 'gc-flip', '⟲'); bFlip.setAttribute('aria-label', 'Trocar de câmara');
    const chips = el('div', 'gc-chips'); chips.append(bLefty, bSil);
    top.append(bX, seg, el('span', 'gc-sp'), chips, bFlip);
    const stage = el('div', 'gc-stage');
    const video = el('video'); video.playsInline = true; video.muted = true; video.autoplay = true; video.setAttribute('playsinline', '');
    const sil = el('div', 'gc-sil');
    const cv = el('canvas'), cx = cv.getContext('2d');
    const recTag = el('div', 'gc-rec'); recTag.hidden = true;
    const msg = el('div', 'gc-msg', '<b>A abrir a câmara…</b>');
    stage.append(video, sil, cv, recTag, msg);
    const bot = el('div', 'gc-bot');
    const hint = el('div', 'gc-hint');
    const row = el('div', 'gc-row');
    const left = el('div', 'gc-side'), right = el('div', 'gc-side r');
    const shut = el('button', 'gc-shut', '<i></i>'); shut.setAttribute('aria-label', 'Gravar'); shut.disabled = true;
    const bLive = el('button', '', 'Traço ao vivo'), bSens = el('button'), bFire = el('button', 'gc-fire', 'Disparar');
    const meter = el('div', 'gc-meter', '<i></i>');
    if (live) { left.append(bLive, bSens); right.append(meter, bFire); }
    row.append(left, shut, right);
    bot.append(hint, row);
    root.append(top, stage, bot);
    document.body.appendChild(root);
    document.documentElement.style.overflow = 'hidden';

    // ---------- geometry ----------
    let R = { l: 0, t: 0, w: 0, h: 0 }, S = null, dpr = 1;
    function contentRect() {
      const sw = stage.clientWidth, sh = stage.clientHeight, vw = video.videoWidth || 16, vh = video.videoHeight || 9;
      const s = Math.min(sw / vw, sh / vh), w = vw * s, h = vh * s;
      return { l: (sw - w) / 2, t: (sh - h) / 2, w, h };
    }
    function silRect() {
      const h = R.h * 0.8, w = h * 0.6;
      const top = R.h * 0.92 - h * (452 / 500);
      let l = view === 'face-on' ? R.w / 2 - w / 2 : R.w * 0.5 - w * 0.62;
      if (lefty) l = R.w - l - w;
      return { l, t: top, w, h };
    }
    function defaults() {
      const s = silRect(), [bx, by] = SIL_BALL[view];
      const x = s.l + (lefty ? 300 - bx : bx) / 300 * s.w, y = s.t + by / 500 * s.h;
      if (!ballSet) ball = { x: clamp(x / R.w, 0.02, 0.98), y: clamp(y / R.h, 0.02, 0.98) };
      if (!landSet) land = view === 'face-on'
        ? { x: lefty ? 0.04 : 0.96, y: clamp(ball.y - 0.14, 0.05, 0.95) }
        : { x: clamp(0.5 + (ball.x - 0.5) * 0.35, 0.05, 0.95), y: 0.34 };
    }
    function layout() {
      R = contentRect(); dpr = window.devicePixelRatio || 1;
      Object.assign(cv.style, { left: R.l + 'px', top: R.t + 'px', width: R.w + 'px', height: R.h + 'px' });
      cv.width = Math.round(R.w * dpr); cv.height = Math.round(R.h * dpr);
      S = silRect();
      Object.assign(sil.style, { left: R.l + S.l + 'px', top: R.t + S.t + 'px', width: S.w + 'px', height: S.h + 'px' });
      defaults();
    }
    function drawSil() {
      const [bx, by] = SIL_BALL[view];
      sil.innerHTML = `<svg viewBox="0 0 300 500" width="100%" height="100%" aria-hidden="true"><g opacity=".5" fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">${SIL[view === 'face-on' ? 'face' : 'dtl']}</g>`
        + `<path d="M8 452 H292" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-dasharray="6 6"/>`
        + (live && liveOn ? '' : `<circle cx="${bx}" cy="${by}" r="7" fill="none" stroke="#ffdf45" stroke-width="2.5"/>`) + `</svg>`;
      sil.classList.toggle('mir', lefty);
    }
    function sync() {
      bBack.classList.toggle('on', view === 'down-the-line'); bFront.classList.toggle('on', view === 'face-on');
      bLefty.classList.toggle('on', lefty); bSil.classList.toggle('on', showSil);
      sil.style.opacity = showSil ? (recording ? '.35' : '1') : '0';
      bLive.classList.toggle('on', liveOn);
      bSens.textContent = 'Som: ' + ({ low: 'baixo', med: 'médio', high: 'alto' })[sens];
      bSens.hidden = bFire.hidden = meter.hidden = !liveOn;
      hint.textContent = live && liveOn
        ? 'Arraste Bola e Queda para o sítio certo. O traço dispara com o som do impacto, ou toque em Disparar.'
        : (view === 'face-on' ? 'De frente: câmara à altura das mãos, apontada ao peito do jogador. Alinhe o jogador com a silhueta.'
                              : 'Por trás: câmara à altura das mãos, alinhada com a linha do alvo. Alinhe o jogador com a silhueta.');
      drawSil();
    }
    const setPref = (k, v) => { prefs[k] = v; savePrefs(); };
    bBack.onclick = () => { view = 'down-the-line'; setPref('view', view); ballSet = landSet = false; layout(); sync(); };
    bFront.onclick = () => { view = 'face-on'; setPref('view', view); ballSet = landSet = false; layout(); sync(); };
    bLefty.onclick = () => { lefty = !lefty; setPref('lefty', lefty); ballSet = landSet = false; layout(); sync(); };
    bSil.onclick = () => { showSil = !showSil; setPref('sil', showSil); sync(); };
    bLive.onclick = () => { if (recording) return; liveOn = !liveOn; setPref('live', liveOn); trig = null; sync(); };
    bSens.onclick = () => { sens = ({ low: 'med', med: 'high', high: 'low' })[sens]; setPref('sens', sens); sync(); };
    bFire.onclick = () => fire(performance.now());

    // ---------- live tracer ----------
    function fire(t) {
      if (!liveOn || (trig != null && t - trig < 1000)) return;   // one shot per second (echo, double clicks)
      trig = t;
      if (recording) impacts.push(Math.max(0, (t - recStart) / 1000));
    }
    const THR = { low: 0.5, med: 0.3, high: 0.15 };
    function listen(now) {
      if (!analyser) return;
      analyser.getFloatTimeDomainData(abuf);
      let peak = 0, sum = 0;
      for (let i = 0; i < abuf.length; i++) { const v = Math.abs(abuf[i]); if (v > peak) peak = v; sum += v * v; }
      const rms = Math.sqrt(sum / abuf.length);
      level = Math.max(peak, level * 0.85);
      meter.firstChild.style.width = Math.min(100, level * 160) + '%';
      const spike = peak > THR[sens] && peak > noise * 9;
      if (spike && liveOn && now - armedAt > 1200) fire(now - 25);   // ~25 ms of audio latency
      if (!spike) noise = noise * 0.97 + rms * 0.03;
    }
    // Handles (on screen only, never recorded)
    let drag = null;
    function handle(p, label) {
      const x = p.x * R.w, y = p.y * R.h;
      cx.save(); cx.lineWidth = 2; cx.strokeStyle = '#fff'; cx.fillStyle = 'rgba(0,0,0,.45)';
      cx.beginPath(); cx.arc(x, y, 9, 0, Math.PI * 2); cx.fill(); cx.stroke();
      cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x, y, 2, 0, Math.PI * 2); cx.fill();
      cx.font = '600 11px -apple-system,system-ui,sans-serif';
      const tw = cx.measureText(label).width, bx = clamp(x - tw / 2 - 6, 2, R.w - tw - 14), by = y - 32 < 2 ? y + 14 : y - 30;
      cx.fillStyle = 'rgba(0,0,0,.7)'; cx.beginPath(); cx.roundRect ? cx.roundRect(bx, by, tw + 12, 17, 8.5) : cx.rect(bx, by, tw + 12, 17); cx.fill();
      cx.fillStyle = '#fff'; cx.fillText(label, bx + 6, by + 12.5); cx.restore();
    }
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) }; };
    cv.addEventListener('pointerdown', e => {
      if (!live || !liveOn || !ball) return;
      const m = pos(e), d = p => Math.hypot((p.x - m.x) * R.w, (p.y - m.y) * R.h);
      drag = d(ball) < 34 ? 'ball' : d(land) < 34 ? 'land' : null;
      if (drag) { cv.setPointerCapture(e.pointerId); e.preventDefault(); }
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return; const m = pos(e);
      if (drag === 'ball') { ball = m; ballSet = true; } else { land = m; landSet = true; }
    });
    const end = () => { drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

    // Recorded frame with the trace burned in (only while recording with the live trace on).
    const comp = el('canvas'), cctx = comp.getContext('2d');
    let raf = 0;
    function frame(now) {
      if (closed) return;
      raf = requestAnimationFrame(frame);
      if (live) listen(now);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, R.w, R.h);
      const t = trig != null ? (now - trig) / 1000 : null;
      if (t != null && t > live.duration()) trig = null;
      if (live && liveOn && ball) {
        if (trig != null) live.draw(cx, R.w, R.h, t, ball, land, view);
        else {
          cx.save(); cx.setLineDash([5, 5]); cx.strokeStyle = 'rgba(255,255,255,.6)'; cx.lineWidth = 1.4;
          cx.beginPath(); cx.moveTo(ball.x * R.w, ball.y * R.h); cx.lineTo(land.x * R.w, land.y * R.h); cx.stroke(); cx.restore();
        }
        if (!recording || drag) { handle(ball, 'Bola'); handle(land, 'Queda'); }
      }
      if (compRec && video.videoWidth) {
        cctx.drawImage(video, 0, 0, comp.width, comp.height);
        if (trig != null) live.draw(cctx, comp.width, comp.height, t, ball, land, view);
      }
      if (recording) { const s = (now - recStart) / 1000; recTag.textContent = '● ' + Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
    }

    // ---------- camera ----------
    async function start() {
      stopTracks();
      msg.hidden = false; msg.innerHTML = '<b>A abrir a câmara…</b>';
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return fail('Este navegador não dá acesso à câmara.', 'Use o Safari no iPhone ou o Chrome, num endereço https.');
      const v = { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } };
      const wantAudio = opts.audio !== false && !!(live || opts.audio);
      try { stream = await navigator.mediaDevices.getUserMedia({ video: v, audio: wantAudio }); }
      catch (e) {
        if (wantAudio) { try { stream = await navigator.mediaDevices.getUserMedia({ video: v, audio: false }); } catch (e2) { e = e2; stream = null; } }
        if (!stream) return fail(e && e.name === 'NotAllowedError' ? 'Sem permissão para usar a câmara.' : 'Não foi possível abrir a câmara.',
          e && e.name === 'NotAllowedError' ? 'Autorize a câmara (e o microfone) para este site nas definições do navegador e tente de novo.' : 'Feche outras apps que estejam a usar a câmara e tente de novo.');
      }
      if (closed) { stopTracks(); return; }
      video.srcObject = stream;
      try { await video.play(); } catch (e) {}
      if (actx && stream.getAudioTracks().length) {
        try {
          if (actx.state === 'suspended') await actx.resume();
          const src = actx.createMediaStreamSource(stream);
          analyser = actx.createAnalyser(); analyser.fftSize = 1024; abuf = new Float32Array(analyser.fftSize);
          src.connect(analyser);
        } catch (e) { analyser = null; }
      }
      if (live && !analyser) bSens.disabled = true;
      armedAt = performance.now();
      const ready = () => { msg.hidden = true; shut.disabled = false; layout(); sync(); };
      if (video.videoWidth) ready(); else video.addEventListener('loadedmetadata', ready, { once: true });
    }
    function fail(title, text) {
      msg.hidden = false; shut.disabled = true;
      msg.innerHTML = `<b>${title}</b><span>${text}</span>`;
      if (opts.onPickFile) { const b = el('button', '', 'Escolher um vídeo do telemóvel'); b.onclick = () => { close(); opts.onPickFile(); }; msg.append(b); }
    }
    function stopTracks() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; if (analyser) { try { analyser.disconnect(); } catch (e) {} analyser = null; } }
    bFlip.onclick = () => { if (recording) return; facing = facing === 'environment' ? 'user' : 'environment'; start(); };

    // ---------- recording ----------
    const rec = (s, bits) => {
      const mime = pickMime(MIMES);
      let r; try { r = new MediaRecorder(s, mime ? { mimeType: mime, videoBitsPerSecond: bits } : { videoBitsPerSecond: bits }); } catch (e) { r = new MediaRecorder(s); }
      const chunks = []; r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      r.done = new Promise(res => { r.onstop = () => res(new Blob(chunks, { type: (r.mimeType || mime || 'video/webm').split(';')[0] })); });
      return r;
    };
    function startRec() {
      if (!stream || pickMime(MIMES) === null) { hint.textContent = 'Este navegador não consegue gravar vídeo. Use o Safari (iOS 14.5+) ou o Chrome.'; return; }
      impacts = []; trig = null;
      rawRec = rec(stream, 12e6);
      if (live && liveOn && comp.captureStream) {
        const k = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
        comp.width = Math.round(video.videoWidth * k / 2) * 2; comp.height = Math.round(video.videoHeight * k / 2) * 2;
        try {
          const cs = comp.captureStream(30);
          stream.getAudioTracks().forEach(t => cs.addTrack(t.clone ? t.clone() : t));
          compRec = rec(cs, 8e6);
        } catch (e) { compRec = null; }
      }
      recStart = performance.now(); recording = true;
      rawRec.start(500); if (compRec) { try { compRec.start(500); } catch (e) { compRec = null; } }
      shut.classList.add('rec'); shut.setAttribute('aria-label', 'Parar'); recTag.hidden = false;
      [bX, bBack, bFront, bLefty, bFlip, bLive].forEach(b => b.disabled = true); sync();
    }
    async function stopRec() {
      if (!recording) return;
      recording = false;
      const r1 = rawRec, r2 = compRec; rawRec = compRec = null;
      try { r1.stop(); } catch (e) {} if (r2) { try { r2.stop(); } catch (e) {} }
      shut.classList.remove('rec'); shut.setAttribute('aria-label', 'Gravar'); recTag.hidden = true; shut.disabled = true;
      [bX, bBack, bFront, bLefty, bFlip, bLive].forEach(b => b.disabled = false); sync();
      const raw = await r1.done, burned = r2 ? await r2.done : null;
      shut.disabled = false;
      const ext = b => /mp4/.test(b.type) ? 'mp4' : 'webm';
      const name = `gpf-${opts.tool || 'video'}-${stamp()}`;
      const rawFile = new File([raw], `${name}.${ext(raw)}`, { type: raw.type });
      const info = { view, lefty, impact: impacts.length ? impacts[0] : null, ball: ball && { ...ball }, land: land && { ...land } };
      if (!burned || !burned.size) { close(); opts.onVideo && opts.onVideo(rawFile, info); return; }
      showResult(new File([burned], `${name}-tracer.${ext(burned)}`, { type: burned.type }), rawFile, info);
    }
    shut.onclick = () => { if (recording) stopRec(); else startRec(); };

    function showResult(burned, rawFile, info) {
      const url = URL.createObjectURL(burned);
      const res = el('div', 'gc-res');
      const pv = el('video'); pv.src = url; pv.controls = true; pv.playsInline = true; pv.setAttribute('playsinline', ''); pv.loop = true;
      const txt = el('div', 'gc-hint', info.impact == null ? 'Não foi detetado nenhum impacto: o vídeo não tem traço. Abra-o no editor para o marcar à mão.' : 'Vídeo com o traço ao vivo. Pode guardá-lo já ou afinar o traço no editor.');
      const r = el('div', 'gc-row');
      const bSave = el('button', 'pri', 'Guardar vídeo'), bEdit = el('button', '', 'Afinar no editor'), bAgain = el('button', '', 'Filmar outra');
      bSave.onclick = async () => {
        try { if (navigator.canShare && navigator.canShare({ files: [burned] })) { await navigator.share({ files: [burned], title: 'GPF Shot Tracer' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
        const a = document.createElement('a'); a.href = url; a.download = burned.name; document.body.appendChild(a); a.click(); a.remove();
        txt.textContent = 'Guardado nas Transferências: ' + burned.name;
      };
      bEdit.onclick = () => { URL.revokeObjectURL(url); close(); opts.onVideo && opts.onVideo(rawFile, info); };
      bAgain.onclick = () => { URL.revokeObjectURL(url); res.remove(); trig = null; };
      r.append(bSave, bEdit, bAgain);
      res.append(pv, txt, r); stage.append(res);
      pv.play().catch(() => {});
    }

    // ---------- lifecycle ----------
    function close() {
      if (closed) return; closed = true;
      if (recording) { try { rawRec.stop(); } catch (e) {} if (compRec) { try { compRec.stop(); } catch (e) {} } recording = false; }
      cancelAnimationFrame(raf); stopTracks(); ro.disconnect();
      if (actx) { try { actx.close(); } catch (e) {} }
      document.removeEventListener('visibilitychange', onVis); document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
      root.remove();
    }
    const onVis = () => { if (document.hidden && recording) stopRec(); };
    const onKey = e => { if (e.key === 'Escape' && !recording) close(); else if (e.key === ' ' && !shut.disabled) { e.preventDefault(); shut.click(); } };
    document.addEventListener('visibilitychange', onVis); document.addEventListener('keydown', onKey);
    bX.onclick = close;
    const ro = new ResizeObserver(() => { if (video.videoWidth) layout(); }); ro.observe(stage);
    video.addEventListener('resize', () => layout());     // the phone was rotated
    sync(); start(); raf = requestAnimationFrame(frame);
    return { close };
  }

  window.GPFCam = { open, supported: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) };
})();
