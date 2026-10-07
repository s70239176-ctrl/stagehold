"""Assemble spikes/probe_runtime5.py: write-transaction test of the attestation verifier,
a per-shot P-256 signature check, and blob storage/transaction-size limits.
Also writes test blobs (base64 text files) to spikes/blobs/.  Run: python build_probe5.py"""

import base64
import hashlib
import io
import json
import os
import re

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "testdata")
BLOBS = os.path.join(HERE, "blobs")
os.makedirs(BLOBS, exist_ok=True)


def chain_b64(path):
    pem = open(path).read()
    return [
        "".join(m.strip().split("\n")[1:-1])
        for m in re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", pem, re.S)
    ]


roots_b64 = ["".join(r.strip().split("\n")[1:-1]) for r in json.load(open(os.path.join(DATA, "roots.json")))]
good = chain_b64(os.path.join(DATA, "caiman_sdk36_TEE_EC_RKP.pem"))

# Per-shot signature test vector: a desktop key signs a digest the way the app would.
priv = ec.generate_private_key(ec.SECP256R1())
nums = priv.public_key().public_numbers()
msg = b"jpeg-sha256|thumb-sha256|line-1|code-ABC123|deadline-1760000000"
digest = hashlib.sha256(msg).digest()
sig = priv.sign(msg, ec.ECDSA(hashes.SHA256()))

# Blob test files: realistic sizes. Grayscale PNG thumbnail (anchor/alignment) and JPEG-sized noise.
def png_blob(side):
    import random

    rnd = random.Random(7)
    img = Image.new("L", (side, side))
    px = img.load()
    for y in range(side):
        for x in range(side):
            px[x, y] = (x * 3 + y * 2 + rnd.randint(0, 40)) % 256
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def write_blob(name, raw):
    b64 = base64.b64encode(raw).decode()
    open(os.path.join(BLOBS, name + ".b64.txt"), "w").write(b64)
    return len(raw), len(b64), hashlib.sha256(raw).hexdigest()


report = {}
report["thumb_small"] = write_blob("thumb_small", png_blob(96))
report["thumb_med"] = write_blob("thumb_med", png_blob(192))
report["noise_100k"] = write_blob("noise_100k", os.urandom(100 * 1024))
report["noise_400k"] = write_blob("noise_400k", os.urandom(400 * 1024))
print("blob report (raw bytes, base64 chars, sha256):")
for k, v in report.items():
    print(" ", k, v)

lib = open(os.path.join(HERE, "attest_verify.py"), encoding="utf-8").read()
lib = lib.split('"""', 2)[2]

header = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }\n'
doc = '''"""Stagehold spike probe 5: write transactions.

No funds. Tests, inside WRITE transactions (not views):
  1. verify_attestation on a real Google sample chain (execution-limit check),
  2. a per-shot ECDSA P-256 signature check,
  3. storing a blob of a given size (transaction size and storage limits).
Call a write, then read the result with the matching view.
"""

from genlayer import *
import base64
import hashlib
import json
'''

data = "GOOD_CHAIN = " + json.dumps(good) + "\n"
data += "ROOTS = " + json.dumps(roots_b64) + "\n"
data += "SHOT_PUB_X = " + str(nums.x) + "\n"
data += "SHOT_PUB_Y = " + str(nums.y) + "\n"
data += "SHOT_MSG = " + repr(msg) + "\n"
data += "SHOT_SIG_HEX = " + json.dumps(sig.hex()) + "\n"

cls = '''

def _chain(items):
    return [base64.b64decode(x) for x in items]


class StageholdProbe5(gl.Contract):
    results: TreeMap[str, str]
    blobs: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.write
    def verify_in_write(self) -> str:
        ok, reason, kd = verify_attestation(_chain(GOOD_CHAIN), _chain(ROOTS), now=None)
        text = json.dumps({"ok": ok, "reason": reason, "level": kd["attestation_security_level"] if kd else None})
        self.results["verify_in_write"] = text
        return text

    @gl.public.write
    def check_shot_in_write(self) -> str:
        pub = {"kind": "ec", "curve": "1.2.840.10045.3.1.7", "x": SHOT_PUB_X, "y": SHOT_PUB_Y}
        digest = hashlib.sha256(SHOT_MSG).digest()
        sig = bytes.fromhex(SHOT_SIG_HEX)
        good = verify_shot_signature(pub, digest, sig)
        bad = verify_shot_signature(pub, hashlib.sha256(SHOT_MSG + b"x").digest(), sig)
        text = json.dumps({"valid_accepted": good, "wrong_digest_rejected": not bad})
        self.results["check_shot_in_write"] = text
        return text

    @gl.public.write
    def store_blob(self, label: str, data_b64: str) -> str:
        raw = base64.b64decode(data_b64)
        text = json.dumps({"label": label, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
        self.blobs[label] = data_b64
        self.results["blob:" + label] = text
        return text

    @gl.public.view
    def get_result(self, key: str) -> str:
        if key in self.results:
            return self.results[key]
        return "(none)"
'''

src = header + doc + lib + "\n" + data + cls
out = os.path.join(HERE, "probe_runtime5.py")
open(out, "w", encoding="utf-8").write(src)
print("wrote", out, len(src), "bytes")
