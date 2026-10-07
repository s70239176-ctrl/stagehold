/**
 * Hashing, the signed shot message and signature encoding. Pure WebCrypto, no DOM, so it runs under
 * Node tests too. The message layout must equal build_shot_message in contracts/src/body.py.
 */
const enc = new TextEncoder();

export const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export function fromHex(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function toB64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

export const sha256Hex = async (bytes: Uint8Array): Promise<string> => toHex(await sha256(bytes));

/** The exact ASCII message the contract verifies for a shot. */
export function shotMessage(
  contract: string,
  stage: string,
  code: string,
  deadline: number,
  jpegShaHex: string,
  thumbShaHex: string,
): Uint8Array {
  return enc.encode(`stagehold.v1|${contract.toLowerCase()}|${stage}|${code}|${deadline}|${jpegShaHex}|${thumbShaHex}`);
}

function derInt(raw: Uint8Array): Uint8Array {
  let i = 0;
  while (i < raw.length - 1 && raw[i] === 0) i++;
  let v = raw.subarray(i);
  if ((v[0] ?? 0) & 0x80) v = Uint8Array.from([0, ...v]);
  return Uint8Array.from([0x02, v.length, ...v]);
}

/** WebCrypto signs ECDSA as r||s (64 bytes); the contract verifies DER. */
export function p1363ToDer(sig: Uint8Array): Uint8Array {
  if (sig.length !== 64) throw new Error("expected a 64-byte P-256 signature");
  const r = derInt(sig.subarray(0, 32));
  const s = derInt(sig.subarray(32, 64));
  return Uint8Array.from([0x30, r.length + s.length, ...r, ...s]);
}

/** From an uncompressed P-256 public key (0x04 || x || y): the coordinates and the contract's key_id. */
export async function keyInfo(raw: Uint8Array): Promise<{ x: string; y: string; keyId: string }> {
  if (raw.length !== 65 || raw[0] !== 4) throw new Error("expected an uncompressed P-256 public key");
  return {
    x: toHex(raw.subarray(1, 33)),
    y: toHex(raw.subarray(33, 65)),
    keyId: await sha256Hex(raw.subarray(1, 65)), // sha256(x || y), as the contract derives it
  };
}

export async function signShot(privateKey: CryptoKey, message: Uint8Array): Promise<string> {
  const p1363 = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, message as BufferSource),
  );
  return toHex(p1363ToDer(p1363));
}
