import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const Check = (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const Cross = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const Clock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const Camera = (p: P) => <Svg {...p}><path d="M4 8.5A1.5 1.5 0 015.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5z" /><circle cx="12" cy="13" r="3.4" /></Svg>;
export const Shield = (p: P) => <Svg {...p}><path d="M12 3l7 2.8v5.4c0 4.4-2.9 7.9-7 9.8-4.1-1.9-7-5.4-7-9.8V5.8z" /><path d="M9 12l2.2 2.2L15.5 10" /></Svg>;
export const Lock = (p: P) => <Svg {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></Svg>;
export const Copy = (p: P) => <Svg {...p}><rect x="9" y="9" width="10.5" height="10.5" rx="2" /><path d="M15 9V6.5A1.5 1.5 0 0013.5 5h-7A1.5 1.5 0 005 6.5v7A1.5 1.5 0 006.5 15H9" /></Svg>;
export const External = (p: P) => <Svg {...p}><path d="M14 5h5v5M19 5l-8 8M18 14v3.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 17.5v-9A1.5 1.5 0 017.5 7H11" /></Svg>;
export const Info = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const Alert = (p: P) => <Svg {...p}><path d="M12 4l9 15.5H3z" /><path d="M12 10v4M12 17h.01" /></Svg>;
export const Spinner = (p: P) => <Svg className="spin" {...p}><path d="M12 3.5a8.5 8.5 0 018.5 8.5" /></Svg>;
export const Arrow = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const Eye = (p: P) => <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></Svg>;
export const Layers = (p: P) => <Svg {...p}><path d="M12 4l8.5 4.5L12 13 3.5 8.5z" /><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16L12 20.5 20.5 16" /></Svg>;
export const Users = (p: P) => <Svg {...p}><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" /><path d="M16 6.2a3 3 0 010 5.6M17.5 14.6c1.8.6 3 2 3.5 4.4" /></Svg>;
export const Github = (p: P) => <Svg {...p}><path d="M9 19c-4 1.2-4-2-5.5-2.5M14.5 21v-3.1c0-.9.1-1.5-.5-2.2 2.9-.3 5.5-1.4 5.5-6.2a4.8 4.8 0 00-1.3-3.3 4.4 4.4 0 00-.1-3.3s-1.1-.3-3.6 1.3a12.4 12.4 0 00-6.5 0C5.4 2.6 4.3 3 4.3 3a4.4 4.4 0 00-.1 3.3A4.8 4.8 0 002.9 9.6c0 4.8 2.6 5.9 5.5 6.2-.6.6-.6 1.2-.5 2.2V21" /></Svg>;

/* the five stages */
export const StageBeam = (p: P) => <Svg {...p}><path d="M3 9h18v6H3z" /><path d="M7.5 9v6M12 9v6M16.5 9v6" /></Svg>;
export const StageBlock = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 9.7v4.6M9 14.3V19" /></Svg>;
export const StageRoof = (p: P) => <Svg {...p}><path d="M3 12.5L12 5l9 7.5" /><path d="M5.5 11v8h13v-8" /><path d="M10 19v-4.5h4V19" /></Svg>;
export const StageOpenings = (p: P) => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M12 4v16M4 12h16" /></Svg>;
export const StagePlaster = (p: P) => <Svg {...p}><path d="M4 6h16v7H4z" /><path d="M4 16.5h10M4 20h6" /></Svg>;

export const STAGE_ICON: Record<string, (p: P) => ReactNode> = {
  ring_beam: StageBeam,
  blockwork: StageBlock,
  roof: StageRoof,
  openings: StageOpenings,
  plaster: StagePlaster,
};

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2.75" y="2.75" width="18.5" height="18.5" />
      <path d="M2.75 8.9h18.5M2.75 15.1h18.5" />
      <path d="M12 8.9v6.2" stroke="#6bb6d8" />
    </svg>
  );
}
