/** Original line drawing of a small building in section, used as the project plate. Not a photograph. */
export type PlateStage = "ring_beam" | "blockwork" | "roof" | "openings" | "plaster" | null;
export type PlateOverlay = "none" | "capture" | "verify" | "release";

const INK = "#f2f1ed";
const DIM = "#626569";
const LINE = "#3a3e42";
const ACC = "#6bb6d8";

export function Plate({ active = null, overlay = "none", wide = false, code }: { active?: PlateStage; overlay?: PlateOverlay; wide?: boolean; code?: string }) {
  const on = (s: PlateStage) => active === s;
  const stroke = (s: PlateStage) => (on(s) ? ACC : INK);
  const fill = (s: PlateStage) => (on(s) ? "rgba(107,182,216,0.12)" : "none");
  const vb = wide ? "0 0 960 540" : "0 0 600 680";
  const g = wide ? "translate(180 -70) scale(1.1)" : undefined;
  return (
    <svg viewBox={vb} role="img" aria-label="Line drawing of a building section with the active stage highlighted" fontFamily="var(--mono), ui-monospace, monospace">
      <defs>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke={DIM} strokeWidth="1" />
        </pattern>
        <pattern id="gridp" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#ffffff" strokeOpacity="0.035" />
        </pattern>
      </defs>
      <rect width={wide ? 960 : 600} height={wide ? 540 : 680} fill="url(#gridp)" />
      <g transform={g}>
        {/* ground and foundation */}
        <line x1="40" y1="560" x2="560" y2="560" stroke={INK} strokeWidth="1.5" />
        <rect x="120" y="560" width="360" height="30" fill="url(#hatch)" stroke={LINE} />
        {/* walls: blockwork */}
        <rect x="140" y="330" width="320" height="230" fill={fill("blockwork")} stroke={stroke("blockwork")} strokeWidth="1.5" />
        {Array.from({ length: 9 }, (_, i) => 354 + i * 24).map((y) => (
          <line key={y} x1="140" x2="460" y1={y} y2={y} stroke={on("blockwork") ? ACC : LINE} strokeOpacity={on("blockwork") ? 0.6 : 1} />
        ))}
        {/* plastered face */}
        <rect x="318" y="331" width="141" height="228" fill={on("plaster") ? "rgba(107,182,216,0.14)" : "rgba(242,241,237,0.04)"} stroke={on("plaster") ? ACC : "none"} strokeDasharray="4 4" />
        {/* openings */}
        <rect x="178" y="400" width="74" height="64" fill="#0a0b0c" stroke={stroke("openings")} strokeWidth="1.5" />
        <path d="M215 400v64M178 432h74" stroke={on("openings") ? ACC : DIM} />
        <rect x="282" y="452" width="62" height="108" fill="#0a0b0c" stroke={stroke("openings")} strokeWidth="1.5" />
        <rect x="372" y="400" width="52" height="64" fill="#0a0b0c" stroke={stroke("openings")} strokeWidth="1.5" />
        {/* ring beam */}
        <rect x="128" y="308" width="344" height="22" fill={on("ring_beam") ? "rgba(107,182,216,0.2)" : "rgba(242,241,237,0.06)"} stroke={stroke("ring_beam")} strokeWidth="1.5" />
        <path d="M140 319h320" stroke={on("ring_beam") ? ACC : DIM} strokeDasharray="3 4" />
        {/* roof */}
        <path d="M104 308L300 190 496 308" fill={fill("roof")} stroke={stroke("roof")} strokeWidth="2" strokeLinejoin="round" />
        {[170, 235, 365, 430].map((x) => <line key={x} x1={x} y1="308" x2={x < 300 ? 300 - (300 - x) * 0.0 : 300} y2="190" stroke={on("roof") ? ACC : LINE} strokeOpacity="0.5" />)}
        <line x1="300" y1="190" x2="300" y2="308" stroke={on("roof") ? ACC : DIM} strokeDasharray="3 4" />
        {/* the code written on the work */}
        {code ? (
          <text x="160" y="540" fill="#d9a24b" fontSize="22" fontWeight="600" letterSpacing="4" transform="rotate(-1.5 160 540)">{code}</text>
        ) : null}
        {/* dimension line */}
        <g stroke={DIM} fill="none">
          <path d="M520 190V560M514 190h12M514 560h12" />
          <path d="M520 308h-8M520 330h-8" />
        </g>
        <text x="530" y="380" fill={DIM} fontSize="10" letterSpacing="1.5" transform="rotate(90 530 380)">H 3.60 M</text>
        {/* section markers */}
        <g stroke={DIM} fill="none">
          <path d="M40 440H120M480 440H560" strokeDasharray="6 4" />
        </g>
        {[40, 560].map((x) => (
          <g key={x}>
            <circle cx={x} cy="440" r="11" fill="#0a0b0c" stroke={INK} />
            <text x={x} y="444" fill={INK} fontSize="11" textAnchor="middle">A</text>
          </g>
        ))}
      </g>

      {/* annotations */}
      <g fill={DIM} fontSize="10" letterSpacing="1.5">
        <text x="24" y="34">SECTION A–A</text>
        <text x="24" y="52">SCALE 1:50</text>
        <text x={wide ? 936 : 576} y="34" textAnchor="end">06.139° N</text>
        <text x={wide ? 936 : 576} y="52" textAnchor="end">03.341° E</text>
        <text x="24" y={wide ? 516 : 656}>PROJECT / SAMPLE</text>
        <text x={wide ? 936 : 576} y={wide ? 516 : 656} textAnchor="end">ILLUSTRATION, NOT A SITE</text>
      </g>

      {overlay === "capture" ? (
        <g stroke={ACC} strokeWidth="2" fill="none">
          <path d="M92 180v-34h34M508 146h34v34M92 600v34h34M508 634h34v-34" transform={wide ? "translate(180 -40)" : undefined} />
        </g>
      ) : null}
      {overlay === "verify" ? (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${190 + i * 70} 96)`}>
              <rect width="50" height="50" fill="#0a0b0c" stroke={ACC} />
              <path d="M14 26l8 8 15-17" stroke={ACC} strokeWidth="2" fill="none" />
            </g>
          ))}
        </g>
      ) : null}
      {overlay === "release" ? (
        <g fill="none" stroke={ACC} strokeWidth="1.5">
          <path d="M80 620H500" strokeDasharray="6 5" />
          <path d="M488 612l12 8-12 8" />
          <text x="80" y="606" fill={INK} stroke="none" fontSize="12" letterSpacing="2">2,000 GEN → BUILDER</text>
        </g>
      ) : null}
    </svg>
  );
}
