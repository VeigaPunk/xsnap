// worker/index.ts — the xsnap.app app. One fetch handler, zero deps.
// Prod: Cloudflare Workers + D1 (wrangler.toml). Dev: Bun via dev/server.ts.
//
// Route map (authoritative in docs/PATHS.md):
//   GET  /               home
//   GET  /robots.txt     targeted crawl rules
//   GET  /sitemap.xml    last 500 pastes
//   GET  /p/:id          public paste page (Māori only, immutable cache)
//   GET  /p/:id/raw      text/plain Māori body
//   GET  /p/:id/meta     public JSON metadata
//   POST /api/upload     {rinnegan, transcript, mode} → {id,url,bytes}
//   POST /api/decrypt    {rinnegan, id} → {id,transcript}
//   POST /dev/rinnegan   DEV only: mint {user} → {rinnegan}

import { wrapD1, type DBLike } from "./d1";
import { verify, mint, wrapKey, parse } from "./rinnegan";
import { sha256Hex, aesEncrypt, aesDecrypt } from "./crypto";
import { translateToMi } from "./translate/mi";
import { translateLLM } from "./translate/llm";
import { homePage, pastePage, notFoundPage } from "./html";

export interface Env {
  DB: DBLike | Record<string, unknown>;
  RINNEGAN_ISSUER_KEY: string;
  RINNEGAN_ISSUER_ID?: string;
  ORIGIN?: string;
  DEV?: boolean | string | number;
  TRANSLATE_URL?: string;
  TRANSLATE_KEY?: string;
  TRANSLATE_MODEL?: string;
}

interface PasteRow {
  id: string; owner: string; nonce: string; ciphertext: string;
  mi: string; mode: string; bytes: number; created_at: number;
}

const MAX_CHARS = 512_000;
const ID_RE = /^[0-9a-f]{16}$/;

function originOf(env: Env): string {
  return env.ORIGIN || "https://xsnap.app";
}

function devOnly(env: Env): boolean {
  return env.DEV === true || env.DEV === "1" || env.DEV === 1;
}

// The public body must never carry uploader provenance: user@host / email
// shaped tokens are scrubbed to a placeholder AFTER rendering, on both the
// corpus and LLM paths (originals are unaffected — decrypt returns them as
// uploaded).
const PROVENANCE_RE = /[\p{L}\p{N}._-]+@[\p{L}\p{N}._-]+/gu;

 async function translate(text: string, env: Env): Promise<string> {
   if (env.TRANSLATE_URL && env.TRANSLATE_KEY) {
     try {
      return (await translateLLM(text, env)).replace(
        PROVENANCE_RE, "koreingoa@tūmau");
     } catch (err) {
       console.warn("llm translate failed, corpus fallback:", err);
     }
   }
  return translateToMi(text).replace(PROVENANCE_RE, "koreingoa@tūmau");
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

async function handleUpload(req: Request, db: DBLike, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJson(req);
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const rinneganRaw = body.rinnegan;
  const transcript = body.transcript;
  const mode = body.mode === "inputs" || body.mode === "outputs"
    ? body.mode : "whole";
  if (typeof rinneganRaw !== "string" || typeof transcript !== "string"
    || transcript.length === 0 || transcript.length > MAX_CHARS) {
    return json({ error: "bad request", max_chars: MAX_CHARS }, 400);
  }
  const r = await verify(rinneganRaw, env.RINNEGAN_ISSUER_KEY);
  if (!r) return json({ error: "invalid rinnegan" }, 401);

  const mi = await translate(transcript, env);
  const key = await wrapKey(r.hash);
  const { nonce, ct } = await aesEncrypt(key, transcript);
  const id = (await sha256Hex(nonce + ct)).slice(0, 16);
  try {
    await db.prepare(
      "INSERT INTO pastes (id, owner, nonce, ciphertext, mi, mode, bytes, created_at)"
      + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, r.owner, nonce, ct, mi, mode, transcript.length,
      Math.floor(Date.now() / 1000)).run();
  } catch {
    return json({ error: "paste id collision", id }, 409);
  }
  return json({ id, url: `${originOf(env)}/p/${id}`,
    bytes: transcript.length, mode }, 201);
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
    "SELECT id, owner, nonce, ciphertext, mode, bytes, created_at FROM pastes WHERE id = ?",
  ).bind(id).first<PasteRow>();
  if (!row) return json({ error: "not found" }, 404);
  if (row.owner !== r.owner) return json({ error: "not your paste" }, 403);

  try {
    const key = await wrapKey(r.hash);
    const transcript = await aesDecrypt(key, row.nonce, row.ciphertext);
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
    "SELECT id, mode, bytes, created_at FROM pastes WHERE id = ?",
  ).bind(id).first<PasteRow>();
  if (!row) return json({ error: "not found" }, 404);
  return json({ id: row.id, mode: row.mode, bytes: row.bytes,
    created_at: row.created_at }, 200, "public, max-age=31536000, immutable");
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
    const paste = path.match(/^\/p\/([0-9a-f]+)(?:\/(raw|meta))?\/?$/);
    if (paste) {
      if (paste[2] === "raw") return rawResponse(db, paste[1]);
      if (paste[2] === "meta") return metaResponse(db, paste[1]);
      return pasteResponse(db, env, paste[1]);
    }
    return html(notFoundPage(originOf(env)), 404);
  }

  if (req.method === "POST") {
    if (path === "/api/upload") return handleUpload(req, db, env);
    if (path === "/api/decrypt") return handleDecrypt(req, db, env);
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
