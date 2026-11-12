import math, sys, os, io, requests
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
URL="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
os.makedirs("tiles",exist_ok=True)
def ll2px(lat,lng,z):
    n=256*2**z; x=(lng+180)/360*n
    y=(1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*n
    return x,y
def px2ll(x,y,z):
    n=256*2**z; lng=x/n*360-180
    lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n)))); return lat,lng
def tile(z,x,y):
    p=f"tiles/{z}_{x}_{y}.jpg"
    if not os.path.exists(p):
        r=requests.get(URL.format(z=z,x=x,y=y),timeout=30); r.raise_for_status(); open(p,"wb").write(r.content)
    return Image.open(p).convert("RGB")
def stitch(lat1,lng1,lat2,lng2,z,out):
    x1,y1=ll2px(max(lat1,lat2),min(lng1,lng2),z); x2,y2=ll2px(min(lat1,lat2),max(lng1,lng2),z)
    tx1,ty1,tx2,ty2=int(x1//256),int(y1//256),int(x2//256),int(y2//256)
    W=(tx2-tx1+1)*256;H=(ty2-ty1+1)*256; im=Image.new("RGB",(W,H))
    jobs=[(tx,ty) for tx in range(tx1,tx2+1) for ty in range(ty1,ty2+1)]
    with ThreadPoolExecutor(16) as ex:
        for (tx,ty),t in zip(jobs,ex.map(lambda j:tile(z,*j),jobs)): im.paste(t,((tx-tx1)*256,(ty-ty1)*256))
    im=im.crop((int(x1-tx1*256),int(y1-ty1*256),int(x2-tx1*256),int(y2-ty1*256)))
    im.save(out); return (x1,y1,z)
if __name__=="__main__":
    a=sys.argv; o=stitch(float(a[1]),float(a[2]),float(a[3]),float(a[4]),int(a[5]),a[6]); print(o, Image.open(a[6]).size)
