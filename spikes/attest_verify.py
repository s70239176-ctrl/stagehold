"""Pure-Python Android Key Attestation verifier (prototype).

Standard library only (hashlib), so it can be pasted into a GenVM contract.
Verifies, in deterministic code:
  - X.509 chain signatures: ECDSA P-256/P-384 (SHA-256/384/512) and RSA PKCS#1 v1.5,
  - issuer/subject linkage, BasicConstraints CA on every non-leaf,
  - optional validity window (caller supplies `now`),
  - anchoring to a caller-supplied trust-anchor list,
  - the Android attestation extension (OID 1.3.6.1.4.1.11129.2.1.17):
    security levels, challenge, RootOfTrust, application id.

Not handled (on purpose, documented): revocation (a web fetch, so not deterministic),
ML-DSA signatures (newer devices), iOS App Attest (CBOR, separate verifier).
"""

import hashlib

# ----------------------------------------------------------------------------- DER


def _read(b, off):
    """Return (cls, constructed, tag, start, content_start, content_end)."""
    first = b[off]
    cls = first >> 6
    cons = (first >> 5) & 1
    tag = first & 0x1F
    i = off + 1
    if tag == 0x1F:
        tag = 0
        while True:
            c = b[i]
            i += 1
            tag = (tag << 7) | (c & 0x7F)
            if not (c & 0x80):
                break
    ln = b[i]
    i += 1
    if ln & 0x80:
        n = ln & 0x7F
        ln = int.from_bytes(b[i:i + n], "big")
        i += n
    end = i + ln
    if end > len(b):
        raise ValueError("DER length exceeds buffer")
    return (cls, cons, tag, off, i, end)


def _kids(b, node):
    out = []
    off = node[4]
    while off < node[5]:
        k = _read(b, off)
        out.append(k)
        off = k[5]
    return out


def _content(b, node):
    return b[node[4]:node[5]]


def _raw(b, node):
    return b[node[3]:node[5]]


def _int(b, node):
    return int.from_bytes(_content(b, node), "big", signed=True)


def _uint(b, node):
    return int.from_bytes(_content(b, node), "big")


def _oid(b, node):
    c = _content(b, node)
    parts = [c[0] // 40, c[0] % 40]
    v = 0
    for x in c[1:]:
        v = (v << 7) | (x & 0x7F)
        if not (x & 0x80):
            parts.append(v)
            v = 0
    return ".".join(str(p) for p in parts)


def _bitstring(b, node):
    c = _content(b, node)
    return c[1:]  # drop the unused-bits byte


def _epoch(text, tag):
    # UTCTime YYMMDDHHMMSSZ (tag 23) or GeneralizedTime YYYYMMDDHHMMSSZ (tag 24)
    if tag == 23:
        yy = int(text[0:2])
        year = 1900 + yy if yy >= 50 else 2000 + yy
        rest = text[2:]
    else:
        year = int(text[0:4])
        rest = text[4:]
    mo, d, h, mi, s = int(rest[0:2]), int(rest[2:4]), int(rest[4:6]), int(rest[6:8]), int(rest[8:10])
    y = year - (1 if mo <= 2 else 0)
    era = y // 400
    yoe = y - era * 400
    doy = (153 * (mo + (-3 if mo > 2 else 9)) + 2) // 5 + d - 1
    doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    days = era * 146097 + doe - 719468
    return days * 86400 + h * 3600 + mi * 60 + s


# ----------------------------------------------------------------------------- curves

_P256 = (
    0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF,
    0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551,
    0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296,
    0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5,
)
_P384 = (
    (1 << 384) - (1 << 128) - (1 << 96) + (1 << 32) - 1,
    0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC7634D81F4372DDF581A0DB248B0A77AECEC196ACCC52973,
    0xAA87CA22BE8B05378EB1C71EF320AD746E1D3B628BA79B9859F741E082542A385502F25DBF55296C3A545E3872760AB7,
    0x3617DE4A96262C6F5D9E98BF9292DC29F8F41DBD289A147CE9DA3113B5F0B8C00A60B1CE1D7E819D7A431D7C90EA0E5F,
)
_CURVES = {"1.2.840.10045.3.1.7": _P256, "1.3.132.0.34": _P384}  # (p, n, gx, gy), a = -3


def _dbl(p, pt):
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


def _add(p, p1, p2):
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
        return _dbl(p, p1) if s1 == s2 else None
    i = (2 * h) * (2 * h) % p
    j = h * i % p
    r = 2 * (s2 - s1) % p
    v = u1 * i % p
    x3 = (r * r - j - 2 * v) % p
    y3 = (r * (v - x3) - 2 * s1 * j) % p
    z3 = (((z1 + z2) * (z1 + z2) - z1z1 - z2z2) * h) % p
    return (x3, y3, z3)


def _mul(p, k, pt):
    result = None
    addend = pt
    while k > 0:
        if k & 1:
            result = _add(p, result, addend)
        addend = _dbl(p, addend)
        k >>= 1
    return result


def _on_curve(curve_oid, x, y):
    p = _CURVES[curve_oid][0]
    # b is recovered from the generator so only one constant per curve is stored
    gx, gy = _CURVES[curve_oid][2], _CURVES[curve_oid][3]
    b = (gy * gy - gx ** 3 + 3 * gx) % p
    return (y * y - (x ** 3 - 3 * x + b)) % p == 0


def _ecdsa_verify(curve_oid, qx, qy, digest, sig_der):
    p, n, gx, gy = _CURVES[curve_oid]
    if not _on_curve(curve_oid, qx, qy):
        return False
    node = _read(sig_der, 0)
    kids = _kids(sig_der, node)
    r = _uint(sig_der, kids[0])
    s = _uint(sig_der, kids[1])
    if not (1 <= r < n and 1 <= s < n):
        return False
    nbits = n.bit_length()
    e = int.from_bytes(digest, "big")
    if len(digest) * 8 > nbits:
        e >>= len(digest) * 8 - nbits
    w = pow(s, n - 2, n)
    u1 = e * w % n
    u2 = r * w % n
    pt = _add(p, _mul(p, u1, (gx, gy, 1)), _mul(p, u2, (qx, qy, 1)))
    if pt is None:
        return False
    x, y, z = pt
    zi = pow(z, p - 2, p)
    return (x * zi * zi % p) % n == r


_DIGEST_INFO = {
    "sha256": bytes.fromhex("3031300d060960864801650304020105000420"),
    "sha384": bytes.fromhex("3041300d060960864801650304020205000430"),
    "sha512": bytes.fromhex("3051300d060960864801650304020305000440"),
}


def _rsa_verify(n, e, hash_name, tbs, sig):
    k = (n.bit_length() + 7) // 8
    if len(sig) != k:
        return False
    m = pow(int.from_bytes(sig, "big"), e, n)
    em = m.to_bytes(k, "big")
    h = hashlib.new(hash_name, tbs).digest()
    t = _DIGEST_INFO[hash_name] + h
    expected = b"\x00\x01" + b"\xff" * (k - len(t) - 3) + b"\x00" + t
    return em == expected


# Signature algorithm OIDs: name -> (kind, hash)
_SIGALGS = {
    "1.2.840.10045.4.3.2": ("ec", "sha256"),
    "1.2.840.10045.4.3.3": ("ec", "sha384"),
    "1.2.840.10045.4.3.4": ("ec", "sha512"),
    "1.2.840.113549.1.1.11": ("rsa", "sha256"),
    "1.2.840.113549.1.1.12": ("rsa", "sha384"),
    "1.2.840.113549.1.1.13": ("rsa", "sha512"),
}

_OID_EC_KEY = "1.2.840.10045.2.1"
_OID_RSA_KEY = "1.2.840.113549.1.1.1"
_OID_BASIC_CONSTRAINTS = "2.5.29.19"
OID_ATTESTATION = "1.3.6.1.4.1.11129.2.1.17"


# ----------------------------------------------------------------------------- X.509


def parse_cert(der):
    top = _read(der, 0)
    tbs, sigalg, sigbits = _kids(der, top)
    tk = _kids(der, tbs)
    i = 0
    if tk[0][0] == 2 and tk[0][2] == 0:  # [0] version
        i = 1
    serial = _uint(der, tk[i])
    tbs_sigalg = _oid(der, _kids(der, tk[i + 1])[0])
    issuer = _raw(der, tk[i + 2])
    validity = _kids(der, tk[i + 3])
    subject = _raw(der, tk[i + 4])
    spki = tk[i + 5]

    def _time(node):
        return _epoch(_content(der, node).decode("ascii"), node[2])

    sk = _kids(der, spki)
    alg = _kids(der, sk[0])
    alg_oid = _oid(der, alg[0])
    pub = {"alg": alg_oid}
    keybits = _bitstring(der, sk[1])
    if alg_oid == _OID_EC_KEY:
        curve = _oid(der, alg[1])
        if keybits[0] != 4:
            raise ValueError("only uncompressed EC points supported")
        half = (len(keybits) - 1) // 2
        pub.update(
            kind="ec",
            curve=curve,
            x=int.from_bytes(keybits[1:1 + half], "big"),
            y=int.from_bytes(keybits[1 + half:], "big"),
        )
    elif alg_oid == _OID_RSA_KEY:
        rk = _kids(keybits, _read(keybits, 0))
        pub.update(kind="rsa", n=_uint(keybits, rk[0]), e=_uint(keybits, rk[1]))
    else:
        pub.update(kind="unsupported")

    exts = {}
    for node in tk[i + 6:]:
        if node[0] == 2 and node[2] == 3:  # [3] extensions
            for ext in _kids(der, _kids(der, node)[0]):
                ek = _kids(der, ext)
                oid = _oid(der, ek[0])
                value = ek[-1]
                exts[oid] = _content(der, value)

    return {
        "der": der,
        "tbs": _raw(der, tbs),
        "sig_oid": _oid(der, _kids(der, sigalg)[0]),
        "tbs_sig_oid": tbs_sigalg,
        "sig": _bitstring(der, sigbits),
        "issuer": issuer,
        "subject": subject,
        "serial": serial,
        "not_before": _time(validity[0]),
        "not_after": _time(validity[1]),
        "pub": pub,
        "exts": exts,
    }


def _is_ca(cert):
    ext = cert["exts"].get(_OID_BASIC_CONSTRAINTS)
    if ext is None:
        return False
    try:
        node = _read(ext, 0)
        kids = _kids(ext, node)
        return bool(kids) and kids[0][2] == 1 and _strict_bool(ext, kids[0])
    except (ValueError, IndexError):
        return False  # malformed BasicConstraints: not a CA


def _verify_sig(cert, signer_pub):
    if cert["sig_oid"] != cert["tbs_sig_oid"]:
        return False
    spec = _SIGALGS.get(cert["sig_oid"])
    if spec is None:
        return False
    kind, hname = spec
    if kind != signer_pub.get("kind"):
        return False
    if kind == "ec":
        if signer_pub["curve"] not in _CURVES:
            return False
        digest = hashlib.new(hname, cert["tbs"]).digest()
        return _ecdsa_verify(signer_pub["curve"], signer_pub["x"], signer_pub["y"], digest, cert["sig"])
    return _rsa_verify(signer_pub["n"], signer_pub["e"], hname, cert["tbs"], cert["sig"])


def verify_chain(chain_der, anchors_der, now=None):
    """chain_der[0] is the leaf. Returns (ok, reason, parsed_chain)."""
    if not chain_der:
        return (False, "empty chain", None)
    try:
        chain = [parse_cert(d) for d in chain_der]
        anchors = [parse_cert(d) for d in anchors_der]
    except Exception as exc:  # noqa: BLE001 - malformed input must fail closed
        return (False, "parse error: " + str(exc)[:80], None)

    for i, c in enumerate(chain):
        if now is not None and not (c["not_before"] <= now <= c["not_after"]):
            return (False, "cert %d outside validity window" % i, chain)
        if i > 0 and not _is_ca(c):
            return (False, "cert %d is not a CA" % i, chain)

    for i in range(len(chain) - 1):
        if chain[i]["issuer"] != chain[i + 1]["subject"]:
            return (False, "issuer/subject mismatch at %d" % i, chain)
        if not _verify_sig(chain[i], chain[i + 1]["pub"]):
            return (False, "bad signature on cert %d" % i, chain)

    top = chain[-1]
    for a in anchors:
        if top["der"] == a["der"]:
            return (True, "anchored: top cert is a trust anchor", chain)
        if top["issuer"] == a["subject"] and _is_ca(a) and _verify_sig(top, a["pub"]):
            if now is not None and not (a["not_before"] <= now <= a["not_after"]):
                continue
            return (True, "anchored: signed by trust anchor", chain)
    return (False, "chain does not end at a trust anchor", chain)


# ----------------------------------------------------------------------------- Android attestation extension

SECURITY_LEVEL = {0: "SOFTWARE", 1: "TRUSTED_ENVIRONMENT", 2: "STRONGBOX"}
BOOT_STATE = {0: "VERIFIED", 1: "SELF_SIGNED", 2: "UNVERIFIED", 3: "FAILED"}


def _strict_bool(b, node):
    """DER BOOLEAN must be exactly 0x00 or 0xFF. Anything else is malformed, so fail closed."""
    if node[2] != 1 or node[4] + 1 != node[5]:
        raise ValueError("malformed BOOLEAN")
    v = b[node[4]]
    if v == 0xFF:
        return True
    if v == 0x00:
        return False
    raise ValueError("non-DER BOOLEAN value")


def _auth_list(b, node):
    out = {}
    last = -1
    for k in _kids(b, node):
        if k[0] == 2:  # context-specific, explicit tag
            if k[2] <= last:
                raise ValueError("authorization list tags not strictly ascending")
            last = k[2]
            inner = _kids(b, k)
            if inner:
                out[k[2]] = inner[0]
    return out


def _root_of_trust(b, node):
    kids = _kids(b, node)
    return {
        "verified_boot_key": _content(b, kids[0]),
        "device_locked": _strict_bool(b, kids[1]),
        "verified_boot_state": BOOT_STATE.get(_uint(b, kids[2]), "?"),
    }


def _app_id(b, node):
    inner = _read(_content(b, node), 0)
    raw = _content(b, node)
    kids = _kids(raw, inner)
    packages = []
    for pkg in _kids(raw, kids[0]):
        pk = _kids(raw, pkg)
        packages.append((_content(raw, pk[0]).decode("utf-8", "replace"), _uint(raw, pk[1])))
    sigs = [_content(raw, s) for s in _kids(raw, kids[1])]
    return {"packages": packages, "signature_digests": sigs}


def parse_key_description(ext_value):
    b = ext_value
    kids = _kids(b, _read(b, 0))
    sw = _auth_list(b, kids[6])
    hw = _auth_list(b, kids[7])
    out = {
        "attestation_version": _int(b, kids[0]),
        "attestation_security_level": SECURITY_LEVEL.get(_uint(b, kids[1]), "?"),
        "keymint_version": _int(b, kids[2]),
        "keymint_security_level": SECURITY_LEVEL.get(_uint(b, kids[3]), "?"),
        "challenge": _content(b, kids[4]),
        "root_of_trust": None,
        "app_id": None,
    }
    for lst in (hw, sw):
        if out["root_of_trust"] is None and 704 in lst:
            out["root_of_trust"] = _root_of_trust(b, lst[704])
        if out["app_id"] is None and 709 in lst:
            out["app_id"] = _app_id(b, lst[709])
    return out


def check_policy(kd, challenge=None, package=None, signature_digest=None, require_hardware=True):
    """Return (ok, reason). Fails closed."""
    if require_hardware and kd["attestation_security_level"] not in ("TRUSTED_ENVIRONMENT", "STRONGBOX"):
        return (False, "attestation not hardware-backed")
    if require_hardware and kd["keymint_security_level"] not in ("TRUSTED_ENVIRONMENT", "STRONGBOX"):
        return (False, "key not hardware-backed")
    rot = kd["root_of_trust"]
    if rot is None:
        return (False, "no RootOfTrust")
    if not rot["device_locked"]:
        return (False, "bootloader unlocked")
    if rot["verified_boot_state"] != "VERIFIED":
        return (False, "boot state " + rot["verified_boot_state"])
    if challenge is not None and kd["challenge"] != challenge:
        return (False, "challenge mismatch")
    if package is not None:
        app = kd["app_id"]
        if app is None or package not in [p for p, _ in app["packages"]]:
            return (False, "package not allowed")
        if signature_digest is not None and signature_digest not in app["signature_digests"]:
            return (False, "app signing digest not allowed")
    return (True, "ok")


def verify_attestation(chain_der, anchors_der, now=None, require_p256_leaf=True, **policy):
    ok, reason, chain = verify_chain(chain_der, anchors_der, now)
    if not ok:
        return (False, reason, None)
    if require_p256_leaf:
        pub = chain[0]["pub"]
        if pub.get("kind") != "ec" or pub.get("curve") != "1.2.840.10045.3.1.7":
            return (False, "attested key is not EC P-256", None)
    ext = chain[0]["exts"].get(OID_ATTESTATION)
    if ext is None:
        return (False, "leaf has no attestation extension", None)
    try:
        kd = parse_key_description(ext)
    except Exception as exc:  # noqa: BLE001 - malformed input must fail closed
        return (False, "key description parse error: " + str(exc)[:80], None)
    pok, preason = check_policy(kd, **policy)
    return (pok, preason, kd)


def verify_shot_signature(leaf_pub, digest, sig_der):
    """Verify the per-shot signature (ECDSA over a digest the app produced)."""
    if leaf_pub.get("kind") != "ec" or leaf_pub["curve"] not in _CURVES:
        return False
    return _ecdsa_verify(leaf_pub["curve"], leaf_pub["x"], leaf_pub["y"], digest, sig_der)
