// worker/index.ts — the xsnap.app app. One fetch handler, zero deps.
// Prod: Cloudflare Workers + D1 (wrangler.toml). Dev: Bun via dev/server.ts.
//
// Translation NEVER happens here: clients render the public body locally
// (ANY→suomi→mi — the session/AI does both hops; see plugin/ and
// cli/translate.js). The server publishes what it is given, scrubbed.
//
// Route map (authoritative in docs/PATHS.md):
//   GET  /               home
//   GET  /robots.txt     targeted crawl rules
//   GET  /sitemap.xml    last 500 pastes
//   GET  /p/:id          public paste page (mi only, immutable cache)
//   GET  /p/:id/raw      text/plain mi body
//   GET  /p/:id/meta     public JSON metadata
//   GET  /p/:id/unlock   XP-styled unlock dialog (noindex)
//   POST /api/upload     {rinnegan, mi, transcript, mode} → {id,url,bytes}
//                        ciphertext mode: original AES-GCM'd on xsnap
//   POST /api/publish    {mi, owner, repo, path, nonce2} → {id,url}
//                        plugin mode: keyless; original lives in the
//                        uploader's PRIVATE GitHub repo
//   POST /api/decrypt    {rinnegan, id} → verbatim original (ciphertext mode)
//   POST /api/unlock     {user, token, id} → verbatim original (github mode;
//                        creds verified against GitHub, owner must match)
//   POST /dev/rinnegan   DEV only: mint {user} → {rinnegan}

import { wrapD1, type DBLike } from "./d1";
import { verify, mint, wrapKey, parse } from "./rinnegan";
import { sha256Hex, aesEncrypt, aesDecrypt } from "./crypto";
import { homePage, pastePage, notFoundPage, unlockPage } from "./html";

export interface Env {
  DB: DBLike | Record<string, unknown>;
  RINNEGAN_ISSUER_KEY: string;
  RINNEGAN_ISSUER_ID?: string;
  ORIGIN?: string;
  DEV?: boolean | string | number;
}

interface PasteRow {
  id: string; origin: string; owner: string; repo: string | null;
  path: string | null; nonce: string | null; ciphertext: string | null;
  mi: string; mode: string; bytes: number; created_at: number;
}

const MAX_CHARS = 512_000;
const ID_RE = /^[0-9a-f]{16}$/;
const GH_USER_RE = /^[A-Za-z0-9-]{1,39}$/;
const GH_REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

function originOf(env: Env): string {
  return env.ORIGIN || "https://xsnap.app";
}

function devOnly(env: Env): boolean {
  return env.DEV === true || env.DEV === "1" || env.DEV === 1;
}

// The public body must never carry uploader provenance: user@host / email
// shaped tokens are scrubbed to a placeholder before storing. Originals are
// unaffected — unlock returns them as uploaded.
const PROVENANCE_RE = /[\p{L}\p{N}._-]+@[\p{L}\p{N}._-]+/gu;

function scrubMi(mi: string): string {
  return mi.replace(PROVENANCE_RE, "koreingoa@tūmau");
}

function json(body: unknown, status = 200, cache = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache,
      "x-content-type-options": "nosniff",
    },
  });
}

function html(body: string, status = 200, cache = "public, max-age=300"): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cache,
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    },
  });
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 1_400_000) throw new Error("payload too large");
  return (await req.json()) as Record<string, unknown>;
}

function dbOf(env: Env): DBLike {
  const db = env.DB as DBLike;
  if (typeof db?.prepare === "function") return db;
  return wrapD1(env.DB as never);
}

/// Ciphertext mode: rinnegan-held original. The public body (mi) is supplied
/// by the client — rendered locally, never here.
async function handleUpload(req: Request, db: DBLike, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJson(req);
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const { rinnegan, transcript, mi } = body;
  const mode = body.mode === "inputs" || body.mode === "outputs"
    ? body.mode : "whole";
  if (typeof rinnegan !== "string" || typeof transcript !== "string"
    || typeof mi !== "string" || mi.trim().length === 0
    || transcript.length === 0 || transcript.length > MAX_CHARS
    || mi.length > MAX_CHARS) {
    return json({ error: "bad request", max_chars: MAX_CHARS }, 400);
  }
  const r = await verify(rinnegan, env.RINNEGAN_ISSUER_KEY);
  if (!r) return json({ error: "invalid rinnegan" }, 401);

  const key = await wrapKey(r.hash);
  const { nonce, ct } = await aesEncrypt(key, transcript);
  const id = (await sha256Hex(nonce + ct)).slice(0, 16);
  try {
    await db.prepare(
      "INSERT INTO pastes (id, origin, owner, nonce, ciphertext, mi, mode, bytes, created_at)"
      + " VALUES (?, 'xsnap', ?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, r.owner, nonce, ct, scrubMi(mi), mode, transcript.length,
      Math.floor(Date.now() / 1000)).run();
  } catch {
    return json({ error: "paste id collision", id }, 409);
  }
  return json({ id, url: `${originOf(env)}/p/${id}`,
    bytes: transcript.length, mode }, 201);
}

/// Plugin mode: keyless publish. The original lives in the uploader's
/// PRIVATE GitHub repo (pushed by the plugin); xsnap stores only the
/// coordinates and the public body. id = sha256(mi + nonce2) — the plugin
/// computes the same id before pushing, so path and id agree.
async function handlePublish(req: Request, db: DBLike, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJson(req);
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const { mi, owner, repo, path, nonce2, bytes } = body;
  if (typeof mi !== "string" || mi.trim().length === 0 || mi.length > MAX_CHARS
    || typeof owner !== "string" || !GH_USER_RE.test(owner)
    || typeof repo !== "string" || !GH_REPO_RE.test(repo)
    || typeof path !== "string" || path.length === 0 || path.length > 300
    || typeof nonce2 !== "string" || !ID_RE.test(nonce2)) {
    return json({ error: "bad request", max_chars: MAX_CHARS }, 400);
  }
  const id = (await sha256Hex(mi + nonce2)).slice(0, 16);
  try {
    await db.prepare(
      "INSERT INTO pastes (id, origin, owner, repo, path, mi, mode, bytes, created_at)"
      + " VALUES (?, 'github', ?, ?, ?, ?, 'whole', ?, ?)",
    ).bind(id, owner, repo, path, scrubMi(mi),
      typeof bytes === "number" ? bytes : mi.length,
      Math.floor(Date.now() / 1000)).run();
  } catch {
    return json({ error: "paste id collision", id }, 409);
  }
  return json({ id, url: `${originOf(env)}/p/${id}` }, 201);
}

/// GitHub-mode unlock: verify the presented user:token against GitHub and
/// that the login owns this paste, then fetch the original from the private
/// repo. Credentials are used in-memory only — never logged, never stored.
async function handleUnlock(req: Request, db: DBLike, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJson(req);
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const { user, token, id } = body;
  if (typeof user !== "string" || !GH_USER_RE.test(user)
    || typeof token !== "string" || token.length < 20 || token.length > 255
    || typeof id !== "string" || !ID_RE.test(id)) {
    return json({ error: "bad request" }, 400);
  }
  const row = await db.prepare(
    "SELECT id, origin, owner, repo, path FROM pastes WHERE id = ?",
  ).bind(id).first<PasteRow>();
  if (!row || row.origin !== "github" || !row.repo || !row.path) {
    return json({ error: "not found" }, 404);
  }

  const auth = "Basic " + btoa(`${user}:${token}`);
  const headers = {
    authorization: auth,
    accept: "application/vnd.github+json",
    "user-agent": "xsnap-app",
    "x-github-api-version": "2022-11-28",
  };
  let who: Response;
  try {
    who = await fetch("https://api.github.com/user", { headers });
  } catch {
    return json({ error: "github unreachable" }, 502);
  }
  if (who.status !== 200) return json({ error: "invalid github credentials" }, 401);
  const whoBody: unknown = await who.json();
  const login = (whoBody !== null && typeof whoBody === "object"
    && "login" in whoBody && typeof whoBody.login === "string")
    ? whoBody.login : null;
  if (login === null || login.toLowerCase() !== row.owner.toLowerCase()
    || login.toLowerCase() !== user.toLowerCase()) {
    return json({ error: "not your paste" }, 403);
  }

  let file: Response;
  try {
    file = await fetch(
      `https://api.github.com/repos/${row.owner}/${row.repo}/contents/${
        encodeURIComponent(row.path)}`,
      { headers });
  } catch {
    return json({ error: "github unreachable" }, 502);
  }
  if (file.status !== 200) return json({ error: "original unavailable" }, 404);
  const fileBody: unknown = await file.json();
  const encoded = (fileBody !== null && typeof fileBody === "object"
    && "content" in fileBody && typeof fileBody.content === "string")
    ? fileBody.content.replace(/\n/g, "") : "";
  const transcript = atob(encoded);
  if (transcript.length > 4 * MAX_CHARS) {
    return json({ error: "original too large" }, 413);
  }
  // Coordinates are disclosed only here, after the credentials verified
  // AND the login owns this paste — never on public routes.
  return json({
    id, transcript, mode: "whole",
    repo_url: `https://github.com/${row.owner}/${row.repo}/blob/HEAD/${row.path}`,
    raw_url: `https://raw.githubusercontent.com/${row.owner}/${row.repo}/HEAD/${row.path}`,
  });
}

async function handleDecrypt(req: Request, db: DBLike, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJson(req);
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const rinneganRaw = body.rinnegan;
  const id = body.id;
  if (typeof rinneganRaw !== "string" || typeof id !== "string"
    || !ID_RE.test(id)) {
    return json({ error: "bad request" }, 400);
  }
  const r = await verify(rinneganRaw, env.RINNEGAN_ISSUER_KEY);
  if (!r) return json({ error: "invalid rinnegan" }, 401);

  const row = await db.prepare(
    "SELECT id, origin, owner, nonce, ciphertext, mode, bytes, created_at FROM pastes WHERE id = ?",
  ).bind(id).first<PasteRow>();
  if (!row) return json({ error: "not found" }, 404);
  if (row.origin !== "xsnap") return json({ error: "github-mode paste; use /api/unlock" }, 400);
  if (row.owner !== r.owner) return json({ error: "not your paste" }, 403);

  try {
    const key = await wrapKey(r.hash);
    const transcript = await aesDecrypt(key, row.nonce!, row.ciphertext!);
    return json({ id, transcript, mode: row.mode, bytes: row.bytes,
      created_at: row.created_at });
  } catch {
    return json({ error: "integrity failure" }, 500);
  }
}

async function pasteResponse(db: DBLike, env: Env, id: string): Promise<Response> {
  if (!ID_RE.test(id)) return html(notFoundPage(originOf(env)), 404);
  const row = await db.prepare(
    "SELECT id, mi, mode, bytes, created_at FROM pastes WHERE id = ?",
  ).bind(id).first<PasteRow>();
  if (!row) return html(notFoundPage(originOf(env)), 404);
  return html(
    pastePage(row.id, row.mi, row.bytes, row.created_at, row.mode, originOf(env)),
    200, "public, max-age=31536000, immutable",
  );
}

async function rawResponse(db: DBLike, id: string): Promise<Response> {
  if (!ID_RE.test(id)) return new Response("korekore\n", { status: 404 });
  const row = await db.prepare("SELECT mi FROM pastes WHERE id = ?")
    .bind(id).first<PasteRow>();
  if (!row) return new Response("korekore\n", { status: 404 });
  return new Response(row.mi, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

async function metaResponse(db: DBLike, id: string): Promise<Response> {
  if (!ID_RE.test(id)) return json({ error: "not found" }, 404);
  const row = await db.prepare(
    "SELECT id, origin, mode, bytes, created_at FROM pastes WHERE id = ?",
  ).bind(id).first<PasteRow>();
  if (!row) return json({ error: "not found" }, 404);
  // origin/repo/path stay private on public surfaces: repo coordinates
  // would disclose the uploader's GitHub account (provenance).
  return json({ id: row.id, mode: row.mode, bytes: row.bytes,
    created_at: row.created_at }, 200, "public, max-age=31536000, immutable");
}

async function unlockResponse(db: DBLike, env: Env, id: string): Promise<Response> {
  if (!ID_RE.test(id)) return html(notFoundPage(originOf(env)), 404);
  const row = await db.prepare("SELECT id, origin FROM pastes WHERE id = ?")
    .bind(id).first<PasteRow>();
  if (!row) return html(notFoundPage(originOf(env)), 404);
  return new Response(unlockPage(row.id, row.origin), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'; "
        + "style-src 'unsafe-inline'; connect-src 'self'; "
        + "base-uri 'none'; form-action 'self'",
    },
  });
}

async function sitemapResponse(db: DBLike, env: Env): Promise<Response> {
  const rows = await db.prepare(
    "SELECT id, created_at FROM pastes ORDER BY created_at DESC LIMIT 500",
  ).bind().all<{ id: string; created_at: number }>();
  const origin = originOf(env);
  const urls = rows.map((r) =>
    `  <url><loc>${origin}/p/${r.id}</loc><lastmod>${
      new Date(r.created_at * 1000).toISOString()}</lastmod></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

const ROBOTS = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /dev/
`;

export async function app(req: Request, env: Env): Promise<Response> {
  const path = new URL(req.url).pathname;
  const db = dbOf(env);

  if (req.method === "GET" || req.method === "HEAD") {
    if (path === "/") {
      return html(
        homePage(originOf(env), env.RINNEGAN_ISSUER_ID || "ufo-fsd.kimi.pro"),
        200, "public, max-age=300");
    }
    if (path === "/robots.txt") {
      return new Response(ROBOTS, {
        headers: { "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=3600" } });
    }
    if (path === "/sitemap.xml") return sitemapResponse(db, env);
    const paste = path.match(/^\/p\/([0-9a-f]+)(?:\/(raw|meta|unlock))?\/?$/);
    if (paste) {
      if (paste[2] === "raw") return rawResponse(db, paste[1]);
      if (paste[2] === "meta") return metaResponse(db, paste[1]);
      if (paste[2] === "unlock") return unlockResponse(db, env, paste[1]);
      return pasteResponse(db, env, paste[1]);
    }
    return html(notFoundPage(originOf(env)), 404);
  }

  if (req.method === "POST") {
    if (path === "/api/upload") return handleUpload(req, db, env);
    if (path === "/api/publish") return handlePublish(req, db, env);
    if (path === "/api/decrypt") return handleDecrypt(req, db, env);
    if (path === "/api/unlock") return handleUnlock(req, db, env);
    if (path === "/dev/rinnegan" && devOnly(env)) {
      let body: Record<string, unknown>;
      try {
        body = await readJson(req);
      } catch {
        return json({ error: "bad request" }, 400);
      }
      if (typeof body.user !== "string"
        || !parse(`${body.user}:${"0".repeat(64)}`)) {
        return json({ error: "bad user id" }, 400);
      }
      return json({
        rinnegan: await mint(body.user, env.RINNEGAN_ISSUER_KEY),
        issuer: env.RINNEGAN_ISSUER_ID || "dev",
        note: "dev-minted; prod rinnegan comes from the Kimi OAuth section",
      });
    }
  }

  return json({ error: "not found" }, 404);
}

export default {
  fetch: (req: Request, env: Env): Promise<Response> => app(req, env),
};
