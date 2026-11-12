# Make Hole19-style "screenshots" (1206x2622, tee at display (460,1715), green at (460,270))
# from Esri World Imagery for each hole, plus the holes_meta file for the sketch pipeline.
import json, math, os, re, sys, numpy as np, cv2
from stitch import ll2px, stitch
S = 1206/920; W, H = 1206, 2622
TEE_D, GRN_D = (460, 1715), (460, 270)
src = open(os.path.join(os.path.dirname(__file__), '../../src/lib/holes.js')).read()
blk = src[src.index('LISBON_SPORTS_CLUB'):]; blk = blk[blk.index('geo: ['):blk.index('\n  ],', blk.index('geo: ['))]
geo = {int(m.group(1)): ((float(m.group(2)), float(m.group(3))), (float(m.group(4)), float(m.group(5))))
       for m in re.finditer(r'/\*\s*(\d+) \*/ \[\[([\d.-]+), ([\d.-]+)\], \[([\d.-]+), ([\d.-]+)\]', blk)}
Z = 19
meta = {}
for n,(tee,grn) in sorted(geo.items()):
    kx = 111320*math.cos(math.radians(tee[0])); ky = 110574
    L = math.hypot((grn[1]-tee[1])*kx, (grn[0]-tee[0])*ky)
    ppd = (TEE_D[1]-GRN_D[1]) / L          # display px per metre
    ppf = ppd*S                             # full-res px per metre
    # world px (z19) of tee / green, metres per world px
    tx, ty = ll2px(*tee, Z); gx, gy = ll2px(*grn, Z)
    mpw = 156543.03392*math.cos(math.radians(tee[0]))/2**Z
    # mosaic covering the output frame (radius = frame diagonal in metres)
    R = math.hypot(W, H)/ppf * 0.75
    cx, cy = (tx+gx)/2, (ty+gy)/2
    from stitch import px2ll
    rpx = R/mpw
    a = px2ll(cx-rpx, cy-rpx, Z); b = px2ll(cx+rpx, cy+rpx, Z)
    ox, oy, _ = stitch(a[0], a[1], b[0], b[1], Z, f'/tmp/mos{n}.jpg')
    mos = cv2.imread(f'/tmp/mos{n}.jpg')
    # affine: output full-res px -> mosaic px. Tee -> tee, "up" -> toward green.
    T_out = np.array([TEE_D[0]*S, TEE_D[1]*S]); G_out = np.array([GRN_D[0]*S, GRN_D[1]*S])
    T_in = np.array([tx-ox, ty-oy]); G_in = np.array([gx-ox, gy-oy])
    vo = G_out-T_out; vi = G_in-T_in
    s = np.linalg.norm(vi)/np.linalg.norm(vo); th = math.atan2(vi[1],vi[0]) - math.atan2(vo[1],vo[0])
    c, sn = s*math.cos(th), s*math.sin(th)
    M = np.array([[c,-sn,0],[sn,c,0]]); M[:,2] = T_in - M[:,:2]@T_out
    out = cv2.warpAffine(mos, M, (W,H), flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP, borderValue=(60,90,60))
    cv2.imwrite(os.path.join(os.environ.get('SHOTS_DIR', 'screenshots'), f'l{n}-image.png'), out)
    ra, rb = (25, 75) if L < 160 else (50, 150 if L < 300 else 200)
    meta[n] = (f'l{n}', TEE_D, GRN_D, (ra, TEE_D[0], round(TEE_D[1]-ra*ppd)), (rb, TEE_D[0], round(TEE_D[1]-rb*ppd)))
    print(n, round(L), 'm', round(ppf,2), 'px/m')
with open(os.path.join(os.path.dirname(__file__), 'holes_meta_lisbon_sports_club.py'),'w') as f:
    f.write("# Lisbon Sports Club (18 holes). Same format as holes_meta.py, display coords (920x2000).\n"
            "# Source: Esri World Imagery (ArcGIS), rotated tee-bottom / green-top by gen-shots-arcgis.py\n"
            "# from the tee / green GPS in src/lib/holes.js. Arcs are synthetic (scale only).\nMETA = {\n")
    for n,v in meta.items(): f.write(f" {n}: {v!r},\n")
    f.write("}\n")
