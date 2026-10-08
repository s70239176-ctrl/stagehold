/**
 * Browser-side live-camera checks. They make it harder to pass off a still image or a looping file as
 * a camera feed. They do not authenticate the camera: the contract never sees them and a determined
 * attacker with a virtual camera that adds noise can still pass. Attested capture is the real control.
 */

const VIRTUAL = /\b(obs|virtual|manycam|xsplit|splitcam|vcam|snap camera|screen capture|ndi)\b/i;

/** True when the camera's own name says it is software, not a sensor. */
export const looksVirtual = (label: string): boolean => VIRTUAL.test(label);

/** Mean absolute difference (0-255) between two equally sized grayscale buffers. */
export function meanAbsDiff(a: Uint8ClampedArray | Uint8Array, b: Uint8ClampedArray | Uint8Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i]! - b[i]!);
  return sum / n;
}

/** A real sensor never produces two identical frames in a row; a still image or a stuck feed does. */
export const MIN_SENSOR_NOISE = 0.05;
export const frozen = (diffs: number[]): boolean => diffs.length === 0 || Math.max(...diffs) < MIN_SENSOR_NOISE;

function gray(video: HTMLVideoElement): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 48;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const g = new Uint8ClampedArray(c.width * c.height);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) g[p] = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
  return g;
}

/** Watches the stream for about a second; throws a plain-language reason if it does not look live. */
export async function assertLive(video: HTMLVideoElement): Promise<void> {
  const stream = video.srcObject as MediaStream | null;
  const track = stream?.getVideoTracks()[0];
  if (!track || track.readyState !== "live") throw new Error("The camera stopped. Start it again.");
  if (looksVirtual(track.label)) throw new Error(`"${track.label}" looks like a software camera. Use the device's own camera.`);
  const frames: Uint8ClampedArray[] = [];
  for (let i = 0; i < 6; i++) {
    frames.push(gray(video));
    await new Promise((r) => setTimeout(r, 220));
  }
  const diffs = frames.slice(1).map((f, i) => meanAbsDiff(frames[i]!, f));
  if (frozen(diffs)) throw new Error("The picture is not changing, so it does not look like a live camera. Hold the device in your hands and try again.");
}
