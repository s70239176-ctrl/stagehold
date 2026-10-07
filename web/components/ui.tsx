"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Alert, Check, Copy, Info, Spinner } from "./icons.tsx";

export const short = (addr: string): string => (addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr);

export function CopyButton({ value, label, className = "copy" }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      title="Copy"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      <span className="mono">{label ?? value}</span>
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export function Activity({ text }: { text: string }) {
  return (
    <div className="activity" role="status" aria-live="polite">
      <Spinner size={18} />
      <span>{text}</span>
    </div>
  );
}

export function Notice({ kind = "info", title, children }: { kind?: "info" | "warn" | "bad" | "ok"; title?: string; children: ReactNode }) {
  const Icon = kind === "warn" || kind === "bad" ? Alert : kind === "ok" ? Check : Info;
  return (
    <div className={`notice notice-${kind}`} role={kind === "bad" ? "alert" : undefined}>
      <Icon size={18} />
      <div>
        {title ? <strong>{title} </strong> : null}
        {children}
      </div>
    </div>
  );
}

export function Stat({ k, v, unit }: { k: string; v: ReactNode; unit?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">
        {v}
        {unit ? <small>{unit}</small> : null}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function UnitInput({ value, onChange, unit = "GEN", placeholder, disabled }: { value: string; onChange: (v: string) => void; unit?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <div className="input-unit">
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder={placeholder} disabled={disabled} />
      <span className="unit">{unit}</span>
    </div>
  );
}
