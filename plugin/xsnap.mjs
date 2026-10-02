#!/usr/bin/env node
// plugin/xsnap.mjs — the keyless session plugin for xsnap.app.
//
// Ships with the rinnegan'd section of ufo-fsd.kimi.pro. The AI session
// does the translation locally (TWO hops: content → suomi → te reo Māori —
// see AGENT.md); this script does the plumbing:
//
//   1. verify the GitHub token, resolve the login
//   2. derive the paste id  = sha256(maori + nonce2)[0..16]
//   3. create a PRIVATE GitHub repo xsnap-<id> and push the original
//   4. publish the public page (keyless): POST /api/publish
//
// The original never touches xsnap; the rinnegan that unlocks it at
// /p/<id>/unlock is merely the uploader's github user:pass.
//
// Usage:
//   cat payload.json | GITHUB_TOKEN=ghp_… node plugin/xsnap.mjs [--api URL]
//   payload.json: {"content": "...", "suomi": "...", "maori": "..."}
//   (suomi is kept for the audit trail; maori is the published body)

import { createHash, randomBytes } from "node:crypto";
function die(msg, code = 1) {
  process.stderr.write(`xsnap-plugin: ${msg}\n`);
  process.exit(code);
}

function field(body, name) {
  return body !== null && typeof body === "object" && name in body
    && typeof body[name] === "string" ? body[name] : null;
}

const argv = process.argv.slice(2);
const apiFlag = (() => {
  const i = argv.indexOf("--api");
  return i >= 0 ? argv[i + 1] : null;
})();
const API = (apiFlag || process.env.XSNAPSHOT_API || process.env.XSNAP_API
  || "https://xsnapshot.app").replace(/\/+$/, "");
const TOKEN = process.env.GITHUB_TOKEN;
const MAX_CHARS = 512_000;

if (!TOKEN) die("GITHUB_TOKEN (PAT with repo create + contents write) required");

let payload;
try {
  payload = JSON.parse(process.stdin.isTTY ? die("pipe the payload JSON on stdin") : await new Promise((resolve) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  }));
} catch {
  die("payload must be JSON: {content, suomi, maori}");
}
const content = field(payload, "content");
const maori = field(payload, "maori");
if (!content || content.length === 0 || content.length > MAX_CHARS) {
  die(`content missing or over ${MAX_CHARS} chars`);
}
if (!maori || maori.trim().length === 0) {
  die("maori missing — the session must run BOTH hops locally first "
    + "(content → suomi → maori); see AGENT.md");
}

const GH = "https://api.github.com";
const ghHeaders = {
  authorization: `Bearer ${TOKEN}`,
  accept: "application/vnd.github+json",
  "user-agent": "xsnap-plugin",
  "x-github-api-version": "2022-11-28",
};

async function gh(path, init = {}) {
  const res = await fetch(GH + path, { ...init, headers: ghHeaders });
  const body = await res.json().catch(() => null);
  return { res, body };
}

const sha256Hex = (s) => createHash("sha256").update(s).digest("hex");

const { res: whoRes, body: whoBody } = await gh("/user");
if (whoRes.status !== 200) die(`github token rejected (${whoRes.status})`, 3);
const login = field(whoBody, "login");
if (!login) die("github /user returned no login");

const nonce2 = randomBytes(8).toString("hex"); // 16 hex
const id = sha256Hex(maori + nonce2).slice(0, 16);
const repo = `xsnap-${id}`;
const path = `p/${id}/original.txt`;

const { res: repoRes } = await gh("/user/repos", {
  method: "POST",
  body: JSON.stringify({ name: repo, private: true,
    description: `xsnap private original ${id} — xsnap.app/p/${id}` }),
});
if (repoRes.status !== 201 && repoRes.status !== 422) {
  die(`repo create failed (${repoRes.status})`);
}

const { res: putRes } = await gh(`/repos/${login}/${repo}/contents/${path}`, {
  method: "PUT",
  body: JSON.stringify({
    message: `xsnap ${id}`,
    content: Buffer.from(content, "utf8").toString("base64"),
  }),
});
if (putRes.status !== 201 && putRes.status !== 200) {
  die(`original push failed (${putRes.status})`);
}

const pub = await fetch(`${API}/api/publish`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    mi: maori, owner: login, repo, path, nonce2, bytes: content.length,
  }),
});
const pubBody = await pub.json().catch(() => null);
if (pub.status !== 201) {
  die(`publish failed (${pub.status}): ${JSON.stringify(pubBody)}`, 2);
}
process.stdout.write(JSON.stringify({
  id: field(pubBody, "id"),
  url: field(pubBody, "url"),
  repo: `${login}/${repo}`,
  path,
  bytes: content.length,
}, null, 2) + "\n");
