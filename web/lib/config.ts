export const RPC_URL = process.env.NEXT_PUBLIC_GENLAYER_RPC ?? "https://studio.genlayer.com/api";
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://explorer-studio.genlayer.com";

/** Size caps the contract enforces (contracts/src/body.py). The page guarantees them before submitting. */
export const MAX_JPEG = 150 * 1024;
export const MAX_THUMB = 30 * 1024;

export const STAGES: ReadonlyArray<{ id: string; label: string; brief: string }> = [
  { id: "ring_beam", label: "Ring beam", brief: "A continuous reinforced concrete beam along the top of the walls." },
  { id: "blockwork", label: "Blockwork to lintel", brief: "Walls built in blocks up to the height of the openings' lintels." },
  { id: "roof", label: "Roof", brief: "Roof covering over the full roof, continuous ridge, no open sky." },
  { id: "openings", label: "Openings set", brief: "Door and window frames installed in every opening." },
  { id: "plaster", label: "One wall plastered", brief: "At least one full wall face plastered over its whole visible face." },
];

export const stageLabel = (id: string): string => STAGES.find((s) => s.id === id)?.label ?? id;

/** "24 hours", "40 seconds": the job's own payer window, so test jobs are described truthfully. */
export function humanSeconds(s: number): string {
  if (s % 3600 === 0) return `${s / 3600} hour${s === 3600 ? "" : "s"}`;
  if (s % 60 === 0) return `${s / 60} minute${s === 60 ? "" : "s"}`;
  return `${s} seconds`;
}

export const when = (unix: number): string =>
  new Date(unix * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export const CAPTURE_NOTICE =
  "Web capture is live-camera only (no gallery uploads, software cameras and frozen feeds are refused) but is not device-attested, so a determined faker could still get through. Attested capture arrives with the mobile app before mainnet.";
