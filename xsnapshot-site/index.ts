// xsnapshot-site/index.ts — the GitHub-mode transcript app for
// xsnapshot.app. Deployed as a route-limited Worker (xsnapshot.app/p/* and
// its two API routes) so the existing X-snapshot Pages site is untouched.
//
// Model: the user hosts their own transcript original in a PRIVATE GitHub
// repo (pushed by plugin/xsnap.mjs); the simple unlock key is the
// github_username:password. This site never stores or serves the original —
// unlock verifies the credentials, checks ownership, and hands back the
// repo/raw URLs; the dialog opens them.
//
// Translation NEVER happens here: the session renders the public body
// locally (ANY→suomi→mi, plugin/AGENT.md).
//
// Routes:
//   GET  /p/:id          public paste page (mi only, immutable)
//   GET  /p/:id/raw      text/plain mi body
//   GET  /p/:id/meta     public JSON metadata
//   GET  /p/:id/unlock   XP-styled github user:pass decryptor (noindex)
//   POST /api/publish    {mi, owner, repo, path, nonce2, bytes?} keyless
//   POST /api/unlock     {user, token, id} → {repo_url, raw_url} only

import { wrapD1, type DBLike } from "../worker/d1";
import { sha256Hex } from "../worker/crypto";
import { pastePage, notFoundPage, unlockPage } from "./html";

export interface Env {
  DB: DBLike | Record<string, unknown>;
  ORIGIN?: string;
}

interface PasteRow {
  id: string; owner: string; repo: string; path: string;
  mi: string; bytes: number; created_at: number;
}

const MAX_CHARS = 512_000;
const ID_RE = /^[0-9a-f]{16}$/;
const GH_USER_RE = /^[A-Za-z0-9-]{1,39}$/;
const GH_REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

function originOf(env: Env): string {
  return env.ORIGIN || "https://xsnapshot.app";
}

// The public body must never carry uploader provenance.
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

/// Keyless publish. The original already lives in the uploader's private
/// repo; we store only coordinates + the public body. id = sha256(mi+nonce2)
/// — the plugin computed the same id before pushing, so path and id agree.
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

/// Unlock: verify user:token against GitHub, require the login to own this
/// paste, then disclose the repo coordinates — nothing else. The original
/// itself is read on GitHub, never proxied here.
async function handleUnlock(req: Request, db: DBLike): Promise<Response> {
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
    "SELECT id, owner, repo, path FROM pastes WHERE id = ?",
  ).bind(id).first<PasteRow>();
  if (!row || !row.repo || !row.path) {
    return json({ error: "not found" }, 404);
  }

  const headers = {
    authorization: "Basic " + btoa(`${user}:${token}`),
    accept: "application/vnd.github+json",
    "user-agent": "xsnapshot-app",
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

  return json({
    id,
    repo_url: `https://github.com/${row.owner}/${row.repo}/blob/HEAD/${row.path}`,
    raw_url: `https://raw.githubusercontent.com/${row.owner}/${row.repo}/HEAD/${row.path}`,
  });
}

async function pasteResponse(db: DBLike, env: Env, id: string): Promise<Response> {
  if (!ID_RE.test(id)) return html(notFoundPage(originOf(env)), 404);
  const row = await db.prepare(
    "SELECT id, mi, bytes, created_at FROM pastes WHERE id = ?",
  ).bind(id).first<PasteRow>();
  if (!row) return html(notFoundPage(originOf(env)), 404);
  return html(
    pastePage(row.id, row.mi, row.bytes, row.created_at, originOf(env)),
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
    "SELECT id, bytes, created_at FROM pastes WHERE id = ?",
  ).bind(id).first<PasteRow>();
  if (!row) return json({ error: "not found" }, 404);
  return json({ id: row.id, mode: "whole", bytes: row.bytes,
    created_at: row.created_at }, 200, "public, max-age=31536000, immutable");
}

async function unlockResponse(db: DBLike, env: Env, id: string): Promise<Response> {
  if (!ID_RE.test(id)) return html(notFoundPage(originOf(env)), 404);
  const row = await db.prepare("SELECT id FROM pastes WHERE id = ?")
    .bind(id).first<PasteRow>();
  if (!row) return html(notFoundPage(originOf(env)), 404);
  return new Response(unlockPage(row.id), {
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

export async function app(req: Request, env: Env): Promise<Response> {
  const path = new URL(req.url).pathname;
  const db = dbOf(env);

  const paste = path.match(/^\/p\/([0-9a-f]+)(?:\/(raw|meta|unlock))?\/?$/);
  if (paste && (req.method === "GET" || req.method === "HEAD")) {
    if (paste[2] === "raw") return rawResponse(db, paste[1]);
    if (paste[2] === "meta") return metaResponse(db, paste[1]);
    if (paste[2] === "unlock") return unlockResponse(db, env, paste[1]);
    return pasteResponse(db, env, paste[1]);
  }

  if (req.method === "POST") {
    if (path === "/api/publish") return handlePublish(req, db, env);
    if (path === "/api/unlock") return handleUnlock(req, db);
  }

  return json({ error: "not found" }, 404);
}

export default {
  fetch: (req: Request, env: Env): Promise<Response> => app(req, env),
};
