"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Arrow, Logo } from "./icons.tsx";

const LINKS = [
  { href: "/#method", label: "How it works" },
  { href: "/payer", label: "Payer" },
  { href: "/builder", label: "Builder" },
  { href: "/#protocol", label: "Protocol" },
  { href: "/camera", label: "Camera" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="container nav">
        <Link href="/" className="brand" aria-label="Stagehold home">
          <Logo />
          Stagehold
        </Link>
        <nav className="nav-links" aria-label="Primary">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="nav-right">
          <span className="chip" title="GenLayer Studionet, chain 61999">
            <span className="dot" />
            <span className="hide-sm">GenLayer</span> Studionet
          </span>
          <Link className="btn btn-primary btn-sm" href="/payer">
            <span>Start a project</span> <Arrow size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container stack-sm">
        <div className="spread">
          <span className="brand">
            <Logo size={20} /> Stagehold
          </span>
          <span className="label-t">Built on GenLayer Intelligent Contracts / Studionet</span>
        </div>
        <p style={{ maxWidth: "92ch" }}>
          A photograph proves what is visible, not who owns the land, what materials were used or what is inside a wall. Web
          capture takes live-camera frames only and is not device-attested; an attested mobile capture app is planned before real
          value is used. Studionet GEN has no market value.
        </p>
        <a href="https://github.com/s70239176-ctrl/stagehold" target="_blank" rel="noreferrer" className="label-t" style={{ width: "fit-content" }}>
          Source on GitHub →
        </a>
      </div>
    </footer>
  );
}
