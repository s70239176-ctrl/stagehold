"""Writes the camera scene: a real construction-site photograph with a hand-lettered code on the wall.

The lettering uses a handwriting-style font with jitter, blur and wear (contracts/live/frames.py), because a
headless browser has no wall to write on. Replace --photo and the scenes with your own handwritten photographs
to run the same evidence on real ones.

    python evidence/make_scene.py "TREE BLUE" out.jpg [--photo path]
"""
import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "contracts", "live"))
from frames import chalk  # noqa: E402
from PIL import Image  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("code")
ap.add_argument("out")
ap.add_argument("--photo", default=os.path.join(ROOT, "fixtures", "web2", "w2_11_roof_done_candidate.jpg"))
ap.add_argument("--none", action="store_true", help="no code on the wall")
ap.add_argument("--pos", help="where the words go, as fractions of the picture: x,y;x,y (one pair per word). Default: the mud-house wall")
ap.add_argument("--dark", action="store_true", help="dark marker instead of white chalk (for a white wall)")
ap.add_argument("--size", type=float, default=None, help="letter size as a fraction of the picture width")
a = ap.parse_args()

img = Image.open(a.photo).convert("RGB")
if not a.none:
    words = a.code.split(" ")
    if a.pos:
        spots = [tuple(float(v) for v in s.split(",")) for s in a.pos.split(";")]
        size = round((a.size or 0.06) * img.size[0])
        for word, (fx, fy) in zip(words, spots):
            img = chalk(img, word, (round(fx * img.size[0]), round(fy * img.size[1])), size, color=(25, 30, 45) if a.dark else (245, 245, 235))
    else:
        cx = 832  # a clear wall right of the door, below the window (original-pixel coordinates of the mud-house photo)
        ys = [1070] if len(words) == 1 else [1030, 1125]
        for word, y in zip(words, ys):
            img = chalk(img, word, (cx, y), 74)
img.save(a.out, quality=90)
print("ok", a.out, img.size)
