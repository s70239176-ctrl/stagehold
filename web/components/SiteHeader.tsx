"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Logo } from "./icons.tsx";

const LINKS = [
  { href: "/payer", label: "Payer" },
  { href: "/builder", label: "Builder" },
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
          <Link href="/#how">How it works</Link>
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
          <a className="chip" href="https://github.com/s70239176-ctrl/stagehold" target="_blank" rel="noreferrer" aria-label="Source on GitHub">
            <Github size={16} />
            <span className="hide-sm">Source</span>
          </a>
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
          <span className="brand" style={{ color: "var(--ink-2)" }}>
            <Logo size={22} /> Stagehold
          </span>
          <span>Built on GenLayer Intelligent Contracts. Running on the Studionet network.</span>
        </div>
        <p style={{ maxWidth: "88ch" }}>
          A photograph proves what is visible, not who owns the land, what materials were used or what is inside a wall. The web
          version cannot verify that a photograph came from a live camera; an attested mobile capture app is planned before real
          value is used. Studionet GEN has no market value.
        </p>
      </div>
    </footer>
  );
}
