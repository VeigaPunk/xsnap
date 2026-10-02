# xsnap.app — paths of reference

The authoritative map of "I want to change X → edit Y". If a route, flag,
file or env var isn't listed here, it doesn't exist.

## Wire (repo → world)

| Thing | Value |
|---|---|
| Origin | `https://github.com/VeigaPunk/xsnap.git` (branch `main`) |
| Domain | `xsnap.app` (Cloudflare zone `4a0a5532…`, registrar name.com) |
| Deploy target | Dedicated Worker `xsnap-paste` + D1 `xsnap` — **never** the shared `xsnapshot` Pages project (see `docs/DEPLOY.md`) |
| Cursor | `.cursor/rules/xsnap.mdc` (always-on project rules), `.cursorignore` |
| Local run | `bun dev/server.ts` → `http://localhost:8787`, SQLite `dev/xsnap.db` |

## Files

| Path | Owns |
|---|---|
| `worker/index.ts` | All routes, upload/decrypt flows, headers/cache policy |
| `worker/rinnegan.ts` | user:hash parse/mint/verify, owner HMAC, wrap-key HKDF |
| `worker/crypto.ts` | WebCrypto: SHA-256, HMAC, HKDF, AES-256-GCM, base64 |
| `worker/d1.ts` | DB surface; `wrapD1()` normalizes Cloudflare D1 |
| `worker/html.ts` | Public page templates (home, paste, 404), CSP/meta |
| `worker/translate/mi.ts` | Deterministic ANY→mi longest-match engine |
| `worker/translate/corpus.ts` | The lexicon (EN/PT/ES + computing terms) |
| `worker/translate/llm.ts` | Optional OpenAI-compatible fluent translator |
| `cli/xsnap.js` | Command surface: upload / decrypt / rinnegan |
| `cli/transport.js` | QUIC→TCP TLS ladder, AdGuard-CA resolution |
| `cli/transcript.js` | `-whole/-inputs/-outputs` slicing (cast + heuristics) |
| `dev/server.ts` | Bun dev runner (bun:sqlite → DBLike, dev issuer on) |
| `schema.sql` | D1/SQLite paste table |
| `wrangler.toml` | Worker + D1 binding + public vars |
| `docs/RINNEGAN.md` | Credential spec + ufo-fsd.kimi.pro federation contract |
| `docs/DEPLOY.md` | Cloudflare procedure + domain cutover warning |
| `test/smoke.sh` | Full local loop regression (mint→upload→page→decrypt) |

## HTTP routes (worker/index.ts)

| Route | Method → result |
|---|---|
| `/` | GET → home page |
| `/robots.txt` | GET → allow all, disallow `/api/`, `/dev/` |
| `/sitemap.xml` | GET → last 500 pastes |
| `/p/:id` | GET → public paste page (mi only, immutable) |
| `/p/:id/raw` | GET → text/plain mi body |
| `/p/:id/meta` | GET → `{id, mode, bytes, created_at}` |
| `/api/upload` | POST `{rinnegan, transcript, mode?}` → `201 {id,url,bytes,mode}` |
| `/api/decrypt` | POST `{rinnegan, id}` → `200 {id,transcript,…}` |
| `/dev/rinnegan` | POST `{user}` → dev-minted rinnegan (DEV env only) |

Paste id: 16 hex = `sha256(nonce‖ciphertext)` prefix. Upload is idempotent
per ciphertext; 409 on collision.

## CLI flags (cli/xsnap.js)

| Flag / env | Meaning |
|---|---|
| `-whole` / `-inputs` / `-outputs` | Slicing mode (one required) |
| `-f, --file FILE` or stdin | Transcript source |
| `-r, --rinnegan user:hash` / `XSNAP_RINNEGAN` | Credential |
| `--api URL` / `XSNAP_API` | Endpoint (default `https://xsnap.app`) |
| `--ca PATH` / `XSNAP_CA` / auto-discovery | AdGuard-minted CA pem |
| `--quic-only` / `--no-quic` | Transport pinning |
| `decrypt <id>` | Prints original to stdout |
| `rinnegan --user NAME` | Dev issuer only |

## Server env

| Var | Where | Meaning |
|---|---|---|
| `RINNEGAN_ISSUER_KEY` | secret | HMAC key shared with the issuer |
| `RINNEGAN_ISSUER_ID` | var | Issuer label shown on pages (`ufo-fsd.kimi.pro`) |
| `ORIGIN` | var | Canonical origin for URLs/sitemap |
| `DEV` | dev only | Enables `POST /dev/rinnegan` |
| `TRANSLATE_URL/KEY/MODEL` | secret, optional | Fluent any→mi via LLM; absent ⇒ corpus |

## Behaviors pinned by design

1. Public pages never contain original text, uploader identity, or
   `user@host`-shaped tokens (scrubbed to `koreingoa@tūmau`).
2. Decrypt requires rinnegan validity AND owner HMAC match.
3. Translation direction is ANY language → mi; unknown tokens pass through.
4. API/dev routes are robots-disallowed; paste pages are canonical,
   immutable-cached, no JS.
