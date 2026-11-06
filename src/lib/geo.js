// Small geo helpers for the hole map. Coordinates are [lat, lng] in degrees.
// "World" coordinates are Web Mercator at zoom 0 (0..256 on each axis), the
// same space slippy-map tiles use, so a tile at zoom z covers 256/2^z units.

const R_EARTH = 6371008.8; // mean Earth radius, metres
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distance(a, b) {
  if (!a || !b) return null;
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point `m` metres from `a` towards `b` (straight-line interpolation; fine over a golf hole). */
export function along(a, b, m) {
  const d = distance(a, b);
  if (!d) return a;
  const t = m / d;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function toWorld([lat, lng]) {
  const s = Math.sin(rad(Math.max(-85, Math.min(85, lat))));
  return [((lng + 180) / 360) * 256, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256];
}

export function fromWorld([x, y]) {
  const lng = (x / 256) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / 256;
  return [(180 / Math.PI) * Math.atan(Math.sinh(n)), lng];
}

/** World units per metre at a latitude. */
export const worldPerMetre = (lat) => 256 / (40075016.686 * Math.cos(rad(lat)));

/**
 * A view maps world coords to screen px: screen = k·R(r)·(w − c) + anchor.
 * c = world point shown at `anchor`, k = screen px per world unit, r = rotation.
 */
export function toScreen(v, w) {
  const dx = (w[0] - v.cx) * v.k, dy = (w[1] - v.cy) * v.k;
  const cs = Math.cos(v.r), sn = Math.sin(v.r);
  return [dx * cs - dy * sn + v.ax, dx * sn + dy * cs + v.ay];
}

export function fromScreen(v, [sx, sy]) {
  const dx = sx - v.ax, dy = sy - v.ay;
  const cs = Math.cos(-v.r), sn = Math.sin(-v.r);
  return [(dx * cs - dy * sn) / v.k + v.cx, (dx * sn + dy * cs) / v.k + v.cy];
}

/**
 * View that puts `from` at the bottom-centre and `to` straight above it,
 * filling the space between the paddings.
 */
export function fitLine(from, to, W, H, padTop, padBottom, maxK = 256 * 2 ** 20) {
  const a = toWorld(from), b = toWorld(to);
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const len = Math.hypot(vx, vy) || 1e-9;
  const r = -Math.PI / 2 - Math.atan2(vy, vx);
  const k = Math.min(maxK, Math.max(1, (H - padTop - padBottom) / len));
  return { cx: a[0], cy: a[1], k, r, ax: W / 2, ay: H - padBottom };
}

/** Distances (m) from `from` to the front and back edges of a green polygon along the line to its centre. */
export function frontBack(from, centre, poly) {
  if (!from || !centre || !poly || poly.length < 3) return null;
  // Local flat projection in metres around `from`.
  const kx = 111320 * Math.cos(rad(from[0])), ky = 110574;
  const P = (p) => [(p[1] - from[1]) * kx, (p[0] - from[0]) * ky];
  const c = P(centre), L = Math.hypot(c[0], c[1]);
  if (!L) return null;
  const ux = c[0] / L, uy = c[1] / L;
  const hits = [];
  for (let i = 0; i < poly.length; i++) {
    const p = P(poly[i]), q = P(poly[(i + 1) % poly.length]);
    const ex = q[0] - p[0], ey = q[1] - p[1];
    const den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (p[0] * ey - p[1] * ex) / den;      // distance along the ray
    const s = (p[0] * uy - p[1] * ux) / den;      // position along the edge
    if (t > 0 && s >= 0 && s <= 1) hits.push(t);
  }
  if (hits.length < 2) return null;
  return { front: Math.min(...hits), back: Math.max(...hits) };
}
