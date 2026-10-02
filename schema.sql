-- xsnap.app paste store. One row per upload; immutable after insert.
-- Two origins:
--   origin 'xsnap'  — classic CLI: original AES-256-GCM here, key derived
--                     from the rinnegan hash (worker/rinnegan.ts)
--   origin 'github' — plugin flow: original lives in the uploader's PRIVATE
--                     GitHub repo; unlock = GitHub user:token ("the rinnegan
--                     is merely his github user:pass")
-- id       : 16 hex. xsnap: sha256(nonce||ciphertext). github: sha256(mi||nonce2)
-- owner    : xsnap → owner HMAC; github → GitHub username (never rendered)
-- mi       : the public body, rendered ANY→suomi→mi LOCALLY by the client
--            (session/plugin), never translated server-side
CREATE TABLE IF NOT EXISTS pastes (
  id         TEXT PRIMARY KEY,
  origin     TEXT NOT NULL DEFAULT 'xsnap',
  owner      TEXT NOT NULL,
  repo       TEXT,
  path       TEXT,
  nonce      TEXT,
  ciphertext TEXT,
  mi         TEXT NOT NULL,
  mode       TEXT NOT NULL DEFAULT 'whole',
  bytes      INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pastes_owner   ON pastes(owner);
CREATE INDEX IF NOT EXISTS idx_pastes_created ON pastes(created_at DESC);
