import { addressOf, freshPrivateKey } from "./chain.ts";

export type Role = "payer" | "builder";

const KEY = (role: Role) => `stagehold.account.${role}.v1`;

/**
 * Throwaway keys for a gasless hosted dev network, made in this browser and kept in
 * localStorage. They hold test funds only; nothing is sent anywhere. A real wallet is a later step.
 */
export function loadOrCreateKey(role: Role): string {
  try {
    const raw = window.localStorage.getItem(KEY(role));
    if (raw && /^0x[0-9a-fA-F]{64}$/.test(raw)) return raw;
  } catch {
    /* private mode: fall through and mint a key for this page load */
  }
  const key = freshPrivateKey();
  try {
    window.localStorage.setItem(KEY(role), key);
  } catch {
    /* the key still works until the page closes */
  }
  return key;
}

export function resetKey(role: Role): string {
  try {
    window.localStorage.removeItem(KEY(role));
  } catch {
    /* ignore */
  }
  return loadOrCreateKey(role);
}

export const addressFor = (key: string): string => addressOf(key);
