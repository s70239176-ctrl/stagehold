// Live Studionet test of the money-holding paths not covered by live_test.mjs, with THROWAWAY keys:
//   A. cancel: needs both parties; refunds unpaid stages; stranger rejected; credits withdrawable
//   B. expire: rejected early, works after expiry, refunds the payer
//   C. silent payer: request_code -> early fallback rejected -> fallback after the window -> builder is paid anyway
// Payout/refund is verified via the contract's own balance (Studionet does not credit ordinary accounts).
//
//   node contracts/live/live_paths.mjs [A] [B] [C]      (default: all)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { spawnSync } from "node:child_process";

const here = resolve(dirname(fileURLToPath(import.meta.url)));
const root = resolve(here, "..", "..");
const fromDir = join(root, "web");
const require = createRequire(join(fromDir, "package.json"));
const toUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/")}`).href;
const { createClient, createAccount, generatePrivateKey } = await import(toUrl(require.resolve("genlayer-js")));
const { studionet } = await import(toUrl(require.resolve("genlayer-js/chains")));
const { TransactionStatus } = await import(toUrl(require.resolve("genlayer-js/types")));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ser = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
const sha256hex = (b) => createHash("sha256").update(b).digest("hex");
const results = [];
function note(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok === null ? "INFO" : ok ? "OK  " : "FAIL"} ${step}  ${detail ?? ""}`);
  writeFileSync(join(here, "live_paths_result.json"), JSON.stringify(results, null, 2));
}

async function paced(label, fn) {
  for (let a = 0; a < 10; a++) {
    try { return await fn(); } catch (e) {
      const t = String(e?.message ?? e) + " " + ser(e?.cause ?? "");
      const m = t.match(/retry_after_seconds\D+(\d+)/);
      if (t.includes("-32029") || m) { await sleep(((m ? Number(m[1]) : 20) + 2) * 1000); continue; }
      if (/fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|socket hang up|<html|502|503|504/i.test(t)) { await sleep((8 + a * 6) * 1000); continue; }
      throw e;
    }
  }
  throw new Error(label + ": gave up");
}

const contractSource = readFileSync(join(root, "contracts", "stagehold.py"), "utf8");
const anchorB64 = readFileSync(join(here, "assets", "anchor.png")).toString("base64");
const FEE = 10n;

function actor() {
  const account = createAccount(generatePrivateKey());
  return { account, client: createClient({ chain: studionet, account }) };
}
const reader = actor().client;
const read = (address, fn, args = []) => paced(fn, () => reader.readContract({ address, functionName: fn, args }));
const snap = async (address) => JSON.parse(String(await read(address, "get_snapshot")));
const balanceOf = async (addr) => BigInt(await paced("bal", () => reader.request({ method: "eth_getBalance", params: [addr, "latest"] })));
const chainNow = async () => Number(BigInt((await paced("block", () => reader.request({ method: "eth_getBlockByNumber", params: ["latest", false] }))).timestamp));

async function send(who, address, fn, args = [], value = 0n) {
  const hash = await paced(fn, () => who.client.writeContract({ address, functionName: fn, args, value }));
  const receipt = await paced(fn + " wait", () => who.client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 90, interval: 12000 }));
  return { hash, receipt };
}
async function leaderText(hash) {
  try {
    const tx = await paced("tx", () => reader.request({ method: "eth_getTransactionByHash", params: [hash] }));
    const lr = tx?.consensus_data?.leader_receipt;
    const l = Array.isArray(lr) ? (lr.find((r) => r?.mode === "leader") ?? lr[0]) : lr;
    const p = typeof l?.result === "string" ? l.result : l?.result?.payload;
    const buf = p ? Buffer.from(p, "base64") : null;
    return `${l?.execution_result ?? "?"}${buf ? ": " + buf.slice(buf[0] <= 8 ? 1 : 0).toString("utf8").slice(0, 120) : ""}`;
  } catch (e) { return "leader receipt unavailable"; }
}
// Outbound transfers land some seconds after the transaction is accepted: poll until the balance is as expected.
async function waitBalance(address, expected, timeoutSec = 240) {
  const t0 = Date.now();
  let b = await balanceOf(address);
  while (b !== expected && Date.now() - t0 < timeoutSec * 1000) {
    await sleep(15000);
    b = await balanceOf(address);
  }
  return b;
}
// Expect a call to end in an execution error whose text contains `needle`.
async function expectError(who, address, fn, args, needle) {
  const { hash } = await send(who, address, fn, args);
  const text = await leaderText(hash);
  return { ok: text.startsWith("ERROR") && text.includes(needle), text };
}

async function deploy(payer, builder, expiresIn, windowS) {
  const h = await paced("deploy", () => payer.client.deployContract({
    code: contractSource, args: [builder.account.address, FEE, expiresIn, "", "", 0n, true, windowS, true],
  }));
  const r = await paced("deploy wait", () => payer.client.waitForTransactionReceipt({ hash: h, status: TransactionStatus.ACCEPTED, retries: 90, interval: 8000 }));
  const address = r?.data?.contract_address ?? r?.txDataDecoded?.contractAddress;
  if (!address) throw new Error("no contract address");
  console.log("  deployed", address);
  return address;
}
async function fundJob(payer, address, stages, amounts) {
  const total = amounts.reduce((a, b) => a + BigInt(b), 0n);
  await send(payer, address, "deposit", [], total);
  await send(payer, address, "fund", [stages, amounts, anchorB64]);
}

// ================================================================ A. cancel
async function pathA() {
  console.log("\n=== A. cancel ===");
  const payer = actor(), builder = actor(), stranger = actor();
  const address = await deploy(payer, builder, 2592000n, 86400n);
  await fundJob(payer, address, ["roof", "plaster"], ["600", "400"]);
  await send(builder, address, "deposit_credits", [], 30n);
  note("A setup", (await balanceOf(address)) === 1030n, `contractBalance=${await balanceOf(address)}`);

  const s = await expectError(stranger, address, "cancel", [], "only the payer or the builder");
  note("A stranger cannot cancel", s.ok, s.text);

  const r1 = await send(payer, address, "cancel");
  let sn = await snap(address);
  note("A payer cancel alone does not refund", sn.status === "ACTIVE" && (await balanceOf(address)) === 1030n, `status=${sn.status} balance=${await balanceOf(address)}`);

  await send(builder, address, "cancel");
  sn = await snap(address);
  const bal = await waitBalance(address, 30n);
  note("A both cancelled: refund left the contract", sn.status === "CANCELLED" && bal === 30n, `status=${sn.status} contractBalance=${bal} (expected 30 = builder credits)`);

  await send(builder, address, "withdraw_credits");
  sn = await snap(address);
  const bal2 = await waitBalance(address, 0n);
  note("A builder withdraws unused credits", sn.builder_credits === "0" && bal2 === 0n, `credits=${sn.builder_credits} balance=${bal2}`);
}

// ================================================================ B. expire
async function pathB() {
  console.log("\n=== B. expire ===");
  const payer = actor(), builder = actor();
  const address = await deploy(payer, builder, 300n, 86400n);
  await fundJob(payer, address, ["roof"], ["700"]);
  let sn = await snap(address);
  const early = await expectError(payer, address, "expire", [], "has not expired");
  note("B expire before the deadline is rejected", early.ok && (await balanceOf(address)) === 700n, `${early.text} balance=${await balanceOf(address)}`);
  const need = sn.expires_at + 20;
  while ((await chainNow()) < need) {
    console.log(`  waiting for expiry... chain ${await chainNow()} / ${need}`);
    await sleep(30000);
  }
  await send(payer, address, "expire");
  sn = await snap(address);
  const bal = await waitBalance(address, 0n);
  note("B expire after the deadline refunds the payer", sn.status === "EXPIRED" && bal === 0n, `status=${sn.status} contractBalance=${bal}`);
  const late = await expectError(builder, address, "register_software_key", ["1", "2"], "not active");
  note("B expired job refuses further actions", late.ok, late.text);
}

// ================================================================ C. silent payer
async function pathC() {
  console.log("\n=== C. silent payer: fallback code, builder still paid ===");
  const payer = actor(), builder = actor();
  const address = await deploy(payer, builder, 2592000n, 40n);
  await fundJob(payer, address, ["roof"], ["1000"]);
  await send(builder, address, "deposit_credits", [], 30n);

  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const hex32 = (b) => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
  const px = hex32(jwk.x), py = hex32(jwk.y);
  const keyId = sha256hex(Buffer.concat([Buffer.from(px, "hex"), Buffer.from(py, "hex")]));
  await send(builder, address, "register_software_key", [px, py]);

  // the payer never calls issue_code
  await send(builder, address, "request_code", ["roof"]);
  let sn = await snap(address);
  const requestAt = sn.stages.roof.request_at;
  note("C request recorded", requestAt > 0 && sn.stages.roof.code === "", `request_at=${requestAt}`);

  const dup = await expectError(builder, address, "request_code", ["roof"], "already");
  note("C second request rejected", dup.ok, dup.text);
  const early = await expectError(builder, address, "trigger_fallback_code", ["roof"], "payer still has time");
  note("C early fallback rejected", early.ok, early.text);

  const need = requestAt + 40 + 15;
  while ((await chainNow()) < need) {
    console.log(`  waiting for the payer window... chain ${await chainNow()} / ${need}`);
    await sleep(15000);
  }
  await send(builder, address, "trigger_fallback_code", ["roof"]);
  sn = await snap(address);
  const code = sn.stages.roof.code, deadline = sn.stages.roof.code_deadline;
  note("C fallback code issued", /^[A-Z]+ [A-Z]+$/.test(code), `code=${code} deadline=${deadline}`);

  // draw that code on the honest scene, sign it like the app would, and submit
  const py2 = spawnSync("python", [join(here, "make_code_asset.py"), code, "fb"], { encoding: "utf8" });
  if (py2.status !== 0) { note("C make shot with fallback code", false, py2.stderr.slice(0, 300)); return; }
  const jpeg = readFileSync(join(here, "assets", "fb.jpg")), thumb = readFileSync(join(here, "assets", "fb_thumb.png"));
  const msg = `stagehold.v1|${address.toLowerCase()}|roof|${code}|${deadline}|${sha256hex(jpeg)}|${sha256hex(thumb)}`;
  const sig = sign("sha256", Buffer.from(msg, "ascii"), { key: privateKey, dsaEncoding: "der" });
  const t0 = Date.now();
  const sub = await send(builder, address, "submit", ["roof", keyId, jpeg.toString("base64"), thumb.toString("base64"), sig.toString("hex")]);
  console.log("  submit tx", sub.hash);
  // The state can lag the receipt: poll for the attempt to appear before judging.
  sn = await snap(address);
  for (let i = 0; i < 16 && sn.stages.roof.attempts === 0; i++) {
    console.log(`  waiting for the submit to show in state... (${i + 1})`);
    await sleep(15000);
    sn = await snap(address);
  }
  const attempt1 = String(await read(address, "get_attempt", ["roof", 1n]));
  note("C submit with the fallback code", sn.stages.roof.status === "SETTLING", `took ${Math.round((Date.now() - t0) / 1000)}s stage=${sn.stages.roof.status} attempt1=${attempt1}${sn.stages.roof.status !== "SETTLING" ? " leader=" + await leaderText(sub.hash) : ""}`);
  if (sn.stages.roof.status !== "SETTLING") return;

  const w0 = Date.now();
  while (Date.now() - w0 < 20 * 60 * 1000) {
    sn = await snap(address);
    if (sn.stages.roof.status === "PAID" && !sn.settling) break;
    console.log(`  waiting for finality... stage=${sn.stages.roof.status} (${Math.round((Date.now() - w0) / 1000)}s)`);
    await sleep(30000);
  }
  // transfers to the builder apply after the finalizing transaction is itself accepted; give them time to land
  let bal = await balanceOf(address);
  for (let i = 0; i < 12 && bal !== BigInt(sn.builder_credits); i++) { await sleep(20000); bal = await balanceOf(address); }
  note("C builder paid although the payer never acted", sn.stages.roof.status === "PAID" && sn.status === "DONE" && bal === BigInt(sn.builder_credits),
    `stage=${sn.stages.roof.status} job=${sn.status} contractBalance=${bal} credits=${sn.builder_credits}`);
}

const which = process.argv.slice(2).map((s) => s.toUpperCase());
const run = (k) => which.length === 0 || which.includes(k);
for (const [k, fn] of [["A", pathA], ["B", pathB], ["C", pathC]]) {
  if (!run(k)) continue;
  try { await fn(); } catch (e) { note(`${k} aborted`, false, String(e?.message ?? e).slice(0, 400)); }
}
console.log("\ndone. results in contracts/live/live_paths_result.json");
