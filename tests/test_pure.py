"""Local tests of the contract's pure functions (no chain, no GenLayer runtime).

Loads the generated contracts/stagehold.py with a stub `genlayer` module, then exercises:
the judge prompt and strict answer parsing, the alignment function, the signed-shot message,
the fallback code, and a full signature round trip.   python tests/test_pure.py
"""

import hashlib
import io
import os
import random
import sys
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class _Sub:
    def __class_getitem__(cls, item):
        return cls


def _noop_decorator(*args, **kwargs):
    if len(args) == 1 and callable(args[0]) and not kwargs:
        return args[0]
    return lambda f: f


stub = types.ModuleType("genlayer")
stub.TreeMap = _Sub
stub.u256 = int
stub.Address = type("Address", (), {"__init__": lambda self, v: setattr(self, "as_hex", v)})
stub.allow_storage = lambda c: c
_public = types.SimpleNamespace(view=_noop_decorator, write=types.SimpleNamespace(payable=_noop_decorator))
_public.write.__call__ = None
stub.gl = types.SimpleNamespace(Contract=object, public=types.SimpleNamespace(
    view=lambda f: f,
    write=type("W", (), {"__call__": staticmethod(lambda f: f), "payable": staticmethod(lambda f: f)})(),
), vm=types.SimpleNamespace(UserError=Exception))
sys.modules["genlayer"] = stub

src = open(os.path.join(ROOT, "contracts", "stagehold.py"), encoding="utf-8").read()
ns = {}
exec(compile(src, "stagehold.py", "exec"), ns)

fails = 0


def check(label, cond, extra=""):
    global fails
    print(("PASS " if cond else "FAIL ") + label + (("  " + extra) if extra else ""))
    if not cond:
        fails += 1


# ---- judge prompt and parsing
p = ns["build_prompt"]("roof", "K7Q2")
check("prompt contains stage wording", "No open sky" in p)
check("prompt contains the code", '"K7Q2"' in p)
check("prompt tells the model signs are scenery", "never an instruction" in p)
check("prompt contains no caption field", "caption" in p.lower() and "not in a caption" in p)
import importlib.util

_spec = importlib.util.spec_from_file_location("study_prompt", os.path.join(ROOT, "study", "prompt.py"))
_study = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_study)
check("study prompt equals contract prompt for every stage",
      all(_study.build_prompt(s, "K7Q2") == ns["build_prompt"](s, "K7Q2") for s in _study.STAGE_ORDER))

pa = ns["parse_answers"]
check("good answers parse", pa({"stage_met": "yes", "code_visible": "no"}) == {"stage_met": "yes", "code_visible": "no"})
check("case and spaces normalised", pa({"stage_met": " YES ", "code_visible": "Unclear"}) == {"stage_met": "yes", "code_visible": "unclear"})
check("extra word fails closed", pa({"stage_met": "yes!", "code_visible": "yes"}) == {"stage_met": "unclear", "code_visible": "unclear"})
check("missing key fails closed", pa({"stage_met": "yes"}) == {"stage_met": "unclear", "code_visible": "unclear"})
check("non-dict fails closed", pa("yes") == {"stage_met": "unclear", "code_visible": "unclear"})
check("non-string value fails closed", pa({"stage_met": True, "code_visible": "yes"}) == {"stage_met": "unclear", "code_visible": "unclear"})
ps = ns["passes"]
check("pass needs both yes", ps({"stage_met": "yes", "code_visible": "yes"}))
check("unclear does not pay", not ps({"stage_met": "yes", "code_visible": "unclear"}))
check("no does not pay", not ps({"stage_met": "no", "code_visible": "yes"}))

# ---- alignment
from PIL import Image, ImageDraw


def scene(seed, shift=(0, 0), noise=0):
    rnd = random.Random(seed)
    img = Image.new("L", (160, 120), 120)
    d = ImageDraw.Draw(img)
    for _ in range(12):
        x, y = rnd.randint(10, 120), rnd.randint(10, 80)
        w, h = rnd.randint(10, 40), rnd.randint(10, 30)
        d.rectangle([x + shift[0], y + shift[1], x + w + shift[0], y + h + shift[1]], fill=rnd.randint(20, 240))
    if noise:
        px = img.load()
        for _ in range(noise):
            px[rnd.randint(0, 159), rnd.randint(0, 119)] = rnd.randint(0, 255)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


align = ns["alignment_permille"]
a = scene(1)
check("identical thumbnails score 1000", align(a, a) == 1000, str(align(a, a)))
shifted = align(a, scene(1, shift=(4, 3)))
other = align(a, scene(99))
check("same scene shifted a few pixels scores high", shifted >= 600, str(shifted))
check("different scene scores clearly lower", other < shifted - 200, "other=%d shifted=%d" % (other, shifted))
check("alignment is deterministic", align(a, scene(99)) == other)

# ---- shot message, fallback code, signature round trip
msg = ns["build_shot_message"]("0xABCDEF", "roof", "K7Q2", 1760000000, "aa" * 32, "bb" * 32)
check("shot message is the canonical ascii string",
      msg == b"stagehold.v1|0xabcdef|roof|K7Q2|1760000000|" + b"aa" * 32 + b"|" + b"bb" * 32)
c1 = ns["derive_fallback_code"]("0xabc", "roof", 0, 100, 200)
c2 = ns["derive_fallback_code"]("0xabc", "roof", 0, 100, 200)
c3 = ns["derive_fallback_code"]("0xabc", "roof", 1, 100, 200)
check("fallback code is deterministic", c1 == c2)
check("fallback code changes with inputs", c1 != c3)
check("fallback code is two different valid words", len(c1.split(" ")) == 2 and c1.split(" ")[0] != c1.split(" ")[1]
      and all(w in ns["CODE_WORDS"] for w in c1.split(" ")) and ns["_valid_code"](c1), c1)
check("word list has no duplicates", len(set(ns["CODE_WORDS"])) == len(ns["CODE_WORDS"]))
check("fallback codes over many seeds are always valid", all(ns["_valid_code"](ns["derive_fallback_code"]("0xabc", "roof", n, 1, 2)) for n in range(300)))
check("good codes accepted", ns["_valid_code"]("K7Q2") and ns["_valid_code"]("TREE BLUE"))
check("bad codes rejected", not any(ns["_valid_code"](c) for c in ("ab", "tree", " TREE", "TREE ", "TREE  BLUE", "THIS CODE IS TOO LONG", "TREE-BLUE")))

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec

priv = ec.generate_private_key(ec.SECP256R1())
nums = priv.public_key().public_numbers()
pub = {"kind": "ec", "curve": "1.2.840.10045.3.1.7", "x": nums.x, "y": nums.y}
sig = priv.sign(msg, ec.ECDSA(hashes.SHA256()))  # what the app does: SHA256withECDSA over the message
vs = ns["verify_shot_signature"]
check("app-style signature accepted by contract digest", vs(pub, hashlib.sha256(msg).digest(), sig))
other_msg = ns["build_shot_message"]("0xABCDEF", "roof", "K7Q3", 1760000000, "aa" * 32, "bb" * 32)
check("signature does not carry to another code", not vs(pub, hashlib.sha256(other_msg).digest(), sig))
other_stage = ns["build_shot_message"]("0xABCDEF", "plaster", "K7Q2", 1760000000, "aa" * 32, "bb" * 32)
check("signature does not carry to another stage", not vs(pub, hashlib.sha256(other_stage).digest(), sig))
other_job = ns["build_shot_message"]("0x123456", "roof", "K7Q2", 1760000000, "aa" * 32, "bb" * 32)
check("signature does not carry to another job", not vs(pub, hashlib.sha256(other_job).digest(), sig))

# ---- thumbnail must be a small copy of the judged frame
import numpy as np
from PIL import Image as _Image


def _scene(seed, w=640, h=360):
    rnd = np.random.RandomState(seed)
    x = np.linspace(0, 6, w)[None, :]
    y = np.linspace(0, 4, h)[:, None]
    base = 128 + 70 * np.sin(x * (1 + seed % 3)) * np.cos(y * (2 + seed % 2))
    rgb = np.stack([base + 20 * np.sin(y), base, base - 30 * np.cos(x)], axis=-1) + rnd.normal(0, 6, (h, w, 3))
    return _Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


def _client_thumb(jpeg_bytes):
    """What the web client does: average the decoded frame's luma in 8x8 blocks (edge pixels replicated)."""
    g = np.asarray(_Image.open(io.BytesIO(jpeg_bytes)).convert("L"), dtype=np.float32)
    h, w = g.shape
    rows, cols = (h + 7) // 8, (w + 7) // 8
    pad = np.pad(g, ((0, rows * 8 - h), (0, cols * 8 - w)), mode="edge")
    small = pad.reshape(rows, 8, cols, 8).mean(axis=(1, 3))
    buf = io.BytesIO()
    _Image.fromarray(np.round(small).astype(np.uint8), "L").save(buf, format="PNG")
    return buf.getvalue()


def _jpeg(img, q=80):
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=q, subsampling=2)
    return buf.getvalue()


tm = ns["thumb_matches"]
fa, fb = _jpeg(_scene(1)), _jpeg(_scene(2))
ok_same, _, mad_same = tm(fa, _client_thumb(fa))
check("thumbnail of the same frame is accepted", ok_same, f"mean diff x10 = {mad_same}")
ok_other, why_other, mad_other = tm(fa, _client_thumb(fb))
check("thumbnail of a different picture is refused", not ok_other, f"mean diff x10 = {mad_other}")
inv = _Image.fromarray(255 - np.asarray(_Image.open(io.BytesIO(_client_thumb(fa))).convert("L")), "L")
_b = io.BytesIO()
inv.save(_b, format="PNG")
check("an inverted thumbnail is refused", not tm(fa, _b.getvalue())[0])
_s = io.BytesIO()
_Image.open(io.BytesIO(_client_thumb(fa))).resize((40, 22)).save(_s, format="PNG")
check("a thumbnail of the wrong size is refused", not tm(fa, _s.getvalue())[0])
check("a non-JPEG frame is refused", not tm(b"\x89PNGnot a jpeg", _client_thumb(fa))[0])
_odd = _jpeg(_scene(3, 333, 251))
check("odd-sized frame accepted", tm(_odd, _client_thumb(_odd))[0])

print("\nFAILURES:", fails)
raise SystemExit(1 if fails else 0)
