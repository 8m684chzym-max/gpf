import numpy as np, cv2, json, math, sys
from seg import segment, S, GRASS, SAND, WATER, TREE
Y0, Y1 = int(125*S), int(1782*S)

def polys(mask, ppm, tee, min_m2, eps_m):
    mask = mask.astype(np.uint8)
    mask[:Y0] = 0; mask[Y1:] = 0
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    if hier is None: return out
    hier = hier[0]
    def conv(c):
        c = cv2.approxPolyDP(c, eps_m*ppm, True).reshape(-1,2)
        return [[round((x-tee[0])/ppm,1), round((tee[1]-y)/ppm,1)] for x,y in c]
    for i,c in enumerate(cs):
        if hier[i][3] != -1: continue           # holes handled with their parent
        if cv2.contourArea(c)/ppm**2 < min_m2: continue
        rings = [conv(c)]
        j = hier[i][2]
        while j != -1:
            if cv2.contourArea(cs[j])/ppm**2 >= min_m2: rings.append(conv(cs[j]))
            j = hier[j][0]
        rings = [r for r in rings if len(r) >= 3]
        if rings: out.append(rings)
    return out

def trees(lab, ppm, tee):
    m = (lab==TREE).astype(np.uint8); m[:Y0]=0; m[Y1:]=0
    num, cc, st, cen = cv2.connectedComponentsWithStats(m)
    res = []
    for i in range(1,num):
        a = st[i,4]/ppm**2
        if a < 8: continue
        x,y = cen[i]
        if a > 400:   # big clump: keep as a polygon instead
            continue
        res.append([round((x-tee[0])/ppm,1), round((tee[1]-y)/ppm,1), round(min(4.5, 0.8*math.sqrt(a/math.pi)),1)])
    res.sort(key=lambda t:-t[2])
    return res[:180]

def build(n):
    im, lab, tee, green, ppm = segment(n)
    big = (lab==TREE).astype(np.uint8)
    num, cc, st, _ = cv2.connectedComponentsWithStats(big)
    keep = np.isin(cc, [i for i in range(1,num) if st[i,4]/ppm**2 > 400])
    gx, gy = round((green[0]-tee[0])/ppm,1), round((tee[1]-green[1])/ppm,1)
    return {
        "green": [gx, gy],
        "grass": polys(lab==GRASS, ppm, tee, 40, 0.9),
        "water": polys(lab==WATER, ppm, tee, 60, 0.9),
        "sand":  polys(lab==SAND, ppm, tee, 8, 0.6),
        "woods": polys(keep, ppm, tee, 400, 1.2),
        "trees": trees(lab, ppm, tee),
        "view": [round((0-tee[0])/ppm,1), round((tee[1]-Y1)/ppm,1), round((im.shape[1]-tee[0])/ppm,1), round((tee[1]-Y0)/ppm,1)],
    }

if __name__ == '__main__':
    ns = list(map(int, sys.argv[1:])) or list(range(1,19))
    allh = {}
    for n in ns:
        allh[n] = build(n); print(n, len(json.dumps(allh[n])))
    json.dump(allh, open('sketch.json','w'), separators=(',',':'))
