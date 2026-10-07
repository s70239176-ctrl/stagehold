"""Check Stagehold app output OFFLINE, with the contract's own code, before spending a transaction.

  python app/tools/check_package.py device device.json --contract 0x.. --builder 0x.. [--package com.x --digest <hex>]
  python app/tools/check_package.py shot   shot.json   --device device.json

`device`: verifies the attestation chain exactly as register_device would (Google roots, challenge
          bound to contract+builder, hardware-backed, locked bootloader, P-256 key) and prints what
          the phone attested, including the app signing digest to pass when deploying a non-dev job.
`shot`:   verifies sizes, formats, hashes, the code format and the capture signature against the
          registered key, exactly as submit would before it calls the panel.
"""

import argparse
import base64
import hashlib
import json
import os
import sys
import time
import types

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def load_contract_namespace():
    """Load the generated contract with a stub runtime so its pure functions can be called here."""
    class _Sub:
        def __class_getitem__(cls, item):
            return cls

    stub = types.ModuleType("genlayer")
    stub.TreeMap = _Sub
    stub.u256 = int
    stub.Address = type("Address", (), {"__init__": lambda self, v: setattr(self, "as_hex", v)})
    stub.allow_storage = lambda c: c
    stub.gl = types.SimpleNamespace(
        Contract=object,
        public=types.SimpleNamespace(
            view=lambda f: f,
            write=type("W", (), {"__call__": staticmethod(lambda f: f), "payable": staticmethod(lambda f: f)})(),
        ),
        vm=types.SimpleNamespace(UserError=Exception),
    )
    sys.modules["genlayer"] = stub
    src = open(os.path.join(ROOT, "contracts", "stagehold.py"), encoding="utf-8").read()
    ns = {}
    exec(compile(src, "stagehold.py", "exec"), ns)
    return ns


def b64(text, label):
    try:
        return base64.b64decode(text, validate=True)
    except Exception:
        raise SystemExit("FAIL %s is not valid base64" % label)


def cmd_device(args, ns):
    d = json.load(open(args.file))
    chain = [b64(c, "chain certificate") for c in d["chain_b64"]]
    anchors = [base64.b64decode(r) for r in ns["ROOTS"]]
    challenge = (bytes.fromhex(args.challenge_hex) if args.challenge_hex
                 else hashlib.sha256((args.contract.lower() + ":" + args.builder.lower()).encode("ascii")).digest())
    package = args.package
    digest = bytes.fromhex(args.digest) if args.digest else None
    now = args.now if args.now else int(time.time())
    ok, reason, kd = ns["verify_attestation"](chain, anchors, now=now, challenge=challenge,
                                              package=package, signature_digest=digest)
    leaf = ns["parse_cert"](chain[0])
    print("chain certificates:", len(chain))
    if kd is not None:
        rot = kd["root_of_trust"] or {}
        app = kd["app_id"] or {"packages": [], "signature_digests": []}
        print("attestation level :", kd["attestation_security_level"], "| key level:", kd["keymint_security_level"])
        print("boot state        :", rot.get("verified_boot_state"), "| bootloader locked:", rot.get("device_locked"))
        print("app package(s)    :", [p for p, _ in app["packages"]])
        print("app signing digest:", [d_.hex() for d_ in app["signature_digests"]], " <- use this as app_sig_digest_hex for a non-dev job")
        print("challenge (hex)   :", kd["challenge"].hex())
    pub = leaf["pub"]
    if pub.get("kind") == "ec":
        key_id = hashlib.sha256(pub["x"].to_bytes(32, "big") + pub["y"].to_bytes(32, "big")).hexdigest()
        print("key_id            :", key_id)
    print("\n%s  register_device would %s%s" % ("OK  " if ok else "FAIL", "accept" if ok else "REJECT: ", "" if ok else reason))
    return 0 if ok else 1


def cmd_shot(args, ns):
    s = json.load(open(args.file))
    d = json.load(open(args.device))
    fails = []

    def check(label, cond, extra=""):
        print(("OK   " if cond else "FAIL ") + label + ((" " + extra) if extra else ""))
        if not cond:
            fails.append(label)

    check("version", s.get("version") == "stagehold.shot.v1", str(s.get("version")))
    jpeg = b64(s["jpeg_b64"], "jpeg")
    thumb = b64(s["thumb_b64"], "thumbnail")
    check("frame is a JPEG", jpeg[:3] == b"\xff\xd8\xff")
    check("frame within %d bytes" % ns["MAX_JPEG"], 0 < len(jpeg) <= ns["MAX_JPEG"], "%d bytes" % len(jpeg))
    check("thumbnail is a PNG", thumb[:8] == b"\x89PNG\r\n\x1a\n")
    check("thumbnail within %d bytes" % ns["MAX_THUMB"], 0 < len(thumb) <= ns["MAX_THUMB"], "%d bytes" % len(thumb))
    check("code format is valid", ns["_valid_code"](s["code"]), repr(s["code"]))
    check("stage is a known stage", s["stage"] in ns["STAGE_WORDING"], s["stage"])

    # the thumbnail must decode in the contract's runtime stack (PIL + NumPy)
    try:
        ns["alignment_permille"](thumb, thumb)
        check("thumbnail decodes", True)
    except Exception as exc:
        check("thumbnail decodes", False, str(exc)[:80])

    pub = None
    if "chain_b64" in d:
        chain = [b64(c, "chain certificate") for c in d["chain_b64"]]
        pub = ns["parse_cert"](chain[0])["pub"]
    elif args.insecure_pub and "pub_x" in d:
        pub = {"kind": "ec", "curve": "1.2.840.10045.3.1.7", "x": int(d["pub_x"], 16), "y": int(d["pub_y"], 16)}
    if pub is None or pub.get("kind") != "ec":
        check("device public key available", False)
    else:
        key_id = hashlib.sha256(pub["x"].to_bytes(32, "big") + pub["y"].to_bytes(32, "big")).hexdigest()
        check("key_id matches the device key", s["key_id"] == key_id, s["key_id"][:16] + "...")
        msg = ns["build_shot_message"](s["contract"], s["stage"], s["code"], int(s["deadline"]),
                                       hashlib.sha256(jpeg).hexdigest(), hashlib.sha256(thumb).hexdigest())
        sig = bytes.fromhex(s["signature_hex"])
        check("capture signature is valid", ns["verify_shot_signature"](pub, hashlib.sha256(msg).digest(), sig))
        if int(s["deadline"]) < time.time():
            print("NOTE the code deadline has already passed; the contract would refuse it")

    print("\n%s  submit would %s" % ("OK  " if not fails else "FAIL", "pass its deterministic checks" if not fails else "REVERT"))
    return 0 if not fails else 1


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("device")
    d.add_argument("file")
    d.add_argument("--contract", default="")
    d.add_argument("--builder", default="")
    d.add_argument("--package")
    d.add_argument("--digest")
    d.add_argument("--challenge-hex", help="override the expected challenge (testing only)")
    d.add_argument("--now", type=int, help="check validity as of this unix time (testing only; real chains must be checked now)")
    s = sub.add_parser("shot")
    s.add_argument("file")
    s.add_argument("--device", required=True)
    s.add_argument("--insecure-pub", action="store_true", help="accept pub_x/pub_y in the device file (testing only)")
    args = ap.parse_args()
    ns = load_contract_namespace()
    return cmd_device(args, ns) if args.cmd == "device" else cmd_shot(args, ns)


if __name__ == "__main__":
    sys.exit(main())
