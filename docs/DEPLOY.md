# Deploy — xsnap.app

## ⚠ Before anything: do not touch the shared Pages project

`xsnap.app` currently rides the Cloudflare Pages project `xsnapshot`
(shared with xsnapshot.app). The pastebin is a **Worker + D1**, a different
shape. Deploying it over that Pages project would take xsnapshot.app down.
The cutover moves the `xsnap.app` custom domain to the new worker.

## One-time provision

```bash
npm i -g wrangler            # if absent
wrangler login               # needs the CF token from 1P if not headless

wrangler d1 create xsnap     # paste database_id into wrangler.toml
wrangler d1 execute xsnap --remote --file schema.sql

wrangler secret put RINNEGAN_ISSUER_KEY    # generate: openssl rand -hex 32
# optional fluent translator:
wrangler secret put TRANSLATE_URL          # OpenAI-compatible chat endpoint
wrangler secret put TRANSLATE_KEY
# and set TRANSLATE_MODEL in [vars]
```

`RINNEGAN_ISSUER_KEY` must equal the key the ufo-fsd.kimi.pro Kimi OAuth
section uses to mint rinnegan (docs/RINNEGAN.md). Dev default in
`dev/server.ts` is intentionally NOT usable in prod.

## Deploy

```bash
wrangler deploy              # worker xsnap-paste
```

## Domain cutover (xsnap.app → the worker)

1. Cloudflare dashboard → Workers → `xsnap-paste` → Settings → Domains &
   Routes → Add → Custom domain `xsnap.app`.
   (CLI: `wrangler` doesn't manage custom domains; UI or API only.)
2. Remove `xsnap.app` / `www.xsnap.app` custom domains from the Pages
   project `xsnapshot` (they conflict).
3. HTTP/3: on Cloudflare it is on by network default; the CLI's
   `--http3-only` rung will negotiate h3 at the edge. Verify:
   `curl --http3-only -sI https://xsnap.app/robots.txt`.
4. Purge the zone cache once after cutover.

## Post-deploy verification

```bash
R=$(curl -s -X POST https://xsnap.app/dev/rinnegan -d '{"user":"smoke"}')  # MUST 404 (no DEV in prod)
node cli/xsnap.js upload -whole -f session.log -r "$XSNAP_RINNEGAN"        # rinnegan minted via Kimi OAuth section
node cli/xsnap.js decrypt <id> -r "$XSNAP_RINNEGAN"
curl -s https://xsnap.app/robots.txt
curl -s https://xsnap.app/sitemap.xml | head
```

## Rollback

Workers versioning (`wrangler rollback`) for code; domain back onto the
Pages project for the landing; D1 data is additive-only (no migrations in
v1 beyond `schema.sql`).
