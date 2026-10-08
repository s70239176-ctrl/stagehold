"""Make a shot (JPEG frame + PNG thumbnail) with a given code drawn on a clear wall.

   python contracts/live/make_code_asset.py <CODE> <out-prefix>
Writes contracts/live/assets/<out-prefix>.jpg and <out-prefix>_thumb.png.  SYNTHETIC test image.

The code goes on the clear wall right of the door of the mud house (fixtures/web2/w2_11), one word
per line, so it sits entirely on the building work and is large enough to read.
"""

import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from frames import chalk, prepare_frame  # noqa: E402
from PIL import Image  # noqa: E402

code, prefix = sys.argv[1], sys.argv[2]
img = Image.open(os.path.join(ROOT, "fixtures", "web2", "w2_11_roof_done_candidate.jpg")).convert("RGB")
words = code.split(" ")
cx = 832                      # clear wall right of the door, below the window (original-pixel coordinates)
ys = [1070] if len(words) == 1 else [1030, 1125]
for word, y in zip(words, ys):
    img = chalk(img, word, (cx, y), 74)
tmp = os.path.join(HERE, "assets", prefix + "_src.jpg")
img.save(tmp, quality=90)
open(os.path.join(HERE, "assets", prefix + ".jpg"), "wb").write(prepare_frame(tmp))
buf = io.BytesIO()
img.convert("L").resize((120, 160), Image.BILINEAR).save(buf, format="PNG", optimize=True)
open(os.path.join(HERE, "assets", prefix + "_thumb.png"), "wb").write(buf.getvalue())
os.remove(tmp)
print("ok", code, prefix)
