import Link from "next/link";
import { Arrow, Check, Clock, Eye, Layers, Lock, Shield, Users } from "../components/icons.tsx";

function HeroArt() {
  return (
    <div className="hero-art pop">
      <svg viewBox="0 0 480 360" role="img" aria-label="A building in five stages: blockwork, openings, plaster, ring beam and roof">
        <defs>
          <linearGradient id="wall" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1b222a" />
            <stop offset="1" stopColor="#12171d" />
          </linearGradient>
        </defs>
        <line x1="30" y1="318" x2="450" y2="318" stroke="#2e3844" strokeWidth="2" />
        {/* walls with block courses */}
        <rect x="90" y="160" width="300" height="158" fill="url(#wall)" stroke="#2e3844" strokeWidth="2" />
        {[190, 220, 250, 280].map((y) => <line key={y} x1="90" x2="390" y1={y} y2={y} stroke="#222b35" strokeWidth="1.5" />)}
        {/* plastered face */}
        <rect x="262" y="161" width="127" height="156" fill="#232c36" opacity="0.7" />
        {/* openings */}
        <rect x="118" y="206" width="58" height="48" rx="3" fill="#0b0e12" stroke="#86b8ff" strokeWidth="2" />
        <path d="M147 206v48M118 230h58" stroke="#86b8ff" strokeWidth="1.5" opacity="0.6" />
        <rect x="204" y="236" width="52" height="82" rx="3" fill="#0b0e12" stroke="#86b8ff" strokeWidth="2" />
        <rect x="296" y="206" width="58" height="48" rx="3" fill="#0b0e12" stroke="#86b8ff" strokeWidth="2" />
        <path d="M325 206v48M296 230h58" stroke="#86b8ff" strokeWidth="1.5" opacity="0.6" />
        {/* ring beam */}
        <rect x="80" y="146" width="320" height="16" rx="2" fill="rgba(110,231,183,0.16)" stroke="#6ee7b7" strokeWidth="2" />
        {/* roof */}
        <path d="M64 148L240 52 416 148" fill="rgba(110,231,183,0.06)" stroke="#6ee7b7" strokeWidth="3" strokeLinejoin="round" />
        <path d="M240 52v96" stroke="#6ee7b7" strokeWidth="1.5" opacity="0.5" />
        {/* the code written on the work */}
        <text x="140" y="298" fill="#f5c26b" fontFamily="ui-monospace, Menlo, monospace" fontSize="17" fontWeight="700" letterSpacing="2.4" transform="rotate(-2 140 298)">TREE BLUE</text>
        {/* verdict chips */}
        <g transform="translate(300 292)">
          <rect width="150" height="34" rx="17" fill="#0e1318" stroke="rgba(110,231,183,0.45)" />
          <circle cx="19" cy="17" r="9" fill="#6ee7b7" />
          <path d="M14.5 17.2l3.1 3.1 5.4-5.8" fill="none" stroke="#04130c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <text x="36" y="22" fill="#eef2f5" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="13" fontWeight="650">Panel accepted</text>
        </g>
      </svg>
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <span className="badge badge-ok"><Check size={12} /> Blockwork</span>
        <span className="badge badge-ok"><Check size={12} /> Openings</span>
        <span className="badge badge-ok"><Check size={12} /> Ring beam</span>
        <span className="badge badge-warn"><Clock size={12} /> Roof settling</span>
        <span className="badge">Plaster</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <div className="container hero">
        <div>
          <span className="eyebrow">Built on GenLayer</span>
          <h1>
            Pay for what a panel can <em>see</em>.
          </h1>
          <p className="lede">
            Stagehold releases a construction payment one stage at a time, judged from a photograph by validators that neither the
            payer nor the builder chose.
          </p>
          <div className="btn-row hero-cta">
            <Link className="btn btn-primary btn-lg" href="/payer">
              Start as payer <Arrow size={18} />
            </Link>
            <Link className="btn btn-secondary btn-lg" href="/builder">
              Start as builder
            </Link>
          </div>
          <div className="hero-meta">
            <span><Lock size={16} /> Funds held in a GEN escrow contract</span>
            <span><Users size={16} /> No inspector to hire or trust</span>
            <span><Shield size={16} /> Paid even if the payer goes quiet</span>
          </div>
        </div>
        <HeroArt />
      </div>

      <section className="section" id="how">
        <div className="container">
          <span className="eyebrow">How it works</span>
          <h2>One stage, one photograph, one decision.</h2>
          <p className="sub">Each stage of the building is funded separately. A stage pays only when the panel agrees the stage is complete and the code is written on the work.</p>
          <ol className="flow">
            <li><h3>Anchor the site</h3><p>The payer stores a small reference photo of the real site on-chain. The builder never supplies the first reference.</p></li>
            <li><h3>Issue a code</h3><p>A short code, valid for six hours, is written on the work. If the payer is silent, the builder can unlock a fallback code.</p></li>
            <li><h3>Shoot and sign</h3><p>The builder photographs the stage with the code visible. The frame is signed together with the stage, the code and the deadline.</p></li>
            <li><h3>The panel decides</h3><p>Independent validators answer two questions. If they agree, the builder is paid when the result is final.</p></li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <span className="eyebrow">Why a panel</span>
          <h2>Neither side is allowed to be the judge.</h2>
          <div className="grid-3" style={{ marginTop: 30 }}>
            <div className="feature">
              <div className="ico"><Layers size={20} /></div>
              <h3>Different models, chosen by the protocol</h3>
              <p>GenLayer selects the validators for every transaction, each running its own model. A photo tuned to one known model does not carry over.</p>
            </div>
            <div className="feature">
              <div className="ico"><Eye size={20} /></div>
              <h3>Text in the picture is scenery</h3>
              <p>A sign that says &ldquo;approve&rdquo; changes nothing. The panel answers two fixed questions about the stage and the code, never anything the photo tells it to.</p>
            </div>
            <div className="feature">
              <div className="ico"><Clock size={20} /></div>
              <h3>Silence cannot block payment</h3>
              <p>There is no release button. A passing result is paid when it is final, and a missing payer cannot hold the code hostage.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <span className="eyebrow">Limits, stated plainly</span>
          <h2>What Stagehold does not do.</h2>
          <div className="grid-3" style={{ marginTop: 30 }}>
            <div className="feature">
              <h3>It cannot verify the camera</h3>
              <p>The web version cannot prove a photograph came from a live camera. An attested mobile capture app is planned before real value is used.</p>
            </div>
            <div className="feature">
              <h3>A photograph is not title</h3>
              <p>It shows what is visible. It says nothing about who owns the land, what materials were used or what is inside a wall.</p>
            </div>
            <div className="feature">
              <h3>Studionet GEN has no market value</h3>
              <p>The contract holds and pays native GEN exactly as it would on a live network, but this network is a development environment.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
