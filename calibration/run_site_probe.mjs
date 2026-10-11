// Asks the Studionet validator panel the same-site question about each pair of genuine photographs.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "web", "package.json"));
const toUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/")}`).href;
const { createClient, createAccount, generatePrivateKey } = await import(toUrl(require.resolve("genlayer-js")));
const { studionet } = await import(toUrl(require.resolve("genlayer-js/chains")));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.argv[2] ?? join(root, "calibration", "results", "panel_results.json");
const ONLY = process.argv.slice(3);

async function paced(fn) {
  for (let a = 0; a < 12; a++) {
    try { return await fn(); } catch (e) {
      const t = String(e?.message ?? e) + " " + JSON.stringify(e?.cause ?? "", (_, x) => typeof x === "bigint" ? x.toString() : x);
      const m = t.match(/retry_after_seconds\D+(\d+)/);
      if (t.includes("-32029") || m) { await sleep(((m ? Number(m[1]) : 20) + 2) * 1000); continue; }
      if (/fetch failed|unknown RPC error|ECONNRESET|ETIMEDOUT|UND_ERR|<html|502|503|504/i.test(t)) { await sleep((8 + a * 6) * 1000); continue; }
      throw e;
    }
  }
  throw new Error("gave up");
}
const account = createAccount(generatePrivateKey());
const client = createClient({ chain: studionet, account });
const code = readFileSync(join(root, "calibration", "site_probe.py"), "utf8");
const dh = await paced(() => client.deployContract({ code, args: [] }));
const rc = await paced(() => client.waitForTransactionReceipt({ hash: dh, status: "ACCEPTED", retries: 60, interval: 6000 }));
const address = rc?.data?.contract_address ?? rc?.txDataDecoded?.contractAddress;
console.log("probe contract", address);
const pairs = JSON.parse(readFileSync(join(root, "calibration", "pairs", "pairs.json"), "utf8")).filter((p) => ONLY.length === 0 || ONLY.includes(p.id));
const results = [];
for (const p of pairs) {
  const a = readFileSync(join(root, "calibration", "pairs", `${p.id}_anchor.jpg`)).toString("base64");
  const f = readFileSync(join(root, "calibration", "pairs", `${p.id}_frame.jpg`)).toString("base64");
  const t0 = Date.now();
  let verdict = "?", status = "?", votes = null, hash = null;
  try {
    hash = await paced(() => client.writeContract({ address, functionName: "compare", args: [a, f] }));
    for (let i = 0; i < 80; i++) {
      await sleep(7000);
      const tx = await paced(() => client.request({ method: "eth_getTransactionByHash", params: [hash] }));
      status = tx?.status;
      if (["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"].includes(status)) {
        const lr = tx.consensus_data?.leader_receipt;
        const l = Array.isArray(lr) ? (lr.find((r) => r?.mode === "leader") ?? lr[0]) : lr;
        const pl = typeof l?.result === "string" ? l.result : l?.result?.payload;
        verdict = pl ? Buffer.from(pl, "base64").toString("utf8").replace(/[\u0000-\u001f]/g, "").replace(/^[^a-z]*/, "").slice(0, 40) : "?";
        votes = tx.consensus_data?.votes ? Object.values(tx.consensus_data.votes).reduce((m, v) => ((m[v] = (m[v] ?? 0) + 1), m), {}) : null;
        break;
      }
    }
  } catch (e) { verdict = "error: " + String(e?.message ?? e).slice(0, 100); }
  const row = { id: p.id, label: p.label, note: p.note, verdict, status, votes, hash, seconds: Math.round((Date.now() - t0) / 1000) };
  results.push(row);
  console.log(`${p.id.padEnd(4)} ${p.label.padEnd(7)} ${verdict.padEnd(22)} ${status} ${JSON.stringify(votes)} ${row.seconds}s`);
  writeFileSync(OUT, JSON.stringify({ probe: address, results }, null, 1));
}
console.log("done");
