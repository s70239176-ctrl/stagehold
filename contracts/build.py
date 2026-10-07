"""Assemble contracts/stagehold.py from its parts, so the study prompt, the verifier and the
contract can never drift apart.   python contracts/build.py"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def strip_docstring(text):
    text = text.lstrip()
    if text.startswith('"""'):
        return text.split('"""', 2)[2]
    return text


prompt_src = strip_docstring(open(os.path.join(ROOT, "study", "prompt.py"), encoding="utf-8").read())
verify_src = strip_docstring(open(os.path.join(ROOT, "spikes", "attest_verify.py"), encoding="utf-8").read())
verify_src = verify_src.replace("import hashlib\n", "", 1)  # imported once at the top
align_src = open(os.path.join(HERE, "src", "align.py"), encoding="utf-8").read()
body_src = open(os.path.join(HERE, "src", "body.py"), encoding="utf-8").read()

roots = json.load(open(os.path.join(ROOT, "spikes", "testdata", "roots.json")))
roots_b64 = ["".join(r.strip().split("\n")[1:-1]) for r in roots]

header = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }\n'
doc = '''"""Stagehold: one contract per job. Pays a construction tranche when a named stage is
visible in an app-signed photo, judged by a panel neither party chose.

GENERATED FILE. Edit the parts and run `python contracts/build.py`:
  study/prompt.py          stage wording and the exact judge prompt (frozen after the study)
  spikes/attest_verify.py  Android attestation verifier
  contracts/src/align.py   deterministic site alignment
  contracts/src/body.py    the contract

Status: skeleton. Untested on Studio beyond lint. Alignment is uncalibrated (align_min_permille=0
means not enforced). No claim is made about generated images until a real device chain from
the Stagehold app has been verified on Studio.
"""

from genlayer import *
import base64
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
'''

parts = [
    header, doc,
    "\n# ===== judge: study/prompt.py =====\n", prompt_src,
    "\n# ===== attestation verifier: spikes/attest_verify.py =====\n", verify_src,
    "\n# ===== alignment: contracts/src/align.py =====\n", align_src,
    "\n# ===== trust anchors (Google Android Key Attestation roots, fixed at build) =====\n",
    "ROOTS = " + json.dumps(roots_b64) + "\n",
    "\n# ===== contract: contracts/src/body.py =====\n", body_src,
]
out = os.path.join(HERE, "stagehold.py")
open(out, "w", encoding="utf-8").write("".join(parts))
print("wrote", out, os.path.getsize(out), "bytes")
