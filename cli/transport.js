'use strict';
// cli/transport.js — zero-dep HTTP for the xsnap CLI.
//
// Transport preference (operator spec):
//   1. QUIC / HTTP-3 via `curl --http3-only` (curl ≥8.1 built with ngtcp2)
//   2. TCP TLS via curl
//   3. TCP TLS via node:https (when curl is absent)
//
// TLS trust anchor: the AdGuard-minted CA. AdGuard mints its root CA on the
// fly when HTTPS filtering is enabled after install, then re-signs leaves as
// connections pass through it — so the CLI must be handed that root CA to
// parse the HTTPS presented to it. Resolution order:
//   --ca flag → XSNAP_CA → ~/.config/xsnap/adguard-ca.pem (drop-in)
//   → well-known AdGuard Home cert paths → system roots.

const { spawnSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const ADGUARD_CA_CANDIDATES = [
  ['.config/xsnap/adguard-ca.pem'],
  ['/opt/AdGuardHome/certs/rootCA.crt'],
  ['/var/lib/adguardhome/certs/rootCA.crt'],
  ['/etc/adguardhome/certs/rootCA.crt'],
];

function resolveCA(explicit) {
  if (explicit) return explicit;
  if (process.env.XSNAP_CA) return process.env.XSNAP_CA;
  for (const [dir, file] of ADGUARD_CA_CANDIDATES) {
    const p = file
      ? path.join(dir, file)
      : path.join(os.homedir(), dir);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function curlAvailable() {
  const r = spawnSync('curl', ['--version'], { encoding: 'utf8' });
  return r.status === 0 && typeof r.stdout === 'string';
}

/// One curl attempt. extraArgs carries the transport selection
/// (['--http3-only'] for QUIC, [] for TCP). Returns null to signal
/// "try the next transport" and throws on definitive failure.
function tryCurl(method, url, body, caPath, extraArgs, timeoutMs) {
  const args = ['-sS', '--max-time', String(Math.ceil(timeoutMs / 1000)),
    ...extraArgs, '-X', method, '-H', 'content-type: application/json',
    '-H', 'accept: application/json'];
  if (caPath) args.push('--cacert', caPath);
  if (body !== undefined) args.push('--data-binary', '@-');
  args.push('-w', '\n%{http_code}', url);
  const r = spawnSync('curl', args, { input: body, encoding: 'utf8',
    maxBuffer: 24 * 1024 * 1024 });
  if (r.error) return null; // curl missing → node:https rung
  if (r.status === 0) {
    const out = String(r.stdout);
    const nl = out.lastIndexOf('\n');
    const code = Number(out.slice(nl + 1).trim());
    const payload = out.slice(0, nl);
    return {
      status: code, text: payload,
      transport: extraArgs.length ? 'quic' : 'tls',
    };
  }
  // QUIC rung: any failure (no h3 listener, UDP blocked, old curl) is soft —
  // fall through to TCP TLS unless the caller pinned --quic-only.
  if (extraArgs.length) return null;
  throw new Error(`curl failed (${r.status}): ${String(r.stderr).trim()}`);
}

function nodeHttps(method, url, body, caPath, timeoutMs) {
  const { promise, resolve, reject } = Promise.withResolvers();
  const u = new URL(url);
  const opts = {
    method, timeout: timeoutMs,
    headers: { 'content-type': 'application/json',
      'content-length': body ? Buffer.byteLength(body) : 0 },
  };
  if (caPath) {
    opts.ca = fs.readFileSync(caPath);
    opts.servername = u.hostname;
  }
  const req = https.request(u, opts, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({
      status: res.statusCode,
      text: Buffer.concat(chunks).toString('utf8'),
      transport: 'tls',
    }));
  });
  req.on('timeout', () => req.destroy(new Error('timeout')));
  req.on('error', reject);
  if (body !== undefined) req.write(body);
  req.end();
  return promise;
}

/// Send a JSON request; prefer QUIC, fall back per the ladder above.
/// opts: { ca?: string, quic?: 'prefer'|'only'|'off', timeoutMs?: number }
async function request(method, url, bodyObj, opts = {}) {
  const body = bodyObj === undefined ? undefined : JSON.stringify(bodyObj);
  const ca = resolveCA(opts.ca);
  const timeoutMs = opts.timeoutMs || 30_000;
  const quic = opts.quic || 'prefer';
  const attempts = [];

  if (quic !== 'off' && curlAvailable()) {
    const h3 = tryCurl(method, url, body, ca, ['--http3-only'], timeoutMs);
    if (h3) attempts.push(h3);
    else if (quic === 'only') {
      throw new Error('QUIC unavailable (curl fell back-refused or failed)');
    }
  }
  if (quic !== 'only' && !attempts.length && curlAvailable()) {
    const tcp = tryCurl(method, url, body, ca, [], timeoutMs);
    if (tcp) attempts.push(tcp);
  }
  if (attempts.length) {
    const res = attempts[0];
    let parsed;
    try {
      parsed = JSON.parse(res.text);
    } catch {
      parsed = { error: 'non-JSON response', body: res.text.slice(0, 400) };
    }
    return { ...res, json: parsed };
  }
  const res = await nodeHttps(method, url, body, ca, timeoutMs);
  let parsed;
  try {
    parsed = JSON.parse(res.text);
  } catch {
    parsed = { error: 'non-JSON response', body: res.text.slice(0, 400) };
  }
  return { ...res, json: parsed };
}

module.exports = { request, resolveCA };
