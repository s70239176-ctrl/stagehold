// Live Studionet test of the panel's same-site check, with THROWAWAY keys and genuine photographs (see make_site_assets.py):
//   a photograph of a different site (right code on its wall) is refused for the site; a later photograph of the same site passes.
//   node contracts/live/live_site.mjs
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
const OUT = join(here, "live_site_result.json");
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
const anchorB64 = asset("site_anchor.jpg").toString("base64");
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
const errOf = (l) => {
  const pl = typeof l?.result === "string" ? l.result : l?.result?.payload;
  return pl ? Buffer.from(pl, "base64").toString("utf8").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, 120) : "";
};
/** The messages a transaction emitted (finalized payouts, retries, transfers) and how each ended. */
async function triggeredOf(hash) {
  const tx = await paced("tx", () => reader.request({ method: "eth_getTransactionByHash", params: [hash] }));
  const out = [];
  for (const h of tx?.triggered_transactions ?? []) {
    const k = await paced("tx", () => reader.request({ method: "eth_getTransactionByHash", params: [h] }));
    const lr = k?.consensus_data?.leader_receipt;
    const l = Array.isArray(lr) ? (lr.find((r) => r?.mode === "leader") ?? lr[0]) : lr;
    out.push({ hash: h, kind: String(k?.value ?? 0) !== "0" ? "transfer" : "call", status: k?.status, exec: l?.execution_result, error: l?.execution_result === "ERROR" ? errOf(l) : "" });
  }
  return { status: tx?.status, triggered: out };
}
async function waitFinal(hash, timeoutS = 600) {
  const t0 = Date.now();
  let r = await triggeredOf(hash);
  while ((r.status !== "FINALIZED" || r.triggered.length === 0) && Date.now() - t0 < timeoutS * 1000) { await sleep(15000); r = await triggeredOf(hash); }
  return r;
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
    code: contractSource, args: [builder.account.address, FEE, expiresIn, "", "", 0n, true, windowS, true, true],
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
  await send(payer, address, "fund", [["openings"], amounts, anchorB64]);
  await send(builder, address, "deposit_credits", [], credits);
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const hex32 = (b) => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
  const px = hex32(jwk.x), py = hex32(jwk.y);
  const keyId = sha256hex(Buffer.concat([Buffer.from(px, "hex"), Buffer.from(py, "hex")]));
  await send(builder, address, "register_software_key", [px, py]);
  await send(payer, address, "issue_code", ["openings", "TREE BLUE"]);
  const sn = await snap(address);
  return { keyId, privateKey, deadline: sn.stages.openings.code_deadline };
}
function shotArgs(address, k, jpegName, thumbName) {
  const jpeg = asset(jpegName), thumb = asset(thumbName);
  const msg = `stagehold.v1|${address.toLowerCase()}|openings|TREE BLUE|${k.deadline}|${sha256hex(jpeg)}|${sha256hex(thumb)}`;
  const sig = sign("sha256", Buffer.from(msg, "ascii"), { key: k.privateKey, dsaEncoding: "der" });
  return ["openings", k.keyId, jpeg.toString("base64"), thumb.toString("base64"), sig.toString("hex")];
}

// ================================================================ the site check
async function main() {
  console.log("=== same-site check with genuine photographs ===");
  const payer = actor(), builder = actor();
  const { address } = await deploy(payer, builder, 2592000n, 86400n);
  const k = await setup(payer, builder, address, ["1000"], 50n);
  let sn = await snap(address);
  note("site: the job asks the validators, and stores a JPEG anchor", sn.site_check === true && sn.anchor_kind === "jpeg" && sn.stages.openings.funded === "1000", `site_check=${sn.site_check} anchor_kind=${sn.anchor_kind} anchor_hash=${sn.anchor_hash.slice(0, 12)}`);

  const t0 = Date.now();
  const bad = await send(builder, address, "submit", shotArgs(address, k, "site_other.jpg", "site_other_thumb.png"));
  sn = await snap(address);
  for (let i = 0; i < 12 && sn.stages.openings.attempts === 0; i++) { await sleep(15000); sn = await snap(address); }
  const a1 = JSON.parse(String(await read(address, "get_attempt", ["openings", 1n])) || "{}");
  note("site: a different site, with the right code on its wall, is refused for the site and nothing is paid", a1.paid === false && a1.same_site === "no" && sn.stages.openings.status === "OPEN" && sn.builder_credits === "40",
    `took ${Math.round((Date.now() - t0) / 1000)}s verdict=${JSON.stringify(a1)} stage=${sn.stages.openings.status} credits=${sn.builder_credits}`);

  const t1 = Date.now();
  const good = await send(builder, address, "submit", shotArgs(address, k, "site_same.jpg", "site_same_thumb.png"));
  sn = await snap(address);
  for (let i = 0; i < 12 && sn.stages.openings.attempts === 1; i++) { await sleep(15000); sn = await snap(address); }
  const a2 = JSON.parse(String(await read(address, "get_attempt", ["openings", 2n])) || "{}");
  note("site: a later photograph of the same site passes (same site, stage and code all yes)", a2.paid === true && a2.same_site === "yes" && a2.stage_met === "yes" && a2.code_visible === "yes",
    `took ${Math.round((Date.now() - t1) / 1000)}s verdict=${JSON.stringify(a2)} stage=${sn.stages.openings.status}`);
  const w0 = Date.now();
  while (Date.now() - w0 < 12 * 60 * 1000) { sn = await snap(address); if (sn.stages.openings.status === "PAID" && !sn.settling) break; await sleep(15000); }
  const bal = await waitBalance(address, 30n, 300);
  note("site: paid at finality, once; the books balance", sn.stages.openings.status === "PAID" && sn.status === "DONE" && bal === 30n, `stage=${sn.stages.openings.status} job=${sn.status} balance=${bal} (50 credits - 2 fees of 10 = 30)`);
  const acc = await accounting(address);
  note("site: accounting identity holds", acc.balance === "30" && acc.liabilities === "30" && acc.surplus === "0", ser(acc));
  note("site: contract used", null, address);
}
try { await main(); } catch (e) { note("site aborted", false, String(e?.message ?? e).slice(0, 400)); }
console.log("done");
