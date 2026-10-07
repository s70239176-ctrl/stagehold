import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fromB64, fromHex, keyInfo, p1363ToDer, sha256Hex, shotMessage, signShot, toB64, toHex } from "./crypto.ts";
import { CODE_WORDS, suggestCode, validCode } from "./words.ts";

const here = dirname(fileURLToPath(import.meta.url));

test("shot message equals the contract's layout", () => {
  const msg = new TextDecoder().decode(shotMessage("0xABCDEF", "roof", "DUCK MOON", 1760000000, "aa".repeat(32), "bb".repeat(32)));
  assert.equal(msg, `stagehold.v1|0xabcdef|roof|DUCK MOON|1760000000|${"aa".repeat(32)}|${"bb".repeat(32)}`);
});

test("hex and base64 round trip", () => {
  const b = Uint8Array.from({ length: 300 }, (_, i) => (i * 7) % 256);
  assert.deepEqual(fromHex(toHex(b)), b);
  assert.deepEqual(fromB64(toB64(b)), b);
});

test("sha256Hex matches node", async () => {
  const data = new TextEncoder().encode("stagehold");
  assert.equal(await sha256Hex(data), createHash("sha256").update(data).digest("hex"));
});

test("a WebCrypto signature, converted to DER, verifies under node and carries the contract key_id", async () => {
  for (let n = 0; n < 25; n++) {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const info = await keyInfo(raw);
    assert.equal(info.keyId, createHash("sha256").update(Buffer.from(raw.subarray(1))).digest("hex"));
    const msg = shotMessage("0xabc", "roof", "TREE BLUE", 1760000000 + n, "11".repeat(32), "22".repeat(32));
    const derHex = await signShot(pair.privateKey, msg);
    const spki = Buffer.from(await crypto.subtle.exportKey("spki", pair.publicKey));
    const ok = verify("sha256", Buffer.from(msg), createPublicKey({ key: spki, format: "der", type: "spki" }), Buffer.from(derHex, "hex"));
    assert.ok(ok, "DER signature must verify");
    const tampered = shotMessage("0xabc", "roof", "TREE BLUE", 1760000000 + n + 1, "11".repeat(32), "22".repeat(32));
    assert.ok(!verify("sha256", Buffer.from(tampered), createPublicKey({ key: spki, format: "der", type: "spki" }), Buffer.from(derHex, "hex")));
  }
});

test("p1363ToDer handles high bits and leading zeros", () => {
  const sig = new Uint8Array(64);
  sig[0] = 0x80; // r high bit set -> needs a 0x00 pad
  sig[31] = 1;
  sig[32] = 0; // s starts with zero bytes
  sig[63] = 5;
  const der = p1363ToDer(sig);
  assert.equal(der[0], 0x30);
  assert.equal(der[2], 0x02);
  assert.equal(der[4], 0x00); // padding byte before r
  assert.throws(() => p1363ToDer(new Uint8Array(10)));
});

test("word list equals the contract's CODE_WORDS", () => {
  const src = readFileSync(join(here, "..", "..", "contracts", "src", "body.py"), "utf8");
  const block = src.split("CODE_WORDS = (")[1]!.split(")")[0]!;
  const words = [...block.matchAll(/"([A-Z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(words, [...CODE_WORDS]);
  assert.equal(new Set(CODE_WORDS).size, CODE_WORDS.length);
});

test("codes follow the contract's validity rule", () => {
  for (let i = 0; i < 200; i++) assert.ok(validCode(suggestCode()));
  for (const bad of ["ab", "tree", " TREE", "TREE ", "TREE  BLUE", "THIS CODE IS TOO LONG", "TREE-BLUE"]) {
    assert.ok(!validCode(bad), bad);
  }
  assert.ok(validCode("K7Q2") && validCode("TREE BLUE"));
});
