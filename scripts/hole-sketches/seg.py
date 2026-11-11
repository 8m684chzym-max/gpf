import numpy as np, cv2, math
from PIL import Image
from holes_meta import META, U, COURSE
EST = COURSE == 'estoril-blue'   # small, compressed screenshots: bluish-grey tree shade
S = 1206/920
SCRUB, GRASS, SAND, WATER, TREE, UNK = 0,1,2,3,4,5
PAL = np.array([[233,223,196],[31,138,100],[255,244,214],[47,111,143],[12,58,44],[255,0,255]],np.uint8)

def load(n):
    f,t,g,a,b = META[n]
    im = np.asarray(Image.open(U+f+'-image.png').convert('RGB'))
    ra=math.dist(t,a[1:]); rb=math.dist(t,b[1:]); ppm=(rb-ra)/(b[0]-a[0])
    return im, (t[0]*S,t[1]*S), (g[0]*S,g[1]*S), ppm*S, ppm

def ui_mask(im, n):
    I = im.astype(int); R,G,B = I[...,0],I[...,1],I[...,2]
    lum = (R+G+B)/3; mx = I.max(-1); mn = I.min(-1); chroma = mx-mn
    m = np.zeros(R.shape, bool)
    m |= (lum>178) & (chroma<20)                     # white / grey UI, grey arcs, line
    m |= (B>G+22) & (B>R+22)                          # blue UI / blue arcs / lavender
    m |= (R>190)&(G>120)&(B<110)&(R-B>110)            # orange arc, yellow icons, yellow pill
    m |= (R>180)&(G<140)&(B<120)                      # red arc
    if EST: m |= (B>G+18)&(B>R+28)&(lum<90)           # navy panels/labels (tree shade is bluish here)
    else: m |= (B>G+6)&(B>R+12)&(lum<90)              # navy panels/labels
    m |= (G>190)&(G>R+10)&(G>B+20)                    # light green arcs (par 3)
    m = cv2.dilate(m.astype(np.uint8), np.ones((7,7),np.uint8))>0
    H,W = R.shape
    # fixed UI: status bar, bottom bar, right buttons, plays-like pill
    def rect(x0,y0,x1,y1): m[int(y0*S):int(y1*S), int(x0*S):int(x1*S)] = True
    rect(0,0,920,120); rect(0,1785,920,2000); rect(755,205,880,580); rect(760,1635,880,1750)
    rect(40,182,320,252)
    return m

def classify(im, n):
    I = cv2.GaussianBlur(im,(0,0),2).astype(int); R,G,B = I[...,0],I[...,1],I[...,2]
    lum = (R+G+B)/3
    gray = cv2.cvtColor(im, cv2.COLOR_RGB2GRAY).astype(np.float32)
    mu = cv2.blur(gray,(15,15)); tex = np.sqrt(np.maximum(cv2.blur(gray*gray,(15,15))-mu*mu,0))
    lab = np.full(R.shape, SCRUB, np.uint8)
    grass = (G-R>=6)&(G-B>=12)&(lum>=78)&(lum<=200)
    lab[grass] = GRASS
    sand = (lum>=172)&(R>=G-2)&(G>=B)&(R-B>=12)&(R-B<=90)&(tex<28)
    lab[sand] = SAND
    dark = (lum<88)&(G-R>=7)&(G-B>=3)
    d = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9,9),np.uint8))
    num, cc, st, _ = cv2.connectedComponentsWithStats(d)
    water = np.zeros_like(dark)
    ppm_full = load(n)[3]
    for i in range(1,num):
        if st[i,4] < 9000: continue
        mk = cc==i
        area = st[i,4]/ppm_full**2; t = float(tex[mk].mean()); br = float((B-R)[mk].mean())
        # trees in shade look like dark water; water is smoother and bluer
        if area >= 250 and t < 12 and (br >= -7 or (br >= -8.5 and t < 9)):
            water |= mk
    lab[water] = WATER
    tree = ((lum<96)&(G-R<=12) if EST else (lum<72))&~water
    lab[tree & (lab!=SAND)] = TREE
    return lab

def fill_unknown(lab, m):
    lab = lab.copy(); lab[m] = UNK
    known = (lab!=UNK).astype(np.uint8)
    _, idx = cv2.distanceTransformWithLabels(1-known, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(known)
    lut = lab[ys, xs]
    # labels of DIST_LABEL_PIXEL enumerate zero pixels (known) in row-major order
    return lut[idx-1]

def mode_filter(lab, k):
    best = None; bestc = None
    for c in range(5):
        s = cv2.blur((lab==c).astype(np.float32),(k,k))
        if best is None: best, bestc = s, np.zeros(lab.shape,np.uint8)
        else:
            upd = s>best; best[upd]=s[upd]; bestc[upd]=c
    return bestc

def segment(n):
    im, tee, green, ppm_full, ppm = load(n)
    lab = classify(im, n)
    m = ui_mask(im, n)
    lab = fill_unknown(lab, m)
    k = max(5, int(ppm_full*2.2)|1)   # ~2 m smoothing
    lab = mode_filter(lab, k)
    return im, lab, tee, green, ppm_full

if __name__ == '__main__':
    import sys
    for n in map(int, sys.argv[1:]):
        im, lab, tee, green, ppm = segment(n)
        out = np.concatenate([im, PAL[lab]], 1)
        Image.fromarray(out).resize((600, 652)).save(f'seg{n}.png')
