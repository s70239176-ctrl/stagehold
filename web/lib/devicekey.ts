/**
 * The browser-made signing key. It is a non-extractable WebCrypto P-256 key kept in IndexedDB, so the page
 * can sign but never reveal it. It is NOT hardware-attested: it binds a shot to its stage, code, deadline and
 * bytes, and proves nothing about where the pixels came from.
 */
import { keyInfo } from "./crypto.ts";

const DB = "stagehold";
const STORE = "device-keys";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get(id: string): Promise<CryptoKeyPair | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as CryptoKeyPair | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function put(id: string, pair: CryptoKeyPair): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(pair, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface DeviceKey {
  privateKey: CryptoKey;
  x: string;
  y: string;
  keyId: string;
}

/** One key per job and builder, created on first use. */
export async function getDeviceKey(contract: string, builder: string): Promise<DeviceKey> {
  const id = `${contract.toLowerCase()}:${builder.toLowerCase()}`;
  let pair = await get(id);
  if (!pair) {
    pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"])) as CryptoKeyPair;
    await put(id, pair);
  }
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { privateKey: pair.privateKey, ...(await keyInfo(raw)) };
}
