-- xsnap.app paste store. One row per upload; immutable after insert.
-- id       : 16 hex chars, sha256(nonce||ciphertext) prefix
-- owner    : HMAC(RINNEGAN_ISSUER_KEY, "owner/v1:"+user) — never public
-- nonce/ct : base64 AES-256-GCM of the ORIGINAL transcript
--            key = HKDF(rinnegan_hash, info="xsnap-wrap/v1")
-- mi       : Māori rendering (public page body; any source language)
CREATE TABLE IF NOT EXISTS pastes (
  id         TEXT PRIMARY KEY,
  owner      TEXT NOT NULL,
  nonce      TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  mi         TEXT NOT NULL,
  mode       TEXT NOT NULL DEFAULT 'whole',
  bytes      INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pastes_owner   ON pastes(owner);
CREATE INDEX IF NOT EXISTS idx_pastes_created ON pastes(created_at DESC);
