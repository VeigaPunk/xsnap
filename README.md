# xsnap.app

Anonymous, text-only, **public** pastebin for CLI session transcripts —
with a twist: every paste's public page carries a two-hop rendering
(**ANY language → suomi → te reo Māori**) produced entirely on the
uploader's side, and the verbatim original is recoverable **only** with
the uploader's **rinnegan**.

Two publish modes:

- **Plugin** (AI sessions, keyless — ships with the rinnegan'd section of
  [ufo-fsd.kimi.pro](https://ufo-fsd.kimi.pro)): the session translates
  locally (`plugin/AGENT.md`), the plugin pushes the original to the
  uploader's **private GitHub repo** and publishes only the Māori body.
  Unlock = the uploader's **github_username:password**; the decryptor
  dialog also opens the raw repo.
- **CLI** (classic, no GitHub involvement): `user:hash` rinnegan;
  original AES-256-GCM'd at rest on xsnap.

Public pages: anonymous, no JS, crawlable (robots + sitemap), immutable;
no uploader identity, no `user@host` tokens, no repo coordinates.

> This repo previously hosted the xsnap.app → xsnapshot.app redirect
> landing (kept in git history). Companion flagship: [xsnapshot.app](https://xsnapshot.app).

## Layout

| Area | Path |
|---|---|
| App (routes, crypto, pages, XP unlock dialog) | `worker/` |
| CLI (local 2-hop renderer, QUIC-first, AdGuard-CA) | `cli/` |
| Keyless session plugin + agent guidance | `plugin/` |
| Local dev runner | `dev/server.ts` |
| Everything-to-everything map | **`docs/PATHS.md`** |
| Rinnegan spec (user:hash + github user:pass) | `docs/RINNEGAN.md` |
| System design | `docs/ARCHITECTURE.md` |
| Cloudflare deploy + domain cutover | `docs/DEPLOY.md` |

## Quickstart (local)

```bash
bun dev/server.ts                      # http://localhost:8787 (SQLite dev DB)

# classic CLI mode
RIN=$(curl -s -X POST localhost:8787/dev/rinnegan -d '{"user":"you"}' | jq -r .rinnegan)
node cli/xsnap.js upload -whole   -f session.log  -r "$RIN" --api http://localhost:8787
node cli/xsnap.js decrypt <id>    -r "$RIN" --api http://localhost:8787

# plugin mode (session translates; needs a GitHub PAT)
cat payload.json | GITHUB_TOKEN=ghp_… node plugin/xsnap.mjs --api http://localhost:8787
```

Regression loop: `bash test/smoke.sh` — both modes: mint → upload/publish →
scrub & leak checks → unlock surfaces → 401/403 → robots/sitemap → slicing
modes → two-hop corpus lockstep.

## Unlock UX

Each paste page carries a `RGB(169,13,13)` red **wetehuna** button → the
decryptor dialog (Windows-XP styled):

```
[ Decrypting .... | Tetraquantum unlocking .... |
  Aurelion Sol consulting .... | Maori AI webster'ng .... ]
```

Key check runs under the theater: match → verbatim original (+ the raw
repo opens for plugin pastes); mismatch/error → redirect to
ufo-fsd.kimi.pro. Lending your rinnegan'd eyes to a regular = sharing the
key; possession is permission.

## CLI transport

QUIC (HTTP/3) preferred via `curl --http3-only`; TCP TLS fallback; the TLS
trust anchor is the **AdGuard-minted CA** (the root AdGuard mints on the
fly once installed) when configured: `--ca PATH`, `XSNAP_CA`,
`~/.config/xsnap/adguard-ca.pem`, or well-known AdGuard Home paths.

## Deploy

Worker `xsnap-paste` + D1 — see `docs/DEPLOY.md`. Never deploy over the
shared `xsnapshot` Cloudflare Pages project.

## Wire

- Origin: `https://github.com/VeigaPunk/xsnap.git` (main)
- Editor: Cursor — `.cursor/rules/xsnap.mdc` carries the project rules.
