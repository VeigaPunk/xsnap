// dev/server-xsnapshot.ts — local runner (Bun) for the xsnapshot.app
// GitHub-mode transcript site. SQLite stands in for its D1 database.
//
//   bun dev/server-xsnapshot.ts → http://localhost:8788

import { Database } from "bun:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { app } from "../xsnapshot-site/index.ts";
import type { DBLike } from "../worker/d1.ts";

mkdirSync("dev", { recursive: true });
const db = new Database("dev/xsnapshot.db");
db.exec(readFileSync("schema.sql", "utf8"));

const devDB: DBLike = {
  prepare(q: string) {
    const stmt = db.prepare(q);
    return {
      bind(...args: unknown[]) {
        return {
          async first<T>() {
            return (stmt.get(...args) as T) ?? null;
          },
          async all<T>() {
            return stmt.all(...args) as T[];
          },
          async run() {
            stmt.run(...args);
          },
        };
      },
    };
  },
};

const env = {
  DB: devDB,
  ORIGIN: process.env.ORIGIN || "http://localhost:8788",
};

Bun.serve({
  port: Number(process.env.PORT || 8788),
  fetch: (req) => app(req, env),
});
console.log("xsnapshot dev on http://localhost:8788 " +
  "(db: dev/xsnapshot.db, publish: POST /api/publish, unlock: /p/<id>/unlock)");
