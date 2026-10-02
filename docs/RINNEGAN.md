# Rinnegan — the keys that open originals

"Rinnegan" is the umbrella name for the credential that unlocks a paste's
verbatim original. Two sites, two forms:

- **xsnap.app** (Kimi-OAuth site): the proprietary `user:hash` — form 1.
- **xsnapshot.app** (GitHub site): `github_username:password` — form 2;
  the original lives in the user's own private repo and the unlock opens
  the raw repo (nothing is rendered on the site).

Possession is permission: lending your rinnegan to a regular ("lending
your rinnegan'd eyes") lets them unlock what you locked.

## Form 1 — user:hash (xsnap.app, Kimi-OAuth rinnegan)

```
<user>:<hash>
 user  = opaque id from the Kimi OAuth section, [A-Za-z0-9._-]{1,64}
 hash  = 64 hex = HMAC-SHA256(RINNEGAN_ISSUER_KEY, "rinnegan/v1:" + user)
```

- Owner linkage: `HMAC(RINNEGAN_ISSUER_KEY, "owner/v1:"+user)` — stored in
  D1, never rendered.
- Wrap key: `HKDF-SHA256(hash, info="xsnap-wrap/v1")` → AES-256-GCM key for
  the paste ciphertext.
- Minting: prod = the Kimi-OAuth section of ufo-fsd.kimi.pro (Kimi hosted
  on Alibaba), using the shared `RINNEGAN_ISSUER_KEY`; xsnap only verifies.
  Dev = `POST /dev/rinnegan`.
- Threat model: DB-dump-alone cannot decrypt; a server compromise
  (DB + issuer key) can. v2 salted-hash upgrade noted below.

## Form 2 — github_username:password (xsnapshot.app)

For plugin publishes the original lives in the uploader's PRIVATE GitHub
repo (`xsnap-<id>`, file `p/<id>/original.txt`). The rinnegan is merely the
uploader's **GitHub user:pass** (username + PAT):

- `/p/<id>/unlock` collects user + token and POSTs `/api/unlock`.
- The server verifies the pair against `api.github.com/user`, requires
  the login to own the paste, then reads the original from the private
  repo. Credentials live in memory for the request only — never logged,
  never stored.
- xsnap never sees the original at ANY point in the plugin flow
  (zero-knowledge by construction), and never sees the token outside the
  unlock request.
- Failure of any kind → the dialog redirects to https://ufo-fsd.kimi.pro/.

## The unlock dialog (both sites)

The paste page carries a `[169,13,13]` red **wetehuna** button that opens
the decryptor dialog (Windows-XP-Luna-styled; the theater is cosmetic, the
ownership check is real). One input:

- xsnap.app → rinnegan `user:hash`
- xsnapshot.app → `github_username:password` (single combined field)

```
[ Decrypting .... | Tetraquantum unlocking .... |
  Aurelion Sol consulting .... | Maori AI webster'ng .... ]
```

Each step ~650 ms while the key check runs. Payoff per site:
- xsnap.app → verbatim original shown in the dialog.
- xsnapshot.app → the uploader's raw repo OPENS (`repo_url`/`raw_url`
  disclosed only inside the verified response); no original text is ever
  rendered on the site.
Mismatch/error → redirect to https://ufo-fsd.kimi.pro/.

## v2 upgrade path (form 1)

Salt the hash with per-user randomness (`user:hash = HMAC(K_i, user‖salt)`
+ published verifier) so wrap keys stop being derivable from the issuer
key. Form 2 already achieves this structurally: the secret never leaves
GitHub's auth boundary.
