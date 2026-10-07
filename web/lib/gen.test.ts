import assert from "node:assert/strict";
import { test } from "node:test";
import { formatGen, parseGen, sumWei, withUnit } from "./gen.ts";

test("parses decimal GEN into wei exactly", () => {
  assert.equal(parseGen("1"), 10n ** 18n);
  assert.equal(parseGen("0.25"), 250000000000000000n);
  assert.equal(parseGen(" 1,250.5 "), 1250500000000000000000n);
  assert.equal(parseGen("0.000000000000000001"), 1n);
});

test("rejects anything that is not a plain decimal", () => {
  for (const bad of ["", "abc", "-1", "1e3", "1.", ".5", "1.0000000000000000001", "1 GEN", "0x10"]) {
    assert.equal(parseGen(bad), null, bad);
  }
});

test("formats wei as GEN with grouping and trimmed zeros", () => {
  assert.equal(formatGen(0n), "0");
  assert.equal(formatGen(10n ** 18n), "1");
  assert.equal(formatGen(250000000000000000n), "0.25");
  assert.equal(formatGen(1250250000000000000000n), "1,250.25");
  assert.equal(formatGen("500000000000000000"), "0.5");
  assert.equal(formatGen(123456789012345678n), "0.1234");
  assert.equal(withUnit(10n ** 17n), "0.1 GEN");
});

test("tiny non-zero amounts are never shown as zero", () => {
  assert.equal(formatGen(1n), "<0.0001");
  assert.equal(formatGen(99999999999999n), "<0.0001");
});

test("round trip and sum", () => {
  for (const text of ["0.01", "0.1", "2.5", "1000", "0.123456789012345678"]) {
    assert.equal(formatGen(parseGen(text)!, 18), text.includes(".") ? text : text.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
  }
  assert.equal(sumWei(["1", 2n, "3"]), 6n);
});
