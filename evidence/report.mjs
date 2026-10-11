// Turns evidence/results/evidence.json (and the live hardening results) into docs/EVIDENCE.md.
//   node report.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ev = JSON.parse(fs.readFileSync(path.join(here, "results", "evidence.json"), "utf8"));
const EXPLORER = "https://explorer-studio.genlayer.com";
const short = (h) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const mark = (s) => (s.ok === true ? "pass" : s.ok === false ? "FAIL" : "info");
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

let out = `# Stagehold: end-to-end evidence on Studionet

Recorded ${ev.started?.slice(0, 10)} by \`evidence/run.mjs\` against the deployed frontend **${ev.site}**, in a headless browser, with throwaway accounts. Every transaction below is real and can be opened on the [Studionet explorer](${EXPLORER}). The money checks compare the contract's own balance with the expected figure after each step, because this network does not credit ordinary accounts.

## What was and was not real

| | |
|---|---|
| Frontend | The deployed site, driven like a user: every button click and form field |
| Contract, validators, GenVM, consensus, payouts, refunds | Real, on Studionet. Validators judged the frames; the votes and GenVM results are in \`evidence/results/tx/\` |
| Photograph | A real construction-site photograph (Wikimedia Commons, CC BY-SA 4.0; credits in \`fixtures/web2/ATTRIBUTION.csv\`) |
| Codes on the wall | **Simulated lettering**: a handwriting-style font with jitter, blur and wear drawn onto the photograph. It is not a human hand writing on a real wall |
| Camera | A canvas stream of that picture installed as the browser's camera, because a headless browser has no camera |
| Money | Studionet GEN, which has no market value |

True handwritten codes on a photographed wall have not been tried. To run the same flows on your own photographs: \`USER_SCENES=/folder node evidence/run.mjs pass\` with JPEGs named after the codes (see \`evidence/README.md\`).

`;

for (const [name, sc] of Object.entries(ev.scenarios)) {
  out += `## ${name}: ${sc.title}\n\n`;
  if (sc.contract) out += `Job contract: [\`${sc.contract}\`](${EXPLORER}/address/${sc.contract})` + (sc.accounts?.payer ? `, payer \`${sc.accounts.payer}\`, builder \`${sc.accounts.builder}\`` : "") + "\n\n";
  out += "| Result | Check | Figures |\n|---|---|---|\n";
  for (const s of sc.steps) out += `| ${mark(s)} | ${cell(s.name)} | ${cell(s.detail)} |\n`;
  if (sc.txs?.length) {
    out += "\nTransactions made through the frontend:\n\n| Step | Transaction | Status | GenVM | Validators |\n|---|---|---|---|---|\n";
    for (const t of sc.txs) {
      const votes = t.votes ? (typeof t.votes === "object" ? Object.values(t.votes).join(", ") : String(t.votes)) : "";
      out += `| ${cell(t.label)} | [\`${short(t.hash)}\`](${EXPLORER}/transactions/${t.hash}) | ${cell(t.status)} ${cell(t.result_name ?? "")} | ${cell(t.execution_result ?? "")} | ${t.validator_count ?? ""}${votes ? " (" + cell(votes) + ")" : ""} |\n`;
    }
  }
  if (sc.final) out += `\nFinal state: job \`${sc.final.snapshot?.status}\`, contract balance ${sc.final.balance} wei, accounting ${JSON.stringify(sc.final.accounting)}.\n`;
  out += "\n";
}
const all = Object.values(ev.scenarios).flatMap((s) => s.steps);
out += `## Summary\n\n${all.filter((s) => s.ok === true).length} checks passed, ${all.filter((s) => s.ok === false).length} failed, ${all.filter((s) => s.ok === null).length} informational.\n`;
fs.writeFileSync(path.join(root, "docs", "EVIDENCE.md"), out);
console.log("wrote docs/EVIDENCE.md", out.length, "chars");
