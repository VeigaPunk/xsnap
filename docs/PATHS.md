# xsnap.app + xsnapshot.app — paths of reference

The authoritative map of "I want to change X → edit Y". If a route, flag,
file or env var isn't listed here, it doesn't exist.

## Two websites, two unlock models

| | **xsnap.app** (Kimi-OAuth site) | **xsnapshot.app** (GitHub site) |
|---|---|---|
| Who it's for | rinnegan'd users (Kimi OAuth on ufo-fsd.kimi.pro) | anyone with a GitHub account |
| Upload | CLI, rinnegan `user:hash` required | plugin (keyless publish) |
| Public body | `mi` rendered locally by the CLI | `maori` rendered locally by the session |
| Original | AES-256-GCM on xsnap, key = HKDF(rinnegan hash) | uploader's PRIVATE GitHub repo `xsnap-<id>`, file `p/<id>/original.txt` |
| Unlock key | proprietary rinnegan `user:hash` | simple `github_username:password` (PAT) |
| Unlock payoff | verbatim original in the XP dialog | the user's raw repo OPENS (no original text on the site) |
| Paste id | `sha256(nonce‖ct)[0..16]` | `sha256(mi‖nonce2)[0..16]` (computed client-side first) |
| Code | `worker/` | `xsnapshot-site/` |
| Dev | `bun dev/server.ts` → :8787, db `dev/xsnap.db` | `bun dev/server-xsnapshot.ts` → :8788, db `dev/xsnapshot.db` |

Shared: `schema.sql` (one paste table for both D1 databases), `cli/` (the
xsnap CLI + local two-hop renderer), `plugin/` (ships to xsnapshot.app),
the XP decryptor look and the `[169,13,13]` wetehuna button (template
fixes must be applied to BOTH `worker/html.ts` and `xsnapshot-site/html.ts`).

## Wire

| Thing | Value |
|---|---|
| Origin repo | `https://github.com/VeigaPunk/xsnap.git` (main) |
| xsnap.app | Worker `xsnap-paste` + D1 `xsnap` (root `wrangler.toml`) |
| xsnapshot.app | Worker `xsnapshot-paste` + D1 `xsnapshot-pastes` (`xsnapshot-site/wrangler.toml`), routes `xsnapshot.app/p/*`, `/api/publish`, `/api/unlock` — the existing X-snapshot Pages site stays untouched |
| Kimi OAuth issuer | ufo-fsd.kimi.pro rinnegan'd section (mints user:hash; shares `RINNEGAN_ISSUER_KEY`) |
| Cursor | `.cursor/rules/xsnap.mdc`, `.cursorignore` |

## Files

| Path | Owns |
|---|---|
| `worker/index.ts` | xsnap.app routes: upload/decrypt/paste/raw/meta/unlock/dev-mint |
| `worker/rinnegan.ts` | user:hash parse/mint/verify, owner HMAC, wrap-key HKDF |
| `worker/crypto.ts` | SHA-256, HMAC, HKDF, AES-256-GCM, base64 |
| `worker/d1.ts` | DB surface; `wrapD1()` normalizes Cloudflare D1 |
| `worker/html.ts` | xsnap.app pages + XP rinnegan decryptor |
| `xsnapshot-site/index.ts` | xsnapshot.app routes: publish/unlock/paste/raw/meta |
| `xsnapshot-site/html.ts` | xsnapshot.app pages + XP github user:pass decryptor |
| `cli/xsnap.js` | CLI commands (targets xsnap.app) |
| `cli/translate.js` | LOCAL two-hop renderer (ANY→suomi→mi) + corpora |
| `cli/transport.js` | QUIC→TCP TLS ladder, AdGuard-CA resolution |
| `cli/transcript.js` | `-whole/-inputs/-outputs` slicing |
| `plugin/xsnap.mjs` | keyless plugin: private-repo push + publish (xsnapshot.app) |
| `plugin/AGENT.md` | agent guidance shipped with the ufo-fsd section |
| `dev/server.ts`, `dev/server-xsnapshot.ts` | Bun dev runners |
| `schema.sql` | shared paste table (both D1 databases) |
| `docs/RINNEGAN.md` | both credential forms |
| `docs/DEPLOY.md` | both workers + domain notes |
| `test/smoke.sh` | full regression across BOTH sites |

## Routes

**xsnap.app (`worker/index.ts`)**
| Route | Method → result |
|---|---|
| `/` , `/robots.txt`, `/sitemap.xml` | GET → home / crawl rules / last 500 pastes |
| `/p/:id` · `/p/:id/raw` · `/p/:id/meta` | GET → page (mi only, immutable) / text body / JSON meta |
| `/p/:id/unlock` | GET → XP rinnegan decryptor (noindex) |
| `/api/upload` | POST `{rinnegan, mi, transcript, mode?}` → `201 {id,url,bytes}` |
| `/api/decrypt` | POST `{rinnegan, id}` → `200 {id,transcript}` |
| `/dev/rinnegan` | POST `{user}` → dev-minted rinnegan (DEV only) |

**xsnapshot.app (`xsnapshot-site/index.ts`, route-limited)**
| Route | Method → result |
|---|---|
| `/p/:id` · `/p/:id/raw` · `/p/:id/meta` | GET → page (mi only, immutable) / text body / JSON meta |
| `/p/:id/unlock` | GET → XP github user:pass decryptor (noindex) |
| `/api/publish` | POST `{mi, owner, repo, path, nonce2, bytes?}` → `201 {id,url}` (keyless) |
| `/api/unlock` | POST `{user, token, id}` → `200 {id,repo_url,raw_url}` — URLs only, original never proxied |

## CLI flags / plugin env / server env

| Surface | Keys |
|---|---|
| `cli/xsnap.js` | `-whole/-inputs/-outputs`, `-f FILE`, `-r user:hash`/`XSNAP_RINNEGAN`, `--api`/`XSNAP_API` (default xsnap.app), `--ca`/`XSNAP_CA`, `--quic-only/--no-quic`, `decrypt <id>` |
| `plugin/xsnap.mjs` | `GITHUB_TOKEN` (PAT: repo create + contents write), `XSNAPSHOT_API`/`--api` (default xsnapshot.app), stdin JSON `{content, suomi, maori}` |
| xsnap worker env | `RINNEGAN_ISSUER_KEY` (secret), `RINNEGAN_ISSUER_ID`, `ORIGIN`, `DEV` (dev only) |
| xsnapshot worker env | `ORIGIN` |

## Behaviors pinned by design

1. Translation is ALWAYS client-side, two hops: ANY → suomi → mi
   (`plugin/AGENT.md` for sessions; `cli/translate.js` fallback corpus).
   Neither server translates. Unknown tokens pass through.
2. Public pages never contain original text, uploader identity, or
   `user@host` tokens (scrubbed to `koreingoa@tūmau`); GitHub repo
   coordinates are never serialized to public routes — only inside the
   verified `/api/unlock` response.
3. xsnap.app unlocks with the rinnegan (verbatim in the dialog);
   xsnapshot.app unlocks with `github_username:password` and OPENS the
   user's raw repo — no original text is ever rendered on xsnapshot.app.
4. Paste pages carry the `[169,13,13]` wetehuna button that opens the
   decryptor; the four-step theater runs during the real key check; any
   failure redirects to ufo-fsd.kimi.pro.
5. `/p/*` pages: canonical, immutable-cached, no JS; `/p/*/unlock` is the
   only scripted surface per site (noindex).
