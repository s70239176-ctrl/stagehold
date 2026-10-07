"use client";

import { useEffect, useRef, useState } from "react";
import { JobHeader, StageList } from "../../components/JobStatus.tsx";
import { Activity, Field, Notice, UnitInput, short } from "../../components/ui.tsx";
import { Arrow, Camera, Check, Clock, Cross, Info } from "../../components/icons.tsx";
import { useToast } from "../../components/Toast.tsx";
import { addressFor, loadOrCreateKey, resetKey } from "../../lib/accounts.ts";
import { encodeFrame, grabFrame, startCamera, thumbnailPng } from "../../lib/capture.ts";
import { readAttempt, sendTx } from "../../lib/chain.ts";
import { CAPTURE_NOTICE, humanSeconds, stageLabel } from "../../lib/config.ts";
import { sha256Hex, shotMessage, signShot, toB64 } from "../../lib/crypto.ts";
import { getDeviceKey } from "../../lib/devicekey.ts";
import { parseGen } from "../../lib/gen.ts";
import type { AttemptView } from "../../lib/types.ts";
import { useSnapshot } from "../../lib/useSnapshot.ts";

const JOB_KEY = "stagehold.builder.job";
const REG_KEY = (contract: string, address: string) => `stagehold.registered.${contract.toLowerCase()}.${address.toLowerCase()}`;

function Row({ label, value, na }: { label: string; value: string | boolean; na?: boolean }) {
  const v = value === true ? "yes" : value === false ? "no" : value;
  const cls = na ? "na" : v === "yes" ? "yes" : v === "no" ? "no" : "unk";
  const Icon = na ? Info : v === "yes" ? Check : v === "no" ? Cross : Clock;
  const text = na ? "Not checked yet" : v === "yes" ? "Yes" : v === "no" ? "No" : "Unclear";
  return (
    <div className="verdict-row">
      <span>{label}</span>
      <span className={`res ${cls}`}><Icon size={16} />{text}</span>
    </div>
  );
}

export default function BuilderPage() {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [address, setAddress] = useState("");
  const [contract, setContract] = useState("");
  const [jobInput, setJobInput] = useState("");
  const [busy, setBusy] = useState("");
  const [stage, setStage] = useState("");
  const [credits, setCredits] = useState("0.1");
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

  const phase = (label: string) => (p: string, detail?: string) => setBusy(`${label}: ${p === "signing" ? "signing" : p === "pending" ? `confirming on Studionet${detail ? ` (${detail.toLowerCase()})` : ""}` : "done"}`);

  async function run(fn: () => Promise<void>) {
    setBusy("Working");
    try {
      await fn();
    } catch (e) {
      toast.push({ kind: "bad", title: "That did not go through", body: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy("");
      void refresh();
    }
  }

  async function tx(label: string, fn: string, args: unknown[], value = 0n) {
    const out = await sendTx(key, contract, fn, args, value, phase(label));
    if (out.error) throw new Error(out.error);
  }

  function openJob() {
    const v = jobInput.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return toast.push({ kind: "bad", title: "Check the job address", body: "Paste the address the payer sent you: 0x followed by 40 characters." });
    window.localStorage.setItem(JOB_KEY, v);
    setContract(v);
    setRegistered(window.localStorage.getItem(REG_KEY(v, address)) === "1");
  }

  async function register() {
    const dk = await getDeviceKey(contract, address);
    try {
      await tx("Registering this browser", "register_software_key", [dk.x, dk.y]);
    } catch (e) {
      if (!(e instanceof Error && /already registered/.test(e.message))) throw e;
    }
    window.localStorage.setItem(REG_KEY(contract, address), "1");
    setRegistered(true);
    toast.push({ kind: "ok", title: "This browser is registered for the job" });
  }

  async function addCredits() {
    const wei = parseGen(credits);
    if (wei === null || wei <= 0n) throw new Error("Enter an amount above zero, for example 0.1.");
    await tx("Adding attempt credits", "deposit_credits", [], wei);
    toast.push({ kind: "ok", title: "Attempt credits added" });
  }

  async function begin() {
    if (!video.current) return;
    try {
      stopCamera.current = await startCamera(video.current);
      setCameraOn(true);
    } catch (e) {
      toast.push({ kind: "bad", title: "The camera could not start", body: e instanceof Error ? e.message : String(e) });
    }
  }

  function snap() {
    if (!video.current) return;
    const c = grabFrame(video.current);
    frame.current = c;
    setFrameUrl(c.toDataURL("image/jpeg", 0.7));
    setResult(null);
  }

  function retake() {
    frame.current = null;
    setFrameUrl("");
    setResult(null);
  }

  async function submit() {
    const st = snapshot?.stages[stage];
    if (!st || !frame.current) throw new Error("Take a picture first.");
    if (!st.code || st.code_deadline < Date.now() / 1000) throw new Error("There is no valid code for this stage. Request one, or unlock the fallback.");
    setBusy("Preparing the shot");
    const dk = await getDeviceKey(contract, address);
    const jpeg = await encodeFrame(frame.current);
    const thumb = await thumbnailPng(frame.current);
    const msg = shotMessage(contract, stage, st.code, st.code_deadline, await sha256Hex(jpeg), await sha256Hex(thumb));
    const sig = await signShot(dk.privateKey, msg);
    const before = st.attempts;
    await tx("Asking the panel", "submit", [stage, dk.keyId, toB64(jpeg), toB64(thumb), sig]);
    await refresh();
    const r = await readAttempt(contract, stage, before + 1);
    if (!r) throw new Error("The network accepted the call but no attempt was recorded yet. Check again in a minute.");
    setResult(r);
    toast.push(r.paid ? { kind: "ok", title: "Accepted", body: "Payment releases when the result is final." } : { kind: "bad", title: "Not accepted", body: "Nothing was paid. One attempt fee was used. You can take another picture." });
  }

  const st = snapshot && stage ? snapshot.stages[stage] : undefined;
  const nowS = Date.now() / 1000;
  const hasCode = !!st && !!st.code && st.code_deadline > nowS;
  const window_ = snapshot?.payer_window ?? 86400;
  const fallbackReady = !!st && !hasCode && st.request_at > 0 && nowS >= st.request_at + window_;
  const live = !!snapshot && snapshot.status === "ACTIVE" && !snapshot.settling;
  const expired = !!snapshot && snapshot.expires_at < nowS;
  const stageOptions = snapshot ? Object.entries(snapshot.stages).filter(([, s]) => s.status === "OPEN").map(([id]) => id) : [];

  return (
    <main className="container">
      <div className="console">
        <div className="stack">
          <div className="spread">
            <div className="stack-sm">
              <span className="eyebrow">Builder console</span>
              <h1 style={{ fontSize: "1.9rem" }}>Show the stage, get paid</h1>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="chip" onClick={() => void navigator.clipboard?.writeText(address)} title="Copy your address">{address ? short(address) : "…"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { const k = resetKey("builder"); setKey(k); setAddress(addressFor(k)); setRegistered(false); }}>New account</button>
            </div>
          </div>

          {busy ? <Activity text={busy} /> : null}

          {!contract ? (
            <div className="card">
              <div className="card-head"><div className="row"><span className="step-no now">1</span><h2>Open your job</h2></div></div>
              <div className="card-body stack">
                <Notice kind="info">Give the payer your address (the button above copies it) so they can create the job for you. They will send back a link.</Notice>
                <Field label="Job address">
                  <input className="input mono" value={jobInput} onChange={(e) => setJobInput(e.target.value)} placeholder="0x…" spellCheck={false} />
                </Field>
                <div className="btn-row"><button className="btn btn-primary" onClick={openJob}>Open job <Arrow size={16} /></button></div>
              </div>
            </div>
          ) : null}

          {error ? <Notice kind="bad" title="Could not read the job.">{error}</Notice> : null}

          {snapshot && snapshot.status === "CREATED" ? <Notice kind="info" title="Waiting for the payer.">The job exists but has not been funded yet.</Notice> : null}
          {snapshot && (snapshot.status === "CANCELLED" || snapshot.status === "EXPIRED" || snapshot.status === "DONE") ? (
            <Notice kind={snapshot.status === "DONE" ? "ok" : "warn"} title={snapshot.status === "DONE" ? "Every funded stage is paid." : snapshot.status === "CANCELLED" ? "This job was cancelled." : "This job expired."}>
              {snapshot.builder_credits !== "0" ? "You can withdraw your unused attempt credits." : "Nothing further to do."}
            </Notice>
          ) : null}

          {snapshot && live ? (
            <>
              <div className="card">
                <div className="card-head">
                  <div className="row"><span className={`step-no ${registered ? "done" : "now"}`}>{registered ? <Check size={14} /> : 1}</span><h2>Get ready</h2></div>
                  {registered ? <span className="badge badge-ok">Browser registered</span> : null}
                </div>
                <div className="card-body stack">
                  <p className="ink2 small">Register this browser once so the contract can check your shots are signed by you. Add attempt credits to pay the fee for each judged attempt.</p>
                  <div className="grid-2">
                    <div className="stack-sm">
                      <div className="label">Signing key</div>
                      <button className="btn btn-secondary" disabled={!!busy || registered} onClick={() => void run(register)}>{registered ? "Registered" : "Register this browser"}</button>
                    </div>
                    <Field label="Attempt credits">
                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        <UnitInput value={credits} onChange={setCredits} />
                        <button className="btn btn-secondary" disabled={!!busy} onClick={() => void run(addCredits)}>Add</button>
                      </div>
                    </Field>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><div className="row"><span className={`step-no ${hasCode ? "done" : "now"}`}>{hasCode ? <Check size={14} /> : 2}</span><h2>Get the code</h2></div></div>
                <div className="card-body stack">
                  {stageOptions.length === 0 ? <Notice kind="info">No stage is open. Every funded stage is settling or paid.</Notice> : (
                    <>
                      <Field label="Stage">
                        <select className="input" value={stage} onChange={(e) => { setStage(e.target.value); setResult(null); }}>
                          {stageOptions.map((id) => <option key={id} value={id}>{stageLabel(id)}</option>)}
                        </select>
                      </Field>
                      {hasCode ? (
                        <div className="codecard">
                          <div className="xs ink2">Write this on the work itself, large and clear, then photograph it</div>
                          <div className="code">{st!.code}</div>
                        </div>
                      ) : (
                        <p className="ink2 small">No valid code yet. Ask the payer to issue one, or request it here. If the payer does not respond within {humanSeconds(window_)}, you can unlock a fallback code.</p>
                      )}
                      <div className="btn-row">
                        <button className="btn btn-secondary" disabled={!!busy || hasCode || (st?.request_at ?? 0) > 0} onClick={() => void run(async () => { await tx("Requesting a code", "request_code", [stage]); toast.push({ kind: "ok", title: "Code requested", body: `If the payer stays silent for ${humanSeconds(window_)}, you can unlock a fallback code.` }); })}>Request a code</button>
                        <button className="btn btn-secondary" disabled={!!busy || !fallbackReady} onClick={() => void run(async () => { await tx("Unlocking the fallback code", "trigger_fallback_code", [stage]); toast.push({ kind: "ok", title: "Fallback code unlocked" }); })}>Unlock fallback code</button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-head"><div className="row"><span className="step-no now">3</span><h2>Photograph and submit</h2></div></div>
                <div className="card-body stack">
                  <div className="viewfinder">
                    <video ref={video} playsInline muted style={{ display: cameraOn && !frameUrl ? "block" : "none" }} />
                    {frameUrl ? <img src={frameUrl} alt="Your picture" /> : null}
                    {!cameraOn && !frameUrl ? <div className="vf-empty"><Camera size={30} /><span>The camera is off</span></div> : null}
                    {cameraOn || frameUrl ? <div className="grid-lines" /> : null}
                  </div>
                  <ul className="checklist">
                    <li><Check size={16} /> The whole stage is in frame, in good light.</li>
                    <li><Check size={16} /> The code is written on the wall itself, not on paper and not over plants.</li>
                    <li><Check size={16} /> Hold still. The frame you take is the frame that is judged.</li>
                  </ul>
                  <div className="spread">
                    <div className="row">
                      {!cameraOn ? <button className="btn btn-secondary" disabled={!!busy} onClick={() => void begin()}><Camera size={16} /> Start camera</button> : frameUrl ? <button className="btn btn-secondary" disabled={!!busy} onClick={retake}>Retake</button> : <button className="shutter" aria-label="Take picture" disabled={!!busy} onClick={snap} />}
                    </div>
                    <button className="btn btn-primary" disabled={!!busy || !frameUrl || !registered || !hasCode} onClick={() => void run(submit)}>Submit to the panel <Arrow size={16} /></button>
                  </div>
                  {!registered ? <p className="hint">Register this browser first.</p> : !hasCode ? <p className="hint">You need a valid code before you can submit.</p> : null}
                  <Notice kind="warn" title="About capture.">{CAPTURE_NOTICE}</Notice>
                </div>
              </div>
            </>
          ) : null}

          {result ? (
            <div className="card">
              <div className="card-head">
                <h2>What the panel decided</h2>
                <span className={`badge ${result.paid ? "badge-ok" : "badge-bad"}`}>{result.paid ? "Accepted" : "Not accepted"}</span>
              </div>
              <div className="card-body stack">
                <div className="verdict">
                  <Row label="The stage is complete" value={result.stage_met} />
                  <Row label="The code is written on the work" value={result.code_visible} />
                  <Row label="Same site as the anchor" value={result.site_aligned} na={!snapshot?.alignment_enforced} />
                </div>
                <p className="muted small">{result.paid ? "Payment releases to you when the result is final." : "Nothing was paid. You can take another picture."}</p>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="stack sticky">
          {contract && snapshot ? (
            <>
              <JobHeader contract={contract} snapshot={snapshot} />
              <StageList snapshot={snapshot} onPick={(id) => { setStage(id); setResult(null); }} picked={stage} />
              <div className="card card-pad stack-sm">
                <div className="label">Other actions</div>
                <div className="btn-row">
                  {snapshot.status === "ACTIVE" ? <button className="btn btn-danger btn-sm" disabled={!!busy || snapshot.settling} onClick={() => void run(async () => { await tx("Cancelling", "cancel", []); toast.push({ kind: "ok", title: "Cancellation recorded", body: "Money is refunded only when the payer cancels too." }); })}>Cancel the job</button> : null}
                  {snapshot.status === "ACTIVE" && expired ? <button className="btn btn-danger btn-sm" disabled={!!busy || snapshot.settling} onClick={() => void run(async () => { await tx("Expiring the job", "expire", []); toast.push({ kind: "ok", title: "Job expired", body: "Unpaid stages were refunded to the payer." }); })}>Expire the job</button> : null}
                  {snapshot.builder_credits !== "0" ? <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => void run(async () => { await tx("Withdrawing credits", "withdraw_credits", []); toast.push({ kind: "ok", title: "Unused credits returned" }); })}>Withdraw unused credits</button> : null}
                </div>
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => { window.localStorage.removeItem(JOB_KEY); setContract(""); setStage(""); retake(); }}>Use a different job</button>
              </div>
            </>
          ) : contract ? (
            <div className="card card-pad stack"><div className="skeleton" style={{ height: 22, width: "40%" }} /><div className="skeleton" style={{ height: 80 }} /><div className="skeleton" style={{ height: 160 }} /></div>
          ) : (
            <div className="card card-pad stack">
              <div className="row"><Camera size={20} /><h3 style={{ fontSize: "1.02rem" }}>How you get paid</h3></div>
              <ul className="checklist">
                <li><Check size={16} /> The payer funds a stage and issues a code.</li>
                <li><Check size={16} /> You write the code on the work and photograph the stage.</li>
                <li><Check size={16} /> A validator panel judges it. A pass pays you at finality.</li>
                <li><Check size={16} /> If the payer goes quiet, you can unlock a fallback code.</li>
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
