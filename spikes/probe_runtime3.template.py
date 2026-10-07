# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Stagehold spike probe 3: lossy WebP decode and P-384 constants.

Read-only, no state, no funds. One view method per test so a crash in one cannot hide the others.
Call order: ping, probe_p384, probe_numpy_pure, probe_png_resize, probe_webp_open, probe_webp_load (decode last: a native decoder crash would take only that call down).
Answers:
  1. Can the runtime DECODE a lossy WebP? (If yes, the app can sign one WebP that
     is both the model's image and the alignment input, with no trust gap.)
  2. Does the decoded grayscale sum match the sum computed with a desktop decoder?
     (The checksum can legitimately differ between libwebp versions; a mismatch is
     information about cross-validator determinism risk, not necessarily an error.)
  3. Are the NumPy operations we would use for alignment stable (we return hashes of results)?
  4. Are the P-384 curve constants I would hard-code correct? (Checked by curve equation
     and by n*G == infinity, which needs no external test vector.)
"""

from genlayer import *
import json

WEBP_HEX = "@@WEBP@@"
EXPECTED_GRAY_SUM = 581847  # computed locally with a desktop libwebp

P384_P = (1 << 384) - (1 << 128) - (1 << 96) + (1 << 32) - 1
P384_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC7634D81F4372DDF581A0DB248B0A77AECEC196ACCC52973
P384_B = 0xB3312FA7E23EE7E4988E056BE3F82D19181D9C6EFE8141120314088F5013875AC656398D8A2ED19D2A85C8EDD3EC2AEF
P384_GX = 0xAA87CA22BE8B05378EB1C71EF320AD746E1D3B628BA79B9859F741E082542A385502F25DBF55296C3A545E3872760AB7
P384_GY = 0x3617DE4A96262C6F5D9E98BF9292DC29F8F41DBD289A147CE9DA3113B5F0B8C00A60B1CE1D7E819D7A431D7C90EA0E5F


def _try(name: str, fn) -> dict:
    try:
        return {"name": name, "ok": True, "detail": str(fn())[:300]}
    except BaseException as exc:  # noqa: BLE001 - probe must never raise
        return {"name": name, "ok": False, "detail": (type(exc).__name__ + ": " + str(exc))[:300]}


def _webp_decode():
    import io
    import numpy as np
    from PIL import Image

    raw = bytes.fromhex(WEBP_HEX)
    img = Image.open(io.BytesIO(raw))
    img.load()
    arr = np.asarray(img.convert("L"), dtype=np.uint8)
    total = int(arr.sum())
    return (
        "size=" + str(img.size) + " mode=" + img.mode + " gray_sum=" + str(total)
        + " matches_desktop=" + str(total == EXPECTED_GRAY_SUM)
    )


def _numpy_stability():
    import hashlib
    import io
    import numpy as np
    from PIL import Image

    raw = bytes.fromhex(WEBP_HEX)
    img = Image.open(io.BytesIO(raw)).convert("L")
    small = img.resize((16, 16), Image.BILINEAR)
    a = np.asarray(small, dtype=np.int32)
    gx = np.abs(np.diff(a, axis=1))
    gy = np.abs(np.diff(a, axis=0))
    edge = int(gx.sum() + gy.sum())
    # integer-only shift search of the downscaled image against itself shifted by 1 px
    best = None
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            shifted = np.roll(np.roll(a, dx, axis=1), dy, axis=0)
            score = int(np.abs(a - shifted).sum())
            if best is None or score < best[0]:
                best = (score, dx, dy)
    digest = hashlib.sha256(a.tobytes()).hexdigest()[:16]
    return "edge=" + str(edge) + " best_shift=" + str(best) + " small_sha=" + digest


def _p384_constants():
    p = P384_P
    on_curve = (P384_GY * P384_GY - (P384_GX ** 3 - 3 * P384_GX + P384_B)) % p == 0

    def dbl(pt):
        if pt is None:
            return None
        x, y, z = pt
        if y == 0:
            return None
        delta = z * z % p
        gamma = y * y % p
        beta = x * gamma % p
        alpha = 3 * (x - delta) * (x + delta) % p
        x3 = (alpha * alpha - 8 * beta) % p
        z3 = ((y + z) * (y + z) - gamma - delta) % p
        y3 = (alpha * (4 * beta - x3) - 8 * gamma * gamma) % p
        return (x3, y3, z3)

    def add(p1, p2):
        if p1 is None:
            return p2
        if p2 is None:
            return p1
        x1, y1, z1 = p1
        x2, y2, z2 = p2
        z1z1 = z1 * z1 % p
        z2z2 = z2 * z2 % p
        u1 = x1 * z2z2 % p
        u2 = x2 * z1z1 % p
        s1 = y1 * z2 * z2z2 % p
        s2 = y2 * z1 * z1z1 % p
        h = (u2 - u1) % p
        if h == 0:
            return dbl(p1) if s1 == s2 else None
        i = (2 * h) * (2 * h) % p
        j = h * i % p
        r = 2 * (s2 - s1) % p
        v = u1 * i % p
        x3 = (r * r - j - 2 * v) % p
        y3 = (r * (v - x3) - 2 * s1 * j) % p
        z3 = (((z1 + z2) * (z1 + z2) - z1z1 - z2z2) * h) % p
        return (x3, y3, z3)

    def mul(k, pt):
        result = None
        addend = pt
        while k > 0:
            if k & 1:
                result = add(result, addend)
            addend = dbl(addend)
            k >>= 1
        return result

    # (n-1)*G + G must be the point at infinity, and 2*G must differ from G.
    g = (P384_GX, P384_GY, 1)
    nm1 = mul(P384_N - 1, g)
    total = add(nm1, g)
    return "g_on_curve=" + str(on_curve) + " n_times_G_is_infinity=" + str(total is None)


def _numpy_pure():
    import hashlib
    import numpy as np

    a = ((np.arange(256, dtype=np.int32).reshape(16, 16) * 37) % 251).astype(np.int32)
    gx = np.abs(np.diff(a, axis=1))
    gy = np.abs(np.diff(a, axis=0))
    edge = int(gx.sum() + gy.sum())
    best = None
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            shifted = np.roll(np.roll(a, dx, axis=1), dy, axis=0)
            score = int(np.abs(a - shifted).sum())
            if best is None or score < best[0]:
                best = (score, dx, dy)
    return "edge=" + str(edge) + " best=" + str(best) + " sha=" + hashlib.sha256(a.tobytes()).hexdigest()[:16]


def _png_resize():
    import hashlib
    import io
    import numpy as np
    from PIL import Image

    arr = ((np.arange(64 * 64, dtype=np.int32).reshape(64, 64) * 7) % 256).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr, mode="L").save(buf, format="PNG")
    img = Image.open(io.BytesIO(buf.getvalue()))
    small = img.resize((16, 16), Image.BILINEAR)
    out = np.asarray(small, dtype=np.uint8)
    return "resized sha=" + hashlib.sha256(out.tobytes()).hexdigest()[:16] + " sum=" + str(int(out.sum()))


def _webp_open():
    import io
    from PIL import Image

    img = Image.open(io.BytesIO(bytes.fromhex(WEBP_HEX)))
    return "opened (header only) size=" + str(img.size) + " mode=" + img.mode + " format=" + str(img.format)


class StageholdProbe3(gl.Contract):
    marker: str

    def __init__(self):
        self.marker = "stagehold-probe-3"

    @gl.public.view
    def ping(self) -> str:
        return "alive"

    @gl.public.view
    def probe_p384(self) -> str:
        return json.dumps(_try("P-384 constants", _p384_constants))

    @gl.public.view
    def probe_numpy_pure(self) -> str:
        return json.dumps(_try("numpy ops, no image decode", _numpy_pure))

    @gl.public.view
    def probe_png_resize(self) -> str:
        return json.dumps(_try("PNG decode + resize + numpy", _png_resize))

    @gl.public.view
    def probe_webp_open(self) -> str:
        return json.dumps(_try("WebP open (header only)", _webp_open))

    @gl.public.view
    def probe_webp_load(self) -> str:
        return json.dumps(_try("lossy WebP full decode", _webp_decode))
