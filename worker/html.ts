// worker/html.ts — lean text-first pages. No JS, inline CSS, crawl-friendly.
// Public pages MUST NOT contain uploader identity or original text.

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const CSS = `:root{color-scheme:dark}body{margin:0;font:16px/1.65 ui-monospace,monospace;background:#0b0e14;color:#d7dde6}main{max-width:72ch;margin:0 auto;padding:32px 20px}h1{font-size:1.5rem}a{color:#7fb4ff}pre{white-space:pre-wrap;word-break:break-word;background:#10151f;border:1px solid #1d2635;border-radius:6px;padding:16px}small,.muted{color:#77839a}footer{margin-top:48px;border-top:1px solid #1d2635;padding-top:12px}.wetehuna{display:inline-block;margin:6px 0 14px;padding:8px 18px;background:#a90d0d;color:#fff;border:1px solid #6d0808;border-radius:6px;text-decoration:none;font-weight:700}`;

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
<em>whakamāori</em> (into te reo Māori) via suomi, both hops done locally
by the uploader's session — the server never translates. The
<em>taketake</em> (original) is recoverable only with the uploader's
<strong>rinnegan</strong>: a user:hash from ${escapeHtml(issuer)}, or —
for plugin publishes — their GitHub user:pass.</p>
<h2>Plugin (AI sessions, keyless)</h2>
<pre>translate locally: content → suomi → te reo Māori
GITHUB_TOKEN=&lt;PAT&gt; node plugin/xsnap.mjs &lt; payload.json</pre>
<p class="muted">Originals live in a private GitHub repo of the uploader;
no key is needed to publish. Unlock at /p/&lt;id&gt;/unlock with the
GitHub user:pass. Guidance: plugin/AGENT.md in the repo.</p>
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
whakamāori (via suomi)</p>
<pre>${escapeHtml(mi)}</pre>
<p><a class="wetehuna" href="/p/${id}/unlock">wetehuna — open the decryptor</a></p>
<footer><small>Koreingoa: no uploader identity is stored on this page. The
taketake (original) is haumaru-encrypted; only its rinnegan holder can
retrieve it.</small></footer>`,
  );
}

export function unlockPage(id: string, origin: string): string {
  const github = origin === "github";
  const fields = github
    ? `<label for="creds">github_username:password — the rinnegan user:pass</label>
<input id="creds" type="password" autocomplete="off" spellcheck="false" placeholder="github_username:password">`
    : `<label for="key">SSoT hash key (rinnegan user:hash)</label>
<input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="user:…">`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>xsnap/${id} — wetehuna</title>
<style>
:root{color-scheme:light}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#3a6ea5;font:11px Tahoma,'MS Sans Serif',Geneva,sans-serif;color:#000}
.dlg{width:min(440px,92vw);border-radius:8px 8px 0 0;padding:3px;background:#003c74;box-shadow:2px 2px 12px rgba(0,0,0,.5)}
.tb{display:flex;align-items:center;justify-content:space-between;border-radius:6px 6px 0 0;padding:4px 6px 5px;color:#fff;font-weight:700;text-shadow:1px 1px #0f1089;background:linear-gradient(180deg,#0997ff,#0053ee 8%,#0053ee 40%,#005bff 88%,#003dd7)}
.tb .x{width:21px;height:21px;border-radius:3px;border:1px solid #fff;background:linear-gradient(180deg,#ed6e49,#c33 45%,#b02a00 90%,#c33);color:#fff;font:700 11px Tahoma;text-align:center;line-height:19px;cursor:default}
.panel{background:#ece9d8;padding:14px;display:none}
.panel.on{display:block}
.ask label{display:block;margin:6px 0 4px;font-weight:700}
.ask input{width:100%;box-sizing:border-box;border:1px solid #7f9db9;padding:3px 4px;font:11px Tahoma;background:#fff}
.btn{margin-top:12px;padding:3px 16px;font:11px Tahoma;border:1px solid #003c74;border-radius:3px;background:linear-gradient(180deg,#fff,#ecebe5 86%,#d8d0c4)}
.status{margin:10px 0 6px;font-weight:700;min-height:14px}
.bar{height:16px;border:1px solid #7f9db9;background:#fff;padding:1px;overflow:hidden}
.bar i{display:block;height:100%;width:34%;background:repeating-linear-gradient(90deg,#4be04b 0 8px,#fff 8px 10px);animation:slide 1.1s linear infinite}
@keyframes slide{from{transform:translateX(-110%)}to{transform:translateX(330%)}}
pre.out{white-space:pre-wrap;word-break:break-word;background:#fff;border:1px solid #7f9db9;padding:8px;max-height:50vh;overflow:auto;margin:10px 0}
.err{color:#a00}.btn.go{background:#a90d0d;color:#fff;border-color:#6d0808;font-weight:700}
</style>
</head>
<body>
<div class="dlg">
  <div class="tb"><span>xsnap decrypt — ${escapeHtml(id)}</span><span class="x">×</span></div>
  <div class="panel ask on" id="ask">
    ${fields}
    <button class="btn go" id="go">Decrypt</button>
  </div>
  <div class="panel" id="run">
    <div class="status" id="status">Decrypting ....</div>
    <div class="bar"><i></i></div>
  </div>
  <div class="panel" id="done">
    <div class="status">Verbatim original — unlocked via rinnegan'd SSoT key.</div>
    <pre class="out" id="out"></pre>
  </div>
</div>
<script>
const STEPS=["Decrypting ....","Tetraquantum unlocking ....","Aurelion Sol consulting ....","Maori AI webster'ng ...."];
const id=${JSON.stringify(id)};
const github=${JSON.stringify(github)};
function $(s){return document.querySelector(s)}
function delay(ms){const{promise,resolve}=Promise.withResolvers();setTimeout(resolve,ms);return promise}
function payload(){
  if(github){
    const user=$('#user').value.trim(),token=$('#token').value.trim();
    return user&&token?{user,token,id}:null;
  }
  const key=$('#key').value.trim();
  return key?{rinnegan:key,id}:null;
}
$('#go').addEventListener('click',async()=>{
  const body=payload();
  if(!body)return;
  $('#ask').classList.remove('on');
  $('#run').classList.add('on');
  // The theater below is cosmetic: the only real operation is checking the
  // presented key — rinnegan hash or GitHub user:pass — against the owner
  // of this paste (server-side).
  const tick=(async()=>{for(const s of STEPS){$('#status').textContent=s;await delay(650)}})();
  const endpoint=github?'/api/unlock':'/api/decrypt';
  let res;
  try{
    res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  }catch{res={ok:false}}
  await tick;
  if(res.ok){
    const j=await res.json();
    $('#run').classList.remove('on');
    $('#out').textContent=j.transcript;
    $('#done').classList.add('on');
    // github mode: also open the user's raw repo (coords are disclosed
    // only after the ownership check, inside this verified response)
    if(j.repo_url)window.open(j.repo_url,'_blank','noopener');
  }else{
    $('#status').textContent='Key does not match this paste\\u2019s rinnegan. Redirecting\\u2026';
    $('#status').classList.add('err');
    setTimeout(()=>location.replace('https://ufo-fsd.kimi.pro/'),900);
  }
});
for(const sel of github?['#creds']:['#key']){
  $(sel).addEventListener('keydown',e=>{if(e.key==='Enter')$('#go').click()});
}
</script>
</body>
</html>`;
}

export function notFoundPage(origin: string): string {
  return layout("xsnap — korekore (not found)", "No such paste.", `${origin}/404`,
    `<h1>korekore</h1><p>No such paste. <a href="/">→ xsnap</a></p>`);
}
