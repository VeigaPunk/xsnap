// worker/d1.ts — minimal DB surface. Prod: Cloudflare D1 (normalized by
// wrapD1). Dev: dev/server.ts implements DBLike over bun:sqlite directly.

export interface BoundStmt {
  first<T>(): Promise<T | null>;
  all<T>(): Promise<T[]>;
  run(): Promise<void>;
}

export interface DBLike {
  prepare(q: string): { bind(...args: unknown[]): BoundStmt };
}

/// Normalize a Cloudflare D1 binding into DBLike (all() unwraps .results).
export function wrapD1(raw: {
  prepare(q: string): {
    bind(...a: unknown[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
    };
  };
}): DBLike {
  return {
    prepare(q: string) {
      const stmt = raw.prepare(q);
      return {
        bind(...args: unknown[]): BoundStmt {
          const b = stmt.bind(...args);
          return {
            async first<T>() { return (await b.first<T>()) ?? null; },
            async all<T>() { return (await b.all<T>()).results ?? []; },
            async run() { await b.run(); },
          };
        },
      };
    },
  };
}
