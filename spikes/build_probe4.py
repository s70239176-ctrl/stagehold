"""Assemble spikes/probe_runtime4.py: the pure-Python attestation verifier plus one real
Google sample chain and Google's roots, as a read-only contract. Run: python build_probe4.py"""

import base64
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "testdata")


def chain_b64(path):
    pem = open(path).read()
    return [
        "".join(m.strip().split("\n")[1:-1])
        for m in re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", pem, re.S)
    ]


roots_b64 = ["".join(r.strip().split("\n")[1:-1]) for r in json.load(open(os.path.join(DATA, "roots.json")))]
good = chain_b64(os.path.join(DATA, "caiman_sdk36_TEE_EC_RKP.pem"))
bad_rot = chain_b64(os.path.join(DATA, "invalid_malformed_rot_device_locked.pem"))

lib = open(os.path.join(HERE, "attest_verify.py"), encoding="utf-8").read()
lib = lib.split('"""', 2)[2]  # drop module docstring

header = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }\n'
doc = '''"""Stagehold spike probe 4: does the pure-Python attestation verifier run in the runtime?

Read-only, no state, no funds. Verifies one real Google sample chain against Google's
published roots, then confirms that a tampered chain and Google's malformed sample are
rejected. Expected: good_ok=True, tampered_ok=False, malformed_ok=False.
"""

from genlayer import *
import base64
import json
'''

data = "GOOD_CHAIN = " + json.dumps(good) + "\n"
data += "BAD_ROT_CHAIN = " + json.dumps(bad_rot) + "\n"
data += "ROOTS = " + json.dumps(roots_b64) + "\n"

cls = '''

def _chain(items):
    return [base64.b64decode(x) for x in items]


class StageholdProbe4(gl.Contract):
    marker: str

    def __init__(self):
        self.marker = "stagehold-probe-4"

    @gl.public.view
    def ping(self) -> str:
        return "alive"

    @gl.public.view
    def verify_good(self) -> str:
        ok, reason, kd = verify_attestation(_chain(GOOD_CHAIN), _chain(ROOTS), now=None)
        out = {"good_ok": ok, "reason": reason}
        if kd is not None:
            out["attestation_level"] = kd["attestation_security_level"]
            out["boot_state"] = kd["root_of_trust"]["verified_boot_state"]
            out["device_locked"] = kd["root_of_trust"]["device_locked"]
            out["package"] = kd["app_id"]["packages"][0][0]
        return json.dumps(out)

    @gl.public.view
    def verify_tampered(self) -> str:
        chain = _chain(GOOD_CHAIN)
        mutable = bytearray(chain[2])
        mutable[len(mutable) // 2] ^= 1
        chain[2] = bytes(mutable)
        ok, reason, kd = verify_attestation(chain, _chain(ROOTS), now=None)
        return json.dumps({"tampered_ok": ok, "reason": reason})

    @gl.public.view
    def verify_malformed(self) -> str:
        ok, reason, kd = verify_attestation(_chain(BAD_ROT_CHAIN), _chain(ROOTS), now=None)
        return json.dumps({"malformed_ok": ok, "reason": reason})

    @gl.public.view
    def verify_wrong_challenge(self) -> str:
        ok, reason, kd = verify_attestation(_chain(GOOD_CHAIN), _chain(ROOTS), now=None, challenge=b"nope")
        return json.dumps({"wrong_challenge_ok": ok, "reason": reason})
'''

src = header + doc + lib + "\n" + data + cls
out = os.path.join(HERE, "probe_runtime4.py")
open(out, "w", encoding="utf-8").write(src)
print("wrote", out, len(src), "bytes")
