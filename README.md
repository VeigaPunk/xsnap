# xsnap — two transcript sites

Anonymous, text-only, **public** pastebins for CLI session transcripts.
Every paste's public page carries a two-hop rendering (**ANY language →
suomi → te reo Māori**) produced entirely on the uploader's side; the
verbatim original opens only to key holders.

## The two websites

| | [xsnap.app](https://xsnap.app) | [xsnapshot.app](https://xsnapshot.app) |
|---|---|---|
| Users | rinnegan'd (Kimi OAuth on [ufo-fsd.kimi.pro](https://ufo-fsd.kimi.pro)) | anyone with a GitHub account |
| Upload | CLI with rinnegan `user:hash` | plugin (keyless) — session translates locally |
| Original | AES-256-GCM at rest on xsnap | uploader's own **private GitHub repo** |
| Unlock key | proprietary rinnegan `user:hash` | simple `github_username:password` |
| Unlock payoff | verbatim original in the dialog | the user's raw repo **opens** |

Both dialogs: Windows-XP styled, `[169,13,13]` wetehuna button on the
paste page opens them, the four-step theater
(`Decrypting .... | Tetraquantum unlocking .... | Aurelion Sol consulting .... | Maori AI webster'ng ....`)
runs over the real key check, and any failure redirects to
ufo-fsd.kimi.pro.

## Layout

| Area | Path |
|---|---|
| xsnap.app worker (rinnegan) | `worker/` |
| xsnapshot.app worker (github, route-limited) | `xsnapshot-site/` |
| CLI (xsnap.app) + local 2-hop renderer | `cli/` |
| Keyless plugin + agent guidance (xsnapshot.app) | `plugin/` |
| Dev runners (:8787 / :8788) | `dev/` |
| Everything-to-everything map | **`docs/PATHS.md`** |
| Credential spec (both forms) | `docs/RINNEGAN.md` |
| System design | `docs/ARCHITECTURE.md` |
| Deploys (both workers) | `docs/DEPLOY.md` |

## Quickstart (local)

```bash
bun dev/server.ts                     # xsnap.app   → :8787
bun dev/server-xsnapshot.ts           # xsnapshot.app → :8788

# xsnap.app — rinnegan CLI flow
RIN=$(curl -s -X POST localhost:8787/dev/rinnegan -d '{"user":"you"}' | jq -r .rinnegan)
node cli/xsnap.js upload -whole -f session.log -r "$RIN" --api http://localhost:8787
node cli/xsnap.js decrypt <id> -r "$RIN" --api http://localhost:8787

# xsnapshot.app — plugin flow (session translates; needs a GitHub PAT)
cat payload.json | GITHUB_TOKEN=ghp_… node plugin/xsnap.mjs --api http://localhost:8788
```

Regression across both sites: `bash test/smoke.sh` — mint → upload →
keyless publish → scrub & leak checks → dialogs → 401/403 →
robots/sitemap → slicing modes → two-hop corpus lockstep.

## CLI transport

QUIC (HTTP/3) preferred via `curl --http3-only`; TCP TLS fallback; TLS
trust anchor is the **AdGuard-minted CA** when configured (`--ca`,
`XSNAP_CA`, `~/.config/xsnap/adguard-ca.pem`, AdGuard Home paths).

## Deploy

Workers `xsnap-paste` (xsnap.app) and `xsnapshot-paste`
(route-limited on xsnapshot.app) — `docs/DEPLOY.md`. Never deploy over
the shared `xsnapshot` Cloudflare Pages project.

## Wire

- Origin: `https://github.com/VeigaPunk/xsnap.git` (main)
- Editor: Cursor — `.cursor/rules/xsnap.mdc` carries the project rules.
