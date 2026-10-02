# xsnap.app

Anonymous, text-only, **public** pastebin for CLI session transcripts —
with a twist: every paste's public page is rendered into **te reo Māori**
from any source language, and the original is recoverable **only** by the
uploader's **rinnegan** (`user:hash` credential minted by the Kimi-OAuth
section of [ufo-fsd.kimi.pro](https://ufo-fsd.kimi.pro)).

- Public: `/p/<id>` — anonymous, no JS, crawlable (robots + sitemap),
  immutable. No uploader identity, no `user@host` tokens, no original text.
- Private: `POST /api/decrypt` with the rinnegan → the verbatim original
  (AES-256-GCM at rest, key derived from the rinnegan).

> This repo previously hosted the xsnap.app → xsnapshot.app redirect
> landing (kept in git history). It is now the source of the pastebin
> service itself.

## Layout

| Area | Path |
|---|---|
| App (routes, crypto, pages) | `worker/` |
| ANY→Māori translation | `worker/translate/` |
| CLI (QUIC-first, AdGuard-CA) | `cli/` |
| Local dev runner | `dev/server.ts` |
| Everything-to-everything map | **`docs/PATHS.md`** |
| Rinnegan spec + federation | `docs/RINNEGAN.md` |
| System design | `docs/ARCHITECTURE.md` |
| Cloudflare deploy + domain cutover | `docs/DEPLOY.md` |

## Quickstart (local)

```bash
bun dev/server.ts                      # http://localhost:8787 (SQLite dev DB)

RIN=$(curl -s -X POST localhost:8787/dev/rinnegan -d '{"user":"you"}' | jq -r .rinnegan)

node cli/xsnap.js upload -whole   -f session.log  -r "$RIN" --api http://localhost:8787
node cli/xsnap.js upload -inputs  -f session.cast -r "$RIN" --api http://localhost:8787
node cli/xsnap.js upload -outputs -f session.log  -r "$RIN" --api http://localhost:8787
node cli/xsnap.js decrypt <id> -r "$RIN" --api http://localhost:8787
```

Regression loop: `bash test/smoke.sh` (mint → upload → scrub/leak checks →
decrypt roundtrip → 401/403 → robots/sitemap → slicing modes).

## CLI transport

QUIC (HTTP/3) preferred via `curl --http3-only`; TCP TLS fallback; and the
TLS trust anchor is the **AdGuard-minted CA** (the root AdGuard mints on
the fly once installed, re-signing leaves per connection) when one is
configured: `--ca PATH`, `XSNAP_CA`, `~/.config/xsnap/adguard-ca.pem`,
or well-known AdGuard Home cert paths.

## Deploy

Worker `xsnap-paste` + D1 — see `docs/DEPLOY.md`. Never deploy over the
shared `xsnapshot` Cloudflare Pages project.

## Wire

- Origin: `https://github.com/VeigaPunk/xsnap.git` (main)
- Editor: Cursor — `.cursor/rules/xsnap.mdc` carries the project rules.
