// GPF Swing Lab — putting: putter head and ball tracking + stroke report. Pure functions.
//
// Tracking: the player taps the putter head (and the ball) on the address frame; each is then
// followed frame to frame by template matching (normalised cross-correlation) on grayscale
// frames, searching around the position predicted from the last velocity. A putting stroke
// is slow, so this works at 30–60 fps; the template is refreshed slowly to follow the head
// as it turns. The ball's diameter (42.67 mm) gives the scale in cm.
//
// Report (TrackMan putting definitions): tempo = backswing time ÷ forward swing time (to
// impact); stroke length back and through; speed at impact (accelerating or not); face-on:
// rise of the head and attack angle; overhead: putter path at impact, arc, and the ball's
// start line. Face angle cannot be seen at these resolutions.

export const BALL_MM = 42.67;

// ---------- tracking ----------

function patch(g, gw, gh, cx, cy, r) {
  const n = (2 * r + 1) ** 2, out = new Float32Array(n);
  let k = 0, sum = 0;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const xi = Math.min(gw - 1, Math.max(0, x)), yi = Math.min(gh - 1, Math.max(0, y));
    const v = g[yi * gw + xi]; out[k++] = v; sum += v;
  }
  const m = sum / n; let ss = 0;
  for (let i = 0; i < n; i++) { out[i] -= m; ss += out[i] * out[i]; }
  return { d: out, norm: Math.sqrt(ss) || 1 };
}
function ncc(g, gw, gh, T, r, cx, cy) {
  if (cx - r < 0 || cy - r < 0 || cx + r >= gw || cy + r >= gh) return -1;
  let sum = 0, sum2 = 0, cross = 0, k = 0;
  const n = T.d.length;
  for (let y = cy - r; y <= cy + r; y++) {
    let i = y * gw + cx - r;
    for (let x = -r; x <= r; x++, i++, k++) { const v = g[i]; sum += v; sum2 += v * v; cross += v * T.d[k]; }
  }
  const varI = sum2 - sum * sum / n;
  return varI > 1e-6 ? cross / (Math.sqrt(varI) * T.norm) : -1;
}

// Stateful tracker: createTracker(g0, gw, gh, x, y, r) → { step(g) → {x, y, score, ok} }.
export function createTracker(g0, gw, gh, x0, y0, r, opts = {}) {
  const minScore = opts.minScore ?? 0.5, adapt = opts.adapt ?? 0.12;
  let T = patch(g0, gw, gh, Math.round(x0), Math.round(y0), r);
  const T0 = { d: T.d.slice(), norm: T.norm };
  let x = x0, y = y0, vx = 0, vy = 0, lost = 0;
  return {
    get pos() { return { x, y }; },
    step(g) {
      const px = Math.round(x + vx), py = Math.round(y + vy);
      const R = Math.min(opts.maxSearch ?? 60, Math.round(Math.max(opts.search ?? 10, 1.6 * Math.hypot(vx, vy) + 6)) + lost * 6);
      let best = { s: -2, x: px, y: py };
      for (let yy = py - R; yy <= py + R; yy += 2) for (let xx = px - R; xx <= px + R; xx += 2) {
        const s = ncc(g, gw, gh, T, r, xx, yy); if (s > best.s) best = { s, x: xx, y: yy };
      }
      for (let yy = best.y - 1; yy <= best.y + 1; yy++) for (let xx = best.x - 1; xx <= best.x + 1; xx++) {
        const s = ncc(g, gw, gh, T, r, xx, yy); if (s > best.s) best = { s, x: xx, y: yy };
      }
      // the original template too: stops slow drift of the refreshed one
      const s0 = ncc(g, gw, gh, T0, r, best.x, best.y);
      const score = Math.max(best.s, s0);
      if (score < minScore) { lost++; x += vx; y += vy; return { x, y, score, ok: false }; }
      // sub-pixel: parabola through the scores either side
      const sub = (a, b, c) => { const d = a - 2 * b + c; return d < 0 ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * d))) : 0; };
      const sx = sub(ncc(g, gw, gh, T, r, best.x - 1, best.y), best.s, ncc(g, gw, gh, T, r, best.x + 1, best.y));
      const sy = sub(ncc(g, gw, gh, T, r, best.x, best.y - 1), best.s, ncc(g, gw, gh, T, r, best.x, best.y + 1));
      const nx = best.x + sx, ny = best.y + sy;
      vx = 0.6 * (nx - x) + 0.4 * vx; vy = 0.6 * (ny - y) + 0.4 * vy; x = nx; y = ny; lost = 0;
      if (best.s > 0.75 && adapt > 0) { // refresh slowly
        const P = patch(g, gw, gh, best.x, best.y, r); let ss = 0;
        for (let i = 0; i < T.d.length; i++) { T.d[i] = (1 - adapt) * T.d[i] + adapt * P.d[i]; ss += T.d[i] * T.d[i]; }
        T.norm = Math.sqrt(ss) || 1;
      }
      return { x, y, score, ok: true };
    },
  };
}

// Ball radius (px) around a tapped point: on rays from the centre, the strongest drop in
// brightness (white ball → darker grass); median over the rays. null if unclear.
export function ballRadius(g, gw, gh, cx, cy, maxR) {
  const at = (x, y) => { const xi = Math.round(x), yi = Math.round(y); return xi < 0 || yi < 0 || xi >= gw || yi >= gh ? NaN : g[yi * gw + xi]; };
  // the tap may be a little off: start from the brightest pixel nearby
  let vmax = -1;
  const q = Math.max(2, Math.round(maxR / 3));
  for (let y = cy - q; y <= cy + q; y++) for (let x = cx - q; x <= cx + q; x++) { const v = at(x, y); if (v > vmax) vmax = v; }
  let sx = 0, sy = 0, n = 0; // centre of the bright blob
  for (let y = cy - 2 * q; y <= cy + 2 * q; y++) for (let x = cx - 2 * q; x <= cx + 2 * q; x++) if (at(x, y) >= vmax - 25) { sx += x; sy += y; n++; }
  const c = n ? { x: sx / n, y: sy / n } : { x: cx, y: cy };
  const rs = [];
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
    let best = null;
    for (let r = 2; r <= maxR; r++) { const d = at(c.x + ux * (r - 1), c.y + uy * (r - 1)) - at(c.x + ux * (r + 1), c.y + uy * (r + 1)); if (Number.isFinite(d) && (!best || d > best.d)) best = { r, d }; }
    if (best && best.d > 12) rs.push(best.r);
  }
  if (rs.length < 8) return null;
  rs.sort((a, b) => a - b);
  return { r: rs[rs.length >> 1], x: c.x, y: c.y };
}

// ---------- report ----------

const SRC = {
  tmTempo: { label: 'TrackMan — Tempo (putting)', url: 'https://support.trackmangolf.com/hc/en-us/articles/39762233521691-Parameters-Tempo-Putting' },
  blast: { label: 'Blast Motion — tempo', url: 'https://blastmotion.com/blog/what-is-golf-swing-tempo-ratio/' },
  face: { label: 'GolfWRX — face vs path (SAM PuttLab)', url: 'https://golfwrx.com/210133/rethink-how-you-practice-your-putting/' },
  tmPath: { label: 'TrackMan — Club Path', url: 'https://support.trackmangolf.com/hc/en-us/articles/39724275421211-Parameters-Club-Path-Tee-to-Green' },
  tmAttack: { label: 'TrackMan — Attack Angle', url: 'https://trackman.com/blog/golf/attack-angle' },
  golfcom: { label: 'GOLF.com — stroke length', url: 'https://golf.com/instruction/putting/data-reveals-optimal-stroke-length-make-putts/' },
};

function slope(xs, ys) {
  const n = xs.length; if (n < 2) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return sxx ? sxy / sxx : NaN;
}
const unit = v => { const n = Math.hypot(v.x, v.y) || 1; return { x: v.x / n, y: v.y / n }; };
const dot = (a, b) => a.x * b.x + a.y * b.y;

// head: [{t, x, y, ok}] (video time, video px); ball: same or null; view: 'face-on' | 'overhead';
// lefty: bool; line: {a, b} target line in px or null; cmPerPx or null; slow: slow-motion factor;
// minPx: smallest backstroke worth reporting (px).
export function analyzePutt({ head, ball, view, lefty, line, cmPerPx, slow = 1, minPx = 8 }) {
  // keep the measured part (stop at the first long gap), real time, light smoothing
  let pts = [];
  for (let i = 0; i < head.length; i++) {
    const p = head[i];
    if (p.ok) pts.push({ t: p.t / slow, vt: p.t, x: p.x, y: p.y });
    else if (pts.length > 5 && head.slice(i, i + 4).every(q => !q.ok)) break;
  }
  if (pts.length < 8) return { error: 'O putter perdeu-se logo no início. Toque no centro da cabeça do putter num frame parado (address), com boa luz.' };
  pts = pts.map((p, i) => { if (i === 0 || i === pts.length - 1) return p; const a = pts[i - 1], c = pts[i + 1]; return { ...p, x: (a.x + p.x + c.x) / 3, y: (a.y + p.y + c.y) / 3 }; });
  const p0 = { x: (pts[0].x + pts[1].x + pts[2].x) / 3, y: (pts[0].y + pts[1].y + pts[2].y) / 3 };

  // stroke direction: principal axis of the movement; the first big excursion is the backstroke
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) { const dx = p.x - p0.x, dy = p.y - p0.y; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let e = { x: Math.cos(th), y: Math.sin(th) };
  const se = pts.map(p => dot({ x: p.x - p0.x, y: p.y - p0.y }, e));
  // backstroke = the lowest point before the furthest forward point; pick the orientation
  // that gives the longer backstroke (the flipped one finds only the address before it)
  const backOf = sg => { let iMx = 0; se.forEach((v, i) => { if (sg * v > sg * se[iMx]) iMx = i; }); let m = 0; for (let i = 0; i <= iMx; i++) m = Math.max(m, -sg * se[i]); return m; };
  const bPos = backOf(1), bNeg = backOf(-1);
  if (Math.max(bPos, bNeg) < minPx) return { error: 'Não detetei o movimento do putter. Confirme o toque na cabeça do putter e que o vídeo inclui o putt.' };
  if (bNeg > bPos) e = { x: -e.x, y: -e.y };

  // ball: did it move, and where to
  let ballMove = null;
  if (ball && ball.length > 3) {
    const b0 = ball[0], R = ball.r || 4;
    const iB = ball.findIndex(b => b.ok && Math.hypot(b.x - b0.x, b.y - b0.y) > Math.max(1.5, 0.6 * R));
    if (iB > 0) {
      const after = ball.slice(iB).filter(b => b.ok && b.t / slow - ball[iB].t / slow <= 0.35).slice(0, 10);
      ballMove = { t: (ball[iB - 1].t + ball[iB].t) / 2 / slow, pts: after };
      const bd = after.length >= 2 ? unit({ x: after[after.length - 1].x - b0.x, y: after[after.length - 1].y - b0.y }) : null;
      if (bd && dot(bd, e) < 0) e = { x: -e.x, y: -e.y }; // the ball rolls towards the target
      ballMove.dir = bd;
    }
  }

  // target line
  let T;
  if (line) { T = unit({ x: line.b.x - line.a.x, y: line.b.y - line.a.y }); if (dot(T, e) < 0) T = { x: -T.x, y: -T.y }; }
  else if (view === 'overhead') T = Math.abs(e.x) >= Math.abs(e.y) ? { x: Math.sign(e.x), y: 0 } : { x: 0, y: Math.sign(e.y) };
  else T = { x: Math.sign(e.x) || 1, y: 0 };
  const right = { x: -T.y, y: T.x }; // right of the target line, looking at the target (image y points down)
  const out = lefty ? { x: -right.x, y: -right.y } : right; // away from the golfer (right-handed: to the right)
  let up = { x: T.y, y: -T.x }; if (up.y > 0) up = { x: -up.x, y: -up.y };

  const s = pts.map(p => dot({ x: p.x - p0.x, y: p.y - p0.y }, T));
  const lat = pts.map(p => dot({ x: p.x - p0.x, y: p.y - p0.y }, view === 'overhead' ? out : up));
  const t = pts.map(p => p.t);

  let iFwd = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[iFwd]) iFwd = i;
  let iTop = 0; for (let i = 1; i <= iFwd; i++) if (s[i] < s[iTop]) iTop = i;
  const back = -s[iTop];
  if (back < minPx) return { error: 'Não detetei o backswing do putter.' };
  let iStart = 0; for (let i = iTop; i >= 0; i--) if (s[i] >= -Math.max(1, 0.02 * back)) { iStart = i; break; }
  // impact: the ball starts moving; otherwise the putter back at its address position
  let tImp = null, impBy = 'putter';
  for (let i = iTop + 1; i < s.length; i++) if (s[i] >= 0) { tImp = t[i - 1] + (0 - s[i - 1]) / ((s[i] - s[i - 1]) || 1) * (t[i] - t[i - 1]); break; }
  if (ballMove && ballMove.t > t[iTop] && (tImp == null || Math.abs(ballMove.t - tImp) < 0.12)) { tImp = ballMove.t; impBy = 'bola'; }
  if (tImp == null) return { error: 'O vídeo termina antes do impacto (o putter não volta à bola).' };
  let iImp = t.findIndex(x => x >= tImp); if (iImp < 0) iImp = t.length - 1;
  let iFin = iImp; for (let i = iImp; i < s.length && t[i] - tImp <= 1.5; i++) if (s[i] > s[iFin]) iFin = i;
  const through = s[iFin];
  for (let i = iImp; i < iFin; i++) if (s[i] >= 0.98 * through) { iFin = i; break; } // first moment at the end of the stroke

  // speed along the line (px per real second), central differences
  const v = s.map((_, i) => { const a = Math.max(0, i - 1), b = Math.min(s.length - 1, i + 1); return (s[b] - s[a]) / ((t[b] - t[a]) || 1); });
  let iPeak = iTop; for (let i = iTop; i <= iFin; i++) if (v[i] > v[iPeak]) iPeak = i;
  const lerp = (arr, tt) => { const i = t.findIndex(x => x >= tt); if (i <= 0) return arr[Math.max(0, i)]; const k = (tt - t[i - 1]) / ((t[i] - t[i - 1]) || 1); return arr[i - 1] + k * (arr[i] - arr[i - 1]); };
  const vImp = lerp(v, tImp), dtFrame = (t[t.length - 1] - t[0]) / (t.length - 1);

  const len = px => cmPerPx ? `${(px * cmPerPx).toFixed(1)} cm` : `${Math.round(px)} px`;
  const speed = pxs => cmPerPx ? `${(pxs * cmPerPx / 100).toFixed(2)} m/s` : `${Math.round(pxs)} px/s`;
  const findings = [];
  const add = (label, value, flag, text, src) => findings.push({ label, value, flag, text, sources: (src || []).map(k => SRC[k]) });

  const tBack = t[iTop] - t[iStart], tFwd = tImp - t[iTop], ratio = tBack / tFwd;
  add('Tempo (backswing ÷ forward swing)', `${ratio.toFixed(1)} : 1`, !(ratio >= 1.8 && ratio <= 2.2),
    ratio < 1.8 ? 'Forward swing lento face ao backswing (ou backswing apressado). Os jogadores do Tour ficam perto de 2 : 1 em todos os putts.'
      : ratio > 2.2 ? 'Forward swing rápido face ao backswing — muitas vezes um "golpe" na bola. Os jogadores do Tour ficam perto de 2 : 1.'
        : 'Dentro da faixa do Tour (cerca de 2 : 1). O importante é repetir o mesmo tempo em todos os comprimentos.', ['tmTempo', 'blast']);
  add('Duração backswing / forward swing', `${(tBack * 1000).toFixed(0)} / ${(tFwd * 1000).toFixed(0)} ms`, false,
    `Total até ao impacto ${((tBack + tFwd) * 1000).toFixed(0)} ms. Referência do Tour: cerca de 600 ms para trás e 300 ms até à bola.${dtFrame > 1 / 50 ? ' A 30 fps cada frame vale ~33 ms: o tempo é aproximado.' : ''}`, ['blast']);
  add('Comprimento para trás / para a frente', `${len(back)} / ${len(through)}`, false,
    `Follow-through = ${Math.round(through / back * 100)} % do backswing. Há escolas com proporções diferentes; o essencial é a mesma proporção em todos os putts e controlar a distância pelo comprimento, não pela força.${cmPerPx ? '' : ' Toque também na bola para medir em cm.'}`, ['golfcom']);
  const decel = iPeak < iImp - 1 && t[iPeak] < tImp - 1.5 * dtFrame && vImp < 0.88 * v[iPeak];
  add('Velocidade no impacto', speed(vImp), decel,
    decel ? `Desacelera antes da bola: a velocidade máxima foi ${Math.round((tImp - t[iPeak]) * 1000)} ms antes do impacto (${Math.round(vImp / v[iPeak] * 100)} % do máximo). Backswing mais curto e acelerar até à bola.`
      : 'Velocidade máxima no impacto ou logo depois — o putter não trava antes da bola.', ['tmTempo']);

  const res = { view, impactBy: impBy, findings, times: { start: pts[iStart].vt, top: pts[iTop].vt, impact: tImp * slow, finish: pts[iFin].vt }, target: T, p0 };

  // near impact: last ~25 % of the downswing to the first ~25 % of the follow-through
  const near = pts.map((p, i) => i).filter(i => i > iTop && t[i] <= tImp + 0.08 && s[i] >= -0.3 * back && s[i] <= 0.3 * Math.max(back, through));
  if (view === 'overhead') {
    if (near.length >= 3) {
      const a = Math.atan(slope(near.map(i => s[i]), near.map(i => lat[i]))) * 180 / Math.PI;
      add('Caminho do putter no impacto', `${a > 0 ? '+' : ''}${a.toFixed(1)}°`, false,
        `${Math.abs(a) < 1.5 ? 'Praticamente neutro' : a > 0 ? 'De dentro para fora (in-to-out)' : 'De fora para dentro (out-to-in)'}, em relação à linha do alvo. No putt o caminho pesa pouco na direção de saída — a face decide cerca de 83 %.`, ['tmPath', 'face']);
      res.path = a;
    }
    const arc = -lat[iTop];
    add('Arco no backswing', `${len(Math.abs(arc))} ${arc >= 0 ? 'para dentro' : 'para fora'}`, arc < -0.06 * back,
      arc < -0.06 * back ? 'O putter sai para fora da linha no backswing — tende a voltar de fora para dentro.' : 'Um ligeiro arco para dentro é normal num putter com lie angle.', null);
    if (ballMove?.dir) {
      let a = Math.atan2(dot(ballMove.dir, right), dot(ballMove.dir, T)) * 180 / Math.PI;
      add('Direção de saída da bola', `${Math.abs(a).toFixed(1)}° ${Math.abs(a) < 0.3 ? '' : a > 0 ? 'à direita' : 'à esquerda'}`.trim(), Math.abs(a) > 1.5,
        `${Math.abs(a) <= 0.7 ? 'Em linha.' : 'Fora da linha do alvo.'} Num putt direito de ~3,5 m a margem é de menos de 1°. A saída depende sobretudo da face no impacto (~83 %), não do caminho.${line ? '' : ' Linha do alvo assumida paralela ao lado do vídeo — desenhe-a com ✎ Linhas para a definir.'}`, ['face']);
      res.start = a;
    }
  } else {
    const lift = Math.max(...lat.slice(iStart, iTop + 1));
    add('Subida da cabeça do putter no backswing', len(lift), lift > 0.25 * back,
      lift > 0.25 * back ? 'O putter sobe bastante no backswing — tende a bater de cima para baixo ou a fazer a bola saltar.' : 'Putter baixo e junto à relva no backswing.', null);
    if (near.length >= 3) {
      const a = Math.atan(slope(near.map(i => s[i]), near.map(i => lat[i]))) * 180 / Math.PI;
      add('Ângulo de ataque no impacto', `${a > 0 ? '+' : ''}${a.toFixed(1)}°`, a < -1,
        a < -1 ? 'A descer na bola — favorece saltos e menos rolamento.' : a > 5 ? 'A subir muito — confirme a posição da bola (demasiado à frente?).' : 'A subir ligeiramente ou a direito: bom para pôr a bola a rolar.', ['tmAttack']);
      res.attack = a;
    }
  }
  if (ballMove && ball) {
    const okb = ball.filter(b => b.ok), last = okb[okb.length - 1], d = Math.hypot(last.x - ball[0].x, last.y - ball[0].y);
    add('Rolamento seguido', cmPerPx ? `${(d * cmPerPx / 100).toFixed(2)} m` : `${Math.round(d)} px`, false,
      ball.stopped ? 'A bola parou dentro do enquadramento.' : 'A bola saiu do enquadramento ou perdeu-se — distância parcial.', null);
    res.roll = { px: d, stopped: !!ball.stopped };
  }
  res.note = 'Seguimento por imagem (template matching) do putter e da bola em 2D. A face do putter não é medida. Para caminho, arco e direção de saída filme de cima (câmara por cima da bola, a apontar para baixo); para tempo, comprimento e ataque filme de frente, à altura da bola.';
  res.track = pts.map(p => ({ t: p.vt, x: p.x, y: p.y }));
  return res;
}
