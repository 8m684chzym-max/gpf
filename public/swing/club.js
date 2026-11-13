// GPF Swing Lab — club head from video pixels (no club model exists in MediaPipe).
//
// 1. Address: the shaft is a thin straight line from the hands down to the ground.
//    We test every line from the hands to a point at foot level and keep the one with
//    the strongest "thin line" contrast (pixel vs. pixels 3 px either side).
// 2. Swing: the club head is the fastest, farthest moving thing from the hands. For each
//    frame we take the pixels that changed vs. both neighbouring frames, drop the body
//    (thick segments around the pose), keep a ring around the hands sized by the address
//    shaft length, and take the farthest pixels from the hands.
//
// All coordinates here are in the small grayscale image (gw × gh). Heuristic: works best
// with a fixed camera, the whole club in frame and a plain background.

const ok = (lm, i, v = 0.4) => lm && lm[i] && (lm[i].visibility ?? 1) >= v;
const P = (lm, i, w, h) => ({ x: lm[i].x * w, y: lm[i].y * h });
function mid(lm, a, b, w, h, v = 0.3) {
  const A = ok(lm, a, v), B = ok(lm, b, v);
  if (A && B) return { x: (lm[a].x + lm[b].x) / 2 * w, y: (lm[a].y + lm[b].y) / 2 * h };
  if (A) return P(lm, a, w, h); if (B) return P(lm, b, w, h); return null;
}
export const handsOf = (lm, w, h) => mid(lm, 15, 16, w, h, 0.2);

// Mean of several grayscale frames (address is still, averaging removes noise).
export function average(grays) {
  const n = grays.length, out = new Float32Array(grays[0].length);
  for (const g of grays) for (let i = 0; i < g.length; i++) out[i] += g[i] / n;
  return out;
}

// Returns { head, hands, contrast } in gray-image px, or null.
export function findShaft(img, gw, gh, lm, view) {
  const hands = handsOf(lm, gw, gh), hip = mid(lm, 23, 24, gw, gh), sh = mid(lm, 11, 12, gw, gh);
  if (!hands || !hip || !sh) return null;
  const L = Math.hypot(sh.x - hip.x, sh.y - hip.y);
  let ground = -Infinity;
  for (const i of [27, 28, 29, 30, 31, 32]) if (ok(lm, i, 0.3)) ground = Math.max(ground, lm[i].y * gh);
  if (!Number.isFinite(ground)) ground = hip.y + 1.9 * L;
  ground = Math.min(gh - 2, ground);
  const at = (x, y) => { const xi = x | 0, yi = y | 0; return xi < 0 || yi < 0 || xi >= gw || yi >= gh ? NaN : img[yi * gw + xi]; };
  const side = Math.sign(hands.x - hip.x) || 1; // DTL: the ball is on the hands' side of the hips
  const x0 = view === 'down-the-line' ? hands.x - side * 0.15 * L : hands.x - 0.9 * L;
  const x1 = view === 'down-the-line' ? hands.x + side * 1.6 * L : hands.x + 0.9 * L;
  let best = null;
  const steps = Math.max(20, Math.round(Math.abs(x1 - x0)));
  for (let k = 0; k <= steps; k++) {
    const gx = x0 + (x1 - x0) * k / steps;
    const dx = gx - hands.x, dy = ground - hands.y, len = Math.hypot(dx, dy);
    if (len < 0.8 * L) continue;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    let sum = 0, n = 0;
    for (let s = 0.2 * len; s < 0.92 * len; s += 1) {
      const x = hands.x + ux * s, y = hands.y + uy * s;
      const c = at(x, y), a = at(x + nx * 3, y + ny * 3), b = at(x - nx * 3, y - ny * 3);
      if (Number.isNaN(c) || Number.isNaN(a) || Number.isNaN(b)) continue;
      sum += c - (a + b) / 2; n++;
    }
    if (n < 10) continue;
    const score = Math.abs(sum / n);
    if (!best || score > best.contrast) best = { head: { x: gx, y: ground }, hands, contrast: score };
  }
  return best;
}

// Thick-segment body mask for one frame (1 = body).
function bodyMask(lm, gw, gh, L) {
  const m = new Uint8Array(gw * gh);
  const seg = (a, b, r) => {
    if (!ok(lm, a, 0.3) || !ok(lm, b, 0.3)) return;
    const A = P(lm, a, gw, gh), B = P(lm, b, gw, gh);
    const x0 = Math.max(0, Math.floor(Math.min(A.x, B.x) - r)), x1 = Math.min(gw - 1, Math.ceil(Math.max(A.x, B.x) + r));
    const y0 = Math.max(0, Math.floor(Math.min(A.y, B.y) - r)), y1 = Math.min(gh - 1, Math.ceil(Math.max(A.y, B.y) + r));
    const vx = B.x - A.x, vy = B.y - A.y, vv = vx * vx + vy * vy || 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = Math.max(0, Math.min(1, ((x - A.x) * vx + (y - A.y) * vy) / vv));
      const ex = A.x + t * vx - x, ey = A.y + t * vy - y;
      if (ex * ex + ey * ey <= r * r) m[y * gw + x] = 1;
    }
  };
  for (const [a, b, k] of [[11, 12, .28], [23, 24, .3], [11, 23, .3], [12, 24, .3], [11, 24, .3], [12, 23, .3],
    [23, 25, .2], [25, 27, .16], [24, 26, .2], [26, 28, .16], [27, 31, .1], [28, 32, .1],
    [11, 13, .14], [12, 14, .14], [13, 15, .1], [14, 16, .1], [0, 11, .3], [0, 12, .3]]) seg(a, b, k * L);
  return m;
}

// frames: [{t, lm, g}] (g = Uint8Array gw×gh); head0/hands0 from findShaft.
// Returns [{t, x, y, ok}] per frame from i0 to i1 (inclusive), gaps interpolated.
export function trackHead(frames, gw, gh, i0, i1, head0, hands0) {
  const S = Math.hypot(head0.x - hands0.x, head0.y - hands0.y);
  const out = [];
  for (let i = i0; i <= i1; i++) {
    const f = frames[i], prev = frames[i - 1], next = frames[i + 1];
    let res = { t: f.t, ok: false };
    const hands = f.lm && handsOf(f.lm, gw, gh);
    if (i === i0) res = { t: f.t, x: head0.x, y: head0.y, ok: true };
    else if (hands && prev?.g && next?.g && f.g) {
      const hip = mid(f.lm, 23, 24, gw, gh), sh = mid(f.lm, 11, 12, gw, gh);
      const L = hip && sh ? Math.hypot(sh.x - hip.x, sh.y - hip.y) : S / 1.8;
      const body = bodyMask(f.lm, gw, gh, L);
      const rMin = 0.45 * S, rMax = 1.3 * S, thr = 22;
      const pts = [];
      const x0 = Math.max(1, Math.floor(hands.x - rMax)), x1 = Math.min(gw - 2, Math.ceil(hands.x + rMax));
      const y0 = Math.max(1, Math.floor(hands.y - rMax)), y1 = Math.min(gh - 2, Math.ceil(hands.y + rMax));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = y * gw + x;
        if (body[k]) continue;
        const d = Math.hypot(x - hands.x, y - hands.y);
        if (d < rMin || d > rMax) continue;
        const c = f.g[k], dPrev = Math.abs(c - prev.g[k]), dNext = Math.abs(c - next.g[k]);
        if (Math.min(dPrev, dNext) > thr) pts.push({ x, y, d });
      }
      if (pts.length >= 3) {
        pts.sort((a, b) => b.d - a.d);
        const top = pts.slice(0, Math.max(3, Math.round(pts.length * 0.12)));
        res = { t: f.t, x: top.reduce((s, p) => s + p.x, 0) / top.length, y: top.reduce((s, p) => s + p.y, 0) / top.length, ok: true, n: pts.length };
      }
    }
    out.push(res);
  }
  // Fill gaps linearly; keep the "ok" flag so the report knows what was measured.
  for (let i = 0; i < out.length; i++) {
    if (out[i].ok) continue;
    let a = i - 1, b = i + 1;
    while (b < out.length && !out[b].ok) b++;
    if (a >= 0 && b < out.length) { const k = (out[i].t - out[a].t) / (out[b].t - out[a].t); out[i].x = out[a].x + k * (out[b].x - out[a].x); out[i].y = out[a].y + k * (out[b].y - out[a].y); }
    else if (a >= 0) { out[i].x = out[a].x; out[i].y = out[a].y; }
  }
  return out.filter(p => Number.isFinite(p.x));
}
