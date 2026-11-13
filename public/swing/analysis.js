// GPF Swing Lab — automatic phases and swing report from a sequence of 2D pose frames.
// Pure functions (no DOM): frames = [{t, lm}] with MediaPipe landmarks normalised 0–1,
// w/h = video size in pixels (angles and distances are computed in pixels).
//
// Everything here is a heuristic on 2D body landmarks. The club and the ball are not
// detected; the "plane" is the path of the hands (wrists), compared between backswing
// and downswing. Thresholds are in torso lengths (shoulder centre → hip centre).

export const PHASES = ['Address', 'Takeaway', 'Topo', 'Downswing', 'Impacto', 'Follow-through'];

const VIS = 0.5, VIS_HAND = 0.3;
const okp = (lm, i, v = VIS) => lm && lm[i] && (lm[i].visibility ?? 1) >= v;
function mid(lm, a, b, w, h, v = VIS) {
  const A = okp(lm, a, v), B = okp(lm, b, v);
  if (A && B) return { x: (lm[a].x + lm[b].x) / 2 * w, y: (lm[a].y + lm[b].y) / 2 * h };
  if (A) return { x: lm[a].x * w, y: lm[a].y * h };
  if (B) return { x: lm[b].x * w, y: lm[b].y * h };
  return null;
}
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };

// Body points per frame; missing hands are filled across short gaps, then smoothed.
export function track(frames, w, h) {
  const f = frames.map(({ t, lm }) => ({
    t, lm,
    hand: mid(lm, 15, 16, w, h, VIS_HAND),
    hip: mid(lm, 23, 24, w, h),
    sh: mid(lm, 11, 12, w, h),
    nose: okp(lm, 0) ? { x: lm[0].x * w, y: lm[0].y * h } : null,
    shDx: okp(lm, 11) && okp(lm, 12) ? Math.abs(lm[11].x - lm[12].x) * w : null,
  }));
  for (let i = 0; i < f.length; i++) {
    if (f[i].hand) continue;
    let a = i - 1, b = i + 1;
    while (b < f.length && !f[b].hand && b - i < 4) b++;
    if (a >= 0 && f[a].hand && b < f.length && f[b].hand) {
      const k = (f[i].t - f[a].t) / (f[b].t - f[a].t);
      f[i].hand = { x: f[a].hand.x + k * (f[b].hand.x - f[a].hand.x), y: f[a].hand.y + k * (f[b].hand.y - f[a].hand.y) };
    }
  }
  const raw = f.map(x => x.hand && { ...x.hand });
  for (let i = 1; i < f.length - 1; i++) {
    const n = [raw[i - 1], raw[i], raw[i + 1]].filter(Boolean);
    if (raw[i] && n.length === 3) f[i].hand = { x: (n[0].x + n[1].x + n[2].x) / 3, y: (n[0].y + n[1].y + n[2].y) / 3 };
  }
  const L = median(f.map(x => x.hip && x.sh ? dist(x.hip, x.sh) : NaN));
  return { f, L };
}

// Hand height above the hips, in torso lengths.
const height = (x, L) => x.hand && x.hip ? (x.hip.y - x.hand.y) / L : NaN;

// Rough swing location for the coarse pass: the time the hands are highest.
export function findTop(frames, w, h) {
  const { f, L } = track(frames, w, h);
  if (!Number.isFinite(L)) return null;
  let best = null;
  for (const x of f) { const y = height(x, L); if (Number.isFinite(y) && (!best || y > best.y)) best = { t: x.t, y }; }
  return best && best.y > 0.5 ? best.t : null;
}

// Returns { times: {phase: t}, index: {phase: i}, view } or { error }.
export function detectPhases(frames, w, h) {
  const { f, L } = track(frames, w, h);
  if (f.length < 12 || !Number.isFinite(L)) return { error: 'Corpo não detetado em frames suficientes.' };
  const H = f.map(x => height(x, L));
  let iT = -1;
  H.forEach((y, i) => { if (Number.isFinite(y) && (iT < 0 || y > H[iT])) iT = i; });
  if (iT < 0 || H[iT] < 0.6) return { error: 'Não encontrei o topo do swing (as mãos não sobem acima do peito). Use um vídeo com o corpo inteiro visível.' };

  const v = f.map((x, i) => i && x.hand && f[i - 1].hand ? dist(x.hand, f[i - 1].hand) / L / Math.max(1e-3, x.t - f[i - 1].t) : NaN);
  // Address: last still moment, with low hands, before the top.
  let iA = -1;
  for (let i = iT - 3; i >= 0; i--) {
    const still = [i, i + 1, i + 2].every(k => Number.isFinite(v[k]) ? v[k] < 0.6 : true);
    if (still && Number.isFinite(H[i]) && H[i] < H[iT] * 0.5 && f[i].hand) { iA = i; break; }
  }
  if (iA < 0) iA = f.findIndex(x => x.hand);
  if (iA < 0 || iA >= iT) return { error: 'Não encontrei o address antes do topo.' };
  const A = f[iA].hand, hA = H[iA], half = hA + 0.5 * (H[iT] - hA);

  let iK = -1; // takeaway: hands ~half a torso from address (club around parallel)
  for (let i = iA + 1; i < iT; i++) if (f[i].hand && dist(f[i].hand, A) / L >= 0.55) { iK = i; break; }
  if (iK < 0) iK = Math.round((iA + iT) / 2);

  let iD = -1; // downswing: hands back down to half height (lead arm around parallel)
  for (let i = iT + 1; i < f.length; i++) if (H[i] <= half) { iD = i; break; }
  if (iD < 0) return { error: 'O vídeo termina antes do downswing.' };

  let iI = -1, best = Infinity; // impact: hands closest to their address position
  const tMax = f[iD].t + 0.5;
  for (let i = iD; i < f.length && f[i].t <= tMax; i++) if (f[i].hand) { const d = dist(f[i].hand, A); if (d < best) { best = d; iI = i; } }
  if (iI <= iD) iI = Math.min(f.length - 1, iD + 1);

  let iF = -1; // follow-through: hands back up to half height on the other side
  for (let i = iI + 1; i < f.length; i++) if (H[i] >= half) { iF = i; break; }
  if (iF < 0) iF = Math.min(f.length - 1, iI + Math.max(1, Math.round(0.25 / Math.max(1e-3, f[1].t - f[0].t))));
  if (iF <= iI) return { error: 'O vídeo termina antes do follow-through.' };

  const idx = [iA, iK, iT, iD, iI, iF];
  const index = {}, times = {};
  PHASES.forEach((p, k) => { index[p] = idx[k]; times[p] = f[idx[k]].t; });

  // Camera view from shoulder width at address: wide = face-on, narrow = down-the-line.
  const r = f[iA].shDx != null ? f[iA].shDx / L : NaN;
  const view = r > 0.42 ? 'face-on' : r < 0.3 ? 'down-the-line' : null;
  return { times, index, view };
}

// ---- report ----

const S = {
  tpiOtt: ['TPI — Over the Top', 'https://cdn.site.mytpi.com/improve-my-game/swing-characteristics/over-the-top'],
  tpiEE: ['TPI — Early Extension', 'https://cdn.site.mytpi.com/improve-my-game/swing-characteristics/early-extension'],
  mamg: ['Me and My Golf', 'https://meandmygolf.com/golf-tips/over-the-top-golf-swing/are-you-over-the-top-in-your-golf-swing/'],
  hack: ['HackMotion', 'https://hackmotion.com/over-the-top-golf-swing/'],
  wrx: ['GolfWRX', 'https://www.golfwrx.com/?p=418728'],
  skillest: ['Skillest', 'https://skillest.com/blog/how-to-fix-over-the-top-swing/'],
  gtec: ['GOLFTEC', 'https://www.golftec.com/video/struggling-with-a-slice-heres-the-swing-fix-that-actually-works'],
  digest: ['Golf Digest — getting stuck', 'https://www.golfdigest.com/story/golf-digest-top-golf-swing-stuck-causes'],
  rotary: ['RotarySwing — blocks', 'https://rotaryswing.com/golf-instruction/faultsandfixes/stop-blocking-shots-right'],
  jml: ['JM Long Drive', 'https://jmlongdrive.com/proper-clubhead-path/'],
  golfcomEE: ['GOLF.com — early extension', 'https://golf.com/instruction/two-reasons-golfers-early-extension-fix/'],
  titleistEE: ['Titleist — Dr. Greg Rose', 'https://titleist.eu/instruction/stop-early-extension'],
};
const src = k => ({ label: S[k][0], url: S[k][1] });

export const CAUSES = {
  ott: { title: 'Causas frequentes de over the top (caminho de fora para dentro)', items: [
    ['Downswing iniciado pela parte de cima (ombros/braços) em vez das ancas e pernas', ['tpiOtt', 'mamg', 'hack']],
    ['Transferência de peso insuficiente para o pé da frente — a parte de baixo não lidera', ['tpiOtt']],
    ['Pouca mobilidade das ancas ou pouca separação entre parte de baixo e de cima', ['tpiOtt', 'mamg']],
    ['Reverse pivot: peso vai para a frente no backswing e volta para trás na descida, atirando o ombro de trás para fora', ['wrx']],
    ['Ombros e ancas a abrir cedo demais na descida', ['gtec']],
    ['Setup: ombros abertos / alinhamento', ['skillest']],
    ['Pulso da frente muito em extensão no topo', ['hack']],
  ] },
  inside: { title: 'Causas frequentes de inside-out excessivo / ficar "preso"', items: [
    ['Ancas a deslizar demasiado para o alvo — a parte de cima e os braços ficam para trás', ['digest', 'rotary', 'jml']],
    ['Early extension na descida: a anca vai para a bola e os braços ficam sem espaço', ['digest', 'tpiEE']],
    ['Demasiado perto da bola no address', ['digest']],
    ['Separação excessiva ancas/ombros ou tempo de transição muito rápido', ['digest']],
    ['Braços a fechar/estreitar no topo (perda de largura)', ['digest']],
    ['Ombro de trás a baixar na descida, inclinando o plano dos ombros', ['rotary']],
  ] },
  ee: { title: 'Sobre early extension (anca em direção à bola)', items: [
    ['É a característica mais comum nos rastreios TPI; o corpo fica no caminho dos braços', ['tpiEE']],
    ['Muitas vezes é consequência de uma descida íngreme / over the top', ['golfcomEE']],
    ['Causas físicas: pouca mobilidade de tornozelos, isquiotibiais e glúteos tensos', ['titleistEE', 'digest']],
  ] },
};
const causes = k => ({ title: CAUSES[k].title, items: CAUSES[k].items.map(([t, ks]) => ({ text: t, sources: ks.map(src) })) });

// Signed distance (in torso lengths) of the club head from the two plane lines, measured
// perpendicular to each line; positive = outside/above (away from the golfer).
function vZone(club, tA, tB, L) {
  if (tA == null || tB == null || !club.head0 || !club.hands0 || !club.sh0 || !club.track) return null;
  const { head0: o, hands0: hd, sh0 } = club, S = Math.hypot(hd.x - o.x, hd.y - o.y);
  const up = { x: o.x, y: o.y - S }; // a point straight above the ball is on the outside of both lines
  const sd = (q, p) => { const vx = q.x - o.x, vy = q.y - o.y, n = Math.hypot(vx, vy) || 1; return ((p.x - o.x) * vy - (p.y - o.y) * vx) / n; };
  const sgnLow = Math.sign(sd(hd, up)) || 1, sgnUp = Math.sign(sd(sh0, up)) || 1;
  const pts = club.track.filter(p => p.ok && p.t >= tA - 1e-6 && p.t < tB - 1e-6 && Math.hypot(p.x - o.x, p.y - o.y) > 0.3 * S);
  if (pts.length < 2) return null;
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  return { up: mean(pts.map(p => sgnUp * sd(sh0, p) / L)), low: mean(pts.map(p => sgnLow * sd(hd, p) / L)), n: pts.length };
}
const angleV = (hip, sh) => Math.atan2(Math.abs(sh.x - hip.x), hip.y - sh.y) * 180 / Math.PI; // spine vs vertical
const r2 = x => Math.round(x * 100) / 100;
const pct = x => `${Math.round(x * 100)}% do tronco`;

// marks: {phase: time}; view: 'face-on' | 'down-the-line'
// club (optional, video px): { head0, hands0, sh0, track: [{t, x, y, ok}] }
export function buildReport(frames, w, h, marks, view, club = null) {
  const { f, L } = track(frames, w, h);
  if (!Number.isFinite(L)) return null;
  const near = t => { if (t == null) return -1; let b = -1, d = Infinity; f.forEach((x, i) => { const e = Math.abs(x.t - t); if (e < d) { d = e; b = i; } }); return d < 0.1 ? b : -1; };
  const I = Object.fromEntries(PHASES.map(p => [p, near(marks[p])]));
  const need = ['Address', 'Topo', 'Downswing', 'Impacto'];
  if (need.some(p => I[p] < 0)) return { view, error: 'Faltam fases analisadas (Address, Topo, Downswing, Impacto). Use "Detetar fases".' };
  const P = p => f[I[p]];
  const a = P('Address'), top = P('Topo'), imp = P('Impacto');
  if (!a.hand || !a.hip || !imp.hip) return { view, error: 'Ancas ou mãos não visíveis no address/impacto.' };
  const findings = [], groups = new Set();
  const add = (label, value, flag, text, g) => { findings.push({ label, value, flag, text }); if (flag && g) g.forEach(x => groups.add(x)); };
  let plane = null;

  if (view === 'down-the-line') {
    const d = Math.sign(a.hand.x - a.hip.x) || 1; // +1 = towards the ball
    // Backswing hand path (address → top), as x at a given height.
    const back = f.slice(I.Address, I.Topo + 1).filter(x => x.hand).map(x => x.hand);
    const xAt = y => { let best = null; for (let i = 1; i < back.length; i++) { const p = back[i - 1], q = back[i]; if ((p.y - y) * (q.y - y) <= 0 && p.y !== q.y) { const x = p.x + (y - p.y) / (q.y - p.y) * (q.x - p.x); best = x; } } return best; };
    const offs = [];
    for (let i = I.Topo + 1; i <= I.Downswing; i++) { const x = f[i].hand && xAt(f[i].hand.y); if (x != null) offs.push((f[i].hand.x - x) * d / L); }
    const off = offs.length ? offs.reduce((s, v) => s + v, 0) / offs.length : null;
    // Hands: downswing vs backswing path. Club head: distance from the shaft line (ball → hands)
    // and the shoulder line (ball → shoulders) between the downswing checkpoint and impact.
    const handV = off == null ? null : off > 0.08 ? 'over the top' : off < -0.15 ? 'inside-out acentuado' : 'no plano';
    const vz = club ? vZone(club, marks.Downswing, marks.Impacto, L) : null;
    const clubV = !vz ? null : vz.up > 0.1 ? 'over the top' : vz.low < -0.1 ? 'inside-out acentuado' : 'no plano';
    const TXT = {
      'over the top': 'padrão de over the top — na descida o taco/mãos saem por fora do plano do backswing, com caminho de fora para dentro (slice ou pull).',
      'inside-out acentuado': 'tendência para inside-out acentuado — na descida o taco/mãos vêm bem por dentro/por baixo do plano (push, block ou hook).',
      'no plano': 'as mãos e o taco descem no plano ou ligeiramente por dentro — é o padrão desejado.',
    };
    const handTxt = handV && `Mãos: ${handV === 'over the top' ? 'descem por fora do caminho do backswing' : handV === 'no plano' ? 'descem no mesmo caminho ou ligeiramente por dentro' : 'descem bem por dentro do caminho do backswing'}.`;
    const clubTxt = clubV && `Cabeça do taco: ${clubV === 'over the top' ? 'passa acima da linha dos ombros' : clubV === 'no plano' ? 'fica entre a linha do taco e a dos ombros' : 'passa abaixo da linha do taco'}.`;
    const final = handV && clubV ? (handV === clubV ? handV : 'indícios mistos') : (handV || clubV);
    if (!final) plane = { verdict: 'indeterminado', text: 'Não foi possível comparar os caminhos (mãos pouco visíveis no topo e taco não seguido).' };
    else if (final === 'indícios mistos') { plane = { verdict: 'indícios mistos', text: `${handTxt} ${clubTxt} Os dois sinais não concordam — confirme vendo o vídeo frame a frame ou peça o relatório AI.` }; for (const v of [handV, clubV]) if (v === 'over the top') groups.add('ott'); else if (v !== 'no plano') groups.add('inside'); }
    else { plane = { verdict: final, offset: off != null ? r2(off) : null, text: [TXT[final][0].toUpperCase() + TXT[final].slice(1), handTxt, clubTxt].filter(Boolean).join(' ') }; if (final === 'over the top') groups.add('ott'); else if (final !== 'no plano') groups.add('inside'); }
    if (vz) {
      add('Cabeça do taco vs linha dos ombros (+ = acima)', pct(vz.up), vz.up > 0.1, vz.up > 0.1 ? 'Acima da linha dos ombros na descida.' : 'Não passa acima da linha dos ombros.', null);
      add('Cabeça do taco vs linha do taco (− = abaixo)', pct(vz.low), vz.low < -0.1, (vz.low < -0.1 ? 'Abaixo da linha do taco na descida.' : 'Não passa abaixo da linha do taco.') + ` (${vz.n} posições medidas)`, null);
    }
    if (off != null) add('Mãos na descida vs backswing (+ = por fora)', pct(off), off > 0.08 || off < -0.15, off > 0.08 ? 'Mãos por fora do caminho do backswing.' : off < -0.15 ? 'Mãos bem por dentro do caminho do backswing.' : 'Mãos no caminho certo.', null);

    const ee = (imp.hip.x - a.hip.x) * d / L;
    add('Anca em direção à bola (address → impacto)', pct(ee), ee > 0.08, ee > 0.08 ? 'Early extension: a pélvis avança para a bola na descida.' : 'Anca mantém a distância à bola.', ['ee', 'inside']);
    if (top.hip) { const eb = (top.hip.x - a.hip.x) * d / L; add('Anca em direção à bola no backswing', pct(eb), eb > 0.08, eb > 0.08 ? 'A pélvis já avança para a bola no backswing (early extension no backswing).' : 'Sem avanço da anca no backswing.', ['ee', 'inside']); }
    if (a.sh && imp.sh) { const da = angleV(a.hip, a.sh) - angleV(imp.hip, imp.sh); add('Inclinação da coluna (address − impacto)', `${da.toFixed(1)}°`, da > 8, da > 8 ? 'Perda de postura: o tronco endireita antes do impacto.' : 'Postura mantida até ao impacto.', ['ee']); }
    if (a.nose && imp.nose) { const up = (a.nose.y - imp.nose.y) / L; add('Cabeça sobe até ao impacto', pct(up), up > 0.08, up > 0.08 ? 'A cabeça sobe — sinal de levantar o corpo.' : 'Altura da cabeça estável.', ['ee']); }
  } else {
    plane = { verdict: 'só em down-the-line', text: 'O plano do swing avalia-se num vídeo por trás (down-the-line). De frente (face-on) analisamos a transferência de peso e os deslocamentos laterais.' };
    const fol = I['Follow-through'] >= 0 ? f[I['Follow-through']] : imp;
    const tdir = top.hand && fol.hand ? Math.sign(fol.hand.x - top.hand.x) || 1 : 1; // +1 = towards the target
    if (top.hip) { const sw = (top.hip.x - a.hip.x) * tdir / L; add('Anca no backswing (afasta-se do alvo)', pct(-sw), sw < -0.12, sw < -0.12 ? 'Sway: a anca desliza para trás em vez de rodar.' : 'Sem sway relevante.', ['ott']); }
    if (a.nose && top.nose) { const rp = (top.nose.x - a.nose.x) * tdir / L; add('Cabeça no topo (em direção ao alvo)', pct(rp), rp > 0.08, rp > 0.08 ? 'Reverse pivot: o peso vai para o lado do alvo no backswing.' : 'Sem reverse pivot.', ['ott']); }
    const sl = (imp.hip.x - a.hip.x) * tdir / L;
    add('Anca no impacto (avança para o alvo)', pct(sl), sl > 0.35 || sl < 0.02, sl > 0.35 ? 'Deslize excessivo das ancas para o alvo.' : sl < 0.02 ? 'As ancas não avançam para o alvo: transferência de peso insuficiente.' : 'Transferência de peso normal.', sl > 0.35 ? ['inside'] : ['ott']);
    if (a.nose && imp.nose) { const hd = (imp.nose.x - a.nose.x) * tdir / L; add('Cabeça no impacto (em direção ao alvo)', pct(hd), hd > 0.15, hd > 0.15 ? 'A parte de cima avança para o alvo antes do impacto.' : 'Cabeça atrás da bola / estável.', ['ott']); }
  }
  return {
    view, plane, findings,
    causes: ['ott', 'inside', 'ee'].filter(k => groups.has(k)).map(causes),
    note: 'Heurística 2D sobre pontos do corpo (MediaPipe); o taco e a bola não são detetados e o "plano" é o caminho das mãos. Limiares em comprimentos de tronco. Não substitui um treinador.',
  };
}
