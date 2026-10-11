// Runs the Stagehold flows through a DEPLOYED frontend in headless Edge/Chrome and records evidence:
// every transaction hash, the validators' judgment and GenVM execution result, and the contract's state and
// balance before and after each financial step, checked against the expected figures.
//
//   cd evidence && npm install
//   SITE=https://stagehold-cr.vercel.app node run.mjs [pass] [recover] [cancel] [expire] [fallback]
//
// Camera: the headless browser has no camera, so a canvas stream of a real construction-site photograph with a
// hand-lettered code is installed as the camera (see make_scene.py). Everything else is the real frontend.
import puppeteer from "puppeteer-core";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SITE = (process.env.SITE ?? "https://stagehold-cr.vercel.app").replace(/\/$/, "");
const BROWSER = process.env.BROWSER ?? ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const RESULTS = path.join(here, "results");
fs.mkdirSync(path.join(RESULTS, "tx"), { recursive: true });
fs.mkdirSync(path.join(RESULTS, "scenes"), { recursive: true });
const PHOTO = process.env.PHOTO ?? path.join(root, "fixtures", "web2", "w2_11_roof_done_candidate.jpg");

const requireFromWeb = createRequire(path.join(root, "web", "package.json"));
const toUrl = (p) => pathToFileURL(p).href;
const gl = await import(toUrl(requireFromWeb.resolve("genlayer-js")));
const { studionet } = await import(toUrl(requireFromWeb.resolve("genlayer-js/chains")));
const RPC = studionet.rpcUrls.default.http[0];
const reader = gl.createClient({ chain: studionet });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ser = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
const GEN = 10n ** 18n;
const gen = (s) => BigInt(Math.round(Number(s) * 1e6)) * 10n ** 12n; // "0.5" -> wei
const fmt = (w) => `${(Number(w) / 1e18).toString()} GEN`;

async function paced(fn) {
  for (let a = 0; a < 12; a++) {
    try { return await fn(); } catch (e) {
      const t = String(e?.message ?? e) + " " + ser(e?.cause ?? "");
      const m = t.match(/retry_after_seconds\D+(\d+)/);
      if (t.includes("-32029") || m) { await sleep(((m ? Number(m[1]) : 20) + 2) * 1000); continue; }
      if (/fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|<html|502|503|504/i.test(t)) { await sleep((6 + a * 5) * 1000); continue; }
      throw e;
    }
  }
  throw new Error("gave up");
}
const rpc = (method, params) => paced(async () => {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(ser(j.error));
  return j.result;
});
const balanceOf = async (a) => BigInt(await rpc("eth_getBalance", [a, "latest"]));
const view = (address, fn, args = []) => paced(() => reader.readContract({ address, functionName: fn, args }));
const snap = async (a) => JSON.parse(String(await view(a, "get_snapshot")));
const accounting = async (a) => JSON.parse(String(await view(a, "get_accounting")));
async function waitFor(fn, ok, timeoutS, every = 10000) {
  const t0 = Date.now();
  let v = await fn();
  while (!ok(v) && Date.now() - t0 < timeoutS * 1000) { await sleep(every); v = await fn(); }
  return v;
}

// ------------------------------------------------------------------ evidence log
const run = { site: SITE, started: new Date().toISOString(), photo: path.basename(PHOTO), scenarios: {} };
let cur = null;
const save = () => fs.writeFileSync(path.join(RESULTS, "evidence.json"), ser(run));
function begin(name, title) {
  cur = { title, steps: [], txs: [], contract: null, accounts: {} };
  run.scenarios[name] = cur;
  console.log(`\n=== ${name}: ${title} ===`);
  save();
}
function step(name, ok, detail) {
  cur.steps.push({ name, ok, detail, at: new Date().toISOString() });
  console.log(`${ok === null ? "INFO" : ok ? "OK  " : "FAIL"} ${name}  ${detail ?? ""}`);
  save();
}
async function txSummary(label, hash) {
  const tx = await rpc("eth_getTransactionByHash", [hash]);
  const lr = tx?.consensus_data?.leader_receipt;
  const leader = Array.isArray(lr) ? (lr.find((r) => r?.mode === "leader") ?? lr[0]) : lr;
  const votes = tx?.consensus_data?.votes ?? null;
  const validators = tx?.consensus_data?.validators ?? null;
  const decode = () => {
    const p = typeof leader?.result === "string" ? leader.result : leader?.result?.payload;
    if (!p) return null;
    const b = Buffer.from(p, "base64");
    return b.slice(b[0] <= 8 ? 1 : 0).toString("utf8").slice(0, 300);
  };
  const s = {
    label, hash, status: tx?.status, result_name: tx?.result_name, execution_result: leader?.execution_result,
    genvm_stderr: leader?.genvm_result?.stderr ?? "", leader_output: decode(),
    validator_count: Array.isArray(validators) ? validators.length : (validators ? Object.keys(validators).length : null),
    votes, to: tx?.to_address ?? tx?.to,
  };
  const slim = JSON.parse(ser(tx ?? {}, null, 0), (k, v) => (typeof v === "string" && v.length > 600 ? v.slice(0, 120) + `…[${v.length} chars]` : v));
  fs.writeFileSync(path.join(RESULTS, "tx", `${hash}.json`), JSON.stringify(slim, null, 1));
  return s;
}

// ------------------------------------------------------------------ browser sessions
const CAMERA = `(() => {
  const c = document.createElement("canvas");
  c.width = 1280; c.height = 720;
  const ctx = c.getContext("2d");
  const noise = document.createElement("canvas");
  noise.width = noise.height = 256;
  const nctx = noise.getContext("2d");
  const id = nctx.createImageData(256, 256);
  for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  nctx.putImageData(id, 0, 0);
  let img = null;
  window.__setScene = (dataUrl) => new Promise((res) => {
    const i = new Image();
    i.onload = () => { const k = 1280 / Math.max(i.width, i.height); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); img = i; res(true); };
    i.src = dataUrl;
  });
  setInterval(() => {
    if (!img) { ctx.fillStyle = "#222"; ctx.fillRect(0, 0, c.width, c.height); return; }
    ctx.globalAlpha = 1; ctx.drawImage(img, 0, 0, c.width, c.height);
    ctx.globalAlpha = 0.05; // faint sensor noise, so the frame is never perfectly still
    ctx.drawImage(noise, Math.random() * 200, Math.random() * 200, 48, 48, 0, 0, c.width, c.height);
    ctx.globalAlpha = 1;
  }, 50);
  const stream = c.captureStream(20);
  navigator.mediaDevices.getUserMedia = async () => stream;
})();`;

let browser;
async function launch() {
  browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, defaultViewport: { width: 1280, height: 900 }, args: ["--no-sandbox"] });
}
async function session(label) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(CAMERA);
  page.hashes = [];
  page.on("pageerror", (e) => console.log(`  [${label}] pageerror`, String(e.message).slice(0, 160)));
  page.on("response", async (r) => {
    try {
      if (!r.url().startsWith(RPC) || r.request().method() !== "POST") return;
      const body = JSON.parse(r.request().postData() ?? "{}");
      if (body.method === "eth_sendRawTransaction" || body.method === "eth_sendTransaction") {
        const j = await r.json();
        if (typeof j.result === "string") page.hashes.push({ t: Date.now(), hash: j.result });
      }
    } catch { /* ignore */ }
  });
  page.label = label;
  return page;
}
const clickText = async (page, text, exact = false, timeout = 180000) => {
  await page.waitForFunction((t, ex) => [...document.querySelectorAll("button")].some((b) => !b.disabled && (ex ? b.textContent.trim() === t : b.textContent.includes(t))), { timeout, polling: 500 }, text, exact);
  await page.evaluate((t, ex) => { [...document.querySelectorAll("button")].find((b) => !b.disabled && (ex ? b.textContent.trim() === t : b.textContent.includes(t))).click(); }, text, exact);
};
const hasText = (page, re) => page.evaluate((s) => new RegExp(s, "i").test(document.body.innerText), re);
const waitText = (page, re, timeout = 300000) => page.waitForFunction((s) => new RegExp(s, "i").test(document.body.innerText), { timeout, polling: 1000 }, re);
async function setInput(page, labelIncludes, value) {
  const h = await page.evaluateHandle((l) => [...document.querySelectorAll(".field")].find((f) => f.textContent.includes(l))?.querySelector("input"), labelIncludes);
  const el = h.asElement();
  if (!el) throw new Error("no field: " + labelIncludes);
  await el.click({ clickCount: 3 });
  await el.type(String(value), { delay: 5 });
}
async function txsOf(page, label, since) {
  const out = [];
  for (const h of page.hashes.filter((x) => x.t >= since)) out.push(await txSummary(label, h.hash));
  return out;
}
async function scene(page, code, file) {
  // Your own photographs: put JPEGs named after the code (TREE_BLUE.jpg, MOON_FISH.jpg) in USER_SCENES and they are
  // used instead of the generated lettering. The fallback code is only known at run time, so it is always generated.
  const own = process.env.USER_SCENES && code ? path.join(process.env.USER_SCENES, code.replace(/ /g, "_") + ".jpg") : null;
  if (own && fs.existsSync(own)) {
    fs.copyFileSync(own, path.join(RESULTS, "scenes", path.basename(own)));
    await page.evaluate((d) => window.__setScene(d), "data:image/jpeg;base64," + fs.readFileSync(own).toString("base64"));
    run.user_scenes = true;
    return;
  }
  const args = [path.join(here, "make_scene.py"), code ?? "", file, "--photo", PHOTO];
  if (code === null) args.push("--none");
  const r = spawnSync("python", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error("scene failed: " + r.stderr);
  fs.copyFileSync(file, path.join(RESULTS, "scenes", path.basename(file)));
  const b64 = fs.readFileSync(file).toString("base64");
  await page.evaluate((d) => window.__setScene(d), "data:image/jpeg;base64," + b64);
}

// ------------------------------------------------------------------ the flows (all through the frontend)
async function builderAddress(builder) {
  await builder.goto(`${SITE}/builder`, { waitUntil: "networkidle0" });
  const key = await builder.evaluate(() => localStorage.getItem("stagehold.account.builder.v1"));
  return { key, address: gl.createAccount(key).address };
}
async function createJob(payer, baddr, test) {
  await payer.goto(`${SITE}/payer`, { waitUntil: "networkidle0" });
  await payer.waitForSelector('input[placeholder="0x…"]');
  await payer.type('input[placeholder="0x…"]', baddr, { delay: 3 });
  if (test) {
    await payer.evaluate(() => document.querySelector("details summary").click());
    await payer.evaluate(() => document.querySelector('details input[type="checkbox"]').click());
    await setInput(payer, "Expires after", test.expireS);
    await setInput(payer, "Fallback code unlocks after", test.windowS);
  }
  const t = Date.now();
  await clickText(payer, "Create job");
  await payer.waitForFunction(() => localStorage.getItem("stagehold.payer.job"), { timeout: 420000, polling: 1000 });
  const job = await payer.evaluate(() => localStorage.getItem("stagehold.payer.job"));
  return { job, since: t };
}
async function fundRoof(payer, amount = "0.5") {
  await payer.waitForSelector('input[type="file"]');
  await (await payer.$('input[type="file"]')).uploadFile(PHOTO);
  const t = Date.now();
  if (amount !== "0.5") {
    const h = await payer.evaluateHandle(() => [...document.querySelectorAll(".stage-pick")].find((r) => r.textContent.includes("Roof")).querySelector(".input-unit input"));
    await h.asElement().click({ clickCount: 3 });
    await h.asElement().type(amount);
  }
  await sleep(1500);
  await clickText(payer, "Deposit and fund");
  await payer.waitForSelector("select", { timeout: 420000 });
  return t;
}
async function issueCode(payer, code) {
  await payer.type('input[placeholder="TREE BLUE"]', code, { delay: 20 });
  const t = Date.now();
  await clickText(payer, "Issue code");
  return t;
}
async function openBuilder(builder, job) {
  await builder.goto(`${SITE}/builder?job=${job}`, { waitUntil: "networkidle0" });
}
async function registerAndCredit(builder, credits = "0.1") {
  const t = Date.now();
  await clickText(builder, "Register this browser");
  await builder.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Registered"), { timeout: 420000, polling: 1000 });
  if (credits !== "0.1") await setInput(builder, "Attempt credits", credits);
  await clickText(builder, "Add", true);
  await waitText(builder, `${credits.replace(".", "\\.")}\\d* GEN`, 300000).catch(() => {});
  return t;
}
async function shoot(builder) {
  await builder.evaluate(() => document.querySelector(".viewfinder")?.scrollIntoView({ block: "center" }));
  await sleep(500);
  const have = await builder.evaluate(() => !!document.querySelector(".viewfinder img"));
  if (have) await clickText(builder, "Retake");
  await clickText(builder, "Start camera", false, 60000).catch(() => {});
  await builder.waitForFunction(() => { const v = document.querySelector("video"); return v && v.readyState >= 2 && v.videoWidth > 0; }, { timeout: 30000 });
  await sleep(1500);
  await builder.click('button[aria-label="Take picture"]');
  await builder.waitForSelector(".viewfinder img", { timeout: 40000 });
  await sleep(800);
}
async function submitShot(builder, stageStatusCheck) {
  const t = Date.now();
  await clickText(builder, "Submit to the panel");
  return t;
}
const attempts = (address, n) => view(address, "get_attempt", ["roof", BigInt(n)]).then((x) => (String(x) ? JSON.parse(String(x)) : null));

// ---- pass: wrong code is refused (fee burned), right code passes, builder is paid at finality
async function scenarioPass(name = "pass", test = null, doRecover = false) {
  begin(name, test ? "Real-photo flow on a test job: wrong code, right code, payout, and a payout recovery click" : "Real-photo flow: wrong code is refused (fee burned), right code passes, builder paid at finality");
  const payer = await session("payer"), builder = await session("builder");
  const b = await builderAddress(builder);
  const FEE = gen("0.01"), FUND = gen("0.5"), CREDITS = gen("0.1");
  const { job, since: s0 } = await createJob(payer, b.address, test);
  cur.contract = job; cur.accounts = { builder: b.address };
  const sn0 = await waitFor(() => snap(job), (s) => !!s.payer, 120);
  cur.accounts.payer = sn0.payer;
  step("job deployed through the frontend", sn0.status === "CREATED" && sn0.builder.toLowerCase() === b.address.toLowerCase(), `contract=${job} dev_mode=${sn0.dev_mode} capture_attested=${sn0.capture_attested}`);
  cur.txs.push(...await txsOf(payer, "deploy", s0));

  const t1 = await fundRoof(payer);
  const bal1 = await waitFor(() => balanceOf(job), (v) => v === FUND, 120);
  const sn1 = await snap(job);
  step("payer funds 0.5 GEN: escrow holds it", bal1 === FUND && sn1.status === "ACTIVE" && sn1.stages.roof.funded === String(FUND), `contract balance ${fmt(bal1)} stage funded ${fmt(BigInt(sn1.stages.roof.funded))}`);
  cur.txs.push(...await txsOf(payer, "deposit+fund", t1));

  const t2 = await issueCode(payer, "TREE BLUE");
  await waitText(payer, "TREE BLUE", 240);
  const sn2 = await waitFor(() => snap(job), (s) => s.stages.roof.code === "TREE BLUE", 120);
  step("payer issues the code", sn2.stages.roof.code === "TREE BLUE", `code=${sn2.stages.roof.code}`);
  cur.txs.push(...await txsOf(payer, "issue_code", t2));

  await openBuilder(builder, job);
  const t3 = await registerAndCredit(builder);
  const bal3 = await waitFor(() => balanceOf(job), (v) => v === FUND + CREDITS, 120);
  const sn3 = await snap(job);
  step("builder registers a key and buys 0.1 GEN of attempt credits", bal3 === FUND + CREDITS && sn3.keys === 1 && sn3.builder_credits === String(CREDITS), `balance ${fmt(bal3)} keys=${sn3.keys} credits=${fmt(BigInt(sn3.builder_credits))}`);
  cur.txs.push(...await txsOf(builder, "register+credits", t3));

  // wrong code on the wall
  await scene(builder, "MOON FISH", path.join(here, "results", "scenes", `${name}-wrong.jpg`));
  await shoot(builder);
  const t4 = await submitShot(builder);
  const sn4 = await waitFor(() => snap(job), (s) => s.stages.roof.attempts === 1, 420);
  const a1 = await attempts(job, 1);
  const bal4 = await waitFor(() => balanceOf(job), (v) => v === FUND + CREDITS - FEE, 200);
  step("wrong code on the wall: the panel refuses, nothing is paid, the fee is burned", !!a1 && a1.paid === false && sn4.stages.roof.status === "OPEN" && sn4.builder_credits === String(CREDITS - FEE) && bal4 === FUND + CREDITS - FEE,
    `verdict=${ser(a1)} stage=${sn4.stages.roof.status} credits=${fmt(BigInt(sn4.builder_credits))} contract balance ${fmt(bal4)}`);
  cur.txs.push(...await txsOf(builder, "submit (wrong code)", t4));

  // right code on the wall
  await scene(builder, "TREE BLUE", path.join(here, "results", "scenes", `${name}-right.jpg`));
  await shoot(builder);
  const t5 = await submitShot(builder);
  const sn5 = await waitFor(() => snap(job), (s) => s.stages.roof.attempts === 2, 420);
  const a2 = await attempts(job, 2);
  step("right code on the wall: the panel passes the stage; payout waits for finality", !!a2 && a2.paid === true && a2.stage_met === "yes" && a2.code_visible === "yes" && ["SETTLING", "PAID"].includes(sn5.stages.roof.status), `verdict=${ser(a2)} stage=${sn5.stages.roof.status}`);
  cur.txs.push(...await txsOf(builder, "submit (right code)", t5));

  if (doRecover) {
    // the stage is SETTLING: after the contract's retry delay the frontend offers a recovery button
    const showed = await builder.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => x.textContent.includes("Payment is late")), { timeout: 90000, polling: 1000 }).then(() => true).catch(() => false);
    const t6 = Date.now();
    if (showed) {
      await clickText(builder, "Payment is late");
      step("frontend offers 'Payment is late: recover it' while the stage is SETTLING, and it was clicked", true, "retry of the finalized payout sent through the frontend");
    } else {
      step("recovery button did not appear (the payout may already have landed)", null, "stage left SETTLING before the retry delay or the page did not refresh");
    }
    cur.txs.push(...await txsOf(builder, "recover_settlement (frontend button)", t6));
  }

  const fin = await waitFor(() => snap(job), (s) => s.stages.roof.status === "PAID" && !s.settling, 600, 15000);
  const bal6 = await waitFor(() => balanceOf(job), (v) => v === CREDITS - 2n * FEE, 300, 15000);
  await sleep(45000); // let any duplicate payout message land: the builder must be paid exactly once
  const bal7 = await balanceOf(job);
  const acc = await accounting(job);
  step("finality: the contract pays the builder the stage amount, exactly once", fin.stages.roof.status === "PAID" && fin.status === "DONE" && bal6 === CREDITS - 2n * FEE && bal7 === bal6,
    `job=${fin.status} stage=${fin.stages.roof.status} contract balance ${fmt(bal6)} then ${fmt(bal7)} (0.1 credits - 2 fees = ${fmt(CREDITS - 2n * FEE)})`);
  step("books balance: balance = liabilities, no surplus", acc.surplus === "0" && acc.balance === acc.liabilities, ser(acc));
  const shown = await builder.evaluate(() => document.body.innerText);
  step("the frontend shows the result and the completed job", /Every funded stage is paid/i.test(shown) && /YES/.test(shown), "builder page text contains the verdict and completion notice");
  cur.final = { snapshot: fin, accounting: acc, balance: String(bal7) };
  await builder.screenshot({ path: path.join(RESULTS, `${name}-builder-final.png`) });
  await payer.reload({ waitUntil: "networkidle0" }); await sleep(5000);
  await payer.screenshot({ path: path.join(RESULTS, `${name}-payer-final.png`) });
  return { job, builder, payer, b };
}

// ---- cancel + stray funds + reclaim (test job: short delays)
async function scenarioCancel() {
  begin("cancel", "Cancellation needs both parties and refunds the payer; stray funds from a failed transaction are reclaimable");
  const payer = await session("payer"), builder = await session("builder");
  const b = await builderAddress(builder);
  const FUND = gen("0.5"), CREDITS = gen("0.05");
  const { job, since: s0 } = await createJob(payer, b.address, { expireS: 3600, windowS: 40 });
  cur.contract = job; cur.accounts = { builder: b.address, payer: (await snap(job)).payer };
  cur.txs.push(...await txsOf(payer, "deploy", s0));
  const t1 = await fundRoof(payer);
  await waitFor(() => balanceOf(job), (v) => v === FUND, 120);
  cur.txs.push(...await txsOf(payer, "deposit+fund", t1));
  await openBuilder(builder, job);
  const t2 = await registerAndCredit(builder, "0.05");
  const bal2 = await waitFor(() => balanceOf(job), (v) => v === FUND + CREDITS, 120);
  step("setup: 0.5 GEN in escrow, 0.05 GEN of credits", bal2 === FUND + CREDITS, `contract balance ${fmt(bal2)}`);
  cur.txs.push(...await txsOf(builder, "register+credits", t2));

  // stray value: the builder (by script, with the key the frontend created) sends 0.007 GEN to a payer-only payable method
  const STRAY = gen("0.007");
  const bkey = await builder.evaluate(() => localStorage.getItem("stagehold.account.builder.v1"));
  const bclient = gl.createClient({ chain: studionet, account: gl.createAccount(bkey) });
  const sh = await paced(() => bclient.writeContract({ address: job, functionName: "deposit", args: [], value: STRAY }));
  await paced(() => bclient.waitForTransactionReceipt({ hash: sh, status: "ACCEPTED", retries: 60, interval: 8000 }));
  cur.txs.push(await txSummary("stray value: builder sends 0.007 GEN to payer-only deposit()", sh));
  const bal3 = await waitFor(() => balanceOf(job), (v) => v === FUND + CREDITS + STRAY, 150);
  const acc3 = await accounting(job);
  step("a failed payable transaction keeps its value, and the contract accounts for it as surplus", bal3 === FUND + CREDITS + STRAY && acc3.surplus === String(STRAY), `contract balance ${fmt(bal3)} surplus ${fmt(BigInt(acc3.surplus))}`);

  // both parties cancel through the frontend
  await payer.goto(`${SITE}/payer`, { waitUntil: "networkidle0" });
  const t4 = Date.now();
  await waitText(payer, "Cancel the job", 120);
  await clickText(payer, "Cancel the job");
  await sleep(1000);
  const sn4 = await waitFor(() => snap(job), () => true, 1);
  await waitText(payer, "Cancellation recorded|ACTIVE", 200).catch(() => {});
  await sleep(25000);
  const mid = await snap(job);
  const midBal = await balanceOf(job);
  step("payer cancelling alone refunds nothing", mid.status === "ACTIVE" && midBal === FUND + CREDITS + STRAY, `status=${mid.status} contract balance ${fmt(midBal)}`);
  cur.txs.push(...await txsOf(payer, "payer cancel", t4));
  await openBuilder(builder, job);
  const t5 = Date.now();
  await clickText(builder, "Cancel the job");
  const done = await waitFor(() => snap(job), (s) => s.status === "CANCELLED", 240);
  const bal5 = await waitFor(() => balanceOf(job), (v) => v === CREDITS + STRAY, 240);
  step("builder cancels too: the job is CANCELLED and the unpaid stage is refunded", done.status === "CANCELLED" && bal5 === CREDITS + STRAY, `status=${done.status} contract balance ${fmt(bal5)} (credits 0.05 + stray 0.007; the 0.5 GEN left for the payer)`);
  cur.txs.push(...await txsOf(builder, "builder cancel", t5));

  // reclaim stray funds through the payer page (appears after the surplus delay)
  const wait = done.closed_at + done.surplus_delay + 10;
  while (Number(BigInt((await rpc("eth_getBlockByNumber", ["latest", false])).timestamp)) < wait) await sleep(8000);
  await payer.goto(`${SITE}/payer`, { waitUntil: "networkidle0" });
  await waitText(payer, "Stray funds are held", 120);
  step("the frontend shows the stray funds to the payer", true, "notice with the exact amount and a Reclaim button");
  const t6 = Date.now();
  await clickText(payer, "Reclaim");
  const bal6 = await waitFor(() => balanceOf(job), (v) => v === CREDITS, 300);
  const acc6 = await accounting(job);
  step("payer reclaims exactly the stray 0.007 GEN; the builder's credits are untouched", bal6 === CREDITS && acc6.surplus === "0", `contract balance ${fmt(bal6)} surplus ${acc6.surplus}`);
  cur.txs.push(...await txsOf(payer, "reclaim_surplus", t6));

  await openBuilder(builder, job);
  const t7 = Date.now();
  await clickText(builder, "Withdraw unused credits");
  const bal7 = await waitFor(() => balanceOf(job), (v) => v === 0n, 240);
  step("builder withdraws the unused credits: the contract ends at exactly 0", bal7 === 0n, `contract balance ${fmt(bal7)}`);
  cur.txs.push(...await txsOf(builder, "withdraw_credits", t7));
  cur.final = { snapshot: await snap(job), accounting: await accounting(job), balance: String(bal7) };
  await payer.screenshot({ path: path.join(RESULTS, "cancel-payer-final.png") });
}

// ---- expire (test job)
async function scenarioExpire() {
  begin("expire", "A job past its deadline can be expired by the payer, who is refunded");
  const payer = await session("payer"), builder = await session("builder");
  const b = await builderAddress(builder);
  const FUND = gen("0.5");
  const { job, since: s0 } = await createJob(payer, b.address, { expireS: 200, windowS: 40 });
  cur.contract = job; cur.accounts = { builder: b.address, payer: (await snap(job)).payer };
  cur.txs.push(...await txsOf(payer, "deploy", s0));
  const t1 = await fundRoof(payer);
  await waitFor(() => balanceOf(job), (v) => v === FUND, 120);
  cur.txs.push(...await txsOf(payer, "deposit+fund", t1));
  const sn = await snap(job);
  step("funded: 0.5 GEN in escrow", (await balanceOf(job)) === FUND, `expires_at=${sn.expires_at}`);
  // before the deadline the button is not offered
  const early = await hasText(payer, "Expire and refund me");
  step("before the deadline the frontend does not offer Expire", early === false, `button present=${early}`);
  while (Number(BigInt((await rpc("eth_getBlockByNumber", ["latest", false])).timestamp)) < sn.expires_at + 15) await sleep(8000);
  await payer.reload({ waitUntil: "networkidle0" });
  await waitText(payer, "Expire and refund me", 120);
  const t2 = Date.now();
  await clickText(payer, "Expire and refund me");
  const done = await waitFor(() => snap(job), (s) => s.status === "EXPIRED", 240);
  const bal = await waitFor(() => balanceOf(job), (v) => v === 0n, 240);
  step("after the deadline the payer expires the job: status EXPIRED, the full 0.5 GEN leaves the contract", done.status === "EXPIRED" && bal === 0n, `status=${done.status} contract balance ${fmt(bal)}`);
  cur.txs.push(...await txsOf(payer, "expire", t2));
  cur.final = { snapshot: done, accounting: await accounting(job), balance: String(bal) };
  await payer.screenshot({ path: path.join(RESULTS, "expire-payer-final.png") });
}

// ---- silent payer: fallback code, builder still paid (test job)
async function scenarioFallback() {
  begin("fallback", "The payer never issues a code: after the window the builder unlocks a fallback code and is still paid");
  const payer = await session("payer"), builder = await session("builder");
  const b = await builderAddress(builder);
  const FUND = gen("0.5"), CREDITS = gen("0.1"), FEE = gen("0.01");
  const { job, since: s0 } = await createJob(payer, b.address, { expireS: 3600, windowS: 40 });
  cur.contract = job; cur.accounts = { builder: b.address, payer: (await snap(job)).payer };
  cur.txs.push(...await txsOf(payer, "deploy", s0));
  const t1 = await fundRoof(payer);
  await waitFor(() => balanceOf(job), (v) => v === FUND, 120);
  cur.txs.push(...await txsOf(payer, "deposit+fund", t1));
  await openBuilder(builder, job);
  const t2 = await registerAndCredit(builder);
  cur.txs.push(...await txsOf(builder, "register+credits", t2));
  const t3 = Date.now();
  await clickText(builder, "Request a code");
  const rq = await waitFor(() => snap(job), (s) => s.stages.roof.request_at > 0, 200);
  step("builder requests a code; the payer stays silent", rq.stages.roof.request_at > 0 && rq.stages.roof.code === "", `request_at=${rq.stages.roof.request_at}`);
  cur.txs.push(...await txsOf(builder, "request_code", t3));
  const earlyDisabled = await builder.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Unlock fallback code")); return !!b && b.disabled; });
  step("the fallback button is disabled before the payer window passes", earlyDisabled === true, `disabled=${earlyDisabled}`);
  while (Number(BigInt((await rpc("eth_getBlockByNumber", ["latest", false])).timestamp)) < rq.stages.roof.request_at + 40 + 12) await sleep(5000);
  await builder.reload({ waitUntil: "networkidle0" });
  const t4 = Date.now();
  await clickText(builder, "Unlock fallback code");
  const fb = await waitFor(() => snap(job), (s) => s.stages.roof.code !== "", 240);
  const code = fb.stages.roof.code;
  step("after the window the builder unlocks a fallback code", /^[A-Z]+ [A-Z]+$/.test(code), `code=${code}`);
  cur.txs.push(...await txsOf(builder, "trigger_fallback_code", t4));
  await scene(builder, code, path.join(RESULTS, "scenes", "fallback.jpg"));
  await builder.reload({ waitUntil: "networkidle0" });
  await scene(builder, code, path.join(RESULTS, "scenes", "fallback.jpg"));
  await shoot(builder);
  const t5 = await submitShot(builder);
  const s5 = await waitFor(() => snap(job), (s) => s.stages.roof.attempts === 1, 420);
  const a1 = await attempts(job, 1);
  step("the shot with the fallback code is judged", !!a1 && a1.paid === true, `verdict=${ser(a1)}`);
  cur.txs.push(...await txsOf(builder, "submit (fallback code)", t5));
  const fin = await waitFor(() => snap(job), (s) => s.stages.roof.status === "PAID" && !s.settling, 600, 15000);
  const bal = await waitFor(() => balanceOf(job), (v) => v === CREDITS - FEE, 300, 15000);
  step("builder is paid although the payer never acted", fin.status === "DONE" && bal === CREDITS - FEE, `job=${fin.status} contract balance ${fmt(bal)} (credits left ${fmt(CREDITS - FEE)})`);
  cur.final = { snapshot: fin, accounting: await accounting(job), balance: String(bal) };
  await builder.screenshot({ path: path.join(RESULTS, "fallback-builder-final.png") });
}

const which = process.argv.slice(2);
const want = (k) => which.length === 0 || which.includes(k);
await launch();
try {
  if (want("pass")) await scenarioPass("pass", null, false);
  if (want("recover")) await scenarioPass("recover", { expireS: 3600, windowS: 40 }, true);
  if (want("cancel")) await scenarioCancel();
  if (want("expire")) await scenarioExpire();
  if (want("fallback")) await scenarioFallback();
} catch (e) {
  step("scenario aborted", false, String(e?.stack ?? e).slice(0, 600));
} finally {
  run.finished = new Date().toISOString();
  save();
  await browser.close();
}
const all = Object.values(run.scenarios).flatMap((s) => s.steps);
console.log(`\n${all.filter((s) => s.ok).length} ok, ${all.filter((s) => s.ok === false).length} failed, ${all.filter((s) => s.ok === null).length} info`);
