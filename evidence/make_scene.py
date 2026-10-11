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
a = ap.parse_args()

img = Image.open(a.photo).convert("RGB")
if not a.none:
    words = a.code.split(" ")
    cx = 832  # a clear wall right of the door, below the window (original-pixel coordinates of the mud-house photo)
    ys = [1070] if len(words) == 1 else [1030, 1125]
    for word, y in zip(words, ys):
        img = chalk(img, word, (cx, y), 74)
img.save(a.out, quality=90)
print("ok", a.out, img.size)
