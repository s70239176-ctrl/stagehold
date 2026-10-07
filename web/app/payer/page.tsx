"use client";

import { useEffect, useRef, useState } from "react";
import { JobStatus } from "../../components/JobStatus.tsx";
import { addressFor, loadOrCreateKey, resetKey } from "../../lib/accounts.ts";
import { anchorFromFile } from "../../lib/capture.ts";
import { deployJob, sendTx } from "../../lib/chain.ts";
import { STAGES, humanSeconds, stageLabel } from "../../lib/config.ts";
import { toB64 } from "../../lib/crypto.ts";
import { useSnapshot } from "../../lib/useSnapshot.ts";
import { suggestCode, validCode } from "../../lib/words.ts";

const JOB_KEY = "stagehold.payer.job";

export default function PayerPage() {
  const [key, setKey] = useState("");
  const [address, setAddress] = useState("");
  const [contract, setContract] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  // create
  const [builder, setBuilder] = useState("");
  const [fee, setFee] = useState("10");
  const [days, setDays] = useState("30");
  const [testJob, setTestJob] = useState(false);
  const [windowS, setWindowS] = useState("40");
  const [expireS, setExpireS] = useState("600");
  // fund
  const [stage, setStage] = useState("roof");
  const [amount, setAmount] = useState("1000");
  const anchorFile = useRef<HTMLInputElement>(null);
  // code
  const [code, setCode] = useState("");

  const { snapshot, error, refresh } = useSnapshot(contract);

  useEffect(() => {
    const k = loadOrCreateKey("payer");
    setKey(k);
    setAddress(addressFor(k));
    setContract(window.localStorage.getItem(JOB_KEY) ?? "");
  }, []);

  const say = (text: string, bad = false) => setMessage({ text, bad });

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      say(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy("");
      void refresh();
    }
  }

  const phase = (label: string) => (p: string, detail?: string) => setBusy(`${label}: ${p}${detail ? ` (${detail})` : ""}`);

  async function create() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(builder)) throw new Error("Paste the builder's address (0x and 40 characters).");
    const expiresIn = testJob ? BigInt(Math.round(Number(expireS))) : BigInt(Math.round(Number(days) * 86400));
    const test = testJob ? { payerWindowSeconds: Math.round(Number(windowS)) } : null;
    const addr = await deployJob(key, builder, BigInt(fee), expiresIn, test, phase("Creating the job"));
    window.localStorage.setItem(JOB_KEY, addr);
    setContract(addr);
    say("Job created. Send the builder the link below.");
  }

  async function fund() {
    const file = anchorFile.current?.files?.[0];
    if (!file) throw new Error("Choose your anchor photo first: one picture of the real site that you trust.");
    const png = await anchorFromFile(file);
    const out1 = await sendTx(key, contract, "deposit", [], BigInt(amount), phase("Depositing"));
    if (out1.error) throw new Error(out1.error);
    const out2 = await sendTx(key, contract, "fund", [[stage], [amount], toB64(png)], 0n, phase("Funding"));
    if (out2.error) throw new Error(out2.error);
    say(`Funded ${stageLabel(stage)} with ${amount}. The anchor thumbnail is now stored on-chain (about ${Math.round(png.length / 1024)} KB, public).`);
  }

  async function issue() {
    if (!validCode(code)) throw new Error("A code is 4 to 16 capital letters or digits, with single spaces.");
    const out = await sendTx(key, contract, "issue_code", [stage, code], 0n, phase("Issuing the code"));
    if (out.error) throw new Error(out.error);
    say(`Code "${code}" issued for ${stageLabel(stage)}. It is valid for 6 hours. Tell the builder to write it on the work.`);
  }

  async function cancel() {
    const out = await sendTx(key, contract, "cancel", [], 0n, phase("Cancelling"));
    if (out.error) throw new Error(out.error);
    say("Your cancellation is recorded. Money is refunded only when the builder cancels too.");
  }

  async function expire() {
    const out = await sendTx(key, contract, "expire", [], 0n, phase("Expiring"));
    if (out.error) throw new Error(out.error);
    say("The job has expired and the unpaid money is refunded.");
  }

  const expired = !!snapshot && snapshot.expires_at < Date.now() / 1000;
  const link = typeof window !== "undefined" && contract ? `${window.location.origin}/builder?job=${contract}` : "";

  return (
    <main>
      <h1>Payer</h1>
      <p className="muted">
        Your play-money account: <span className="mono">{address || "…"}</span>{" "}
        <button className="secondary" onClick={() => { const k = resetKey("payer"); setKey(k); setAddress(addressFor(k)); }}>New account</button>
      </p>

      {busy ? <p className="card">{busy}…</p> : null}
      {message ? <p className={`card ${message.bad ? "err" : "ok"}`}>{message.text}</p> : null}

      {!contract ? (
        <div className="card">
          <h2>1. Create the job</h2>
          <label>Builder's address (they get it on their page)</label>
          <input value={builder} onChange={(e) => setBuilder(e.target.value.trim())} placeholder="0x…" />
          <label>Attempt fee (burned on each judged attempt)</label>
          <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="numeric" />
          {!testJob ? (
            <>
              <label>Job lasts (days, at least 30)</label>
              <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
            </>
          ) : (
            <>
              <label>Test job: seconds before the builder can unlock a fallback code</label>
              <input value={windowS} onChange={(e) => setWindowS(e.target.value)} inputMode="numeric" />
              <label>Test job: seconds until the job expires</label>
              <input value={expireS} onChange={(e) => setExpireS(e.target.value)} inputMode="numeric" />
            </>
          )}
          <label>
            <input type="checkbox" style={{ width: "auto", marginRight: 8 }} checked={testJob} onChange={(e) => setTestJob(e.target.checked)} />
            Test job (short windows, for trying the unlock, cancel and expiry buttons). It is labelled as a test job to everyone.
          </label>
          <button disabled={!!busy || !key} onClick={() => void run("create", create)}>Create job</button>
        </div>
      ) : (
        <div className="card">
          <h2>Your job</h2>
          <p className="mono">{contract}</p>
          <p className="muted">Send the builder this link:</p>
          <p className="mono">{link}</p>
          <button className="secondary" onClick={() => { window.localStorage.removeItem(JOB_KEY); setContract(""); }}>Use a different job</button>
        </div>
      )}

      {contract && snapshot?.status === "CREATED" ? (
        <div className="card">
          <h2>2. Fund a stage and set the anchor</h2>
          <label>Stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <label>Amount to hold</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
          <label>Anchor photo: one picture of the real site, taken by you. It is shrunk to a small grayscale thumbnail that is stored on-chain, so anyone can see it.</label>
          <input type="file" accept="image/*" ref={anchorFile} />
          <button disabled={!!busy} onClick={() => void run("fund", fund)}>Deposit and fund</button>
        </div>
      ) : null}

      {contract && snapshot?.status === "ACTIVE" ? (
        <div className="card">
          <h2>3. Issue a code when a stage is ready</h2>
          <p className="muted">The builder writes it on the work and photographs it. If you go quiet, the builder can unlock a fallback code after {humanSeconds(snapshot.payer_window ?? 86400)}, so your silence cannot block payment.</p>
          <label>Stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {Object.keys(snapshot.stages).map((id) => <option key={id} value={id}>{stageLabel(id)}</option>)}
          </select>
          <label>Code</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="for example TREE BLUE" />
          <div className="row">
            <button className="secondary" onClick={() => setCode(suggestCode())}>Suggest two words</button>
            <button disabled={!!busy} onClick={() => void run("issue", issue)}>Issue code</button>
          </div>
          <button className="secondary" disabled={!!busy || snapshot.settling} onClick={() => void run("cancel", cancel)}>Cancel the job (needs the builder too)</button>
          {expired ? <button className="secondary" disabled={!!busy || snapshot.settling} onClick={() => void run("expire", expire)}>Expire the job and refund me</button> : null}
        </div>
      ) : null}

      {error ? <p className="err">Could not read the job: {error}</p> : null}
      {snapshot ? <JobStatus snapshot={snapshot} /> : null}
    </main>
  );
}
