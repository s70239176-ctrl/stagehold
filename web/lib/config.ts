export const RPC_URL = process.env.NEXT_PUBLIC_GENLAYER_RPC ?? "https://studio.genlayer.com/api";
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://explorer-studio.genlayer.com";

/** Size caps the contract enforces (contracts/src/body.py). The page guarantees them before submitting. */
export const MAX_JPEG = 150 * 1024;
export const MAX_THUMB = 30 * 1024;

export const STAGES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "ring_beam", label: "Ring beam" },
  { id: "blockwork", label: "Blockwork to lintel" },
  { id: "roof", label: "Roof" },
  { id: "openings", label: "Openings set" },
  { id: "plaster", label: "One wall plastered" },
];

export const stageLabel = (id: string): string => STAGES.find((s) => s.id === id)?.label ?? id;

/** "24 hours", "40 seconds": the job's own payer window, so test jobs are described truthfully. */
export function humanSeconds(s: number): string {
  if (s % 3600 === 0) return `${s / 3600} hour${s === 3600 ? "" : "s"}`;
  if (s % 60 === 0) return `${s / 60} minute${s === 60 ? "" : "s"}`;
  return `${s} seconds`;
}

export const WEB_MODE_WARNING =
  "WEB MODE: this page cannot prove a photo came from a live camera. A gallery photo or an AI-generated image " +
  "cannot be told apart from a live frame. Play money only.";
