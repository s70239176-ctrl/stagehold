import Link from "next/link";
import { Arrow } from "../components/icons.tsx";
import { Plate } from "../components/Plate.tsx";
import { Reveal } from "../components/Reveal.tsx";
import { Escrow, Evidence, Method, Panel, Schedule } from "../components/landing.tsx";

function Band({ a, title, b }: { a: string; title: string; b: string }) {
  return (
    <div className="container">
      <div className="band-head">
        <span className="label-t">{a}</span>
        <span className="ttl">{title}</span>
        <span className="label-t">{b}</span>
      </div>
    </div>
  );
}

const LIMITS = [
  ["Camera", "Web capture takes live-camera frames only and refuses software cameras and frozen feeds, but it is not device-attested. An attested mobile app is planned before mainnet."],
  ["Evidence", "A photograph shows what is visible. It says nothing about who owns the land, what materials were used or what is inside a wall."],
  ["Network", "Studionet is a development network. The contract holds and pays native GEN exactly as it would elsewhere, but this GEN has no market value."],
] as const;

export default function Home() {
  return (
    <main>
      <div className="container hero">
        <div className="hero-copy">
          <span className="eyebrow"><i className="tick" />Construction payment protocol / 2026</span>
          <h1 aria-label="Payment follows proof.">
            <span aria-hidden="true"><i>Payment</i></span>
            <span aria-hidden="true"><i>follows</i></span>
            <span aria-hidden="true"><i>proof.</i></span>
          </h1>
          <p className="lede">Construction payments held in escrow and released stage by stage, only when independent validators can see the work.</p>
          <div className="btn-row hero-cta">
            <Link className="btn btn-primary btn-lg" href="/payer"><span>Start a project</span> <Arrow size={16} /></Link>
            <Link className="btn btn-secondary btn-lg" href="/#method"><span>Explore the protocol</span> <Arrow size={16} /></Link>
          </div>
        </div>
        <div className="hero-plate">
          <Reveal className="mask">
            <div className="plate">
              <Plate active="ring_beam" />
              <div className="plate-cap">
                <div><span className="label-t muted">Project</span><b>Sample</b></div>
                <div><span className="label-t muted">Stage</span><b>03</b></div>
                <div><span className="label-t muted">Element</span><b>Ring beam</b></div>
                <div><span className="label-t muted">Year</span><b>2026</b></div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <section className="band">
        <Band a="01 / Method" title="The Stagehold method" b="Build → Release" />
        <div className="container">
          <Reveal><h2 className="display" style={{ padding: "56px 0 8px", maxWidth: "14ch" }}>Four steps. No inspector.</h2></Reveal>
          <Method />
        </div>
      </section>

      <section className="band" id="schedule">
        <Band a="02 / Schedule" title="A project, stage by stage" b="Sample project" />
        <div className="container" style={{ padding: "56px 0 72px" }}>
          <Reveal><h2 className="display" style={{ marginBottom: 36, maxWidth: "16ch" }}>Five stages. Each one earns its payment.</h2></Reveal>
          <Schedule />
        </div>
      </section>

      <section className="band">
        <Band a="03 / Evidence" title="What the validators are given" b="Illustrative" />
        <div className="container" style={{ padding: "56px 0 72px" }}>
          <Reveal><h2 className="display" style={{ marginBottom: 36, maxWidth: "15ch" }}>One photograph, tied to one stage.</h2></Reveal>
          <Reveal className="mask"><Evidence /></Reveal>
          <p className="ink2" style={{ marginTop: 22, maxWidth: "64ch" }}>The frame comes from the live camera with the code written on the work, signed with the stage, the code and the deadline. Text inside the picture is treated as scenery: a sign that says &ldquo;approve&rdquo; changes nothing.</p>
        </div>
      </section>

      <section className="band" id="protocol">
        <Band a="04 / Protocol" title="Independent verification" b="Panel" />
        <div className="container" style={{ padding: "56px 0 72px" }}>
          <Reveal><h2 className="display" style={{ marginBottom: 36, maxWidth: "16ch" }}>The builder does not approve themselves.</h2></Reveal>
          <Panel />
          <div className="not-list">
            <div><span className="label-t muted">Builder</span><p style={{ marginTop: 6 }}><s>Approves the stage</s></p></div>
            <div><span className="label-t muted">Payer</span><p style={{ marginTop: 6 }}><s>Withholds the payment</s></p></div>
            <div><span className="label-t" style={{ color: "var(--accent)" }}>Validators</span><p style={{ marginTop: 6 }}>Decide, by consensus</p></div>
          </div>
          <p className="label-t muted" style={{ marginTop: 16 }}>Illustration of a 3 of 3 outcome. The panel size and the models are set by GenLayer for each transaction.</p>
        </div>
      </section>

      <section className="band">
        <Band a="05 / Escrow" title="Capital follows completion" b="GEN" />
        <div className="container" style={{ padding: "56px 0 72px" }}>
          <Reveal><h2 className="display" style={{ marginBottom: 36, maxWidth: "12ch" }}>Capital follows completion.</h2></Reveal>
          <Escrow />
        </div>
      </section>

      <section className="band">
        <Band a="06 / Limits" title="Stated plainly" b="" />
        <div className="container">
          <div className="grid-3" style={{ padding: "40px 0 72px", gap: 0 }}>
            {LIMITS.map(([k, v]) => (
              <div key={k} style={{ padding: "22px 24px", borderLeft: "1px solid var(--line-strong)" }}>
                <span className="label-t" style={{ color: "var(--accent)" }}>{k}</span>
                <p className="ink2" style={{ marginTop: 10 }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container endcap">
          <div>
            <span className="eyebrow"><i className="tick" />Project complete</span>
            <h2 style={{ marginTop: 26 }}>Build it. Show it. Get paid.</h2>
            <div className="btn-row">
              <Link className="btn btn-primary btn-lg" href="/payer"><span>Start a project</span> <Arrow size={16} /></Link>
              <Link className="btn btn-secondary btn-lg" href="/builder"><span>I am the builder</span> <Arrow size={16} /></Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
