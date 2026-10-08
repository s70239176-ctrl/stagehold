"""Build test assets for the live Studionet run: an anchor thumbnail, a good shot and a wrong-code shot.

Frames are re-encoded like the app will (JPEG <= 150 KB), thumbnails are grayscale PNGs <= 30 KB.
All frames here are the SYNTHETIC test images (drawn code).   python contracts/live/make_assets.py
"""

import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from frames import prepare_frame  # noqa: E402
from PIL import Image  # noqa: E402

OUT = os.path.join(HERE, "assets")
os.makedirs(OUT, exist_ok=True)


def thumb_png(path, name, side=(160, 120)):
    img = Image.open(path).convert("L")
    img = img.resize(side, Image.BILINEAR)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    data = buf.getvalue()
    assert len(data) <= 30 * 1024, (name, len(data))
    open(os.path.join(OUT, name), "wb").write(data)
    return len(data)


synth = os.path.join(ROOT, "fixtures", "synth")
print("anchor thumb", thumb_png(os.path.join(synth, "h1_nocode.jpg"), "anchor.png"), "bytes")
for tag, src in (("good", "h1_code.jpg"), ("bad", "h1_wrongcode.jpg")):
    jpeg = prepare_frame(os.path.join(synth, src))
    open(os.path.join(OUT, tag + ".jpg"), "wb").write(jpeg)
    print(tag, "frame", len(jpeg), "bytes; thumb", thumb_png(os.path.join(synth, src), tag + "_thumb.png"), "bytes")
