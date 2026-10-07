// Copies the generated contract into public/ so the payer page can deploy it. Run: npm run sync-contract
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = resolve(here, "..", "..", "contracts", "stagehold.py");
const to = join(resolve(here, ".."), "public", "stagehold.py");
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log("copied", from, "->", to);
