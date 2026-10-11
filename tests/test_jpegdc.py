"""Desktop tests of contracts/src/jpegdc.py against Pillow's own decoder."""
import io, os, sys, time, random
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "contracts", "src"))
from jpegdc import parse_jpeg_dc  # noqa: E402

fails = 0
def check(name, ok, detail=""):
    global fails
    print(("PASS " if ok else "FAIL ") + name + (" " + detail if detail else ""))
    if not ok:
        fails += 1

def reference(img, w, h):
    g = img.convert("L")
    cols, rows = (w + 7) // 8, (h + 7) // 8
    padded = Image.new("L", (cols * 8, rows * 8))
    padded.paste(g, (0, 0))
    # edge replicate like the encoder does
    arr = np.array(padded, dtype=np.float32)
    ga = np.array(g, dtype=np.float32)
    if cols * 8 > w:
        arr[:h, w:] = ga[:, -1:]
    if rows * 8 > h:
        arr[h:, :] = arr[h - 1:h, :]
    return arr.reshape(rows, 8, cols, 8).mean(axis=(1, 3))

def synth(w, h, seed=1):
    rnd = np.random.RandomState(seed)
    x = np.linspace(0, 6, w)[None, :]
    y = np.linspace(0, 4, h)[:, None]
    base = 128 + 70 * np.sin(x * 2) * np.cos(y * 3)
    rgb = np.stack([base + 20 * np.sin(y), base, base - 30 * np.cos(x)], axis=-1)
    rgb += rnd.normal(0, 6, rgb.shape)
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))

def run(label, img, **kw):
    buf = io.BytesIO()
    img.save(buf, format="JPEG", **kw)
    data = buf.getvalue()
    t = time.time()
    w, h, luma = parse_jpeg_dc(data)
    dt = time.time() - t
    ref = reference(Image.open(io.BytesIO(data)), img.size[0], img.size[1])
    got = np.array(luma, dtype=np.float32)
    mad = float(np.abs(got - ref).mean())
    check(f"{label}: size and dc grid shape", (w, h) == img.size and got.shape == ref.shape, f"{len(data)} bytes, {dt:.2f}s")
    check(f"{label}: matches Pillow's decode (mean abs diff {mad:.2f})", mad < 2.0)

run("1280x720 q80 4:2:0", synth(1280, 720), quality=80, subsampling=2)
run("1280x720 q60 4:4:4", synth(1280, 720, 2), quality=60, subsampling=0)
run("odd size 333x251 4:2:0", synth(333, 251, 3), quality=85, subsampling=2)
run("grayscale 400x300", synth(400, 300, 4).convert("L"), quality=85)
run("restart interval", synth(640, 480, 5), quality=75, subsampling=2, restart_marker_blocks=7) if "restart_marker_blocks" in Image.SAVE.__doc__ or True else None
for name, f in (("progressive", dict(progressive=True, quality=80)),):
    buf = io.BytesIO(); synth(200, 200).save(buf, format="JPEG", **f)
    try:
        parse_jpeg_dc(buf.getvalue()); ok = False
    except ValueError:
        ok = True
    check("progressive JPEG is refused", ok)
for bad in (b"", b"\xff\xd8", b"not a jpeg", b"\xff\xd8\xff\xd9"):
    try:
        parse_jpeg_dc(bad); ok = False
    except (ValueError, IndexError):
        ok = True
    check(f"garbage {bad[:8]!r} is refused", ok)
buf = io.BytesIO(); synth(640, 480).save(buf, format="JPEG", quality=80)
cut = buf.getvalue()[: len(buf.getvalue()) // 2]
try:
    parse_jpeg_dc(cut); ok = False
except (ValueError, IndexError):
    ok = True
check("truncated JPEG is refused", ok)
print("\nFAILURES:", fails)
sys.exit(1 if fails else 0)
