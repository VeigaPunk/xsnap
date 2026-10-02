# Rinnegan — the user:hash credential

The rinnegan is xsnap's proprietary uploader credential. One string,
granted to a human after Kimi OAuth, that both attributes (privately) and
unlocks (exclusively) everything they paste.

## Format

```
<user>:<hash>
 user  = opaque id from the Kimi OAuth section, [A-Za-z0-9._-]{1,64}
 hash  = 64 hex = HMAC-SHA256(RINNEGAN_ISSUER_KEY, "rinnegan/v1:" + user)
```

## Derived values (worker/rinnegan.ts)

| Value | Formula | Use |
|---|---|---|
| owner | `HMAC(RINNEGAN_ISSUER_KEY, "owner/v1:"+user)` | Private paste↔user linkage stored in D1 |
| wrap key | `HKDF-SHA256(hash, info="xsnap-wrap/v1")` | AES-256-GCM key for the paste's original |

Verification is stateless (recompute + constant-time compare); the server
never stores the credential or its hash.

## Minting

- **Prod**: the Kimi-OAuth-gated section of `ufo-fsd.kimi.pro` (hosted on
  Kimi/Alibaba). Contract for that surface:
  1. User completes Kimi OAuth in the gated section.
  2. Section derives `user` from the verified Kimi identity and computes
     `hash` with the shared `RINNEGAN_ISSUER_KEY`.
  3. Section displays the rinnegan ONCE; user stores it (password manager).
  4. xsnap.app never mints — it only verifies with the same key.
- **Dev**: `POST /dev/rinnegan {"user": "…"}` on a DEV-flagged server
  (reference minting implementation: `mint()` in `worker/rinnegan.ts`).

## Threat model (v1, operator-selected: server-trusted)

| Attacker | Sees originals? |
|---|---|
| Public web / crawlers / scrapers | Never — only the mi rendering |
| DB dump alone (no env secrets) | No — ciphertext + owner HMAC only |
| xsnap server compromise (DB + `RINNEGAN_ISSUER_KEY`) | Yes — the key
  derives wrap keys. This is the accepted v1 trade-off for server-side
  translation. |

## v2 upgrade path (not implemented)

Salt the hash with per-user randomness so wrap keys stop being derivable
from the issuer key: issuer stores `verifier = HMAC(K_v, user‖salt)`,
rinnegan becomes `user:hash = HMAC(K_i, user‖salt):salt`. Requires the
issuer to publish verifiers (shared table or signed token). Decrypt then
needs the user to present the rinnegan (as today) AND the server to be
unable to reconstruct it (new). Zero-knowledge mode (client-side AES before
upload, corpus in the CLI) remains the end-state if the operator later
wants the server fully blind.
