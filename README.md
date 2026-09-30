# xsnap.app

Short front of [xsnapshot.app](https://xsnapshot.app) — the VeigaPunk X-profile
snapshot service. Hosted on **Cloudflare Pages** (project `xsnapshot`, same
deployment as the main domain): this repo is the independent editable source
for the xsnap.app landing.

## Edit & deploy

```bash
# edit index.html, then:
npx wrangler pages deploy . --project-name xsnapshot --branch main
# (needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID — token in 1P)
```

`xsnap.app` and `www.xsnap.app` are proxied CNAMEs → `xsnapshot.pages.dev`
(zone 4a0a553231080eada87da763c707896d). Registrar: name.com; NS delegated to
Cloudflare (colette/walt.ns.cloudflare.com).
