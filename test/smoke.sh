#!/usr/bin/env bash
# test/smoke.sh — full local xsnap loop. Run from repo root:
#   bash test/smoke.sh
# Exercises: dev issuer → upload (whole/inputs/outputs) → public page
# provenance scrub → decrypt roundtrip → cross-user 403 → crawl files.
set -euo pipefail

PORT=${PORT:-8799}
API="http://localhost:$PORT"
DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$DIR"

PORT=$PORT bun dev/server.ts >/tmp/xsnap-smoke.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do
  curl -s -o /dev/null "$API/robots.txt" && break
  sleep 0.1
done

fail() { echo "FAIL: $1"; exit 1; }

# 1. dev rinnegan mint
RIN=$(curl -s -X POST "$API/dev/rinnegan" -d '{"user":"smoke-user"}' | jq -r .rinnegan)
[[ "$RIN" == smoke-user:* ]] || fail "rinnegan mint"

# 2. upload (multi-language transcript with provenance in prompts)
printf '[smoke@host ~]$ systemctl status docker\n all is well, everything good\n[smoke@host ~]$ echo "thank you"\n olá mundo, tudo bem?\n' > /tmp/xsnap-smoke.log.txt
U=$(node cli/xsnap.js upload -whole -f /tmp/xsnap-smoke.log.txt -r "$RIN" --api "$API")
ID=$(echo "$U" | grep -oP '[0-9a-f]{16}' | head -1)
[[ -n "$ID" ]] || fail "upload ($U)"

# 3. public page: provenance scrubbed, original absent
BODY=$(curl -s "$API/p/$ID")
echo "$BODY" | grep -q 'koreingoa@tūmau' || fail "provenance placeholder missing"
! echo "$BODY" | grep -q 'smoke@host' || fail "provenance LEAK (smoke@host)"
! echo "$BODY" | grep -q 'all is well' || fail "original LEAK on public page"
echo "$BODY" | grep -q 'ngā mihi' || fail "mi rendering missing (thank you)"

# 4. decrypt roundtrip byte-identical
node cli/xsnap.js decrypt "$ID" -r "$RIN" --api "$API" | diff -q - /tmp/xsnap-smoke.log.txt \
  || fail "decrypt roundtrip"

# 5. cross-user 403
RIN2=$(curl -s -X POST "$API/dev/rinnegan" -d '{"user":"intruder"}' | jq -r .rinnegan)
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/decrypt" \
  -d "{\"rinnegan\":\"$RIN2\",\"id\":\"$ID\"}")
[[ "$CODE" == 403 ]] || fail "cross-user decrypt got $CODE (want 403)"

# 6. invalid rinnegan 401
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/decrypt" \
  -d "{\"rinnegan\":\"smoke-user:$(printf '0%.0s' $(seq 1 64))\",\"id\":\"$ID\"}")
[[ "$CODE" == 401 ]] || fail "invalid rinnegan got $CODE (want 401)"

# 7. crawl surfaces
curl -s "$API/robots.txt" | grep -q 'Disallow: /api/' || fail "robots"
curl -s "$API/sitemap.xml" | grep -q "/p/$ID" || fail "sitemap lists paste"
curl -s "$API/p/$ID/meta" | grep -q '"mode":"whole"' || fail "meta"

# 8. slicing modes
printf '%s\n' '{"version":2}' '[0.1,"i","git status"]' '[0.2,"o","clean tree"]' > /tmp/xsnap-smoke.cast
node cli/xsnap.js upload -inputs  -f /tmp/xsnap-smoke.cast -r "$RIN" --api "$API" | grep -q 'mode inputs'  || fail "cast -inputs"
node cli/xsnap.js upload -outputs -f /tmp/xsnap-smoke.cast -r "$RIN" --api "$API" | grep -q 'mode outputs' || fail "cast -outputs"
node cli/xsnap.js upload -inputs  -f /tmp/xsnap-smoke.log.txt -r "$RIN" --api "$API" | grep -q 'mode inputs'  || fail "plain -inputs"

# 9. two-hop rendering ran locally (ANY→suomi→mi), vocabulary lockstep
HOPS=$(bun -e '
const t = require("./cli/translate.js");
const fi = t.renderFi("thank you");
const haka = t.renderHaka("thank you");
const missing = [...new Set(Object.values(t.CORPUS_FI))]
  .filter(v => t.CORPUS_MI[v] === undefined && !v.includes(" "));
if (fi !== "kiitos" || haka !== "ngā mihi") { console.error("hop fail", fi, haka); process.exit(1) }
if (missing.length) { console.error("hop2 missing:", missing.join(",")); process.exit(1) }
console.log("hops-ok");')
[[ "$HOPS" == "hops-ok" ]] || fail "local two-hop rendering ($HOPS)"

# 10. plugin publish (keyless) — deterministic id, github-mode page
N2=$(printf '%016x' $((RANDOM * 32768 + RANDOM)))
MI='kia ora ao — ngā mihi'
PID=$(printf '%s' "$MI$N2" | openssl dgst -sha256 -hex | cut -d' ' -f2 | head -c 16)
P=$(curl -s -X POST "$API/api/publish" -d "{\"mi\":\"$MI\",\"owner\":\"veigapunk\",\"repo\":\"xsnap-$PID\",\"path\":\"p/$PID/original.txt\",\"nonce2\":\"$N2\",\"bytes\":42}")
echo "$P" | grep -q "\"id\":\"$PID\"" || fail "publish id mismatch ($P)"
U=$(curl -s "$API/p/$PID/unlock")
echo "$U" | grep -q 'github_username:password'  || fail "unlock combined creds field"
echo "$U" | grep -q '#a90d0d'                   || fail "RGB 169,13,13 decrypt button"
echo "$U" | grep -qi 'noindex'              || fail "unlock page noindex"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/unlock" \
  -d "{\"user\":\"veigapunk\",\"token\":\"ghp_definitelyinvalidtoken99\",\"id\":\"$PID\"}")
[[ "$CODE" == 401 ]] || fail "github unlock with bad creds got $CODE (want 401)"
curl -s "$API/p/$PID/meta" | grep -q '"mode":"whole"' || fail "github-mode meta"
curl -s "$API/p/$PID/meta" | grep -q 'repo'           && fail "meta leaks repo (provenance)"

echo "smoke: all green (xsnap $ID, github $PID)"
