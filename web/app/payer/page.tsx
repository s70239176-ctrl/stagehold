"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CopyButton, Field, Notice, UnitInput, short } from "../../components/ui.tsx";
import { JobHeader, StageList } from "../../components/JobStatus.tsx";
import { Arrow, Camera, Check, STAGE_ICON } from "../../components/icons.tsx";
import { useToast } from "../../components/Toast.tsx";
import { addressFor, loadOrCreateKey, resetKey } from "../../lib/accounts.ts";
import { anchorFromFile } from "../../lib/capture.ts";
import { deployJob, sendTx } from "../../lib/chain.ts";
import { STAGES, humanSeconds, stageLabel } from "../../lib/config.ts";
import { toB64 } from "../../lib/crypto.ts";
import { formatGen, parseGen, sumWei } from "../../lib/gen.ts";
import { useSnapshot } from "../../lib/useSnapshot.ts";
import { suggestCode, validCode } from "../../lib/words.ts";

const JOB_KEY = "stagehold.payer.job";

interface Pick {
  on: boolean;
  amount: string;
}

export default function PayerPage() {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [address, setAddress] = useState("");
  const [contract, setContract] = useState("");
  const [busy, setBusy] = useState("");

  // step 1
  const [builder, setBuilder] = useState("");
  const [fee, setFee] = useState("0.01");
  const [days, setDays] = useState("30");
  const [testJob, setTestJob] = useState(false);
  const [windowS, setWindowS] = useState("40");
  const [expireS, setExpireS] = useState("600");

  // step 2
  const [picks, setPicks] = useState<Record<string, Pick>>(() =>
    Object.fromEntries(STAGES.map((s) => [s.id, { on: s.id === "roof", amount: "0.5" }])),
  );
  const [anchorBytes, setAnchorBytes] = useState<Uint8Array | null>(null);
  const [anchorUrl, setAnchorUrl] = useState("");

  // step 3
  const [stage, setStage] = useState("");
  const [code, setCode] = useState("");

  const { snapshot, error, refresh } = useSnapshot(contract);

  useEffect(() => {
    const k = loadOrCreateKey("payer");
    setKey(k);
    setAddress(addressFor(k));
    setContract(window.localStorage.getItem(JOB_KEY) ?? "");
  }, []);

  const openStages = useMemo(() => (snapshot ? Object.entries(snapshot.stages).filter(([, s]) => s.status === "OPEN").map(([id]) => id) : []), [snapshot]);
  useEffect(() => {
    if (!stage || !openStages.includes(stage)) setStage(openStages[0] ?? "");
  }, [openStages, stage]);

  const phase = (label: string) => (p: string, detail?: string) => setBusy(`${label}: ${p === "signing" ? "waiting for the signature" : p === "pending" ? `confirming on Studionet${detail ? ` (${detail.toLowerCase()})` : ""}` : "done"}`);

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

  const feeWei = parseGen(fee);
  const picked = STAGES.filter((s) => picks[s.id]?.on);
  const pickedWei = picked.map((s) => parseGen(picks[s.id]!.amount));
  const fundValid = picked.length > 0 && pickedWei.every((w) => w !== null && w > 0n) && !!anchorBytes;
  const totalWei = fundValid ? sumWei(pickedWei as bigint[]) : 0n;

  async function onAnchor(file: File | undefined) {
    if (!file) return;
    try {
      const bytes = await anchorFromFile(file);
      setAnchorBytes(bytes);
      if (anchorUrl) URL.revokeObjectURL(anchorUrl);
      setAnchorUrl(URL.createObjectURL(new Blob([bytes as BlobPart], { type: "image/png" })));
    } catch (e) {
      toast.push({ kind: "bad", title: "That image could not be read", body: e instanceof Error ? e.message : String(e) });
    }
  }

  async function create() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(builder)) throw new Error("Paste the builder's address: 0x followed by 40 characters.");
    if (feeWei === null || feeWei <= 0n) throw new Error("Enter an attempt fee above zero, for example 0.01.");
    const expiresIn = testJob ? BigInt(Math.round(Number(expireS))) : BigInt(Math.round(Number(days) * 86400));
    if (!testJob && Number(days) < 30) throw new Error("A job must last at least 30 days.");
    const test = testJob ? { payerWindowSeconds: Math.round(Number(windowS)) } : null;
    const addr = await deployJob(key, builder, feeWei, expiresIn, test, phase("Creating the job"));
    window.localStorage.setItem(JOB_KEY, addr);
    setContract(addr);
    toast.push({ kind: "ok", title: "Job created", body: "Fund a stage next, then send the builder the link." });
  }

  async function fund() {
    if (!fundValid || !anchorBytes) throw new Error("Choose at least one stage with an amount, and add the anchor photograph.");
    await tx("Depositing", "deposit", [], totalWei);
    await tx("Funding the stages", "fund", [picked.map((s) => s.id), pickedWei.map((w) => String(w)), toB64(anchorBytes)]);
    toast.push({ kind: "ok", title: `${formatGen(totalWei)} GEN held in escrow`, body: "The anchor thumbnail is now stored on-chain." });
  }

  async function issue() {
    if (!stage) throw new Error("Pick a funded stage first.");
    if (!validCode(code)) throw new Error("A code is 4 to 16 capital letters or digits, with single spaces.");
    await tx("Issuing the code", "issue_code", [stage, code]);
    toast.push({ kind: "ok", title: `Code "${code}" issued`, body: `Valid for 6 hours for ${stageLabel(stage)}. Tell the builder to write it on the work.` });
  }

  async function cancel() {
    await tx("Cancelling", "cancel", []);
    toast.push({ kind: "ok", title: "Cancellation recorded", body: "Unpaid money is refunded only when the builder cancels too." });
  }

  async function expire() {
    await tx("Expiring the job", "expire", []);
    toast.push({ kind: "ok", title: "Job expired", body: "Unpaid stages were refunded to you." });
  }

  const link = typeof window !== "undefined" && contract ? `${window.location.origin}/builder?job=${contract}` : "";
  const expired = !!snapshot && snapshot.expires_at < Date.now() / 1000;
  const status = snapshot?.status;

  return (
    <main className="container">
      <div className="console">
        <div className="stack">
          <div className="spread">
            <div className="stack-sm">
              <span className="eyebrow">Payer console</span>
              <h1 style={{ fontSize: "1.9rem" }}>Fund the work, release on proof</h1>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className="chip">{address ? short(address) : "…"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { const k = resetKey("payer"); setKey(k); setAddress(addressFor(k)); }}>New account</button>
            </div>
          </div>

          {busy ? <Activity text={busy} /> : null}

          {!contract ? (
            <div className="card">
              <div className="card-head"><div className="row"><span className="step-no now">1</span><h2>Create the job</h2></div></div>
              <div className="card-body stack">
                <Field label="Builder's address" hint="The builder copies this from their page.">
                  <input className="input mono" value={builder} onChange={(e) => setBuilder(e.target.value.trim())} placeholder="0x…" spellCheck={false} />
                </Field>
                <div className="grid-2">
                  <Field label="Attempt fee" hint="Burned on each judged attempt.">
                    <UnitInput value={fee} onChange={setFee} />
                  </Field>
                  {!testJob ? (
                    <Field label="Job lasts (days)" hint="At least 30.">
                      <input className="input" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
                    </Field>
                  ) : (
                    <Field label="Expires after (seconds)" hint="Test timing only.">
                      <input className="input" value={expireS} onChange={(e) => setExpireS(e.target.value)} inputMode="numeric" />
                    </Field>
                  )}
                </div>
                <details>
                  <summary className="small muted" style={{ cursor: "pointer" }}>Advanced: test timing</summary>
                  <div className="stack" style={{ marginTop: 12 }}>
                    <label className="row small"><input type="checkbox" checked={testJob} onChange={(e) => setTestJob(e.target.checked)} /> Test job with short windows (clearly labelled to everyone)</label>
                    {testJob ? (
                      <Field label="Fallback code unlocks after (seconds)">
                        <input className="input" value={windowS} onChange={(e) => setWindowS(e.target.value)} inputMode="numeric" />
                      </Field>
                    ) : null}
                  </div>
                </details>
                <div className="btn-row">
                  <button className="btn btn-primary" disabled={!!busy || !key} onClick={() => void run(create)}>Create job <Arrow size={16} /></button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {status === "CREATED" ? (
                <div className="card">
                  <div className="card-head"><div className="row"><span className="step-no now">2</span><h2>Fund stages and set the anchor</h2></div></div>
                  <div className="card-body stack">
                    <div>
                      <div className="label" style={{ marginBottom: 6 }}>Stages to fund</div>
                      {STAGES.map((s) => {
                        const Icon = STAGE_ICON[s.id]!;
                        const p = picks[s.id]!;
                        return (
                          <div className="stage-pick" key={s.id}>
                            <input type="checkbox" checked={p.on} onChange={(e) => setPicks({ ...picks, [s.id]: { ...p, on: e.target.checked } })} aria-label={`Fund ${s.label}`} />
                            <div className="row" style={{ gap: 10 }}>
                              <Icon size={18} />
                              <div><div className="stage-name">{s.label}</div><div className="stage-sub">{s.brief}</div></div>
                            </div>
                            <UnitInput value={p.amount} disabled={!p.on} onChange={(v) => setPicks({ ...picks, [s.id]: { ...p, amount: v } })} />
                          </div>
                        );
                      })}
                    </div>
                    <Field label="Anchor photograph" hint="One picture of the real site that you trust. It is shrunk to a small grayscale thumbnail and stored on-chain, so anyone can see it.">
                      <input className="input file" type="file" accept="image/*" onChange={(e) => void onAnchor(e.target.files?.[0])} />
                    </Field>
                    {anchorUrl ? (
                      <div className="row">
                        <img src={anchorUrl} alt="Anchor thumbnail" style={{ height: 84, borderRadius: 8, border: "1px solid var(--line-strong)" }} />
                        <span className="small muted">Stored thumbnail, about {Math.round((anchorBytes?.length ?? 0) / 1024)} KB.</span>
                      </div>
                    ) : null}
                    <div className="spread">
                      <div><span className="muted small">Total to deposit</span> <strong style={{ fontSize: "1.2rem" }}>{fundValid ? formatGen(totalWei) : "0"} GEN</strong></div>
                      <button className="btn btn-primary" disabled={!!busy || !fundValid} onClick={() => void run(fund)}>Deposit and fund <Arrow size={16} /></button>
                    </div>
                  </div>
                </div>
              ) : null}

              {status === "ACTIVE" ? (
                <div className="card">
                  <div className="card-head"><div className="row"><span className="step-no now">3</span><h2>Issue a code when a stage is ready</h2></div></div>
                  <div className="card-body stack">
                    <p className="ink2 small">The builder writes the code on the work and photographs it. If you stay silent, the builder can unlock a fallback code after {humanSeconds(snapshot?.payer_window ?? 86400)}, so your silence cannot block payment.</p>
                    {openStages.length === 0 ? <Notice kind="info">Every funded stage is already settling or paid.</Notice> : (
                      <>
                        <div className="grid-2">
                          <Field label="Stage">
                            <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
                              {openStages.map((id) => <option key={id} value={id}>{stageLabel(id)}</option>)}
                            </select>
                          </Field>
                          <Field label="Code" hint="Two short words read most reliably.">
                            <input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="TREE BLUE" spellCheck={false} />
                          </Field>
                        </div>
                        <div className="btn-row">
                          <button className="btn btn-secondary" onClick={() => setCode(suggestCode())}>Suggest two words</button>
                          <button className="btn btn-primary" disabled={!!busy || !code} onClick={() => void run(issue)}>Issue code <Check size={16} /></button>
                        </div>
                      </>
                    )}
                    <hr className="divider" />
                    <div className="btn-row">
                      <button className="btn btn-danger btn-sm" disabled={!!busy || snapshot?.settling} onClick={() => void run(cancel)}>Cancel the job (needs the builder too)</button>
                      {expired ? <button className="btn btn-danger btn-sm" disabled={!!busy || snapshot?.settling} onClick={() => void run(expire)}>Expire and refund me</button> : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {status && status !== "CREATED" && status !== "ACTIVE" ? (
                <Notice kind={status === "DONE" ? "ok" : "warn"} title={status === "DONE" ? "All funded stages are paid." : status === "CANCELLED" ? "This job was cancelled." : "This job expired."}>
                  {status === "DONE" ? "Nothing further to do." : "Unpaid stages were refunded to the payer."}
                </Notice>
              ) : null}

              {error ? <Notice kind="bad" title="Could not read the job.">{error}</Notice> : null}
            </>
          )}
        </div>

        <aside className="stack sticky">
          {contract && snapshot ? (
            <>
              <JobHeader contract={contract} snapshot={snapshot} />
              <StageList snapshot={snapshot} />
              <div className="card card-pad stack-sm">
                <div className="label">Send the builder this link</div>
                <CopyButton value={link} label={link.replace(/^https?:\/\//, "")} />
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => { window.localStorage.removeItem(JOB_KEY); setContract(""); }}>Use a different job</button>
              </div>
            </>
          ) : contract ? (
            <div className="card card-pad stack"><div className="skeleton" style={{ height: 22, width: "40%" }} /><div className="skeleton" style={{ height: 80 }} /><div className="skeleton" style={{ height: 160 }} /></div>
          ) : (
            <div className="card card-pad stack">
              <div className="row"><Camera size={20} /><h3 style={{ fontSize: "1.02rem" }}>What happens next</h3></div>
              <ul className="checklist">
                <li><Check size={16} /> You create a job and fund the stages you choose, in GEN.</li>
                <li><Check size={16} /> The builder shoots each stage with the code written on the work.</li>
                <li><Check size={16} /> A validator panel decides; a pass pays the builder at finality.</li>
                <li><Check size={16} /> If you go quiet, the builder can still unlock a fallback code.</li>
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
