#!/usr/bin/env python3
"""Engraved yardage-book images (public/holes/engraved/hole-N.webp source SVGs).

Reads public/holes/pinheirinho-sketch.json (from vec.py) and draws each hole in the
vintage engraved style with a faint GPF logo watermark. Writes out/hole-N.svg and
out/meta.json (metre bounds of each image); render the SVGs to PNG/WebP with any
headless browser and put the bounds in the sketch JSON under "img".
Run from the repo root:  python3 scripts/hole-sketches/engrave.py
"""
import json, math, random, sys
random.seed(7)
SK = json.load(open('public/holes/pinheirinho-sketch.json'))
INK, INK2, SEPIA, PAPER = '#1e3b28', '#2f5536', '#8c6d3f', '#efe4cf'
PX = 1.9  # px per metre

def pip(x, y, ring):
    c = False; n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]; x2, y2 = ring[(i+1) % n]
        if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1+1e-12)+x1: c = not c
    return c
def inpoly(x, y, rings): return pip(x, y, rings[0]) and not any(pip(x, y, r) for r in rings[1:])

def path(polys, T):
    return ''.join('M' + 'L'.join(f'{T(p)[0]:.1f},{T(p)[1]:.1f}' for p in r) + 'Z' for rings in polys for r in rings)

def tree(cx, cy, r):
    """engraved tree crown: shadow, lobes, highlights"""
    o = [f'<ellipse cx="{cx+r*.4:.1f}" cy="{cy+r*.5:.1f}" rx="{r*1.05:.1f}" ry="{r*.8:.1f}" fill="{SEPIA}" opacity=".3"/>']
    for i in range(5):
        a = i*2*math.pi/5 + random.random()*.6; d = r*.42 if i else 0
        k = .7 if i else .78
        o.append(f'<circle cx="{cx+math.cos(a)*d:.1f}" cy="{cy+math.sin(a)*d:.1f}" r="{r*k:.1f}" fill="{random.choice(["#55804f", "#4a7447", "#638a58", "#3f6a42"])}" stroke="{INK}" stroke-width=".75"/>')
    for _ in range(6):
        a = random.uniform(math.pi*.95, math.pi*1.65); d = random.uniform(.15, .75)*r
        o.append(f'<circle cx="{cx+math.cos(a)*d:.1f}" cy="{cy+math.sin(a)*d:.1f}" r="{r*random.uniform(.1,.2):.1f}" fill="#f4ecd8" opacity=".9"/>')
    o.append(f'<path d="M{cx-r*.5:.1f},{cy+r*.1:.1f} q{r*.3:.1f},{-r*.25:.1f} {r*.6:.1f},0 M{cx-r*.1:.1f},{cy+r*.45:.1f} q{r*.25:.1f},{-r*.2:.1f} {r*.5:.1f},0" fill="none" stroke="{INK}" stroke-width=".6" opacity=".8"/>')
    return ''.join(o)

def area(r):
    return abs(sum(r[i][0]*r[(i+1)%len(r)][1]-r[(i+1)%len(r)][0]*r[i][1] for i in range(len(r))))/2

class Hole:
    def __init__(s, n, ox, oy):
        s.n, s.ox, s.oy = n, ox, oy
        sk = SK[str(n)]; s.sk = sk
        s.gx, s.gy = sk['green']
        s.grass = [g for g in sk['grass'] if area(g[0]) >= 900 and any(abs(p[0]) < 38 for p in g[0])]  # this hole only
        s.water = sk['water']
        s.sand = [g for g in sk['sand'] if area(g[0]) >= 10 and min(abs(p[0]) for p in g[0]) < 60]
        s.blocks = s.grass + s.water + s.sand
        s.bbox = [(min(p[0] for p in g[0]), max(p[0] for p in g[0]), min(p[1] for p in g[0]), max(p[1] for p in g[0])) for g in s.blocks]
        v = sk['view']; s.view = v
    def T(s, p): return (s.ox + p[0]*PX, s.oy - p[1]*PX)
    def L(s, x, y): return ((x - s.ox)/PX, (s.oy - y)/PX)
    def open_ground(s, x, y, margin):
        """True if (x,y) metres is off grass/water/sand by `margin` and inside the traced area"""
        v = s.view
        if not (v[0]+3 < x < v[2]-3 and v[1]+3 < y < v[3]-3): return None   # outside the trace
        if math.dist((x, y), (s.gx, s.gy)) < 24 or math.dist((x, y), (0, 0)) < 12: return False
        for dx, dy in ((0, 0), (margin, 0), (-margin, 0), (0, margin), (0, -margin)):
            px, py = x+dx, y+dy
            for (a, b, c, d), g in zip(s.bbox, s.blocks):
                if a <= px <= b and c <= py <= d and inpoly(px, py, g): return False
        return True
    def svg(s, label_side):
        T = s.T; sk = s.sk; gx, gy = s.gx, s.gy
        L = []
        gp = path(s.grass, T)
        L.append(f'<path d="{gp}" fill="#f7eedc" fill-rule="evenodd"/><path d="{gp}" fill="url(#mow)" fill-rule="evenodd"/>')
        L.append(f'<path d="{gp}" fill="none" stroke="{SEPIA}" stroke-width="6" opacity=".16" transform="translate(2,3)"/>')
        L.append(f'<path d="{gp}" fill="none" stroke="{INK}" stroke-width="1.3"/>')
        if s.water:
            wp = path(s.water, T)
            L.append(f'<path d="{wp}" fill="#e2dac6" fill-rule="evenodd"/><path d="{wp}" fill="url(#wave)" fill-rule="evenodd"/><path d="{wp}" fill="none" stroke="{INK}" stroke-width="1.4"/>')
        sp = path(s.sand, T)
        L.append(f'<path d="{sp}" fill="#fbf4e4" stroke="{INK}" stroke-width="1.1" fill-rule="evenodd"/><path d="{sp}" fill="url(#sand)" fill-rule="evenodd"/>')
        G = T((gx, gy)); ang = -math.degrees(math.atan2(gx, gy))
        L.append(f'<g transform="rotate({ang:.1f} {G[0]:.1f} {G[1]:.1f})"><ellipse cx="{G[0]:.1f}" cy="{G[1]:.1f}" rx="{13*PX}" ry="{16*PX}" fill="#f8f0de" stroke="{INK}" stroke-width="1.5"/>'
                 f'<ellipse cx="{G[0]:.1f}" cy="{G[1]:.1f}" rx="{13*PX-4}" ry="{16*PX-4}" fill="none" stroke="{INK}" stroke-width=".6" stroke-dasharray="2 2"/></g>')
        L.append(f'<line x1="{G[0]:.1f}" y1="{G[1]:.1f}" x2="{G[0]:.1f}" y2="{G[1]-22:.1f}" stroke="{INK}" stroke-width="1.2"/><path d="M{G[0]:.1f},{G[1]-22:.1f} l11,4 l-11,4z" fill="{INK}"/>')
        Te = T((0, 0))
        L.append(f'<rect x="{Te[0]-9}" y="{Te[1]-5}" width="18" height="10" rx="3" fill="#f8f0de" stroke="{INK}" stroke-width="1.2"/>')
        s.label = (G, label_side, round(math.hypot(gx, gy)))
        return ''.join(L)
    def label_svg(s):
        G, side, length = s.label
        tx = G[0] + 115*side; ty = G[1] + 70
        anchor = 'start' if side > 0 else 'end'
        bx = tx - (92 if side < 0 else 6)
        return (f'<rect x="{bx}" y="{ty-20}" width="98" height="66" rx="4" fill="{PAPER}" opacity=".93"/>'
                f'<line x1="{G[0] + 30*side:.1f}" y1="{G[1]+6:.1f}" x2="{tx - 8*side:.1f}" y2="{ty-4:.1f}" stroke="{INK}" stroke-width="1"/>'
                f'<text x="{tx}" y="{ty}" class="lab" text-anchor="{anchor}">HOLE {s.n}</text><text x="{tx}" y="{ty+19}" class="lab" text-anchor="{anchor}">PAR 4</text>'
                f'<text x="{tx}" y="{ty+38}" class="lab sm" text-anchor="{anchor}">{length} M</text>')

import math, random, json, base64, sys
DEFS = eval('f' + repr(DEFS))   # fill in the colours
LOGO = base64.b64encode(open('public/logo.png', 'rb').read()).decode()

def build(n):
    random.seed(100 + n)
    sk = SK[str(n)]; gx, gy = sk['green']; v = sk['view']
    xa, xb = max(v[0], -135), min(v[2], 135)
    ya, yb = max(v[1], -35), min(v[3], gy + 60)
    global PX, PXI
    PXI = max(3.0, min(8.0, 1000 / (xb - xa)))   # ~1000 px wide, up to 8 px/m on short par 3s
    PX = PXI
    W, H = round((xb - xa) * PXI), round((yb - ya) * PXI)
    h = Hole(n, -xa * PXI, yb * PXI)          # local (0,0) = tee
    feats = h.svg(1)
    crowns = []
    step = 12.5 * PXI / 1.9
    y = -10
    while y < H + 10:
        x = -10 + random.random() * step
        while x < W + 10:
            jx, jy = x + random.uniform(-4, 4) * PXI / 1.9, y + random.uniform(-4, 4) * PXI / 1.9
            lx, ly = h.L(jx, jy)
            nz = (math.sin(lx*.04+1.3)*math.cos(ly*.033-.4) + .6*math.sin(lx*.09-ly*.075+2.1) + .4*math.cos(lx*.17+ly*.13))
            edge = min(jx, W - jx, jy, H - jy) / PXI
            pe = max(0, min(1, (edge - 4) / 30))
            ok = h.open_ground(lx, ly, 9)
            if ok is None or ok:
                near = ok and not h.open_ground(lx, ly, 24)
                p = 0.9 if near else (0.62 if ok is None else 0.5)
                if (near or nz > -.35) and random.random() < pe * p:
                    r = random.uniform(8, 12) if near else random.choice([random.uniform(6, 9), random.uniform(9, 13)])
                    crowns.append((jx, jy, r * PXI / 1.9))
            x += step
        y += step
    crowns.sort(key=lambda c: c[1])
    forest = ''.join(tree(x, y, r) for x, y, r in crowns)
    lw = min(W * .34, 220)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs><filter id="soft"><feGaussianBlur stdDeviation="{10*PXI}"/></filter>
<mask id="fade"><rect x="{6*PXI}" y="{6*PXI}" width="{W-12*PXI}" height="{H-12*PXI}" rx="{20*PXI}" fill="#fff" filter="url(#soft)"/></mask>
<filter id="wm"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope=".35" intercept=".05"/><feFuncG type="linear" slope=".45" intercept=".12"/><feFuncB type="linear" slope=".35" intercept=".08"/></feComponentTransfer></filter>
 {DEFS}</defs>
<rect width="{W}" height="{H}" fill="{PAPER}"/>
<g filter="url(#rough)"><g mask="url(#fade)"><rect width="{W}" height="{H}" fill="url(#stip)"/>{feats}{forest}</g></g>
<image href="data:image/png;base64,{LOGO}" x="{W - lw - 10*PXI}" y="{H - lw - 10*PXI}" width="{lw}" height="{lw}" opacity=".13" filter="url(#wm)"/>
<rect width="{W}" height="{H}" filter="url(#paper)"/>
</svg>'''
    open(f'out/hole-{n}.svg', 'w').write(svg)
    return {"px": round(PXI, 3), "x0": round(xa, 1), "x1": round(xb, 1), "y0": round(ya, 1), "y1": round(yb, 1), "w": W, "h": H, "trees": len(crowns)}

if __name__ == '__main__':
    import os; os.makedirs('out', exist_ok=True)
    meta = {}
    for n in (map(int, sys.argv[1:]) if len(sys.argv) > 1 else range(1, 19)):
        meta[n] = build(n); print(n, meta[n])
    json.dump(meta, open('out/meta.json', 'w'))
