/**
 * The one GenLayer client file. Everything that talks to the Intelligent Contract goes through here.
 * Nothing in this app decides a verdict: the page sends what the contract asks for and shows what it
 * answers. The hosted RPC allows about 30 requests a minute per client, so reads are batched
 * (get_snapshot) and transaction polling is slow.
 */
import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { Hash } from "genlayer-js/types";
import type { AttemptView, Snapshot, TxOutcome } from "./types.ts";
import { fromB64 } from "./crypto.ts";

type Hex = `0x${string}`;
type RawRequest = { request: (a: { method: string; params: unknown[] }) => Promise<unknown> };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const freshPrivateKey = (): string => generatePrivateKey();
export const addressOf = (key: string): string => createAccount(key as Hex).address;

function clientFor(key?: string) {
  return createClient({ chain: studionet, account: key ? createAccount(key as Hex) : undefined });
}

/** Retries rate limits and network blips; anything else is a real error and is rethrown. */
async function paced<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const text = `${e instanceof Error ? e.message : String(e)} ${safeJson((e as { cause?: unknown })?.cause)}`;
      const m = text.match(/retry_after_seconds\D+(\d+)/);
      if (text.includes("-32029") || m) {
        await sleep(((m ? Number(m[1]) : 20) + 2) * 1000);
        continue;
      }
      if (/fetch failed|Failed to fetch|NetworkError|ECONNRESET|ETIMEDOUT|<html|502|503|504/i.test(text)) {
        await sleep((6 + attempt * 5) * 1000);
        continue;
      }
      throw e;
    }
  }
  throw new Error("The network kept failing. Try again in a minute.");
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)) ?? "";
  } catch {
    return "";
  }
}

export async function readSnapshot(contract: string): Promise<Snapshot> {
  const raw = await paced(() =>
    clientFor().readContract({ address: contract as Hex, functionName: "get_snapshot", args: [] }),
  );
  return JSON.parse(String(raw)) as Snapshot;
}

export async function readAttempt(contract: string, stage: string, n: number): Promise<AttemptView | null> {
  const raw = await paced(() =>
    clientFor().readContract({ address: contract as Hex, functionName: "get_attempt", args: [stage, BigInt(n)] }),
  );
  const text = String(raw);
  return text ? (JSON.parse(text) as AttemptView) : null;
}

const TERMINAL = new Set(["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"]);

const DEAD_TEXT: Record<string, string> = {
  UNDETERMINED: "The validators could not agree, so nothing was recorded and nothing was charged. You can try again.",
  CANCELED: "The transaction was cancelled before it ran. Nothing changed.",
  LEADER_TIMEOUT: "The lead validator timed out. Nothing changed. Try again.",
  VALIDATORS_TIMEOUT: "The validators timed out. Nothing changed. Try again.",
};

interface RawTx {
  status?: string;
  result_name?: string;
  consensus_data?: { leader_receipt?: Array<{ mode?: string; execution_result?: string; result?: unknown }> };
}

/** The contract's own revert text, decoded from the leader's receipt (a revert still shows as ACCEPTED). */
function revertText(tx: RawTx): string | undefined {
  const receipts = tx.consensus_data?.leader_receipt;
  const leader = receipts?.find((r) => r.mode === "leader") ?? receipts?.[0];
  if (!leader || leader.execution_result !== "ERROR") return undefined;
  const res = leader.result;
  const payload = typeof res === "string" ? res : (res as { payload?: string } | undefined)?.payload;
  if (!payload) return "The contract refused the call.";
  try {
    const bytes = fromB64(payload);
    return new TextDecoder().decode(bytes.subarray(bytes[0] !== undefined && bytes[0] <= 8 ? 1 : 0));
  } catch {
    return "The contract refused the call.";
  }
}

export type Phase = "signing" | "pending" | "done";

/** Send a write, follow it until the network settles it, and return the contract's own answer. */
export async function sendTx(
  key: string,
  contract: string,
  functionName: string,
  args: unknown[],
  value = 0n,
  onPhase?: (p: Phase, detail?: string) => void,
): Promise<TxOutcome> {
  const client = clientFor(key);
  onPhase?.("signing");
  const hash = await paced(() =>
    client.writeContract({ address: contract as Hex, functionName, args: args as never, value }),
  );
  onPhase?.("pending");
  const started = Date.now();
  while (Date.now() - started < 15 * 60 * 1000) {
    await sleep(6000);
    const tx = (await paced(() =>
      (client as unknown as RawRequest).request({ method: "eth_getTransactionByHash", params: [hash] }),
    )) as RawTx | null;
    const status = tx?.status ?? "PENDING";
    onPhase?.("pending", status);
    if (TERMINAL.has(status)) {
      onPhase?.("done", status);
      const error = (tx && revertText(tx)) ?? DEAD_TEXT[status];
      return { hash, status, resultName: tx?.result_name, error };
    }
  }
  return { hash, status: "TIMEOUT", error: "Still waiting after 15 minutes. Check the status page later." };
}

/** Deploy one job contract from the bundled source (npm run sync-contract copies it to /public). */
export async function deployJob(
  key: string,
  builder: string,
  feeUnits: bigint,
  expiresInSeconds: bigint,
  /** A TEST job (dev_mode) may use short windows; its snapshot says dev_mode and the pages label it. */
  test: { payerWindowSeconds: number } | null,
  onPhase?: (p: Phase, detail?: string) => void,
): Promise<string> {
  const code = await (await fetch("/stagehold.py")).text();
  if (!code.includes("class Stagehold")) throw new Error("The contract source is missing; run npm run sync-contract.");
  const client = clientFor(key);
  onPhase?.("signing");
  const hash = await paced(() =>
    client.deployContract({
      code,
      // builder, fee, expires_in, app_package, app_sig_digest, align_min_permille, dev_mode, payer_window_s, software_keys
      args: [builder, feeUnits, expiresInSeconds, "", "", 0n, test !== null, BigInt(test?.payerWindowSeconds ?? 86400), true] as never,
    }),
  );
  onPhase?.("pending");
  const receipt = await paced(() =>
    client.waitForTransactionReceipt({ hash: hash as Hash, status: TransactionStatus.ACCEPTED, retries: 120, interval: 8000 }),
  );
  onPhase?.("done");
  const r = receipt as { data?: { contract_address?: string }; txDataDecoded?: { contractAddress?: string } };
  const address = r?.data?.contract_address ?? r?.txDataDecoded?.contractAddress;
  if (!address) throw new Error("The network did not return a contract address.");
  return address;
}
