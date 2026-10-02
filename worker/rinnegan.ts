// worker/rinnegan.ts — the proprietary user:hash credential.
//
// Format:   "<user>:<hash>"   user: opaque id from the Kimi OAuth section
//                             (ufo-fsd.kimi.pro), [A-Za-z0-9._-]{1,64}
//           hash: 64 hex = HMAC-SHA256(RINNEGAN_ISSUER_KEY, "rinnegan/v1:"+user)
// Minting:  issuer section on ufo-fsd.kimi.pro (Kimi OAuth gate) using the
//           shared RINNEGAN_ISSUER_KEY. Dev/local: POST /dev/rinnegan.
// Verify:   recompute + constant-time compare (stateless, no user table).
// Wrap key: HKDF(hash bytes, info="xsnap-wrap/v1") → AES-256-GCM paste key.
// Owner id: HMAC(RINNEGAN_ISSUER_KEY, "owner/v1:"+user) — the only linkage
//           stored server-side; never rendered on any public route.
//
// v2 (roadmap, docs/RINNEGAN.md): per-user random salt baked into the hash so
// a DB+secret compromise cannot reconstruct wrap keys; requires the issuer to
// publish verifiers. v1 is the server-trusted model by operator decision.

import { hmacHex, ctEqual, hkdf32 } from "./crypto";

export interface Rinnegan {
  user: string;
  hash: string;
  owner: string;
}

const USER_RE = /^[A-Za-z0-9._-]{1,64}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

export function parse(raw: string): Rinnegan | null {
  const i = raw.indexOf(":");
  if (i < 0) return null;
  const user = raw.slice(0, i);
  const hash = raw.slice(i + 1);
  if (!USER_RE.test(user) || !HASH_RE.test(hash)) return null;
  return { user, hash, owner: "" };
}

export async function mint(
  user: string, issuerKey: string,
): Promise<string> {
  if (!USER_RE.test(user)) throw new Error("bad user id");
  return `${user}:${await hmacHex(issuerKey, "rinnegan/v1:" + user)}`;
}

/// Returns the rinnegan with owner HMAC, or null if the hash is invalid.
export async function verify(
  raw: string, issuerKey: string,
): Promise<Rinnegan | null> {
  const r = parse(raw);
  if (!r) return null;
  const expected = await hmacHex(issuerKey, "rinnegan/v1:" + r.user);
  if (!ctEqual(expected, r.hash)) return null;
  r.owner = await hmacHex(issuerKey, "owner/v1:" + r.user);
  return r;
}

export async function wrapKey(hashHex: string): Promise<Uint8Array> {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hashHex.slice(i * 2, i * 2 + 2), 16);
  }
  return hkdf32(bytes, "xsnap-wrap/v1");
}
