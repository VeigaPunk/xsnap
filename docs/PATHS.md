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
| Companion | `xsnapshot.app` (flagship), plugin source lives here |

## Two publish modes

| | Ciphertext (CLI) | Plugin (AI session) |
|---|---|---|
| Upload auth | rinnegan `user:hash` (HMAC issuer) | **keyless** |
| Public body | `mi` rendered locally by the CLI (`cli/translate.js`) | `maori` rendered by the session itself (two hops) |
| Original | AES-256-GCM on xsnap, key = HKDF(rinnegan) | uploader's PRIVATE GitHub repo `xsnap-<id>`, file `p/<id>/original.txt` |
| Unlock | `POST /api/decrypt` with the rinnegan | `POST /api/unlock` with GitHub `user:token` — "the rinnegan is merely his github user:pass" |
| Paste id | `sha256(nonce‖ct)[0..16]` | `sha256(mi‖nonce2)[0..16]` (computed client-side first) |

## Files

| Path | Owns |
|---|---|
| `worker/index.ts` | All routes, upload/publish/decrypt/unlock flows, scrub, headers |
| `worker/rinnegan.ts` | user:hash parse/mint/verify, owner HMAC, wrap-key HKDF (ciphertext mode) |
| `worker/crypto.ts` | WebCrypto: SHA-256, HMAC, HKDF, AES-256-GCM, base64 |
| `worker/d1.ts` | DB surface; `wrapD1()` normalizes Cloudflare D1 |
| `worker/html.ts` | Home/paste/404 templates + the XP-styled unlock dialog |
| `cli/xsnap.js` | Command surface: upload / decrypt / rinnegan |
| `cli/translate.js` | LOCAL two-hop renderer (ANY→suomi→mi) + both corpora |
| `cli/transport.js` | QUIC→TCP TLS ladder, AdGuard-CA resolution |
| `cli/transcript.js` | `-whole/-inputs/-outputs` slicing (cast + heuristics) |
| `plugin/xsnap.mjs` | Keyless session plugin: private-repo push + publish |
| `plugin/AGENT.md` | The guidance shipped with the rinnegan'd ufo-fsd section |
| `dev/server.ts` | Bun dev runner (bun:sqlite → DBLike, dev issuer on) |
| `schema.sql` | D1/SQLite paste table (dual origin columns) |
| `wrangler.toml` | Worker + D1 binding + public vars |
| `docs/RINNEGAN.md` | Credential spec (user:hash + github user:pass), federation |
| `docs/DEPLOY.md` | Cloudflare procedure + domain cutover warning |
| `test/smoke.sh` | Full local regression (both modes) |

## HTTP routes (worker/index.ts)

| Route | Method → result |
|---|---|
| `/` | GET → home page |
| `/robots.txt` | GET → allow all, disallow `/api/`, `/dev/` |
| `/sitemap.xml` | GET → last 500 pastes |
| `/p/:id` | GET → public paste page (mi only, immutable) |
| `/p/:id/raw` | GET → text/plain mi body |
| `/p/:id/meta` | GET → `{id, mode, bytes, created_at}` (no repo coords — provenance) |
| `/p/:id/unlock` | GET → XP-styled unlock dialog (noindex, no-store) |
| `/api/upload` | POST `{rinnegan, mi, transcript, mode?}` → `201 {id,url,bytes}` |
| `/api/publish` | POST `{mi, owner, repo, path, nonce2, bytes?}` → `201 {id,url}` (keyless) |
| `/api/decrypt` | POST `{rinnegan, id}` → `200 {id,transcript}` (ciphertext mode) |
| `/api/unlock` | POST `{user, token, id}` → `200 {id,transcript}` (github mode; server verifies against api.github.com, owner must match; creds never stored) |
| `/dev/rinnegan` | POST `{user}` → dev-minted rinnegan (DEV env only) |

## CLI flags (cli/xsnap.js)

| Flag / env | Meaning |
|---|---|
| `-whole` / `-inputs` / `-outputs` | Slicing mode (one required) |
| `-f, --file FILE` or stdin | Transcript source |
| `-r, --rinnegan user:hash` / `XSNAP_RINNEGAN` | Credential (ciphertext mode) |
| `--api URL` / `XSNAP_API` | Endpoint (default `https://xsnap.app`) |
| `--ca PATH` / `XSNAP_CA` / auto-discovery | AdGuard-minted CA pem |
| `--quic-only` / `--no-quic` | Transport pinning |
| `decrypt <id>` | Prints original to stdout |

## Plugin env (plugin/xsnap.mjs)

| Var | Meaning |
|---|---|
| `GITHUB_TOKEN` | PAT: repo create + contents write (classic `repo` scope, or fine-grained Administration+Contents RW) |
| `XSNAP_API` / `--api` | xsnap endpoint |
| stdin JSON | `{content, suomi, maori}` — the session translates, the script plumbs |

## Server env

| Var | Where | Meaning |
|---|---|---|
| `RINNEGAN_ISSUER_KEY` | secret | HMAC key shared with the issuer (ciphertext mode) |
| `RINNEGAN_ISSUER_ID` | var | Issuer label shown on pages (`ufo-fsd.kimi.pro`) |
| `ORIGIN` | var | Canonical origin for URLs/sitemap |
| `DEV` | dev only | Enables `POST /dev/rinnegan` |

## Behaviors pinned by design

1. Translation is ALWAYS client-side, two hops: ANY → suomi → mi
   (`plugin/AGENT.md` for AI sessions; `cli/translate.js` fallback corpus).
   The server never translates.
2. Public pages never contain original text, uploader identity, or
   `user@host`-shaped tokens (scrubbed to `koreingoa@tūmau`). Repo
   coordinates of plugin pastes are never serialized to public routes.
3. Unlock (either mode) requires a key that proves ownership: rinnegan
   hash match, or GitHub creds whose login owns the paste; the unlock
   response discloses `repo_url`/`raw_url` only after verification.
4. Paste pages carry the `[169,13,13]` **wetehuna** button that opens the
   decryptor dialog; github mode takes one combined `github_username:password`
   field and opens the raw repo on success; any failure redirects to
   ufo-fsd.kimi.pro.
5. `/p/*` paste pages: canonical, immutable-cached, no JS; `/p/*/unlock`
   is the only scripted surface (noindex).
