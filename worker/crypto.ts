// worker/crypto.ts — WebCrypto primitives shared by Workers and Bun.
// Zero deps; only crypto.subtle + btoa/atob.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64e(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function b64d(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256(data: string | Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256",
    typeof data === "string" ? enc.encode(data) : data));
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  return hex(await sha256(data));
}

export function hex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

export async function hmac(
  key: string | Uint8Array, msg: string,
): Promise<Uint8Array> {
  const k = typeof key === "string" ? enc.encode(key) : key;
  const ck = await crypto.subtle.importKey(
    "raw", k as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", ck, enc.encode(msg)));
}

export async function hmacHex(
  key: string | Uint8Array, msg: string,
): Promise<string> {
  return hex(await hmac(key, msg));
}

export function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/// HKDF-SHA256 → 32 bytes.
export async function hkdf32(
  ikm: Uint8Array, info: string, salt = new Uint8Array(0),
): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey(
    "raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource,
      info: enc.encode(info) } as AlgorithmIdentifier,
    base, 256);
  return new Uint8Array(bits);
}

/// AES-256-GCM encrypt → { nonce, ct } base64. Key must be 32 bytes.
export async function aesEncrypt(
  key: Uint8Array, plaintext: string,
): Promise<{ nonce: string; ct: string }> {
  const ck = await crypto.subtle.importKey(
    "raw", key as BufferSource, "AES-GCM", false, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as BufferSource }, ck, enc.encode(plaintext)));
  return { nonce: b64e(nonce), ct: b64e(ct) };
}

export async function aesDecrypt(
  key: Uint8Array, nonceB64: string, ctB64: string,
): Promise<string> {
  const ck = await crypto.subtle.importKey(
    "raw", key as BufferSource, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64d(nonceB64) as BufferSource },
    ck, b64d(ctB64) as BufferSource);
  return dec.decode(pt);
}
