"""Builds the 26 anchor/frame pairs of genuine photographs used to calibrate site verification.

Needs the photographs in fixtures/sites (fetched from Wikimedia Commons, see ATTRIBUTION.csv there) and fixtures/web, fixtures/web2.
Anchors are 640 px JPEGs of at most 100 KB; frames are 1280 px JPEGs of at most 150 KB, as the web client makes them.
"""
import io, json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = ROOT + "/calibration/pairs"
os.makedirs(OUT, exist_ok=True)
S = lambda n: next(f for f in os.listdir(ROOT + "/fixtures/sites") if f.startswith("s%02d_" % n) and f.endswith(".jpg"))
def path(x):
    if isinstance(x, int):
        return ROOT + "/fixtures/sites/" + S(x)
    for d in ("web2", "web"):
        for f in os.listdir(ROOT + "/fixtures/" + d):
            if f.startswith(x) and f.endswith(".jpg"):
                return ROOT + "/fixtures/%s/%s" % (d, f)
    raise KeyError(x)

def jpeg(src, long_edge, cap):
    im = Image.open(src).convert("RGB")
    k = long_edge / max(im.size)
    if k < 1:
        im = im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
    q = 80
    while True:
        b = io.BytesIO(); im.save(b, format="JPEG", quality=q); d = b.getvalue()
        if len(d) <= cap:
            return d
        if q > 40: q -= 5
        else: im = im.resize((round(im.size[0] * .88), round(im.size[1] * .88)), Image.LANCZOS); q = 70

# label: M_spot = same site, similar viewpoint, different stage/time; M_angle = same site, different angle; U = unrelated sites; U_hard = unrelated but look alike
PAIRS = [
    ("M1", "M_spot", 10, 11, "Highland Colour Coaters extension, steel frame then finished (same spot)"),
    ("M2", "M_spot", 20, 21, "Site 33W, October 2010 then January 2011 (same vantage)"),
    ("M3", "M_spot", 17, 19, "Liversedge cemetery field, June 2021, two shots"),
    ("M4", "M_spot", 16, 19, "Liversedge cemetery field, March then June 2021"),
    ("M5", "M_spot", 14, 16, "Liversedge cemetery field, November 2020 then March 2021"),
    ("M6", "M_spot", 3, 6, "Cowes Esplanade, the blue container, May then August 2010"),
    ("M7", "M_spot", 4, 5, "Cowes Esplanade, piling rig and church, May 2010"),
    ("M8", "M_angle", 1, 2, "Cowes Esplanade, hoarding in 2010 then the frame in 2011 (other angle)"),
    ("M9", "M_angle", 8, 9, "Fanshawe Road, the gate then the scaffolded houses (other angle)"),
    ("M10", "M_spot", "w2_05", "w2_06", "Two photographs of the same house under construction (Ted)"),
    ("M11", "M_spot", "w2_07", "w2_08", "Two photographs of the same residential site (Maina Pat Mbae)"),
    ("M12", "M_angle", 12, 13, "Liversedge cemetery, cleared land then field (other angle)"),
    ("U1", "U", 10, 20, "Highland building vs Site 33W"),
    ("U2", "U", 16, 3, "Liversedge field vs Cowes container"),
    ("U3", "U", 11, 2, "Highland finished building vs Cowes frame"),
    ("U4", "U", 14, 9, "Liversedge field vs Fanshawe houses"),
    ("U5", "U", 17, 4, "Liversedge field vs Cowes piling rig"),
    ("U6", "U", 21, 8, "Site 33W vs Fanshawe gate"),
    ("U7", "U", 13, 6, "Liversedge pond field vs Cowes container"),
    ("U8", "U", 5, 20, "Cowes piling rig vs Site 33W"),
    ("U9", "U", 19, 21, "Liversedge field vs Site 33W"),
    ("U10", "U_hard", "w2_05", "w2_07", "Two different houses under construction"),
    ("U11", "U_hard", "w2_01", "w2_02", "Two different houses under construction (Kwameghana)"),
    ("U12", "U_hard", "web_02", "web_03", "Roof trusses at two different sites"),
    ("U13", "U_hard", "w2_11", "w2_12", "Two different roofed houses"),
    ("U14", "U_hard", 8, "w2_03", "Scaffolded houses at two different sites"),
]
meta = []
for pid, label, a, b, note in PAIRS:
    ja = jpeg(path(a), 640, 100 * 1024)
    jb = jpeg(path(b), 1280, 150 * 1024)
    open("%s/%s_anchor.jpg" % (OUT, pid), "wb").write(ja)
    open("%s/%s_frame.jpg" % (OUT, pid), "wb").write(jb)
    meta.append({"id": pid, "label": label, "anchor": os.path.basename(path(a)), "frame": os.path.basename(path(b)), "note": note,
                 "anchor_kb": len(ja) // 1024, "frame_kb": len(jb) // 1024})
json.dump(meta, open(OUT + "/pairs.json", "w"), indent=1)
print(len(meta), "pairs", sum(1 for m in meta if m["label"].startswith("M")), "matching")
