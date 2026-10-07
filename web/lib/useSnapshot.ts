"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readSnapshot } from "./chain.ts";
import type { Snapshot } from "./types.ts";

/**
 * Reads the job's snapshot now and every `everyMs` while the tab is visible. One batched read per poll keeps
 * us far below the hosted RPC's limit (about 30 requests a minute).
 */
export function useSnapshot(contract: string, everyMs = 15000) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string>("");
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(contract) || busy.current) return;
    busy.current = true;
    try {
      setSnapshot(await readSnapshot(contract));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
    }
  }, [contract]);

  useEffect(() => {
    setSnapshot(null);
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, everyMs);
    return () => window.clearInterval(id);
  }, [refresh, everyMs]);

  return { snapshot, error, refresh };
}
