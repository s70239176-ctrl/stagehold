# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Stagehold spike probe 2: image decoding and hand-written signature math.

Read-only, no state, no funds. Answers:
  1. Can PIL DECODE a JPEG (the encoder is known to be missing)? PNG round trip? Which codecs exist?
  2. Do sha1/sha384/sha512 exist (X.509 chains use them)?
  3. Does a pure-Python ECDSA P-256 verify complete inside the runtime, and is it correct?
     (RFC 6979 A.2.5 vector, plus a self-sign/self-verify consistency check so a wrong
     recalled vector cannot be mistaken for a runtime failure.)
  4. Does a 4096-bit RSA public-key exponentiation complete?

`probe(reps)` repeats the P-256 verify `reps` times so call latency can be compared
for reps=1 versus reps=10.
"""

from genlayer import *
import json

JPEG_HEX = "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080010001003012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00f37d3b40e9f2575da7681d3e4fd2ba4d3b40e9f27e95d769da074f928a554321cfb6d4ffd9"

P = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF
N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
GX = 0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296
GY = 0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5


def _dbl(pt):
    if pt is None:
        return None
    x, y, z = pt
    if y == 0:
        return None
    delta = z * z % P
    gamma = y * y % P
    beta = x * gamma % P
    alpha = 3 * (x - delta) * (x + delta) % P
    x3 = (alpha * alpha - 8 * beta) % P
    z3 = ((y + z) * (y + z) - gamma - delta) % P
    y3 = (alpha * (4 * beta - x3) - 8 * gamma * gamma) % P
    return (x3, y3, z3)


def _add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1, z1 = p1
    x2, y2, z2 = p2
    z1z1 = z1 * z1 % P
    z2z2 = z2 * z2 % P
    u1 = x1 * z2z2 % P
    u2 = x2 * z1z1 % P
    s1 = y1 * z2 * z2z2 % P
    s2 = y2 * z1 * z1z1 % P
    h = (u2 - u1) % P
    if h == 0:
        if s1 == s2:
            return _dbl(p1)
        return None
    i = (2 * h) * (2 * h) % P
    j = h * i % P
    r = 2 * (s2 - s1) % P
    v = u1 * i % P
    x3 = (r * r - j - 2 * v) % P
    y3 = (r * (v - x3) - 2 * s1 * j) % P
    z3 = (((z1 + z2) * (z1 + z2) - z1z1 - z2z2) * h) % P
    return (x3, y3, z3)


def _mul(k, pt):
    result = None
    addend = pt
    while k > 0:
        if k & 1:
            result = _add(result, addend)
        addend = _dbl(addend)
        k >>= 1
    return result


def _affine(pt):
    if pt is None:
        return None
    x, y, z = pt
    zi = pow(z, P - 2, P)
    zi2 = zi * zi % P
    return (x * zi2 % P, y * zi2 * zi % P)


def _verify(qx, qy, z, r, s) -> bool:
    if not (1 <= r < N and 1 <= s < N):
        return False
    w = pow(s, N - 2, N)
    u1 = z * w % N
    u2 = r * w % N
    pt = _add(_mul(u1, (GX, GY, 1)), _mul(u2, (qx, qy, 1)))
    aff = _affine(pt)
    if aff is None:
        return False
    return aff[0] % N == r


def _try(name: str, fn) -> dict:
    try:
        return {"name": name, "ok": True, "detail": str(fn())[:300]}
    except BaseException as exc:  # noqa: BLE001 - probe must never raise
        return {"name": name, "ok": False, "detail": (type(exc).__name__ + ": " + str(exc))[:300]}


def _codecs():
    from PIL import features

    out = []
    for c in ("jpg", "zlib", "jpg_2000", "libtiff"):
        try:
            out.append(c + ":" + str(features.check_codec(c)))
        except BaseException as exc:  # noqa: BLE001
            out.append(c + ":err " + type(exc).__name__)
    for m in ("webp", "freetype2", "littlecms2"):
        try:
            out.append(m + ":" + str(features.check_module(m)))
        except BaseException as exc:  # noqa: BLE001
            out.append(m + ":err " + type(exc).__name__)
    return ",".join(out)


def _jpeg_decode():
    import io
    import numpy as np
    from PIL import Image

    raw = bytes.fromhex(JPEG_HEX)
    img = Image.open(io.BytesIO(raw))
    img.load()
    arr = np.asarray(img.convert("L"), dtype=np.uint8)
    return "decoded size=" + str(img.size) + " mode=" + img.mode + " sum=" + str(int(arr.sum()))


def _png_roundtrip():
    import io
    import numpy as np
    from PIL import Image

    arr = (np.arange(64, dtype=np.uint8).reshape(8, 8) * 3).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr, mode="L").save(buf, format="PNG")
    raw = buf.getvalue()
    back = np.asarray(Image.open(io.BytesIO(raw)).convert("L"), dtype=np.uint8)
    return "png bytes=" + str(len(raw)) + " equal=" + str(bool((back == arr).all()))


def _hashes():
    import hashlib

    return ",".join(
        [
            n + ":" + hashlib.new(n, b"x").hexdigest()[:8]
            for n in ("sha1", "sha224", "sha256", "sha384", "sha512")
        ]
    )


def _ecdsa(reps: int):
    import hashlib

    # RFC 6979 A.2.5 (P-256, SHA-256, message "sample")
    qx = 0x60FED4BA255A9D31C961EB74C6356D68C049B8923B61FA6CE669622E60F29FB6
    qy = 0x7903FE1008B8BC99A41AE9E95628BC64F2F1B20C2D7E9F5177A3C294D4462299
    r = 0xEFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716
    s = 0xF7CB1C942D657C41D436C7A1B6E29F65F3E900DBB9AFF4064DC4AB2F843ACDA8
    z = int.from_bytes(hashlib.sha256(b"sample").digest(), "big")
    vec_ok = True
    for _ in range(max(1, reps)):
        vec_ok = vec_ok and _verify(qx, qy, z, r, s)
    tampered = _verify(qx, qy, z ^ 1, r, s)

    # Self-consistency: sign with a fixed k, then verify our own signature.
    d = 0xC9AFA9D845BA75166B5C215767B1D6934E50C3DB36E89B127B8A622B120F6721
    k = 0xA6E3C57DD01ABE90086538398355DD4C3B17AA873382B0F24D6129493D8AAD60
    kg = _affine(_mul(k, (GX, GY, 1)))
    r2 = kg[0] % N
    s2 = pow(k, N - 2, N) * (z + r2 * d) % N
    pub = _affine(_mul(d, (GX, GY, 1)))
    self_ok = _verify(pub[0], pub[1], z, r2, s2)
    return (
        "vector_verifies=" + str(vec_ok)
        + " tampered_rejected=" + str(not tampered)
        + " self_sign_verify=" + str(self_ok)
        + " r_matches_rfc=" + str(r2 == r)
        + " pub_matches_rfc=" + str(pub == (qx, qy))
    )


def _rsa4096():
    n = (1 << 4096) - 189
    m = (1 << 4095) + 12345
    sig = pow(m, 65537, n)
    return "rsa4096 e=65537 low32=" + hex(sig & 0xFFFFFFFF)


class StageholdProbe2(gl.Contract):
    marker: str

    def __init__(self):
        self.marker = "stagehold-probe-2"

    @gl.public.view
    def probe(self, reps: int) -> str:
        results = [
            _try("PIL codecs", _codecs),
            _try("PIL JPEG decode", _jpeg_decode),
            _try("PIL PNG encode+decode", _png_roundtrip),
            _try("hash algorithms", _hashes),
            _try("ECDSA P-256 verify x" + str(reps), lambda: _ecdsa(reps)),
            _try("RSA-4096 public exponentiation", _rsa4096),
        ]
        return json.dumps(results)
