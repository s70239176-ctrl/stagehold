"use client";

import { useEffect, useRef, useState } from "react";
import { JobStatus } from "../../components/JobStatus.tsx";
import { addressFor, loadOrCreateKey, resetKey } from "../../lib/accounts.ts";
import { encodeFrame, grabFrame, startCamera, thumbnailPng } from "../../lib/capture.ts";
import { readAttempt, sendTx } from "../../lib/chain.ts";
import { humanSeconds, stageLabel } from "../../lib/config.ts";
import { sha256Hex, shotMessage, signShot, toB64 } from "../../lib/crypto.ts";
import { getDeviceKey } from "../../lib/devicekey.ts";
import type { AttemptView } from "../../lib/types.ts";
import { useSnapshot } from "../../lib/useSnapshot.ts";

const JOB_KEY = "stagehold.builder.job";
const REG_KEY = (contract: string, address: string) => `stagehold.registered.${contract.toLowerCase()}.${address.toLowerCase()}`;

const word = (v: string | boolean): string => (v === true ? "yes" : v === false ? "no" : v);

export default function BuilderPage() {
  const [key, setKey] = useState("");
  const [address, setAddress] = useState("");
  const [contract, setContract] = useState("");
  const [jobInput, setJobInput] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [stage, setStage] = useState("");
  const [credits, setCredits] = useState("30");
  const [registered, setRegistered] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [frameUrl, setFrameUrl] = useState("");
  const [result, setResult] = useState<AttemptView | null>(null);

  const video = useRef<HTMLVideoElement>(null);
  const stopCamera = useRef<(() => void) | null>(null);
  const frame = useRef<HTMLCanvasElement | null>(null);

  const { snapshot, error, refresh } = useSnapshot(contract);

  useEffect(() => {
    const k = loadOrCreateKey("builder");
    setKey(k);
    const a = addressFor(k);
    setAddress(a);
    const fromLink = new URLSearchParams(window.location.search).get("job") ?? "";
    const saved = fromLink || window.localStorage.getItem(JOB_KEY) || "";
    if (saved) {
      setContract(saved);
      setJobInput(saved);
      window.localStorage.setItem(JOB_KEY, saved);
      setRegistered(window.localStorage.getItem(REG_KEY(saved, a)) === "1");
    }
    return () => stopCamera.current?.();
  }, []);

  useEffect(() => {
    if (snapshot && !stage) setStage(Object.keys(snapshot.stages)[0] ?? "");
  }, [snapshot, stage]);

  const say = (text: string, bad = false) => setMessage({ text, bad });
  const phase = (label: string) => (p: string, detail?: string) => setBusy(`${label}: ${p}${detail ? ` (${detail})` : ""}`);

  async function run(fn: () => Promise<void>) {
    setBusy("working");
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

  async function tx(label: string, fn: string, args: unknown[], value = 0n) {
    const out = await sendTx(key, contract, fn, args, value, phase(label));
    if (out.error) throw new Error(out.error);
    return out;
  }

  function openJob() {
    const v = jobInput.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return say("Paste the job address the payer sent you.", true);
    window.localStorage.setItem(JOB_KEY, v);
    setContract(v);
    setRegistered(window.localStorage.getItem(REG_KEY(v, address)) === "1");
  }

  async function register() {
    const dk = await getDeviceKey(contract, address);
    try {
      await tx("Registering this device", "register_software_key", [dk.x, dk.y]);
    } catch (e) {
      if (!(e instanceof Error && /already registered/.test(e.message))) throw e;
    }
    window.localStorage.setItem(REG_KEY(contract, address), "1");
    setRegistered(true);
    say("This browser is registered for the job.");
  }

  async function begin() {
    if (!video.current) return;
    try {
      stopCamera.current = await startCamera(video.current);
      setCameraOn(true);
    } catch (e) {
      say(`The camera could not start: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  }

  function snap() {
    if (!video.current) return;
    const c = grabFrame(video.current);
    frame.current = c;
    setFrameUrl(c.toDataURL("image/jpeg", 0.6));
    setResult(null);
  }

  async function submit() {
    const st = snapshot?.stages[stage];
    if (!st || !frame.current) throw new Error("Take a picture first.");
    const now = Date.now() / 1000;
    if (!st.code || st.code_deadline < now) throw new Error("There is no valid code for this stage. Request one, or use the fallback.");
    setBusy("Preparing the shot");
    const dk = await getDeviceKey(contract, address);
    const jpeg = await encodeFrame(frame.current);
    const thumb = await thumbnailPng(frame.current);
    const msg = shotMessage(contract, stage, st.code, st.code_deadline, await sha256Hex(jpeg), await sha256Hex(thumb));
    const sig = await signShot(dk.privateKey, msg);
    const before = st.attempts;
    const out = await sendTx(key, contract, "submit", [stage, dk.keyId, toB64(jpeg), toB64(thumb), sig], 0n, phase("Asking the panel"));
    if (out.error) throw new Error(out.error);
    await refresh();
    const n = before + 1;
    const r = await readAttempt(contract, stage, n);
    if (!r) throw new Error("The network accepted the call but no attempt was recorded. Check again in a minute.");
    setResult(r);
    say(r.paid ? "The panel accepted this shot. Payment is released when the result is final." : "The panel did not accept this shot. Nothing was paid; an attempt fee was used.", !r.paid);
  }

  async function cancel() {
    await tx("Cancelling", "cancel", []);
    say("Your cancellation is recorded. Money is refunded to the payer only when the payer cancels too.");
  }

  async function withdraw() {
    await tx("Withdrawing credits", "withdraw_credits", []);
    say("Your unused attempt credits were returned.");
  }

  async function expire() {
    await tx("Expiring", "expire", []);
    say("The job has expired and the unpaid money is refunded to the payer.");
  }

  const st = snapshot && stage ? snapshot.stages[stage] : undefined;
  const expired = !!snapshot && snapshot.expires_at < Date.now() / 1000;
  const nowS = Date.now() / 1000;
  const hasCode = !!st && !!st.code && st.code_deadline > nowS;
  const window_ = snapshot?.payer_window ?? 86400;
  const fallbackReady = !!st && !hasCode && st.request_at > 0 && nowS >= st.request_at + window_;
  const canShoot = !!snapshot && snapshot.status === "ACTIVE" && !snapshot.settling;

  return (
    <main>
      <h1>Builder</h1>
      <p className="muted">
        Your play-money address (give this to the payer): <span className="mono">{address || "…"}</span>{" "}
        <button className="secondary" onClick={() => { const k = resetKey("builder"); setKey(k); setAddress(addressFor(k)); setRegistered(false); }}>New account</button>
      </p>

      {busy ? <p className="card">{busy}…</p> : null}
      {message ? <p className={`card ${message.bad ? "err" : "ok"}`}>{message.text}</p> : null}

      {!contract ? (
        <div className="card">
          <h2>Open your job</h2>
          <label>Job address (from the payer's link)</label>
          <input value={jobInput} onChange={(e) => setJobInput(e.target.value)} placeholder="0x…" />
          <button onClick={openJob}>Open</button>
        </div>
      ) : (
        <p className="muted">Job <span className="mono">{contract}</span>{" "}
          <button className="secondary" onClick={() => { window.localStorage.removeItem(JOB_KEY); setContract(""); setStage(""); }}>Change</button></p>
      )}

      {error ? <p className="err">Could not read the job: {error}</p> : null}
      {snapshot ? <JobStatus snapshot={snapshot} /> : null}

      {snapshot && canShoot ? (
        <>
          <div className="card">
            <h2>1. Get ready</h2>
            <p className="muted">Register this browser once, and keep some attempt credits. Each judged attempt uses the fee.</p>
            <div className="row">
              <button disabled={!!busy || registered} onClick={() => void run(register)}>{registered ? "Registered" : "Register this browser"}</button>
            </div>
            <label>Add attempt credits</label>
            <input value={credits} onChange={(e) => setCredits(e.target.value)} inputMode="numeric" />
            <button className="secondary" disabled={!!busy} onClick={() => void run(async () => { await tx("Adding credits", "deposit_credits", [], BigInt(credits)); say("Credits added."); })}>Add credits</button>
          </div>

          <div className="card">
            <h2>2. Get a code</h2>
            <label>Stage</label>
            <select value={stage} onChange={(e) => { setStage(e.target.value); setResult(null); }}>
              {Object.keys(snapshot.stages).map((id) => <option key={id} value={id}>{stageLabel(id)}</option>)}
            </select>
            {hasCode ? (
              <p>Write this on the work itself, large and clear, then photograph it: <strong style={{ fontSize: "1.4rem" }}>{st!.code}</strong></p>
            ) : (
              <p className="muted">No valid code yet. Ask the payer to issue one, or request it here.</p>
            )}
            <div className="row">
              <button className="secondary" disabled={!!busy || hasCode || (st?.request_at ?? 0) > 0} onClick={() => void run(async () => { await tx("Requesting a code", "request_code", [stage]); say(`Requested. If the payer does not issue a code within ${humanSeconds(window_)} you can unlock a fallback code.`); })}>Request a code</button>
              <button className="secondary" disabled={!!busy || !fallbackReady} onClick={() => void run(async () => { await tx("Unlocking the fallback code", "trigger_fallback_code", [stage]); say("Fallback code issued."); })}>Unlock fallback code</button>
            </div>
          </div>

          <div className="card">
            <h2>3. Take the picture and submit</h2>
            <p className="muted">The whole stage must be in frame, in good light, with the code written on the wall itself (not on paper, not over plants).</p>
            <video ref={video} playsInline muted style={{ display: cameraOn ? "block" : "none" }} />
            {frameUrl ? <img className="preview" src={frameUrl} alt="your picture" /> : null}
            <div className="row">
              {!cameraOn ? <button disabled={!!busy} onClick={() => void begin()}>Start camera</button> : <button disabled={!!busy} onClick={snap}>Take picture</button>}
              <button disabled={!!busy || !frameUrl || !registered || !hasCode} onClick={() => void run(submit)}>Submit to the panel</button>
            </div>
            {!registered ? <p className="muted">Register this browser first.</p> : null}
          </div>
        </>
      ) : null}

      {snapshot ? (
        <div className="card">
          <h2>Other actions</h2>
          <div className="row">
            {snapshot.status === "ACTIVE" ? (
              <button className="secondary" disabled={!!busy || snapshot.settling} onClick={() => void run(cancel)}>Cancel the job (needs the payer too)</button>
            ) : null}
            {snapshot.status === "ACTIVE" && expired ? (
              <button className="secondary" disabled={!!busy || snapshot.settling} onClick={() => void run(expire)}>Expire the job (refunds the payer)</button>
            ) : null}
            {snapshot.builder_credits !== "0" ? (
              <button className="secondary" disabled={!!busy} onClick={() => void run(withdraw)}>Withdraw my unused credits</button>
            ) : null}
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="card">
          <h2>What the panel decided</h2>
          <div className="result">
            <span>Stage complete</span><strong className={result.stage_met === "yes" ? "ok" : "err"}>{word(result.stage_met)}</strong>
            <span>Code visible on the work</span><strong className={result.code_visible === "yes" ? "ok" : "err"}>{word(result.code_visible)}</strong>
            <span>Same site as the anchor</span>
            {snapshot?.alignment_enforced ? (
              <strong className={result.site_aligned ? "ok" : "err"}>{word(result.site_aligned)}</strong>
            ) : (
              <strong className="muted">not checked yet</strong>
            )}
          </div>
          <p className="muted">{result.paid ? "Paid after the result is final." : "Not paid. You can take another picture."}</p>
        </div>
      ) : null}
    </main>
  );
}
