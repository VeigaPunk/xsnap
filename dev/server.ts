// dev/server.ts — local xsnap runner (Bun). Same app as prod; SQLite stands
// in for D1 and the dev issuer is enabled.
//
//   bun dev/server.ts                 → http://localhost:8787
//   bun dev/server.ts --tls c.pem k.pem → https://localhost:8443
//                                           (for --ca / pinned-CA testing)
//
// Env: RINNEGAN_ISSUER_KEY (default: dev value), ORIGIN.

import { Database } from "bun:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { app } from "../worker/index.ts";
import type { DBLike } from "../worker/d1.ts";

mkdirSync("dev", { recursive: true });
const db = new Database("dev/xsnap.db");
db.exec(readFileSync("schema.sql", "utf8"));

// bun:sqlite → DBLike (same surface wrapD1 gives D1 in prod).
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
  RINNEGAN_ISSUER_KEY: process.env.RINNEGAN_ISSUER_KEY || "dev-issuer-key",
  RINNEGAN_ISSUER_ID: process.env.RINNEGAN_ISSUER_ID || "dev",
  ORIGIN: process.env.ORIGIN || "http://localhost:8787",
  DEV: "1",
};

const tlsArgs = process.argv.slice(2);
const tls = tlsArgs[0] === "--tls"
  ? { cert: readFileSync(tlsArgs[1], "utf8"), key: readFileSync(tlsArgs[2], "utf8") }
  : undefined;

const port = Number(process.env.PORT || (tls ? 8443 : 8787));
Bun.serve({
  port,
  tls,
  fetch: (req) => app(req, env),
});
console.log(`xsnap dev on ${tls ? "https" : "http"}://localhost:${port}` +
  ` (db: dev/xsnap.db, dev rinnegan: POST /dev/rinnegan)`);
