"""Test the pure-Python attestation verifier against Google's sample chains.

Run from the spikes folder:  python test_attest_verify.py
Uses the desktop `cryptography` package only as an independent cross-check of
signature results and the attestation field values; the verifier itself uses none.
"""

import base64
import glob
import json
import os
import re
import time

import attest_verify as av

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "testdata")


def load_chain(path):
    pem = open(path).read()
    return [
        base64.b64decode("".join(m.strip().split("\n")[1:-1]))
        for m in re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", pem, re.S)
    ]


def pem_to_der(pem):
    return base64.b64decode("".join(pem.strip().split("\n")[1:-1]))


roots = [pem_to_der(r) for r in json.load(open(os.path.join(DATA, "roots.json")))]
fails = 0


def check(label, cond, extra=""):
    global fails
    print(("PASS " if cond else "FAIL ") + label + (("  " + extra) if extra else ""))
    if not cond:
        fails += 1


print("== 1. Chains verified against their own top certificate (algorithm coverage)")
for path in sorted(glob.glob(os.path.join(DATA, "*.pem"))):
    name = os.path.basename(path)
    if name.startswith("tokay"):
        continue  # ML-DSA, expected unsupported
    chain = load_chain(path)
    ok, reason, _ = av.verify_chain(chain, [chain[-1]], now=None)
    if name.startswith("invalid_"):
        print("     (", name, ") ->", ok, reason)
        continue
    t0 = time.time()
    ok, reason, parsed = av.verify_chain(chain, [chain[-1]], now=None)
    check(name + " chain", ok, reason + " [%.2fs]" % (time.time() - t0))

print("\n== 2. Anchoring to Google's published roots")
for path in sorted(glob.glob(os.path.join(DATA, "*.pem"))):
    name = os.path.basename(path)
    if name.startswith("tokay"):
        continue
    chain = load_chain(path)
    ok, reason, _ = av.verify_chain(chain, roots, now=None)
    print("     ", name, "->", ok, reason)

print("\n== 3. Attestation extension fields versus Google's expected JSON")
for jpath in sorted(glob.glob(os.path.join(DATA, "*.json"))):
    if os.path.basename(jpath) == "roots.json":
        continue
    pem_path = jpath[:-5] + ".pem"
    chain = load_chain(pem_path)
    expected = json.load(open(jpath))
    leaf = av.parse_cert(chain[0])
    kd = av.parse_key_description(leaf["exts"][av.OID_ATTESTATION])
    name = os.path.basename(jpath)
    check(name + " attestation level",
          kd["attestation_security_level"].replace("_", "") == expected["attestationSecurityLevel"].replace("_", ""),
          kd["attestation_security_level"])
    check(name + " keymint level",
          kd["keymint_security_level"].replace("_", "") == expected["keyMintSecurityLevel"].replace("_", ""),
          kd["keymint_security_level"])
    check(name + " challenge", base64.b64encode(kd["challenge"]).decode() == expected["attestationChallenge"])
    exp_rot = expected.get("hardwareEnforced", {}).get("rootOfTrust") or expected.get("teeEnforced", {}).get("rootOfTrust")
    rot = kd["root_of_trust"]
    if exp_rot:
        check(name + " rootOfTrust", rot is not None
              and rot["device_locked"] == exp_rot["deviceLocked"]
              and rot["verified_boot_state"] == exp_rot["verifiedBootState"]
              and base64.b64encode(rot["verified_boot_key"]).decode() == exp_rot["verifiedBootKey"],
              str(rot and (rot["device_locked"], rot["verified_boot_state"])))
    exp_app = expected.get("softwareEnforced", {}).get("attestationApplicationId") \
        or expected.get("hardwareEnforced", {}).get("attestationApplicationId")
    app = kd["app_id"]
    if exp_app:
        check(name + " applicationId", app is not None
              and [p for p, _ in app["packages"]] == [p["name"] for p in exp_app["packages"]]
              and [base64.b64encode(s).decode() for s in app["signature_digests"]] == exp_app["signatures"],
              str(app and app["packages"]))

print("\n== 4. Policy")
chain = load_chain(os.path.join(DATA, "caiman_sdk36_TEE_EC_RKP.pem"))
ok, reason, kd = av.verify_attestation(chain, [chain[-1]], now=None)
check("caiman hardware policy passes", ok, reason)
ok, reason, kd = av.verify_attestation(chain, [chain[-1]], now=None, challenge=b"wrong-challenge")
check("wrong challenge rejected", (not ok) and reason == "challenge mismatch", reason)
ok, reason, kd = av.verify_attestation(chain, [chain[-1]], now=None, package="com.evil.app")
check("wrong package rejected", (not ok) and reason == "package not allowed", reason)

print("\n== 5. Tamper tests (must all fail closed)")
chain = load_chain(os.path.join(DATA, "caiman_sdk36_TEE_EC_RKP.pem"))
for idx in range(len(chain)):
    bad = list(chain)
    mutable = bytearray(bad[idx])
    mutable[len(mutable) // 2] ^= 0x01
    bad[idx] = bytes(mutable)
    ok, reason, _ = av.verify_chain(bad, [chain[-1]], now=None)
    check("flip one byte in cert %d" % idx, not ok, reason)
ok, reason, _ = av.verify_chain(chain[:-1], [chain[-1]], now=None)
check("missing top cert still anchored via trust anchor signature", ok, reason)
ok, reason, _ = av.verify_chain([chain[0], chain[2], chain[1]] + chain[3:], [chain[-1]], now=None)
check("reordered chain rejected", not ok, reason)
ok, reason, _ = av.verify_chain(chain, [], now=None)
check("no anchors rejected", not ok, reason)
ok, reason, _ = av.verify_chain(chain, [chain[-1]], now=1_000_000_000)
check("expired/not-yet-valid window rejected", not ok, reason)

print("\n== 6. Invalid samples from Google (must be rejected by the full attestation check)")
for name in ("invalid_malformed_rot_device_locked.pem", "invalid_tags_not_in_ascending_order.pem"):
    chain = load_chain(os.path.join(DATA, name))
    ok, reason, kd = av.verify_attestation(chain, roots, now=None)
    check(name + " rejected", not ok, reason)

print("\n== 7. ML-DSA sample: chain signatures are ECDSA, but the attested app key is ML-DSA")
chain = load_chain(os.path.join(DATA, "tokay_TEE_MLDSA_RKP.pem"))
ok, reason, _ = av.verify_chain(chain, [chain[-1]], now=None)
check("chain itself verifies (signatures are ECDSA)", ok, reason)
ok, reason, _ = av.verify_attestation(chain, [chain[-1]], now=None)
check("full check rejects a non-P-256 attested key", (not ok) and "P-256" in reason, reason)
leaf = av.parse_cert(chain[0])
check("shot-signature verification refuses an ML-DSA leaf",
      not av.verify_shot_signature(leaf["pub"], b"\x00" * 32, b"\x30\x06\x02\x01\x01\x02\x01\x01"))

print("\n== 8. Shot signature round trip (desktop key signs, pure-Python verifies)")
import hashlib
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec

priv = ec.generate_private_key(ec.SECP256R1())
nums = priv.public_key().public_numbers()
pub = {"kind": "ec", "curve": "1.2.840.10045.3.1.7", "x": nums.x, "y": nums.y}
msg = b"frame-hash|line|code|deadline"
sig = priv.sign(msg, ec.ECDSA(hashes.SHA256()))
check("valid shot signature accepted", av.verify_shot_signature(pub, hashlib.sha256(msg).digest(), sig))
check("wrong digest rejected", not av.verify_shot_signature(pub, hashlib.sha256(msg + b"x").digest(), sig))
bad = bytearray(sig)
bad[-1] ^= 1
check("tampered signature rejected", not av.verify_shot_signature(pub, hashlib.sha256(msg).digest(), bytes(bad)))

print("\nFAILURES:", fails)
raise SystemExit(1 if fails else 0)
