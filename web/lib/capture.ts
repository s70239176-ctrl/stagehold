/**
 * Browser camera and image encoding. The frame comes from a live camera stream, never from a file picker
 * (that raises the effort of passing off a gallery photo, but does not authenticate the camera: a virtual
 * camera or a screen can still be pointed at the page, and the contract says so).
 * The encoders guarantee the contract's size caps before anything is submitted.
 */
import { MAX_JPEG, MAX_THUMB } from "./config.ts";

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(16, Math.round(w));
  c.height = Math.max(16, Math.round(h));
  return c;
}

function blobOf(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error("could not encode the image"))),
      type,
      quality,
    ),
  );
}

function scaledCopy(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const c = canvasOf(src.width * factor, src.height * factor);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function toLongEdge(src: HTMLCanvasElement, longEdge: number): HTMLCanvasElement {
  const current = Math.max(src.width, src.height);
  return current <= longEdge ? src : scaledCopy(src, longEdge / current);
}

/** JPEG of at most 150 KB: lower the quality first, then shrink, until it fits. */
export async function encodeFrame(src: HTMLCanvasElement): Promise<Uint8Array> {
  let canvas = toLongEdge(src, 1280);
  let quality = 0.8;
  for (let i = 0; i < 40; i++) {
    const data = await blobOf(canvas, "image/jpeg", quality);
    if (data.length <= MAX_JPEG) return data;
    if (quality > 0.4) quality -= 0.05;
    else {
      canvas = scaledCopy(canvas, 0.88);
      quality = 0.7;
    }
  }
  throw new Error("could not fit the frame under the size limit");
}

/** Grayscale PNG with a 160 px long edge, at most 30 KB (alignment input, and the payer's anchor). */
export async function thumbnailPng(src: HTMLCanvasElement): Promise<Uint8Array> {
  let canvas = toLongEdge(src, 160);
  for (let i = 0; i < 20; i++) {
    const copy = canvasOf(canvas.width, canvas.height);
    const ctx = copy.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0);
    const img = ctx.getImageData(0, 0, copy.width, copy.height);
    const d = img.data;
    for (let p = 0; p < d.length; p += 4) {
      const g = Math.round(0.299 * d[p]! + 0.587 * d[p + 1]! + 0.114 * d[p + 2]!);
      d[p] = d[p + 1] = d[p + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
    const data = await blobOf(copy, "image/png");
    if (data.length <= MAX_THUMB) return data;
    canvas = scaledCopy(canvas, 0.85);
  }
  throw new Error("could not fit the thumbnail under the size limit");
}

/** Why a camera cannot start, in words a builder can act on. */
export function cameraProblem(e: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext)
    return "Browsers only allow the camera on a secure (https) page. Open the site over https.";
  if (!navigator.mediaDevices?.getUserMedia) return "This browser has no camera access. Try Chrome, Safari or Firefox.";
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError") return "Camera permission was refused. Allow the camera for this site in the browser's address bar, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "Another app is using the camera. Close it and try again.";
  return e instanceof Error ? e.message : String(e);
}

/** Opens a camera in a <video> element (rear by default, or "user" for the front one). Returns a stop function. */
export async function startCamera(video: HTMLVideoElement, facing: "environment" | "user" = "environment"): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error(cameraProblem(null));
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  } catch (e) {
    // some desktops reject the size hints; retry with any camera
    if ((e as { name?: string })?.name === "OverconstrainedError") stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    else throw new Error(cameraProblem(e));
  }
  video.srcObject = stream;
  await video.play();
  return () => stream.getTracks().forEach((t) => t.stop());
}

/** One frame from the live stream. */
export function grabFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const c = canvasOf(video.videoWidth, video.videoHeight);
  c.getContext("2d")!.drawImage(video, 0, 0);
  return c;
}

/** The payer's anchor: any photo file is shrunk to the same grayscale thumbnail the contract expects. */
export async function anchorFromFile(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const c = canvasOf(bitmap.width, bitmap.height);
  c.getContext("2d")!.drawImage(bitmap, 0, 0);
  return thumbnailPng(c);
}
