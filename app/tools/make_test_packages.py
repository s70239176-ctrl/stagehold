"""Make test packages in the formats the Android app must produce, to test the checker and the contract.

  python app/tools/make_test_packages.py
Writes app/tools/testdata/: device_google_sample.json (a real Google sample chain, whose challenge will
NOT match a job, so use --challenge-hex), device_fake.json + shot_good.json + shot_bad_*.json
(a desktop key signing like the app would). SYNTHETIC; for tool tests only.
"""

import base64
import hashlib
import json
import os
import re

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, "testdata")
os.makedirs(OUT, exist_ok=True)
ASSETS = os.path.join(ROOT, "contracts", "live", "assets")
CONTRACT = "0x" + "ab" * 20


def chain_b64(path):
    pem = open(path).read()
    return ["".join(m.strip().split("\n")[1:-1]) for m in re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", pem, re.S)]


chain = chain_b64(os.path.join(ROOT, "spikes", "testdata", "caiman_sdk36_TEE_EC_RKP.pem"))
json.dump({"version": "stagehold.device.v1", "contract": CONTRACT, "builder": "0x" + "cd" * 20, "chain_b64": chain},
          open(os.path.join(OUT, "device_google_sample.json"), "w"), indent=1)

priv = ec.generate_private_key(ec.SECP256R1())
nums = priv.public_key().public_numbers()
key_id = hashlib.sha256(nums.x.to_bytes(32, "big") + nums.y.to_bytes(32, "big")).hexdigest()
json.dump({"version": "stagehold.device.v1", "contract": CONTRACT, "pub_x": format(nums.x, "x"), "pub_y": format(nums.y, "x")},
          open(os.path.join(OUT, "device_fake.json"), "w"), indent=1)

jpeg = open(os.path.join(ASSETS, "good.jpg"), "rb").read()
thumb = open(os.path.join(ASSETS, "good_thumb.png"), "rb").read()
stage, code, deadline = "roof", "DUCK MOON", 4102444800


def package(jpeg_b, thumb_b, code_s=code, key=key_id, tamper_sig=False, sign_code=code):
    msg = ("stagehold.v1|%s|%s|%s|%d|%s|%s" % (CONTRACT.lower(), stage, sign_code, deadline,
                                               hashlib.sha256(jpeg_b).hexdigest(), hashlib.sha256(thumb_b).hexdigest())).encode("ascii")
    sig = priv.sign(msg, ec.ECDSA(hashes.SHA256()))
    if tamper_sig:
        sig = sig[:-2] + bytes([sig[-2] ^ 1, sig[-1]])
    return {"version": "stagehold.shot.v1", "contract": CONTRACT, "stage": stage, "code": code_s, "deadline": deadline,
            "key_id": key, "jpeg_b64": base64.b64encode(jpeg_b).decode(), "thumb_b64": base64.b64encode(thumb_b).decode(),
            "signature_hex": sig.hex()}


def save(name, obj):
    json.dump(obj, open(os.path.join(OUT, name), "w"))


save("shot_good.json", package(jpeg, thumb))
save("shot_bad_signature.json", package(jpeg, thumb, tamper_sig=True))
save("shot_bad_code_signed_other.json", package(jpeg, thumb, sign_code="TREE BLUE"))
save("shot_bad_oversize.json", package(jpeg + b"\0" * (160 * 1024), thumb))
save("shot_bad_notjpeg.json", package(b"not a jpeg at all", thumb))
save("shot_bad_wrongkey.json", package(jpeg, thumb, key="00" * 32))
print("wrote test packages to", OUT)
