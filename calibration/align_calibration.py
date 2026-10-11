"""Scores every pair with the contract's deterministic edge-overlap alignment and reports how well it separates
matching sites from unrelated ones (AUC and the best threshold)."""
import io, json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT + "/contracts/src")
sys.path.insert(0, ROOT + "/contracts/live")
import align  # noqa: E402
from frames import block_thumb  # noqa: E402
from jpegdc import parse_jpeg_dc  # noqa: E402

pairs = json.load(open(ROOT + "/calibration/pairs/pairs.json"))
rows = []
for p in pairs:
    a = open(f"{ROOT}/calibration/pairs/{p['id']}_anchor.jpg", "rb").read()
    f = open(f"{ROOT}/calibration/pairs/{p['id']}_frame.jpg", "rb").read()
    anchor_grid = parse_jpeg_dc(a)[2]            # what the contract derives from a JPEG anchor
    thumb = block_thumb(f)                       # what the client sends
    rows.append((p["id"], p["label"], align.alignment_permille(anchor_grid, thumb)))
rows_m = [r for r in rows if r[1].startswith("M")]
rows_u = [r for r in rows if r[1].startswith("U")]
for r in rows:
    print("%-4s %-8s %4d" % r)
m = np.array([r[2] for r in rows_m]); u = np.array([r[2] for r in rows_u])
# AUC: probability a random matching pair scores above a random unrelated pair
auc = np.mean([(a > b) + 0.5 * (a == b) for a in m for b in u])
print("matching n=%d min %d median %d max %d" % (len(m), m.min(), np.median(m), m.max()))
print("unrelated n=%d min %d median %d max %d" % (len(u), u.min(), np.median(u), u.max()))
print("AUC", round(float(auc), 3))
best = max(range(0, 1001, 5), key=lambda t: (np.mean(m >= t) - np.mean(u >= t)))
print("best threshold %d: matching accepted %.0f%%, unrelated accepted %.0f%%" % (best, 100 * np.mean(m >= best), 100 * np.mean(u >= best)))
json.dump({"rows": rows, "auc": float(auc), "best": best}, open(ROOT + "/calibration/pairs/align_scores.json", "w"))
