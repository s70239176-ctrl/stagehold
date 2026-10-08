import test from "node:test";
import assert from "node:assert/strict";
import { looksVirtual, meanAbsDiff, frozen } from "./liveness.ts";

test("software camera names are caught, device names are not", () => {
  for (const n of ["OBS Virtual Camera", "ManyCam Virtual Webcam", "Snap Camera", "XSplit VCam"]) assert.ok(looksVirtual(n), n);
  for (const n of ["FaceTime HD Camera", "Integrated Camera (0bda:5653)", "camera2 0, facing back", ""]) assert.ok(!looksVirtual(n), n);
});

test("identical frames are frozen, noisy frames are live", () => {
  const a = new Uint8Array(100).fill(120);
  assert.equal(meanAbsDiff(a, a), 0);
  assert.ok(frozen([0, 0, 0]));
  const b = a.map((v, i) => (i % 2 ? v + 2 : v));
  assert.ok(meanAbsDiff(a, b) >= 0.05);
  assert.ok(!frozen([0, meanAbsDiff(a, b)]));
});
