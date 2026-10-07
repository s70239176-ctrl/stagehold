// Submit Stagehold app output to a deployed job, as the BUILDER.
//
//   set STAGEHOLD_PRIVATE_KEY=0x...        (the builder's key; stays in the environment, never in a file here)
//   node app/tools/submit_package.mjs register  device.json
//   node app/tools/submit_package.mjs credits   30            (attempt credits, in the network's smallest unit)
//   node app/tools/submit_package.mjs submit    shot.json
//   node app/tools/submit_package.mjs status    <contract>
//
// Always run app/tools/check_package.py first: it shows whether the contract would accept the file.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fromDir = process.env.GENLAYER_JS_FROM || join(dirname(fileURLToPath(import.meta.url)), "..", "..", "web");
const require = createRequire(join(fromDir, "package.json"));
const toUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/")}`).href;
const { createClient, createAccount } = await import(toUrl(require.resolve("genlayer-js")));
const { studionet } = await import(toUrl(require.resolve("genlayer-js/chains")));
const { TransactionStatus } = await import(toUrl(require.resolve("genlayer-js/types")));

const argv = process.argv.slice(2);
const throwaway = argv.includes("--throwaway");   // use the builder key saved by deploy_job.mjs (dev jobs only)
const [cmd, arg] = argv.filter((a) => a !== "--throwaway");
let key = process.env.STAGEHOLD_PRIVATE_KEY;
if (throwaway) {
  const saved = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), ".testkeys.json");
  key = JSON.parse(readFileSync(saved, "utf8")).builderKey;
}
if (!cmd || !arg) { console.error("usage: submit_package.mjs [--throwaway] register|credits|submit|status <file|amount|contract>"); process.exit(2); }
if (cmd !== "status" && !key) { console.error("set STAGEHOLD_PRIVATE_KEY to the builder's private key first, or use --throwaway after deploy_job.mjs"); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ser = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
async function paced(fn) {
  for (let a = 0; a < 10; a++) {
    try { return await fn(); } catch (e) {
      const t = String(e?.message ?? e) + " " + ser(e?.cause ?? "");
      const m = t.match(/retry_after_seconds\D+(\d+)/);
      if (t.includes("-32029") || m) { await sleep(((m ? Number(m[1]) : 20) + 2) * 1000); continue; }
      if (/fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|<html|502|503|504/i.test(t)) { await sleep((8 + a * 6) * 1000); continue; }
      throw e;
    }
  }
  throw new Error("gave up after repeated network errors");
}

const account = key ? createAccount(key) : undefined;
const client = createClient({ chain: studionet, account });

async function write(address, functionName, args, value = 0n) {
  const hash = await paced(() => client.writeContract({ address, functionName, args, value }));
  console.log("sent", functionName, hash);
  await paced(() => client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 120, interval: 12000 }));
  return hash;
}

if (cmd === "status") {
  console.log(String(await paced(() => client.readContract({ address: arg, functionName: "get_snapshot", args: [] }))));
} else if (cmd === "register") {
  const d = JSON.parse(readFileSync(arg, "utf8"));
  console.log("builder", account.address, "-> register_device on", d.contract);
  await write(d.contract, "register_device", [d.chain_b64]);
  console.log("done. read the result with: status", d.contract);
} else if (cmd === "credits") {
  const contract = process.argv[4];
  if (!contract) { console.error("usage: credits <amount> <contract>"); process.exit(2); }
  await write(contract, "deposit_credits", [], BigInt(arg));
} else if (cmd === "submit") {
  const s = JSON.parse(readFileSync(arg, "utf8"));
  console.log("builder", account.address, "-> submit", s.stage, "to", s.contract);
  await write(s.contract, "submit", [s.stage, s.key_id, s.jpeg_b64, s.thumb_b64, s.signature_hex]);
  console.log("accepted by the network. A pass pays after finality; read it with: status", s.contract);
}
