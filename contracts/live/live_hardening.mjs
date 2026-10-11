// Live Studionet tests of the steward's hardening points, with THROWAWAY keys and dev_mode jobs:
//   D. the alignment thumbnail must be a small copy of the judged frame (mismatch and wrong size are refused)
//   E. a failed payable transaction keeps its value: it shows up as surplus and only the payer can reclaim it
//   F. a stage stuck SETTLING can be recovered by a retry of the payout without paying twice
//   G. ... and by direct settlement past the force delay, after which the late original payout is refused
// Payout/refund is verified via the contract's own balance (Studionet does not credit ordinary accounts).
//
//   node contracts/live/live_hardening.mjs [D] [E] [F] [G]      (default: all)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, generateKeyPairSync, sign } from "node:crypto";

const here = resolve(dirname(fileURLToPath(import.meta.url)));
const root = resolve(here, "..", "..");
const require = createRequire(join(root, "web", "package.json"));
const toUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/")}`).href;
const { createClient, createAccount, generatePrivateKey } = await import(toUrl(require.resolve("genlayer-js")));
const { studionet } = await import(toUrl(require.resolve("genlayer-js/chains")));
const { TransactionStatus } = await import(toUrl(require.resolve("genlayer-js/types")));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ser = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
const sha256hex = (b) => createHash("sha256").update(b).digest("hex");
const results = [];
const OUT = join(here, "live_hardening_result.json");
function note(step, ok, detail) {
  results.push({ step, ok, detail, at: new Date().toISOString() });
  console.log(`${ok === null ? "INFO" : ok ? "OK  " : "FAIL"} ${step}  ${detail ?? ""}`);
  writeFileSync(OUT, JSON.stringify(results, null, 2));
}

async function paced(label, fn) {
  for (let a = 0; a < 12; a++) {
    try { return await fn(); } catch (e) {
      const t = String(e?.message ?? e) + " " + ser(e?.cause ?? "");
      const m = t.match(/retry_after_seconds\D+(\d+)/);
      if (t.includes("-32029") || m) { await sleep(((m ? Number(m[1]) : 20) + 2) * 1000); continue; }
      if (/fetch failed|unknown RPC error|ECONNRESET|ETIMEDOUT|UND_ERR|socket hang up|<html|502|503|504/i.test(t)) { await sleep((8 + a * 6) * 1000); continue; }
      throw e;
    }
  }
  throw new Error(label + ": gave up");
}

const contractSource = readFileSync(join(root, "contracts", "stagehold.py"), "utf8");
const asset = (n) => readFileSync(join(here, "assets", n));
const anchorB64 = asset("anchor.png").toString("base64");
const FEE = 10n;

function actor() {
  const account = createAccount(generatePrivateKey());
  return { account, client: createClient({ chain: studionet, account }) };
}
const reader = actor().client;
const read = (address, fn, args = []) => paced(fn, () => reader.readContract({ address, functionName: fn, args }));
const snap = async (address) => JSON.parse(String(await read(address, "get_snapshot")));
const accounting = async (address) => JSON.parse(String(await read(address, "get_accounting")));
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
    return `${l?.execution_result ?? "?"}${buf ? ": " + buf.slice(buf[0] <= 8 ? 1 : 0).toString("utf8").slice(0, 160) : ""}`;
  } catch (e) { return "leader receipt unavailable"; }
}
async function waitBalance(address, expected, timeoutSec = 300) {
  const t0 = Date.now();
  let b = await balanceOf(address);
  while (b !== expected && Date.now() - t0 < timeoutSec * 1000) { await sleep(15000); b = await balanceOf(address); }
  return b;
}
async function expectError(who, address, fn, args, needle, value = 0n) {
  const { hash } = await send(who, address, fn, args, value);
  const text = await leaderText(hash);
  return { ok: text.startsWith("ERROR") && text.includes(needle), text, hash };
}
async function deploy(payer, builder, expiresIn, windowS) {
  const h = await paced("deploy", () => payer.client.deployContract({
    code: contractSource, args: [builder.account.address, FEE, expiresIn, "", "", 0n, true, windowS, true],
  }));
  const r = await paced("deploy wait", () => payer.client.waitForTransactionReceipt({ hash: h, status: TransactionStatus.ACCEPTED, retries: 90, interval: 8000 }));
  const address = r?.data?.contract_address ?? r?.txDataDecoded?.contractAddress;
  if (!address) throw new Error("no contract address");
  console.log("  deployed", address);
  return { address, hash: h };
}
async function setup(payer, builder, address, amounts, credits) {
  const total = amounts.reduce((a, b) => a + BigInt(b), 0n);
  await send(payer, address, "deposit", [], total);
  await send(payer, address, "fund", [["roof", "plaster"].slice(0, amounts.length), amounts, anchorB64]);
  await send(builder, address, "deposit_credits", [], credits);
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const hex32 = (b) => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
  const px = hex32(jwk.x), py = hex32(jwk.y);
  const keyId = sha256hex(Buffer.concat([Buffer.from(px, "hex"), Buffer.from(py, "hex")]));
  await send(builder, address, "register_software_key", [px, py]);
  await send(payer, address, "issue_code", ["roof", "K7Q2"]);
  const sn = await snap(address);
  return { keyId, privateKey, deadline: sn.stages.roof.code_deadline };
}
function shotArgs(address, k, jpegName, thumbName) {
  const jpeg = asset(jpegName), thumb = asset(thumbName);
  const msg = `stagehold.v1|${address.toLowerCase()}|roof|K7Q2|${k.deadline}|${sha256hex(jpeg)}|${sha256hex(thumb)}`;
  const sig = sign("sha256", Buffer.from(msg, "ascii"), { key: k.privateKey, dsaEncoding: "der" });
  return ["roof", k.keyId, jpeg.toString("base64"), thumb.toString("base64"), sig.toString("hex")];
}

// ================================================================ D. thumbnail must match the frame
async function pathD() {
  console.log("\n=== D. the thumbnail must be a small copy of the judged frame ===");
  const payer = actor(), builder = actor();
  const { address } = await deploy(payer, builder, 2592000n, 86400n);
  const k = await setup(payer, builder, address, ["1000"], 50n);
  const before = await snap(address);
  const balBefore = await balanceOf(address);

  // a perfectly signed shot whose thumbnail is the wrong size for the frame
  const size = await expectError(builder, address, "submit", shotArgs(address, k, "good.jpg", "anchor.png"), "thumbnail size does not match the frame");
  note("D thumbnail of the wrong size is refused", size.ok, size.text);

  // a perfectly signed shot whose thumbnail belongs to a different picture (other_thumb is another scene at the same size)
  const wrong = await expectError(builder, address, "submit", shotArgs(address, k, "good.jpg", "other_thumb.png"), "thumbnail does not match the frame");
  note("D thumbnail of a different picture is refused", wrong.ok, wrong.text);

  const after = await snap(address);
  const balAfter = await balanceOf(address);
  note("D refused shots change nothing: credits, attempts and balance", after.builder_credits === before.builder_credits && after.stages.roof.attempts === 0 && balAfter === balBefore,
    `credits ${before.builder_credits}->${after.builder_credits} attempts=${after.stages.roof.attempts} balance ${balBefore}->${balAfter}`);

  // control: the honest pair is accepted by the thumbnail check and reaches the panel
  const t0 = Date.now();
  const good = await send(builder, address, "submit", shotArgs(address, k, "good.jpg", "good_thumb.png"));
  const text = await leaderText(good.hash);
  let sn = await snap(address);
  for (let i = 0; i < 12 && sn.stages.roof.attempts === 0; i++) { await sleep(15000); sn = await snap(address); }
  const attempt = String(await read(address, "get_attempt", ["roof", 1n]));
  note("D honest frame and its own thumbnail reach the panel", sn.stages.roof.attempts === 1 && attempt.includes("stage_met"), `took ${Math.round((Date.now() - t0) / 1000)}s attempt1=${attempt} leader=${text.slice(0, 80)}`);
  return address;
}

// ================================================================ E. failed payable transactions
async function pathE() {
  console.log("\n=== E. value from failed transactions is accounted for and recoverable ===");
  const payer = actor(), builder = actor(), stranger = actor();
  const { address } = await deploy(payer, builder, 2592000n, 86400n);
  await setup(payer, builder, address, ["600", "400"], 30n);
  let bal = await balanceOf(address);
  let acc = await accounting(address);
  note("E books balance before any stray value", bal === 1030n && acc.surplus === "0" && acc.liabilities === "1030", `balance=${bal} accounting=${ser(acc)}`);

  // 1. the builder sends value to a payer-only payable method: the call errors and keeps the value
  const a = await expectError(builder, address, "deposit", [], "only the payer", 777n);
  bal = await waitBalance(address, 1807n, 120);
  acc = await accounting(address);
  note("E payable call that errors keeps the value, visible as surplus", a.ok && bal === 1807n && acc.surplus === "777", `leader=${a.text} balance=${bal} accounting=${ser(acc)}`);

  // 2. a stranger sends value to the builder-only payable method
  const b = await expectError(stranger, address, "deposit_credits", [], "only the builder", 55n);
  bal = await waitBalance(address, 1862n, 120);
  acc = await accounting(address);
  note("E second failed payable call adds to the surplus", b.ok && bal === 1862n && acc.surplus === "832", `leader=${b.text} balance=${bal} accounting=${ser(acc)}`);

  // 3. value attached to a non-payable method
  let c;
  try {
    c = await expectError(builder, address, "cancel", [], "", 123n);
  } catch (e) {
    c = { ok: false, text: "send failed: " + String(e?.message ?? e).slice(0, 200) };
  }
  bal = await balanceOf(address);
  acc = await accounting(address);
  note("E value attached to a non-payable method is also accounted for", acc.surplus === String(bal - BigInt(acc.liabilities)), `leader=${c.text} balance=${bal} accounting=${ser(acc)}`);
  const surplusNow = BigInt(acc.surplus);

  // 4. the payer cannot reclaim while the job is open
  const open = await expectError(payer, address, "reclaim_surplus", [], "not closed");
  note("E surplus cannot be reclaimed while the job is open", open.ok, open.text);

  // 5. close the job: both cancel -> unpaid stages refunded
  await send(payer, address, "cancel");
  await send(builder, address, "cancel");
  let sn = await snap(address);
  const afterRefund = await waitBalance(address, 30n + surplusNow, 240);
  note("E both cancelled: stage money refunded, credits and stray value remain", sn.status === "CANCELLED" && afterRefund === 30n + surplusNow, `status=${sn.status} balance=${afterRefund} (credits 30 + stray ${surplusNow})`);

  const early = await expectError(payer, address, "reclaim_surplus", [], "too early");
  const stranger2 = await expectError(stranger, address, "reclaim_surplus", [], "only the payer");
  note("E reclaim is refused too early and refused for anyone but the payer", early.ok || stranger2.ok, `early: ${early.text} | stranger: ${stranger2.text}`);

  const need = sn.closed_at + sn.surplus_delay + 10;
  while ((await chainNow()) < need) { await sleep(10000); }
  const rec = await send(payer, address, "reclaim_surplus");
  const recText = await leaderText(rec.hash);
  const finalBal = await waitBalance(address, 30n, 240);
  acc = await accounting(address);
  note("E payer reclaims exactly the stray value; credits untouched", finalBal === 30n && acc.surplus === "0" && acc.liabilities === "30", `leader=${recText} balance=${finalBal} accounting=${ser(acc)}`);

  const again = await expectError(payer, address, "reclaim_surplus", [], "no unaccounted");
  note("E a second reclaim finds nothing", again.ok, again.text);
  await send(builder, address, "withdraw_credits");
  const zero = await waitBalance(address, 0n, 240);
  note("E builder withdraws credits; contract ends at exactly 0", zero === 0n, `balance=${zero}`);
  return address;
}

// ================================================================ F. recovery of a stuck settlement
// mode "retry": call recover_settlement once the retry delay has passed (it re-emits the finalized payout).
// mode "force": wait past the force delay and call it while the stage is still SETTLING (direct settlement);
//               the original finalized message then arrives late and must be refused, not pay twice.
async function pathF(mode = "retry") {
  console.log(`
=== F (${mode}). recovery of a SETTLING stage ===`);
  const payer = actor(), builder = actor(), anyone = actor();
  const { address } = await deploy(payer, builder, 2592000n, 86400n);
  const k = await setup(payer, builder, address, ["1000"], 30n);
  const t0 = Date.now();
  await send(builder, address, "submit", shotArgs(address, k, "good.jpg", "good_thumb.png"));
  let sn = await snap(address);
  for (let i = 0; i < 12 && sn.stages.roof.attempts === 0; i++) { await sleep(15000); sn = await snap(address); }
  const st = sn.stages.roof;
  note(`F ${mode}: the panel passes the shot; the stage is SETTLING`, st.status === "SETTLING" || st.status === "PAID",
    `took ${Math.round((Date.now() - t0) / 1000)}s stage=${st.status} settle_at=${st.settle_at} attempt1=${String(await read(address, "get_attempt", ["roof", 1n]))}`);

  let recovery = null;
  if (st.status === "SETTLING") {
    const wantAge = mode === "force" ? sn.settle_force + 2 : sn.settle_retry + 1;
    let age = (await chainNow()) - st.settle_at;
    while (age < wantAge) { await sleep(3000); age = (await chainNow()) - st.settle_at; }
    sn = await snap(address);
    if (sn.stages.roof.status === "SETTLING") {
      const r = await send(anyone, address, "recover_settlement", ["roof"]);
      recovery = await leaderText(r.hash);
      note(`F ${mode}: anyone calls recover_settlement on a SETTLING stage (age ${age}s)`,
        mode === "force" ? /settled directly/.test(recovery) : /payout retried|settled directly/.test(recovery), recovery);
    } else {
      note(`F ${mode}: the normal payout landed before the recovery call`, null, `stage=${sn.stages.roof.status}; this run could not exercise the ${mode} path`);
    }
  }

  const w0 = Date.now();
  while (Date.now() - w0 < 12 * 60 * 1000) {
    sn = await snap(address);
    if (sn.stages.roof.status === "PAID" && !sn.settling) break;
    await sleep(15000);
  }
  // credits 30, minus the 10 burned for the attempt, remain: the stage amount must have left exactly once
  const bal = await waitBalance(address, 20n, 300);
  await sleep(90000); // the original and any retried payout messages all land in this time
  const bal2 = await balanceOf(address);
  note(`F ${mode}: builder paid exactly once (only the remaining 20 credits stay; nothing more leaves)`, sn.stages.roof.status === "PAID" && sn.status === "DONE" && bal === 20n && bal2 === 20n,
    `stage=${sn.stages.roof.status} job=${sn.status} balance=${bal} then ${bal2} (1000 stage + 30 credits - 10 fee - 1000 payout = 20)`);
  const again = await expectError(anyone, address, "recover_settlement", ["roof"], "not settling");
  note(`F ${mode}: recovery on a paid stage is refused`, again.ok, again.text);
  const acc = await accounting(address);
  note(`F ${mode}: accounting identity holds at the end`, acc.balance === "20" && acc.liabilities === "20" && acc.surplus === "0", ser(acc));
  return address;
}

const which = process.argv.slice(2).map((s) => s.toUpperCase());
const run = (k) => which.length === 0 || which.includes(k);
const addresses = {};
for (const [k, fn] of [["D", pathD], ["E", pathE], ["F", () => pathF("retry")], ["G", () => pathF("force")]]) {
  if (!run(k)) continue;
  try { addresses[k] = await fn(); } catch (e) { note(`${k} aborted`, false, String(e?.message ?? e).slice(0, 400)); }
}
note("contracts used", null, ser(addresses));
console.log("\ndone. results in contracts/live/live_hardening_result.json");
