// Deploy probe_runtime5.py to Studionet with a THROWAWAY key (gasless; key is never stored)
// and run: attestation verify in a write tx, shot-signature check, and blob store at rising sizes.
//
//   node run_probe5.mjs [--only-small] [--from <dir containing package.json with genlayer-js>]
//
// Respects the ~30 requests/min Studionet RPC limit by pacing and retrying on -32029.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = resolve(dirname(fileURLToPath(import.meta.url)));
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}
const fromDir = arg("from", join(here, "..", "web"));
const onlySmall = process.argv.includes("--only-small");

const require = createRequire(join(fromDir, "package.json"));
const toUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/")}`).href;
const { createClient, createAccount, generatePrivateKey } = await import(toUrl(require.resolve("genlayer-js")));
const { studionet } = await import(toUrl(require.resolve("genlayer-js/chains")));
const { TransactionStatus } = await import(toUrl(require.resolve("genlayer-js/types")));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ser = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));

async function paced(label, fn) {
  for (let attempt = 0; attempt < 8; attempt++) {
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
      throw e;
    }
  }
  throw new Error(`${label}: gave up after repeated rate limits`);
}

const code = readFileSync(join(here, "probe_runtime5.py"), "utf8");
const account = createAccount(generatePrivateKey());
const client = createClient({ chain: studionet, account });

async function write(address, functionName, args) {
  const hash = await paced(functionName, () => client.writeContract({ address, functionName, args, value: 0n }));
  const receipt = await paced(functionName + " wait", () =>
    client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 60, interval: 6000 }),
  );
  return { hash, receipt };
}
async function read(address, functionName, args) {
  return paced(functionName, () => client.readContract({ address, functionName, args }));
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}  ${detail}`);
}

// --address <0x..> reuses an already deployed probe and --labels a,b,c runs only those blobs
// (expected byte count is read from the file itself).
const reuse = arg("address", "");
const labelArg = arg("labels", "");
let address = reuse;
if (!reuse) {
  console.log("Deploying probe 5 (", code.length, "bytes of source ) ...");
  const dhash = await paced("deploy", () => client.deployContract({ code, args: [] }));
  const drec = await paced("deploy wait", () =>
    client.waitForTransactionReceipt({ hash: dhash, status: TransactionStatus.ACCEPTED, retries: 60, interval: 6000 }),
  );
  address = drec?.data?.contract_address ?? drec?.txDataDecoded?.contractAddress;
  if (!address) {
    console.log(ser(drec).slice(0, 3000));
    throw new Error("no contract address in deployment receipt");
  }
  console.log("deployed at", address);

  await write(address, "verify_in_write", []);
  const v = await read(address, "get_result", ["verify_in_write"]);
  record("attestation verify inside a WRITE tx", String(v).includes('"ok": true'), String(v));

  await write(address, "check_shot_in_write", []);
  const s = await read(address, "get_result", ["check_shot_in_write"]);
  record("per-shot signature check inside a WRITE tx", String(s).includes('"valid_accepted": true') && String(s).includes('"wrong_digest_rejected": true'), String(s));
} else {
  console.log("reusing probe at", address);
}

const blobs = labelArg
  ? labelArg.split(",").map((l) => [l, Buffer.from(readFileSync(join(here, "blobs", `${l}.b64.txt`), "utf8").trim(), "base64").length])
  : [
      ["thumb_small", 7196],
      ["thumb_med", 28385],
      ["noise_100k", 102400],
      ["noise_400k", 409600],
    ];
for (const [label, expectBytes] of blobs) {
  if (onlySmall && label !== "thumb_small") break;
  const file = join(here, "blobs", `${label}.b64.txt`);
  if (!existsSync(file)) {
    record(`blob ${label}`, false, "missing blob file; run build_probe5.py first");
    break;
  }
  const b64 = readFileSync(file, "utf8").trim();
  const expectSha = createHash("sha256").update(Buffer.from(b64, "base64")).digest("hex");
  try {
    await write(address, "store_blob", [label, b64]);
    const r = await read(address, "get_result", [`blob:${label}`]);
    const parsed = JSON.parse(String(r));
    const ok = parsed.bytes === expectBytes && parsed.sha256 === expectSha;
    record(`blob ${label} (${b64.length} base64 chars)`, ok, `bytes=${parsed.bytes} sha256_match=${parsed.sha256 === expectSha}`);
    if (!ok) break;
  } catch (e) {
    record(`blob ${label} (${b64.length} base64 chars)`, false, String(e?.message ?? e).slice(0, 300));
    break;
  }
}

writeFileSync(join(here, "probe5_results.json"), JSON.stringify({ address, results }, null, 2));
console.log("\nresults written to spikes/probe5_results.json");
