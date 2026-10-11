export interface StageView {
  status: "OPEN" | "SETTLING" | "PAID";
  funded: string;
  attempts: number;
  code: string;
  code_deadline: number;
  request_at: number;
  settle_at?: number;
}

/** What `get_snapshot` returns (one batched read keeps us under the hosted RPC's request limit). */
export interface Snapshot {
  status: "CREATED" | "ACTIVE" | "CANCELLED" | "EXPIRED" | "DONE";
  settling: boolean;
  payer: string;
  builder: string;
  fee: string;
  expires_at: number;
  payer_window?: number;
  dev_mode: boolean;
  software_keys: boolean;
  capture_attested: boolean;
  alignment_enforced: boolean;
  anchor_hash: string;
  keys: number;
  payer_deposit: string;
  builder_credits: string;
  stages: Record<string, StageView>;
  closed_at?: number;
  surplus?: string;
  settle_retry?: number;
  settle_force?: number;
  surplus_delay?: number;
}

/** The three results the builder sees. The model's explanation is never shown. */
export interface AttemptView {
  stage_met: "yes" | "no" | "unclear";
  code_visible: "yes" | "no" | "unclear";
  site_aligned: boolean;
  paid: boolean;
  attempt: number;
}

export interface TxOutcome {
  hash: string;
  status: string;
  resultName?: string;
  /** The contract's own revert text, if the transaction ended in an execution error. */
  error?: string;
}
