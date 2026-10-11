"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check } from "../../components/icons.tsx";
import { Notice } from "../../components/ui.tsx";
import { assertLive } from "../../lib/liveness.ts";
import { cameraProblem, encodeFrame, frameThumbnail, grabFrame, startCamera } from "../../lib/capture.ts";

/** Try the live camera without a job: shows exactly what a builder's shot looks like after encoding. */
export default function CameraCheck() {
  const video = useRef<HTMLVideoElement | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const [on, setOn] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState("");
  const [shot, setShot] = useState<{ url: string; jpeg: number; thumb: number; w: number; h: number } | null>(null);

  useEffect(() => () => stop.current?.(), []);

  async function begin(f = facing) {
    if (!video.current) return;
    stop.current?.();
    setError("");
    try {
      stop.current = await startCamera(video.current, f);
      setFacing(f);
      setOn(true);
    } catch (e) {
      setOn(false);
      setError(e instanceof Error ? e.message : cameraProblem(e));
    }
  }

  async function snap() {
    if (!video.current) return;
    try {
      await assertLive(video.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    setError("");
    const canvas = grabFrame(video.current);
    const jpeg = await encodeFrame(canvas);
    const thumb = await frameThumbnail(jpeg);
    if (shot) URL.revokeObjectURL(shot.url);
    setShot({ url: URL.createObjectURL(new Blob([jpeg as BlobPart], { type: "image/jpeg" })), jpeg: jpeg.length, thumb: thumb.length, w: canvas.width, h: canvas.height });
  }

  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <div className="stack">
        <div className="stack-sm">
          <span className="eyebrow">Camera check</span>
          <h1 style={{ fontSize: "1.9rem" }}>Try the live camera</h1>
          <p className="ink2">The builder page takes its picture from this same camera view; it never accepts a file from the gallery. Nothing here is sent anywhere or written to the chain.</p>
        </div>
        <div className="viewfinder">
          <video ref={video} playsInline muted style={{ display: on && !shot ? "block" : "none" }} />
          {shot ? <img src={shot.url} alt="The encoded frame" /> : null}
          {!on && !shot ? <div className="vf-empty"><Camera size={30} /><span>The camera is off</span></div> : null}
          {on || shot ? <div className="grid-lines" /> : null}
        </div>
        {error ? <Notice kind="bad" title="The camera could not start.">{error}</Notice> : null}
        <div className="btn-row">
          {!on ? (
            <button className="btn btn-primary" onClick={() => void begin()}><Camera size={16} /> Start camera</button>
          ) : shot ? (
            <button className="btn btn-secondary" onClick={() => setShot(null)}>Retake</button>
          ) : (
            <>
              <button className="shutter" aria-label="Take picture" onClick={() => void snap()} />
              <button className="btn btn-ghost btn-sm" onClick={() => void begin(facing === "environment" ? "user" : "environment")}>Switch camera</button>
            </>
          )}
        </div>
        {shot ? (
          <div className="card"><div className="card-body stack-sm">
            <div className="row"><Check size={16} /><strong>Frame ready</strong></div>
            <p className="ink2 small">Live check passed (software cameras and frozen feeds are refused). {shot.w}×{shot.h} captured. Encoded for the contract: {(shot.jpeg / 1024).toFixed(0)} KB JPEG (limit 150 KB) and a {(shot.thumb / 1024).toFixed(0)} KB grayscale thumbnail (limit 30 KB).</p>
          </div></div>
        ) : null}
        <p className="hint">Ready? <Link href="/builder">Go to the builder page</Link>. The camera card appears once a job link is open and this browser is registered.</p>
      </div>
    </main>
  );
}
