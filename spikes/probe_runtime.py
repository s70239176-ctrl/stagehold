# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Stagehold spike 1/2 probe: what can the contract runtime do?

Throwaway read-only probe. It tries a list of imports and tiny operations and
returns a JSON string with the outcome of each, so we learn what the runtime
offers (hashing, numpy, PIL, crypto, ASN.1 / X.509 parsing, big integers for
ECDSA) before designing around it. No state, no funds.
"""

from genlayer import *
import json


def _try(name: str, fn) -> dict:
    try:
        return {"name": name, "ok": True, "detail": str(fn())[:200]}
    except BaseException as exc:  # noqa: BLE001 - probe must never raise
        return {"name": name, "ok": False, "detail": (type(exc).__name__ + ": " + str(exc))[:200]}


def _sha256():
    import hashlib

    return hashlib.sha256(b"stagehold").hexdigest()


def _numpy():
    import numpy as np

    a = np.arange(16, dtype=np.float32).reshape(4, 4)
    return "numpy " + np.__version__ + " sum=" + str(float(a.sum()))


def _pil():
    import PIL
    from PIL import Image

    img = Image.new("L", (8, 8), 128)
    return "PIL " + PIL.__version__ + " size=" + str(img.size)


def _pil_jpeg_roundtrip():
    import io
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (16, 16), (200, 10, 10)).save(buf, format="JPEG")
    raw = buf.getvalue()
    back = Image.open(io.BytesIO(raw))
    back.load()
    return "jpeg bytes=" + str(len(raw)) + " mode=" + back.mode


def _cryptography():
    import cryptography

    return "cryptography " + cryptography.__version__


def _ecdsa_p256_bigint():
    # Pure-integer sanity check that big-int math works (needed for P-256 ECDSA in pure Python).
    p = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF
    return str(pow(3, p - 2, p) * 3 % p)


def _asn1_manual():
    # Minimal DER length parse, proves we can write our own X.509/ASN.1 walker if no library exists.
    der = bytes.fromhex("3003020101")
    return "seq_len=" + str(der[1]) + " int=" + str(der[4])


def _stdlib_modules():
    out = []
    for m in ("base64", "binascii", "struct", "hmac", "io", "zlib", "datetime", "ssl", "secrets"):
        try:
            __import__(m)
            out.append(m + ":yes")
        except BaseException:  # noqa: BLE001
            out.append(m + ":no")
    return ",".join(out)


class StageholdProbe(gl.Contract):
    marker: str

    def __init__(self):
        self.marker = "stagehold-probe"

    @gl.public.view
    def probe(self) -> str:
        results = [
            _try("hashlib.sha256", _sha256),
            _try("numpy", _numpy),
            _try("PIL", _pil),
            _try("PIL jpeg roundtrip", _pil_jpeg_roundtrip),
            _try("cryptography", _cryptography),
            _try("bigint modexp (P-256 field)", _ecdsa_p256_bigint),
            _try("manual DER walk", _asn1_manual),
            _try("stdlib modules", _stdlib_modules),
        ]
        return json.dumps(results)
