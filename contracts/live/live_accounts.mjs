// Live Studionet test that payouts, refunds, fee burns and surplus claims ARRIVE in the recipients' accounts.
// Payer and builder are throwaway accounts made known to Studionet with sim_fundAccount, so debits and credits are
// real and every balance can be checked in the accounts themselves, not only in the contract.
//   node contracts/live/live_accounts.mjs
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
const OUT = join(here, "live_accounts_result.json");
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
const FEE = 10n ** 16n; // 0.01 GEN, as in the app

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
    code: contractSource, args: [builder.account.address, FEE, expiresIn, "", "", 0n, true, windowS, true, false],
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

const GEN = 10n ** 18n;
const g = (x) => BigInt(Math.round(x * 1e6)) * 10n ** 12n;
const fmt = (w) => `${Number(w) / 1e18} GEN`;
const BURN = "0x000000000000000000000000000000000000dEaD";
const rpcRaw = (method, params) => paced("rpc", async () => (await (await fetch("https://studio.genlayer.com/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()));
const fund = (addr, wei) => rpcRaw("sim_fundAccount", [addr, Number(wei)]);
const waitAcct = async (addr, expected, timeoutSec = 400) => {
  const t0 = Date.now();
  let b = await balanceOf(addr);
  while (b !== expected && Date.now() - t0 < timeoutSec * 1000) { await sleep(15000); b = await balanceOf(addr); }
  return b;
};
const newJob = (payer, builder, expiresIn = 2592000n, windowS = 86400n) => deploy(payer, builder, expiresIn, windowS);

async function main() {
  const payer = actor(), builder = actor();
  await fund(payer.account.address, 5n * GEN);
  await fund(builder.account.address, 1n * GEN);
  const P0 = await balanceOf(payer.account.address), B0 = await balanceOf(builder.account.address);
  note("accounts: payer 5 GEN and builder 1 GEN, known to Studionet", P0 === 5n * GEN && B0 === 1n * GEN, `payer ${fmt(P0)} builder ${fmt(B0)}`);
  const burn0 = await balanceOf(BURN);

  console.log("=== A. pass: the payout reaches the builder's account ===");
  const { address: A } = await newJob(payer, builder);
  await send(payer, A, "deposit", [], g(0.5));
  await send(payer, A, "fund", [["roof"], [String(g(0.5))], anchorB64]);
  let pb = await waitAcct(payer.account.address, P0 - g(0.5), 120);
  note("A funding debits the payer's account by exactly the stage amount", pb === P0 - g(0.5), `payer ${fmt(pb)} contract ${fmt(await balanceOf(A))}`);
  await send(builder, A, "deposit_credits", [], g(0.1));
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const hex32 = (b) => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
  const px = hex32(jwk.x), py = hex32(jwk.y);
  const keyId = sha256hex(Buffer.concat([Buffer.from(px, "hex"), Buffer.from(py, "hex")]));
  await send(builder, A, "register_software_key", [px, py]);
  await send(payer, A, "issue_code", ["roof", "K7Q2"]);
  let sn = await snap(A);
  const k = { keyId, privateKey, deadline: sn.stages.roof.code_deadline };
  let bb = await waitAcct(builder.account.address, B0 - g(0.1), 120);
  note("A buying credits debits the builder's account by exactly the credits", bb === B0 - g(0.1), `builder ${fmt(bb)}`);

  await send(builder, A, "submit", shotArgs(A, k, "bad.jpg", "bad_thumb.png"));
  sn = await snap(A);
  for (let i = 0; i < 30 && sn.stages.roof.attempts === 0; i++) { await sleep(8000); sn = await snap(A); }
  const burn1 = await waitAcct(BURN, burn0 + g(0.01), 300);
  note("A a refused attempt burns its fee: the burn address is credited", burn1 === burn0 + g(0.01), `burn address ${fmt(burn1 - burn0)} higher; stage ${sn.stages.roof.status}`);

  const sub = await send(builder, A, "submit", shotArgs(A, k, "good.jpg", "good_thumb.png"));
  sn = await snap(A);
  for (let i = 0; i < 30 && sn.stages.roof.attempts < 2; i++) { await sleep(8000); sn = await snap(A); }
  note("A the panel passes the right code; the stage is settling", sn.stages.roof.status === "SETTLING" || sn.stages.roof.status === "PAID", `stage ${sn.stages.roof.status}`);
  const expectedBuilder = B0 - g(0.1) + g(0.5);
  bb = await waitAcct(builder.account.address, expectedBuilder, 600);
  note("A at finality the builder's ACCOUNT is credited the stage amount, once", bb === expectedBuilder, `builder ${fmt(bb)} (1 - 0.1 credits + 0.5 payout = ${fmt(expectedBuilder)})`);
  await sleep(45000);
  const bb2 = await balanceOf(builder.account.address);
  const cA = await balanceOf(A);
  note("A nothing more is paid, and the contract holds exactly the unspent credits", bb2 === expectedBuilder && cA === g(0.08), `builder ${fmt(bb2)}; contract ${fmt(cA)} (0.1 - 2 fees = 0.08)`);
  const fin = await waitFinal(sub.hash, 600);
  note("A the finalized payout and the transfer messages finalized without a GenVM error", fin.status === "FINALIZED" && fin.triggered.every((x) => x.status === "FINALIZED" && x.exec !== "ERROR"),
    `submit ${fin.status}; triggered: ${fin.triggered.map((x) => `${x.kind} ${x.status} ${x.exec ?? "no GenVM run (plain send)"}${x.error ? " (" + x.error + ")" : ""}`).join(" | ")}`);
  await send(builder, A, "withdraw_credits", []);
  const bb3 = await waitAcct(builder.account.address, expectedBuilder + g(0.08), 300);
  note("A withdrawing the credits returns exactly the remainder to the builder's account", bb3 === expectedBuilder + g(0.08) && (await waitAcct(A, 0n, 120)) === 0n, `builder ${fmt(bb3)}; contract ${fmt(await balanceOf(A))}`);

  console.log("=== B. cancel: the refund reaches the payer's account ===");
  const P1 = await balanceOf(payer.account.address);
  const { address: Bc } = await newJob(payer, builder);
  await send(payer, Bc, "deposit", [], g(0.4));
  await send(payer, Bc, "fund", [["roof"], [String(g(0.4))], anchorB64]);
  const pAfterFund = await waitAcct(payer.account.address, P1 - g(0.4), 120);
  await send(payer, Bc, "cancel", []);
  await send(builder, Bc, "cancel", []);
  const pRef = await waitAcct(payer.account.address, P1, 400);
  note("B both parties cancel: the payer's ACCOUNT gets the whole 0.4 GEN back", pAfterFund === P1 - g(0.4) && pRef === P1 && (await balanceOf(Bc)) === 0n, `payer ${fmt(pAfterFund)} after funding, ${fmt(pRef)} after the refund; contract ${fmt(await balanceOf(Bc))}`);

  console.log("=== C. surplus: the reclaimed stray value reaches the payer's account ===");
  const { address: C } = await newJob(payer, builder);
  await send(payer, C, "deposit", [], g(0.2));
  await send(payer, C, "fund", [["roof"], [String(g(0.2))], anchorB64]);
  const B2 = await balanceOf(builder.account.address);
  const stray = await expectError(builder, C, "deposit", [], "only the payer", g(0.007));
  const bStray = await waitAcct(builder.account.address, B2 - g(0.007), 120);
  const accC = await accounting(C);
  note("C a failed payable call by the builder keeps 0.007 GEN: debited from the builder, reported as surplus", stray.ok && bStray === B2 - g(0.007) && accC.surplus === String(g(0.007)), `leader ${stray.text}; builder ${fmt(bStray)}; accounting ${ser(accC)}`);
  const P2 = await balanceOf(payer.account.address);
  await send(payer, C, "cancel", []);
  await send(builder, C, "cancel", []);
  sn = await snap(C);
  while ((await chainNow()) < sn.closed_at + sn.surplus_delay + 5) await sleep(10000);
  await send(payer, C, "reclaim_surplus", []);
  const P3 = await waitAcct(payer.account.address, P2 + g(0.2) + g(0.007), 400);
  note("C the payer's ACCOUNT receives the refund (0.2) and the reclaimed stray value (0.007)", P3 === P2 + g(0.2) + g(0.007) && (await balanceOf(C)) === 0n, `payer ${fmt(P3)}; contract ${fmt(await balanceOf(C))}`);
  note("contracts used", null, ser({ A, B: Bc, C }));
}
try { await main(); } catch (e) { note("aborted", false, String(e?.message ?? e).slice(0, 400)); }
console.log("done");
