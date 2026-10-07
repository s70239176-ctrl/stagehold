"use client";
import { useEffect, useState } from "react";
import { adoptSandbox, adoptWallet, addressFor, isWalletSigner, resetKey, savedWallet, type Role } from "../lib/accounts.ts";
import { connectWallet, getProvider } from "../lib/wallet.ts";
import { short } from "./ui.tsx";

/** Address chip plus the choice between the sandbox account and a browser wallet. */
export function AccountBar({ role, signer, onSigner, onError }: {
  role: Role;
  signer: string;
  onSigner: (signer: string) => void;
  onError: (message: string) => void;
}) {
  const [hasWallet, setHasWallet] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setHasWallet(!!getProvider()), []);
  const wallet = isWalletSigner(signer);

  // Follow the wallet if the user switches account or locks it.
  useEffect(() => {
    const p = getProvider() as (ReturnType<typeof getProvider> & { on?: (e: string, f: (a: string[]) => void) => void; removeListener?: (e: string, f: (a: string[]) => void) => void }) | undefined;
    if (!p?.on || !wallet) return;
    const h = (accts: string[]) => {
      if (accts?.[0]) onSigner(adoptWallet(role, accts[0]));
      else onSigner(adoptSandbox(role));
    };
    p.on("accountsChanged", h);
    return () => p.removeListener?.("accountsChanged", h);
  }, [wallet, role, onSigner]);

  async function connect() {
    setBusy(true);
    try {
      onSigner(adoptWallet(role, await connectWallet()));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      <button className="chip" title="Copy your address" onClick={() => signer && void navigator.clipboard?.writeText(addressFor(signer))}>
        {signer ? `${wallet ? "Wallet " : "Sandbox "}${short(addressFor(signer))}` : "…"}
      </button>
      {wallet ? (
        <button className="btn btn-ghost btn-sm" onClick={() => onSigner(adoptSandbox(role))}>Use sandbox</button>
      ) : (
        <>
          <button className="btn btn-ghost btn-sm" onClick={() => onSigner(resetKey(role))}>New account</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} title={hasWallet ? "Sign with MetaMask or another browser wallet" : "No browser wallet detected yet"} onClick={() => void connect()}>
            {busy ? "Connecting…" : "Connect wallet"}
          </button>
        </>
      )}
    </div>
  );
}
