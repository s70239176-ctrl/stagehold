// Live Studionet run of contracts/stagehold.py with THROWAWAY keys (gasless dev network).
//
//   node contracts/live/live_test.mjs [--from <dir with genlayer-js>]
//
// Steps: deploy -> fund -> register test key (dev mode) -> issue code -> submit wrong-code shot
//        -> submit good shot -> wait for finality payout -> check balances.
// Writes contracts/live/live_result.json. Keys are generated in memory and never stored.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, generateKeyPairSync, sign } from "node:crypto";

const here = resolve(dirname(fileURLToPath(import.meta.url)));
const root = resolve(here, "..", "..");
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}
const fromDir = arg("from", join(root, "web"));
const require = createRequire(join(fromDir, "package.json"));
const toUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/")}`).href;
const { createClient, createAccount, generatePrivateKey } = await import(toUrl(require.resolve("genlayer-js")));
const { studionet } = await import(toUrl(require.resolve("genlayer-js/chains")));
const { TransactionStatus } = await import(toUrl(require.resolve("genlayer-js/types")));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ser = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
const sha256hex = (buf) => createHash("sha256").update(buf).digest("hex");
const log = [];
function note(step, ok, detail) {
  log.push({ step, ok, detail });
  console.log(`${ok === null ? "INFO" : ok ? "OK  " : "FAIL"} ${step}  ${detail ?? ""}`);
  writeFileSync(join(here, "live_result.json"), JSON.stringify(log, null, 2));
}

async function paced(label, fn) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const text = String(e?.message ?? e) + " " + ser(e?.cause ?? "");
      const m = text.match(/retry_after_seconds\D+(\d+)/);
      if (text.includes("-32029") || m) {
        const wait = (m ? Number(m[1]) : 20) + 2;
        console.log(`  [${label}] rate limited, waiting ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      if (/fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|socket hang up|<html|502|503|504/i.test(text)) {
        const wait = 8 + attempt * 6;
        console.log(`  [${label}] transient network error, retrying in ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`${label}: gave up after repeated rate limits`);
}

const payer = createAccount(generatePrivateKey());
const builder = createAccount(generatePrivateKey());
const payerClient = createClient({ chain: studionet, account: payer });
const builderClient = createClient({ chain: studionet, account: builder });
const reader = payerClient;

function brief(receipt) {
  const r = receipt ?? {};
  return ser({
    status: r.status, statusName: r.statusName, result: r.result, resultName: r.resultName,
    txExecutionResultName: r.txExecutionResultName, consensus: r.consensus_data?.final ?? undefined,
  }).slice(0, 300);
}

async function write(client, address, functionName, args, value = 0n, status = TransactionStatus.ACCEPTED) {
  const hash = await paced(functionName, () => client.writeContract({ address, functionName, args, value }));
  const receipt = await paced(functionName + " wait", () =>
    client.waitForTransactionReceipt({ hash, status, retries: 90, interval: 12000 }),
  );
  return { hash, receipt };
}
const read = (address, functionName, args = []) => paced(functionName, () => reader.readContract({ address, functionName, args }));

// Decode what the leader actually did for a transaction (revert text, execution result).
async function leaderInfo(hash) {
  try {
    const tx = await paced("getTx", () => reader.request({ method: "eth_getTransactionByHash", params: [hash] }));
    const lr = tx?.consensus_data?.leader_receipt;
    const l = Array.isArray(lr) ? (lr.find((r) => r?.mode === "leader") ?? lr[0]) : lr;
    const out = { txStatus: tx?.status, resultName: tx?.result_name, execution: l?.execution_result, genvm: l?.genvm_result };
    const res = l?.result;
    const payload = typeof res === "string" ? res : res?.payload ?? res?.raw;
    if (typeof payload === "string") {
      try {
        const buf = Buffer.from(payload, "base64");
        out.decoded = buf.slice(buf[0] <= 8 ? 1 : 0).toString("utf8").slice(0, 300);
      } catch {}
    }
    out.raw = ser(l ?? tx).slice(0, 700);
    return ser(out);
  } catch (e) {
    return "leaderInfo failed: " + String(e?.message ?? e).slice(0, 200);
  }
}
const snapshot = async (address) => JSON.parse(String(await read(address, "get_snapshot")));
async function balanceOf(addr) {
  const hex = await paced("eth_getBalance", () => reader.request({ method: "eth_getBalance", params: [addr, "latest"] }));
  return BigInt(hex);
}

const code = readFileSync(join(root, "contracts", "stagehold.py"), "utf8");
const asset = (n) => readFileSync(join(here, "assets", n));
const anchorB64 = asset("anchor.png").toString("base64");

// ---------------------------------------------------------------- A. deploy
note("payer", null, payer.address);
note("builder", null, builder.address);
const FEE = 10n;
const dhash = await paced("deploy", () =>
  payerClient.deployContract({ code, args: [builder.address, FEE, 2592000n, "", "", 0n, true, 86400n, true] }),
);
const drec = await paced("deploy wait", () =>
  payerClient.waitForTransactionReceipt({ hash: dhash, status: TransactionStatus.ACCEPTED, retries: 90, interval: 8000 }),
);
const address = drec?.data?.contract_address ?? drec?.txDataDecoded?.contractAddress;
if (!address) {
  console.log(ser(drec).slice(0, 2500));
  note("deploy", false, "no contract address in receipt: " + brief(drec));
  process.exit(1);
}
note("deploy", true, address);
let snap = await snapshot(address);
note("snapshot after deploy", snap.status === "CREATED", ser({ status: snap.status, dev_mode: snap.dev_mode, expires_at: snap.expires_at }));

// ---------------------------------------------------------------- B. fund
try {
  await write(payerClient, address, "deposit", [], 1000n);
  snap = await snapshot(address);
  note("payer deposit 1000", snap.payer_deposit === "1000", `payer_deposit=${snap.payer_deposit} contractBalance=${await balanceOf(address)}`);
  const f = await write(payerClient, address, "fund", [["roof"], ["1000"], anchorB64]);
  snap = await snapshot(address);
  const bal = await balanceOf(address);
  note("fund 1000", snap.status === "ACTIVE" && bal === 1000n, `status=${snap.status} contractBalance=${bal} roof=${ser(snap.stages.roof)} receipt=${brief(f.receipt)}`);
  if (snap.status !== "ACTIVE") note("  leader receipt (fund)", null, f.hash + " " + (await leaderInfo(f.hash)));
  await write(builderClient, address, "deposit_credits", [], 30n);
  snap = await snapshot(address);
  note("builder credits 30", snap.builder_credits === "30", `builder_credits=${snap.builder_credits} contractBalance=${await balanceOf(address)}`);
} catch (e) {
  note("fund 1000", false, String(e?.message ?? e).slice(0, 400));
  process.exit(1);
}

// ---------------------------------------------------------------- C. register a test key (dev mode)
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = publicKey.export({ format: "jwk" });
const hex32 = (b64u) => Buffer.from(b64u, "base64url").toString("hex").padStart(64, "0");
const px = hex32(jwk.x), py = hex32(jwk.y);
const keyId = sha256hex(Buffer.concat([Buffer.from(px, "hex"), Buffer.from(py, "hex")]));
try {
  await write(builderClient, address, "register_software_key", [px, py]);
  snap = await snapshot(address);
  note("register test key", snap.keys === 1, `keys=${snap.keys} keyId=${keyId.slice(0, 16)}...`);
} catch (e) {
  note("register test key", false, String(e?.message ?? e).slice(0, 400));
  process.exit(1);
}

// ---------------------------------------------------------------- D. issue a code
try {
  await write(payerClient, address, "issue_code", ["roof", "K7Q2"]);
  snap = await snapshot(address);
  note("issue code", snap.stages.roof.code === "K7Q2", ser(snap.stages.roof));
} catch (e) {
  note("issue code", false, String(e?.message ?? e).slice(0, 400));
  process.exit(1);
}
const deadline = snap.stages.roof.code_deadline;

function shotArgs(jpegName, thumbName) {
  const jpeg = asset(jpegName), thumb = asset(thumbName);
  const msg = `stagehold.v1|${address.toLowerCase()}|roof|K7Q2|${deadline}|${sha256hex(jpeg)}|${sha256hex(thumb)}`;
  const sig = sign("sha256", Buffer.from(msg, "ascii"), { key: privateKey, dsaEncoding: "der" });
  return ["roof", keyId, jpeg.toString("base64"), thumb.toString("base64"), sig.toString("hex")];
}

// ---------------------------------------------------------------- E0. errored submit (bad signature): nothing may be stranded or charged
try {
  const args = shotArgs("bad.jpg", "bad_thumb.png");
  args[4] = args[4].slice(0, -4) + "0000"; // corrupt the signature
  const e0 = await write(builderClient, address, "submit", args);
  snap = await snapshot(address);
  const balE = await balanceOf(address);
  note("errored submit leaves no trace", snap.builder_credits === "30" && snap.stages.roof.attempts === 0 && balE === 1030n,
    `credits=${snap.builder_credits} attempts=${snap.stages.roof.attempts} contractBalance=${balE} leader=${(await leaderInfo(e0.hash)).slice(0, 220)}`);
} catch (e) {
  note("errored submit leaves no trace", false, String(e?.message ?? e).slice(0, 400));
}

// ---------------------------------------------------------------- E. wrong-code shot (must not pay)
try {
  const t0 = Date.now();
  const s1 = await write(builderClient, address, "submit", shotArgs("bad.jpg", "bad_thumb.png"));
  snap = await snapshot(address);
  const attempt1 = String(await read(address, "get_attempt", ["roof", 1n]));
  note("submit wrong-code shot", snap.stages.roof.status === "OPEN" && attempt1.includes('"paid": false'),
    `took ${Math.round((Date.now() - t0) / 1000)}s stage=${snap.stages.roof.status} attempts=${snap.stages.roof.attempts} attempt1=${attempt1} receipt=${brief(s1.receipt)}`);
  if (snap.stages.roof.attempts === 0) note("  leader receipt (wrong-code submit)", null, s1.hash + " " + (await leaderInfo(s1.hash)));
} catch (e) {
  note("submit wrong-code shot", false, String(e?.message ?? e).slice(0, 500));
}

// ---------------------------------------------------------------- F. good shot (must pay after finality)
try {
  const t0 = Date.now();
  const s2 = await write(builderClient, address, "submit", shotArgs("good.jpg", "good_thumb.png"));
  snap = await snapshot(address);
  const attempt2 = String(await read(address, "get_attempt", ["roof", 2n]));
  note("submit good shot", snap.stages.roof.status === "SETTLING",
    `took ${Math.round((Date.now() - t0) / 1000)}s stage=${snap.stages.roof.status} settling=${snap.settling} attempt2=${attempt2} receipt=${brief(s2.receipt)}`);
  if (snap.stages.roof.status !== "SETTLING") note("  leader receipt (good submit)", null, s2.hash + " " + (await leaderInfo(s2.hash)));
} catch (e) {
  note("submit good shot", false, String(e?.message ?? e).slice(0, 500));
}

// ---------------------------------------------------------------- G. wait for the finalized payout
const waitStart = Date.now();
let final = null;
const pending = (await snapshot(address)).stages.roof.status === "SETTLING";
if (!pending) console.log("  stage is not SETTLING, so there is no payout to wait for");
while (pending && Date.now() - waitStart < 25 * 60 * 1000) {
  snap = await snapshot(address);
  if (snap.stages.roof.status === "PAID" && snap.settling === false) {
    final = snap;
    break;
  }
  console.log(`  waiting for finality... stage=${snap.stages.roof.status} settling=${snap.settling} (${Math.round((Date.now() - waitStart) / 1000)}s)`);
  await sleep(30000);
}
const builderBal = await balanceOf(builder.address);
snap = await snapshot(address);
// The payout transfer lands some seconds after the finalizing transaction: poll for the balance to settle.
let contractBal = await balanceOf(address);
for (let i = 0; i < 16 && contractBal !== BigInt(snap.builder_credits); i++) {
  await sleep(15000);
  contractBal = await balanceOf(address);
}
// NOTE: Studionet does not credit ordinary accounts (builderBal stays 0), so the payout is verified by the
// contract's own balance falling to exactly the remaining attempt credits.
note("payout after finality", !!final && contractBal === BigInt(snap.builder_credits),
  `waited ${Math.round((Date.now() - waitStart) / 1000)}s stage=${snap.stages.roof.status} job=${snap.status} settling=${snap.settling} builderBalance=${builderBal} contractBalance=${contractBal} credits=${snap.builder_credits}`);
console.log("\ndone. results in contracts/live/live_result.json");
