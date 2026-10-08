"use client";
import { useEffect, useRef, useState } from "react";
import { Plate, type PlateOverlay, type PlateStage } from "./Plate.tsx";
import { useInView } from "./Reveal.tsx";

/* ------------------------------------------------------------------ method */
const STEPS: Array<{ n: string; word: string; text: string; stage: PlateStage; overlay: PlateOverlay; code?: string }> = [
  { n: "01", word: "Build", text: "The payer funds each stage into a GEN escrow contract and stores one small reference photo of the real site. The builder works toward the first stage.", stage: "ring_beam", overlay: "none" },
  { n: "02", word: "Capture", text: "A short code is written on the work. The builder photographs the stage live, with the code in frame. The frame is signed together with the stage, the code and the deadline.", stage: "ring_beam", overlay: "capture", code: "TREE BLUE" },
  { n: "03", word: "Verify", text: "Validators chosen by the network, each running its own model, answer two fixed questions: is the stage complete, and is the code written on the work. Neither side picks them.", stage: "ring_beam", overlay: "verify", code: "TREE BLUE" },
  { n: "04", word: "Release", text: "When the result is final, the contract pays the builder. There is no release button, and a silent payer cannot hold the payment.", stage: "ring_beam", overlay: "release" },
];

export function Method() {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i)); }),
      { rootMargin: "-40% 0px -40% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const cur = STEPS[active]!;
  return (
    <div className="method" id="method">
      <div className="method-steps">
        {STEPS.map((s, i) => (
          <div key={s.n} className="mstep" data-i={i} data-active={active === i} ref={(el) => { refs.current[i] = el; }}>
            <span className="n">{s.n} / 04</span>
            <h3>{s.word}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </div>
      <div className="method-visual">
        <div className="plate">
          <Plate active={cur.stage} overlay={cur.overlay} code={cur.code} />
          <div className="plate-cap">
            <div><span className="label-t muted">Step</span><b>{cur.n}</b></div>
            <div><span className="label-t muted">Stage</span><b>Ring beam</b></div>
            <div><span className="label-t muted">State</span><b>{cur.word}</b></div>
            <div><span className="label-t muted">Sample</span><b>Illustrative</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- schedule */
const ROWS: Array<{ n: string; name: string; state: "verified" | "verifying" | "locked"; w: string; label: string }> = [
  { n: "01", name: "Blockwork to lintel", state: "verified", w: "100%", label: "✓ Verified" },
  { n: "02", name: "Ring beam", state: "verified", w: "100%", label: "✓ Verified" },
  { n: "03", name: "Roof", state: "verifying", w: "72%", label: "◉ Verifying" },
  { n: "04", name: "Openings set", state: "locked", w: "0%", label: "○ Locked" },
  { n: "05", name: "One wall plastered", state: "locked", w: "0%", label: "○ Locked" },
];

export function Schedule() {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  return (
    <div className="schedule" ref={ref}>
      {ROWS.map((r, i) => (
        <div key={r.n} className="srow" data-state={r.state} data-in={seen} style={{ ["--w" as string]: r.w }}>
          <span className="sn">{r.n}</span>
          <span className="sname">{r.name}</span>
          <span className="bar"><i style={{ transitionDelay: `${i * 220}ms` }} /></span>
          <span className={`sstate ${r.state}`}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- evidence */
export function Evidence() {
  return (
    <div className="evidence">
      <Plate active="roof" wide code="TREE BLUE" />
      <div className="scan" />
      <div className="ev-meta">
        <div><span className="label-t muted">Stage</span><b>Roof</b></div>
        <div><span className="label-t muted">Code on the work</span><b>TREE BLUE</b></div>
        <div><span className="label-t muted">Frame</span><b>Signed, live camera</b></div>
        <div><span className="label-t muted">Timestamp</span><b>Inside the code window</b></div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ panel */
export function Panel() {
  const [ref, seen] = useInView<HTMLDivElement>(0.4);
  return (
    <div className="panel3" ref={ref} data-on={seen}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="pv">
          <div>
            <span className="label-t muted">Validator 0{i}</span>
            <div className="label-t muted" style={{ marginTop: 6 }}>Own model, own run</div>
          </div>
          <div className="verd">Pass</div>
          <div className="tag" />
        </div>
      ))}
      <div className="pconsensus">
        <div><span className="label-t muted">Consensus</span></div>
        <div className="big">3 / 3</div>
        <div className="label-t" style={{ color: "var(--green)" }}>Verified. Payment released at finality.</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- escrow */
const ESC = [
  { nm: "Blockwork to lintel", am: 2000 },
  { nm: "Ring beam", am: 2000 },
  { nm: "Roof", am: 2000 },
  { nm: "Openings set", am: 2000 },
  { nm: "One wall plastered", am: 2000 },
] as const;
const fmt = (n: number) => n.toLocaleString("en-US");

export function Escrow() {
  const [ref, seen] = useInView<HTMLDivElement>(0.35);
  const [phase, setPhase] = useState<"idle" | "verifying" | "moving" | "released">("idle");
  const timers = useRef<number[]>([]);
  function play() {
    timers.current.forEach(clearTimeout);
    setPhase("verifying");
    timers.current = [window.setTimeout(() => setPhase("moving"), 1500), window.setTimeout(() => setPhase("released"), 3000)];
  }
  useEffect(() => {
    if (seen) play();
    return () => timers.current.forEach(clearTimeout);
  }, [seen]);
  const done = phase === "released";
  const released = 4000 + (done ? 2000 : 0);
  const rowState = (i: number) => (i < 2 ? "released" : i === 2 ? (done ? "released" : phase === "moving" ? "moving" : "locked") : "locked");
  const stText = (i: number) => {
    const s = rowState(i);
    return s === "released" ? "Released" : s === "moving" ? "Releasing" : i === 2 && phase === "verifying" ? "Verifying" : "Locked";
  };
  return (
    <div ref={ref}>
      <div className="escrow">
        <div className="escrow-total">
          <span className="label-t muted">Total escrow / sample</span>
          <div className="amt">10,000</div>
          <span className="label-t" style={{ color: "var(--accent)" }}>GEN</span>
          <p className="ink2" style={{ marginTop: 22, maxWidth: "30ch" }}>Each stage is funded up front and is released only by the stage&rsquo;s own verified result.</p>
        </div>
        <div className="escrow-list">
          {ESC.map((e, i) => (
            <div className="erow" key={e.nm} data-s={rowState(i)}>
              <span className="nm">{e.nm}</span>
              <span className="am">{fmt(e.am)}</span>
              <span className="st">{stText(i)}</span>
            </div>
          ))}
        </div>
        <div className="flowline">
          <div data-on={!done}><span className="label-t muted">Escrow</span><b>{fmt(10000 - released)} GEN</b><i className="nodeline" /></div>
          <div data-on={phase === "moving"}><span className="label-t muted">{phase === "moving" ? "Releasing 2,000 GEN" : "Released"}</span><b>{fmt(released)} GEN</b><i className="nodeline" /></div>
          <div data-on={done}><span className="label-t muted">Builder</span><b>{fmt(released)} GEN</b><i className="nodeline" /></div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
        <span className="label-t muted">Illustration with sample figures. Studionet GEN has no market value.</span>
        <button className="btn btn-ghost btn-sm" onClick={play}><span>Replay</span></button>
      </div>
    </div>
  );
}
