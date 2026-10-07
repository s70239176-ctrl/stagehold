// Set up a DEV job on Studionet for the phone test, with throwaway keys saved to app/tools/.testkeys.json.
//
//   node app/tools/deploy_job.mjs [--anchor path/to/anchor.png] [--code "DUCK MOON"] [--stage roof] [--lock-app <package> <digest-hex>]
//
// Deploys contracts/stagehold.py in dev_mode (so key registration accepts a debug build), deposits and
// funds 1000 for the chosen stage with the anchor thumbnail, gives the builder 30 attempt credits and
// issues the code. Prints what to type into the app. Studionet is gasless and uses play money.
// The saved keys are throwaway dev keys for this network only; app/tools/.gitignore keeps them out of git.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(dirname(fileURLToPath(import.meta.url)));
const root = resolve(here, "..", "..");
const fromDir = process.env.GENLAYER_JS_FROM || join(root, "web");
const require = createRequire(join(fromDir, "package.json"));
const toUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/")}`).href;
const { createClient, createAccount, generatePrivateKey } = await import(toUrl(require.resolve("genlayer-js")));
const { studionet } = await import(toUrl(require.resolve("genlayer-js/chains")));
const { TransactionStatus } = await import(toUrl(require.resolve("genlayer-js/types")));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}
const anchorPath = arg("anchor", join(root, "contracts", "live", "assets", "anchor.png"));
const code = arg("code", "DUCK MOON");
const stage = arg("stage", "roof");
const lockIdx = process.argv.indexOf("--lock-app");
const appPackage = lockIdx > -1 ? process.argv[lockIdx + 1] : "";
const appDigest = lockIdx > -1 ? process.argv[lockIdx + 2] : "";
const devMode = lockIdx === -1;

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

const payerKey = generatePrivateKey(), builderKey = generatePrivateKey();
const payer = createAccount(payerKey), builder = createAccount(builderKey);
const pc = createClient({ chain: studionet, account: payer });
const bc = createClient({ chain: studionet, account: builder });

async function write(client, address, functionName, args = [], value = 0n) {
  const hash = await paced(() => client.writeContract({ address, functionName, args, value }));
  await paced(() => client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 90, interval: 12000 }));
}

const source = readFileSync(join(root, "contracts", "stagehold.py"), "utf8");
const anchorB64 = readFileSync(anchorPath).toString("base64");
console.log("deploying (dev_mode =", devMode, ") ...");
const dh = await paced(() => pc.deployContract({
  code: source,
  args: [builder.address, 10n, 604800n, appPackage, appDigest, 0n, devMode, 86400n, devMode],
}));
const dr = await paced(() => pc.waitForTransactionReceipt({ hash: dh, status: TransactionStatus.ACCEPTED, retries: 90, interval: 8000 }));
const contract = dr?.data?.contract_address ?? dr?.txDataDecoded?.contractAddress;
if (!contract) throw new Error("no contract address in the deployment receipt");
console.log("contract", contract);

await write(pc, contract, "deposit", [], 1000n);
await write(pc, contract, "fund", [[stage], ["1000"], anchorB64]);
await write(bc, contract, "deposit_credits", [], 30n);
await write(pc, contract, "issue_code", [stage, code]);
const snap = JSON.parse(String(await paced(() => pc.readContract({ address: contract, functionName: "get_snapshot", args: [] }))));

writeFileSync(join(here, ".testkeys.json"), JSON.stringify({ contract, payerKey, builderKey, builder: builder.address, payer: payer.address }, null, 2));
console.log("\n=== Type these into the app ===");
console.log("Job contract address :", contract);
console.log("Builder address      :", builder.address);
console.log("Stage                :", stage);
console.log("Code                 :", code);
console.log("Code deadline (unix) :", snap.stages[stage].code_deadline, "(valid for 6 hours)");
console.log("\nThen: app step 1 -> share device.json -> python app/tools/check_package.py device device.json --contract", contract, "--builder", builder.address);
console.log("      node app/tools/submit_package.mjs --throwaway register device.json");
console.log("      write the code on the work, app step 2 -> shot.json -> check_package.py shot shot.json --device device.json");
console.log("      node app/tools/submit_package.mjs --throwaway submit shot.json");
console.log("      node app/tools/submit_package.mjs --throwaway status", contract);
