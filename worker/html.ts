// worker/html.ts — lean text-first pages. No JS, inline CSS, crawl-friendly.
// Public pages MUST NOT contain uploader identity or original text.

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const CSS = `:root{color-scheme:dark}body{margin:0;font:16px/1.65 ui-monospace,monospace;background:#0b0e14;color:#d7dde6}main{max-width:72ch;margin:0 auto;padding:32px 20px}h1{font-size:1.5rem}a{color:#7fb4ff}pre{white-space:pre-wrap;word-break:break-word;background:#10151f;border:1px solid #1d2635;border-radius:6px;padding:16px}small,.muted{color:#77839a}footer{margin-top:48px;border-top:1px solid #1d2635;padding-top:12px}`;

function layout(title: string, desc: string, canonical: string, body: string): string {
  return `<!doctype html>
<html lang="mi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${escapeHtml(canonical)}">
<style>${CSS}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

export function homePage(origin: string, issuer: string): string {
  return layout(
    "xsnap — tuhinga nohoanga (session-transcript paste)",
    "Anonymous, text-only, public paste for CLI session transcripts. Public body rendered in te reo Māori; originals recoverable only with the uploader's rinnegan.",
    `${origin}/`,
    `<h1>xsnap</h1>
<p>Punakitanga tuhinga nohoanga — anonymous, text-only, public host for CLI
session transcripts. Every paste's public page is rendered
<em>whakamāori</em> (into te reo Māori) from any source language; the
<em>taketake</em> (original) is encrypted at rest and recoverable only with
the uploader's <strong>rinnegan</strong> (${escapeHtml(issuer)}).</p>
<h2>CLI</h2>
<pre>xsnap upload -whole    -f session.log  -r &lt;user:hash&gt;
xsnap upload -inputs   -f session.cast -r &lt;user:hash&gt;
xsnap upload -outputs  -f session.log  -r &lt;user:hash&gt;
xsnap decrypt &lt;id&gt; -r &lt;user:hash&gt;</pre>
<p class="muted">Transport: QUIC (HTTP/3) first, TCP TLS fallback; trust
anchor: the AdGuard-minted CA when configured (<code>--ca</code>).</p>
<h2>Kōnae (files)</h2>
<p><a href="/sitemap.xml">sitemap.xml</a> · <a href="/robots.txt">robots.txt</a></p>
<footer><small>xsnap.app — koreingoa (anonymous), tūmatanui (public),
muna (originals are private to their rinnegan holder).</small></footer>`,
  );
}

export function pastePage(
  id: string, mi: string, bytes: number, createdAt: number, mode: string,
  origin: string,
): string {
  const when = new Date(createdAt * 1000).toISOString().slice(0, 19) + "Z";
  const desc = `Anonymous session transcript ${id} — te reo Māori rendering (${mode}).`;
  return layout(
    `xsnap/${id}`,
    desc,
    `${origin}/p/${id}`,
    `<h1><a href="/">xsnap</a>/${id}</h1>
<p class="muted">${when} · ${bytes} bytes · mode: ${escapeHtml(mode)} ·
whakamāori</p>
<pre>${escapeHtml(mi)}</pre>
<footer><small>Koreingoa: no uploader identity is stored on this page. The
taketake (original) is haumaru-encrypted; only its rinnegan holder can
retrieve it.</small></footer>`,
  );
}

export function notFoundPage(origin: string): string {
  return layout("xsnap — korekore (not found)", "No such paste.", `${origin}/404`,
    `<h1>korekore</h1><p>No such paste. <a href="/">→ xsnap</a></p>`);
}
