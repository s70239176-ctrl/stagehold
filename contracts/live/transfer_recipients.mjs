// Does an outbound transfer (the mechanism behind every Stagehold payout and refund) reach its recipient on Studionet?
// A contract that holds a deposit pays 0.1 GEN each to: a contract that accepts transfers, a funded ordinary account,
// and an unfunded ordinary account. Balances and the triggered transaction's GenVM result are recorded.
//   node contracts/live/transfer_recipients.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = resolve(dirname(fileURLToPath(import.meta.url)));
const root = resolve(here, "..", "..");
const require = createRequire(join(root, "web", "package.json"));
const toUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/")}`).href;
const { createClient, createAccount, generatePrivateKey } = await import(toUrl(require.resolve("genlayer-js")));
const { studionet } = await import(toUrl(require.resolve("genlayer-js/chains")));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rpc = async (method, params) => (await (await fetch("https://studio.genlayer.com/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json());
const bal = async (a) => BigInt((await rpc("eth_getBalance", [a, "latest"])).result);
const gen = (w) => (Number(w) / 1e18).toString() + " GEN";
const out = [];
const note = (k, v) => { out.push({ k, v }); console.log(k.padEnd(52), v); writeFileSync(join(here, "transfer_recipients_result.json"), JSON.stringify(out, null, 1)); };

const payer = createAccount(generatePrivateKey());
const funded = createAccount(generatePrivateKey());
const unfunded = createAccount(generatePrivateKey());
await rpc("sim_fundAccount", [payer.address, 5000000000000000000]);
await rpc("sim_fundAccount", [funded.address, 1000000000000000000]);
const client = createClient({ chain: studionet, account: payer });
const deploy = async (file) => {
  const h = await client.deployContract({ code: readFileSync(join(here, "probe", file), "utf8"), args: [] });
  const r = await client.waitForTransactionReceipt({ hash: h, status: "ACCEPTED", retries: 60, interval: 6000 });
  return r?.data?.contract_address ?? r?.txDataDecoded?.contractAddress;
};
const sink = await deploy("sink.py");
const sender = await deploy("sender.py");
note("sink contract (accepts transfers)", sink);
note("sender contract (holds the deposit)", sender);
const V = 100000000000000000n;
let h = await client.writeContract({ address: sender, functionName: "deposit", args: [], value: 3n * V });
await client.waitForTransactionReceipt({ hash: h, status: "ACCEPTED", retries: 60, interval: 6000 });
await sleep(15000);
note("sender balance after a 0.3 GEN deposit", gen(await bal(sender)));

const targets = [["a contract that accepts transfers (sink)", sink], ["a funded ordinary account", funded.address], ["an unfunded ordinary account", unfunded.address]];
for (const [label, to] of targets) {
  const before = await bal(to);
  h = await client.writeContract({ address: sender, functionName: "pay", args: [to, V] });
  await client.waitForTransactionReceipt({ hash: h, status: "ACCEPTED", retries: 60, interval: 6000 });
  let after = before;
  for (let i = 0; i < 12; i++) { await sleep(15000); after = await bal(to); if (after !== before) break; }
  const tx = (await rpc("eth_getTransactionByHash", [h])).result;
  let trig = "no triggered transaction yet";
  for (let i = 0; i < 10 && !(tx.triggered_transactions ?? []).length; i++) { await sleep(10000); }
  const tx2 = (await rpc("eth_getTransactionByHash", [h])).result;
  for (const t of tx2.triggered_transactions ?? []) {
    const k = (await rpc("eth_getTransactionByHash", [t])).result;
    const l = k.consensus_data?.leader_receipt?.[0];
    trig = `${k.status} ${k.result_name} GenVM ${l?.execution_result}`;
  }
  note(`pay 0.1 GEN to ${label}`, `recipient ${gen(before)} -> ${gen(after)} (${after - before === V ? "CREDITED" : "not credited"}); sender now ${gen(await bal(sender))}; triggered message: ${trig}`);
}
note("sink received (contract state)", String(await client.readContract({ address: sink, functionName: "get_received", args: [] })));
console.log("done");
