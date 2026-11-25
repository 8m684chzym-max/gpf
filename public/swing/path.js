// GPF Swing Lab — club path (down-the-line) and attack angle (face-on) from the club head
// track around impact. Pure functions (no DOM): video-pixel coordinates, times in REAL
// seconds (a slow-motion clip's video time divided by its slow-down factor).
//
// Definitions follow TrackMan: club path = in-to-out (+) / out-to-in (−) direction of the
// club head at impact relative to the target line; attack angle = up (+) / down (−)
// movement of the club head at impact relative to the ground.
//
// Club path (down-the-line). The camera looks along the target line, so in/out is mostly
// depth and cannot be read straight off the image. Near impact the club head is on the
// ground, so each image point is put back on the ground plane with a pinhole camera: a
// ground point at image (x, y) lies at depth Z = f·hc/(y − yh) and at side offset
// X = (x − xv)·hc/(y − yh), where (xv, yh) is the vanishing point of the target line and f
// the focal length in px. The camera height hc cancels out of the angle; f comes from the
// lens chosen (iPhone 1× ≈ 26 mm equivalent; video stabilisation crops a little more).
// Errors: the head is a few cm off the ground, the lens guess, a tilted or rolled camera,
// and the frame rate (at 30 fps the head moves ~1 m between frames — use slow motion).

export const LENSES = { '1': 0.78, '0.5': 0.39, '2': 1.5 }; // focal length ÷ long side of the video
export const focal = (w, h, lens) => (LENSES[lens] || LENSES['1']) * Math.max(w, h);

// Vanishing point of two image lines {a:{x,y}, b:{x,y}} (px); null if nearly parallel.
export function vanishing(l1, l2) {
  const d1 = { x: l1.b.x - l1.a.x, y: l1.b.y - l1.a.y }, d2 = { x: l2.b.x - l2.a.x, y: l2.b.y - l2.a.y };
  const den = d1.x * d2.y - d1.y * d2.x;
  const n = Math.hypot(d1.x, d1.y) * Math.hypot(d2.x, d2.y);
  if (!n || Math.abs(den) / n < 0.02) return null; // < ~1° apart
  const k = ((l2.a.x - l1.a.x) * d2.y - (l2.a.y - l1.a.y) * d2.x) / den;
  return { x: l1.a.x + k * d1.x, y: l1.a.y + k * d1.y };
}

// Least-squares slope of y on x.
function slope(xs, ys) {
  const n = xs.length; if (n < 2) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return sxx ? sxy / sxx : NaN;
}
const deg = r => r * 180 / Math.PI;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

// How much to trust a measurement taken at this real frame rate.
export function quality(fpsReal) {
  if (fpsReal >= 200) return { key: 'alta', text: `${Math.round(fpsReal)} fps — boa resolução no impacto` };
  if (fpsReal >= 100) return { key: 'média', text: `${Math.round(fpsReal)} fps — aceitável; 240 fps é melhor` };
  if (fpsReal >= 50) return { key: 'baixa', text: `${Math.round(fpsReal)} fps — poucos pontos junto à bola; valor aproximado` };
  return { key: 'insuficiente', text: `${Math.round(fpsReal)} fps — a cabeça do taco anda ~1 m entre frames` };
}

// Impact refined on the club head track: the measured head point closest to the address
// club head (the ball), within ±win of the phase estimate. Returns a time or null.
export function impactFromTrack(track, head0, tGuess, win) {
  let best = null;
  for (const p of track) {
    if (!p.ok || Math.abs(p.t - tGuess) > win) continue;
    const d = dist(p, head0);
    if (!best || d < best.d) best = { t: p.t, d };
  }
  return best ? best.t : null;
}

// Head points used for the direction at impact: measured (ok) points from a few frames
// before impact up to half a frame after, near the ball.
function nearImpact(track, head0, tImp, S, fpsReal) {
  const before = Math.max(0.02, 3.5 / fpsReal), after = 0.6 / fpsReal;
  return track.filter(p => p.ok && p.t >= tImp - before - 1e-6 && p.t <= tImp + after + 1e-6 && dist(p, head0) < 0.55 * S)
    .sort((a, b) => a.t - b.t);
}

// o = { head0, side (+1 = image direction from the golfer towards the ball), f, vp, tImp, S, fpsReal }
// Returns { deg, n, quality, dir } or { error, quality }.
export function clubPath(track, o) {
  const q = quality(o.fpsReal);
  if (q.key === 'insuficiente') return { error: 'Para medir o caminho do taco filme em câmara lenta (120 ou 240 fps) e indique-o em "Câmara lenta".', quality: q };
  const g = nearImpact(track, o.head0, o.tImp, o.S, o.fpsReal).map(p => {
    const dy = p.y - o.vp.y;
    return dy > 2 ? { t: p.t, X: (p.x - o.vp.x) * o.side / dy, Z: o.f / dy } : null;
  }).filter(Boolean);
  if (g.length < 2) return { error: `Só ${g.length} posição(ões) da cabeça do taco junto à bola. Use mais fps, boa luz e fundo liso.`, quality: q, n: g.length };
  const t = g.map(p => p.t), vX = slope(t, g.map(p => p.X)), vZ = slope(t, g.map(p => p.Z));
  if (!(vZ > 0)) return { error: 'A cabeça do taco não se afasta da câmara no impacto — confirme que o vídeo é down-the-line (por trás, alinhado com o alvo) e a posição da cabeça do taco no address.', quality: q, n: g.length };
  const a = deg(Math.atan2(vX, vZ));
  if (Math.abs(a) > 20) return { error: `Valor fora do normal (${a.toFixed(1)}°): o seguimento do taco junto à bola não é fiável neste vídeo.`, quality: q, n: g.length };
  return { deg: a, n: g.length, quality: q, verdict: a > 2 ? 'in-to-out' : a < -2 ? 'out-to-in' : 'neutro' };
}

// Image points (px) to draw the target line and the path arrow from the ball (DTL).
export function pathGuide(o, a) {
  const dy0 = o.head0.y - o.vp.y; if (dy0 <= 2) return null;
  const X0 = (o.head0.x - o.vp.x) * o.side / dy0, Z0 = o.f / dy0, L = 0.6 * Z0; // ~60 % further away
  const toImg = (X, Z) => { const dy = o.f / Z; return { x: o.vp.x + X * dy * o.side, y: o.vp.y + dy }; };
  const r = a * Math.PI / 180;
  return { target: [o.head0, toImg(X0, Z0 + L)], path: [o.head0, toImg(X0 + Math.sin(r) * L, Z0 + Math.cos(r) * L)] };
}

// o = { head0, ground (unit image vector along the ground towards the target), tImp, S, L, fpsReal }
// Returns { deg, n, quality, low } or { error, quality }.
export function attackAngle(track, o) {
  const q = quality(o.fpsReal);
  if (q.key === 'insuficiente') return { error: 'Para medir o ângulo de ataque filme em câmara lenta (120 ou 240 fps) e indique-o em "Câmara lenta".', quality: q };
  let u = { x: o.ground.y, y: -o.ground.x }; if (u.y > 0) u = { x: -u.x, y: -u.y }; // perpendicular, pointing up
  const pts = nearImpact(track, o.head0, o.tImp, o.S, o.fpsReal);
  if (pts.length < 2) return { error: `Só ${pts.length} posição(ões) da cabeça do taco junto à bola. Use mais fps, boa luz e fundo liso.`, quality: q, n: pts.length };
  const t = pts.map(p => p.t);
  const vA = slope(t, pts.map(p => (p.x - o.head0.x) * o.ground.x + (p.y - o.head0.y) * o.ground.y));
  const vU = slope(t, pts.map(p => (p.x - o.head0.x) * u.x + (p.y - o.head0.y) * u.y));
  if (!(vA > 0)) return { error: 'A cabeça do taco não avança para o alvo no impacto — confirme que o vídeo é face-on e a posição da cabeça do taco no address.', quality: q, n: pts.length };
  const a = deg(Math.atan2(vU, vA));
  if (Math.abs(a) > 15) return { error: `Valor fora do normal (${a.toFixed(1)}°): o seguimento do taco junto à bola não é fiável neste vídeo.`, quality: q, n: pts.length };
  // Low point: the lowest measured head point around impact, along the target line from the ball.
  let low = null;
  if (o.fpsReal >= 100 && o.L) {
    const around = track.filter(p => p.ok && Math.abs(p.t - o.tImp) <= 0.04 && dist(p, o.head0) < 0.6 * o.S);
    for (const p of around) {
      const h = (p.x - o.head0.x) * u.x + (p.y - o.head0.y) * u.y;
      if (!low || h < low.h) low = { h, along: ((p.x - o.head0.x) * o.ground.x + (p.y - o.head0.y) * o.ground.y) / o.L, x: p.x, y: p.y };
    }
  }
  return { deg: a, n: pts.length, quality: q, low, dir: { x: o.ground.x * Math.cos(a * Math.PI / 180) + u.x * Math.sin(a * Math.PI / 180), y: o.ground.y * Math.cos(a * Math.PI / 180) + u.y * Math.sin(a * Math.PI / 180) } };
}
