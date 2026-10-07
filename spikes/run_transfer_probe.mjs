// Deploy spikes/transfer_probe.py with throwaway keys, send GEN to a fresh recipient, watch the recipient's balance.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(dirname(fileURLToPath(import.meta.url)));
const fromDir = join(here, "..", "web");
const require = createRequire(join(fromDir, "package.json"));
const toUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/")}`).href;
const { createClient, createAccount, generatePrivateKey } = await import(toUrl(require.resolve("genlayer-js")));
const { studionet } = await import(toUrl(require.resolve("genlayer-js/chains")));
const { TransactionStatus } = await import(toUrl(require.resolve("genlayer-js/types")));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ser = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));

async function paced(label, fn) {
  for (let a = 0; a < 10; a++) {
    try { return await fn(); } catch (e) {
      const t = String(e?.message ?? e) + " " + ser(e?.cause ?? "");
      const m = t.match(/retry_after_seconds\D+(\d+)/);
      if (t.includes("-32029") || m) { await sleep(((m ? Number(m[1]) : 20) + 2) * 1000); continue; }
      if (/fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|<html|502|503|504/i.test(t)) { await sleep((8 + a * 6) * 1000); continue; }
      throw e;
    }
  }
  throw new Error(label + ": gave up");
}

const payer = createAccount(generatePrivateKey());
const recipient = createAccount(generatePrivateKey());
const client = createClient({ chain: studionet, account: payer });
const bal = async (addr) => BigInt(await paced("bal", () => client.request({ method: "eth_getBalance", params: [addr, "latest"] })));
const code = readFileSync(join(here, "transfer_probe.py"), "utf8");

const dh = await paced("deploy", () => client.deployContract({ code, args: [] }));
const dr = await paced("deploy wait", () => client.waitForTransactionReceipt({ hash: dh, status: TransactionStatus.ACCEPTED, retries: 60, interval: 8000 }));
const address = dr?.data?.contract_address ?? dr?.txDataDecoded?.contractAddress;
console.log("contract", address, "recipient", recipient.address);

async function write(fn, args, value = 0n) {
  const h = await paced(fn, () => client.writeContract({ address, functionName: fn, args, value }));
  await paced(fn + " wait", () => client.waitForTransactionReceipt({ hash: h, status: TransactionStatus.ACCEPTED, retries: 60, interval: 10000 }));
  return h;
}
await write("deposit", [], 500n);
console.log("after deposit: contract", await bal(address), "payer", await bal(payer.address), "recipient", await bal(recipient.address));
await write("send_str", [recipient.address, 300n]);
const t0 = Date.now();
while (Date.now() - t0 < 5 * 60 * 1000) {
  const c = await bal(address), r = await bal(recipient.address);
  console.log(`${Math.round((Date.now() - t0) / 1000)}s contract=${c} recipient=${r} held=${await paced("held", () => client.readContract({ address, functionName: "get_held", args: [] }))}`);
  if (r > 0n) break;
  await sleep(20000);
}
