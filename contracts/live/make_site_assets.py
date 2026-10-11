"""Assets for live_site.mjs: a JPEG anchor of a real site (steel frame stage), a later photograph of the same site with the
code lettered on the wall, and a photograph of a different site with the same code. All photographs are genuine
(Wikimedia Commons, see fixtures/sites/ATTRIBUTION.csv); only the lettering is added.    python contracts/live/make_site_assets.py"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from frames import block_thumb, prepare_frame  # noqa: E402
from PIL import Image  # noqa: E402
OUT = os.path.join(HERE, "assets")
os.makedirs(OUT, exist_ok=True)
find = lambda d, p: os.path.join(ROOT, "fixtures", d, next(f for f in os.listdir(os.path.join(ROOT, "fixtures", d)) if f.startswith(p) and f.endswith(".jpg")))

# anchor: 640 px colour JPEG of at most 100 KB
im = Image.open(find("sites", "s10_")).convert("RGB")
k = 640 / max(im.size)
im = im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
q = 80
import io
while True:
    b = io.BytesIO(); im.save(b, format="JPEG", quality=q); d = b.getvalue()
    if len(d) <= 100 * 1024: break
    q -= 5
open(os.path.join(OUT, "site_anchor.jpg"), "wb").write(d)
print("anchor", len(d), "bytes")

def shot(name, photo, pos, size, dark=False):
    tmp = os.path.join(OUT, name + "_src.jpg")
    subprocess.run([sys.executable, os.path.join(ROOT, "evidence", "make_scene.py"), "TREE BLUE", tmp, "--photo", photo, "--pos", pos, "--size", str(size)] + (["--dark"] if dark else []), check=True, capture_output=True)
    jpeg = prepare_frame(tmp)
    open(os.path.join(OUT, name + ".jpg"), "wb").write(jpeg)
    open(os.path.join(OUT, name + "_thumb.png"), "wb").write(block_thumb(jpeg))
    os.remove(tmp)
    print(name, len(jpeg), "bytes")

shot("site_same", find("sites", "s11_"), "0.14,0.355;0.14,0.405", 0.045, dark=True)
shot("site_other", find("web2", "w2_13_"), "0.17,0.20;0.17,0.30", 0.07)
