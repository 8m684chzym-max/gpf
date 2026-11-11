import numpy as np, cv2, json, math, os
from PIL import Image
os.environ.setdefault('COURSE', 'estoril-blue')
from holes_meta import META
S=1206/920
d=json.load(open(os.environ.get('SKETCH', 'sketch.json')))
for n,(f,t,g,a,b) in META.items():
    im=np.asarray(Image.open(f'' + os.environ.get('SHOTS_DIR', 'screenshots') + f'/{f}-image.png').convert('RGB'))
    ra=math.dist(t,a[1:]); rb=math.dist(t,b[1:]); ppm=(rb-ra)/(b[0]-a[0])*S
    T=(t[0]*S,t[1]*S); G=(g[0]*S,g[1]*S)
    bl=cv2.GaussianBlur(im,(0,0),3)
    lab=cv2.cvtColor(bl,cv2.COLOR_RGB2LAB).astype(np.float32)
    H,W=im.shape[:2]; yy,xx=np.mgrid[:H,:W]
    R=22*ppm
    # seed colour: median in a ring 3-6 m around the green point (skip the white marker)
    rr=np.hypot(xx-G[0],yy-G[1])
    ring=(rr>3*ppm)&(rr<7*ppm)
    seed=np.median(lab[ring],0)
    dist=np.linalg.norm(lab-seed,axis=-1)
    m=((dist<14)&(rr<R)).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((int(ppm*2)|1,)*2,np.uint8))
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((int(ppm*2.5)|1,)*2,np.uint8))
    num,cc=cv2.connectedComponents(m)
    gi=cc[int(G[1]),int(G[0])]
    if gi==0:
        cands=[(np.sum(cc==i),i) for i in range(1,num)]
        gi=max(cands)[1] if cands else 0
    mk=(cc==gi).astype(np.uint8)
    cs,_=cv2.findContours(mk,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    c=max(cs,key=cv2.contourArea); c=cv2.convexHull(c)
    c=cv2.approxPolyDP(c,0.6*ppm,True).reshape(-1,2)
    poly=[[round((x-T[0])/ppm,1),round((T[1]-y)/ppm,1)] for x,y in c]
    area=cv2.contourArea(c)/ppm**2
    print(n,len(poly),round(area),'m2')
    d[str(n)]['greenPoly']=poly
    # debug crop
    vis=im.copy(); cv2.polylines(vis,[c.reshape(-1,1,2).astype(np.int32)],True,(255,0,255),3)
    x0,y0=int(G[0]-35*ppm),int(G[1]-35*ppm)
    Image.fromarray(vis[max(0,y0):y0+int(70*ppm),max(0,x0):x0+int(70*ppm)]).resize((300,300)).save(f'g{n}.png')
json.dump(d,open(os.environ.get('SKETCH', 'sketch.json'),'w'),separators=(',',':'))
