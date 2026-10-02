#!/usr/bin/env node
'use strict';
// cli/xsnap.js — the very light CLI for xsnap.app.
//
//   xsnap upload -whole   [-f FILE|-] [-r user:hash] [--api URL] [--ca PATH]
//   xsnap upload -inputs  …      (asciinema "i" events / prompt-line commands)
//   xsnap upload -outputs …      (asciinema "o" events / non-prompt lines)
//   xsnap decrypt <id> [-r user:hash] [--api URL] [--ca PATH]
//   xsnap rinnegan --user NAME [--api URL]   (dev issuer; prod: ufo-fsd.kimi.pro)
//
// Flags/env:
//   -r/--rinnegan  credential, or XSNAP_RINNEGAN
//   --api          base URL, or XSNAP_API (default https://xsnap.app)
//   --ca           AdGuard-minted CA path, or XSNAP_CA, or auto-discovered
//   --quic-only    refuse TCP fallback   --no-quic   force TCP TLS
//
// Transport prefers QUIC (HTTP/3) via curl; see cli/transport.js.

const fs = require('fs');
const { request } = require('./transport.js');
const { slice } = require('./transcript.js');

const HELP = `xsnap — anonymous session-transcript paste (xsnap.app)

usage:
  xsnap upload -whole|-inputs|-outputs [-f FILE|-] [-r USER:HASH] [options]
  xsnap decrypt ID [-r USER:HASH] [options]
  xsnap rinnegan --user NAME [--api URL]   (dev issuer only)

options:
  -f, --file FILE   transcript file ('-' or omitted = stdin)
  -r, --rinnegan S  user:hash credential (env XSNAP_RINNEGAN)
      --api URL     xsnap endpoint (env XSNAP_API; default https://xsnap.app)
      --ca PATH     AdGuard-minted CA pem (env XSNAP_CA; auto-discovered)
      --quic-only   error if QUIC is unavailable
      --no-quic     skip QUIC, use TCP TLS
  -h, --help        this help`;

function die(msg, code = 1) {
  process.stderr.write(`xsnap: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '-whole') out.mode = 'whole';
    else if (a === '-inputs') out.mode = 'inputs';
    else if (a === '-outputs') out.mode = 'outputs';
    else if (a === '-f' || a === '--file') out.file = argv[++i];
    else if (a === '-r' || a === '--rinnegan') out.rinnegan = argv[++i];
    else if (a === '--api') out.api = argv[++i];
    else if (a === '--ca') out.ca = argv[++i];
    else if (a === '--quic-only') out.quic = 'only';
    else if (a === '--no-quic') out.quic = 'off';
    else if (a === '--user') out.user = argv[++i];
    else if (a.startsWith('-')) die(`unknown flag ${a}`);
    else out._.push(a);
  }
  return out;
}

function readTranscript(file) {
  if (file && file !== '-') return fs.readFileSync(file, 'utf8');
  if (process.stdin.isTTY) die('no -f FILE and stdin is a TTY; pipe a transcript');
  return fs.readFileSync(0, 'utf8');
}

async function upload(args, api, rinnegan) {
  const mode = args.mode;
  if (!mode) die('pick one slicing flag: -whole, -inputs or -outputs');
  const raw = readTranscript(args.file);
  let text;
  try {
    text = slice(raw, mode);
  } catch (err) {
    die(err.message);
  }
  if (!text.trim()) die('nothing to upload after slicing');
  const res = await request('POST', `${api}/api/upload`,
    { rinnegan, transcript: text, mode },
    { ca: args.ca, quic: args.quic });
  if (res.status === 401) die(res.json.error || 'invalid rinnegan', 3);
  if (res.status !== 201) {
    die(`upload failed (${res.status}): ${JSON.stringify(res.json)}`, 2);
  }
  process.stdout.write(
    `${res.json.url}  (id ${res.json.id}, ${res.json.bytes} bytes, ` +
    `mode ${res.json.mode}, via ${res.transport})\n`);
}

async function decrypt(args, api, rinnegan) {
  const id = args._[1];
  if (!id || !/^[0-9a-f]{16}$/.test(id)) die('decrypt needs a 16-hex paste id');
  const res = await request('POST', `${api}/api/decrypt`,
    { rinnegan, id }, { ca: args.ca, quic: args.quic });
  if (res.status === 401 || res.status === 403) {
    die(res.json.error || 'not your paste', 3);
  }
  if (res.status !== 200) {
    die(`decrypt failed (${res.status}): ${JSON.stringify(res.json)}`, 2);
  }
  process.stdout.write(res.json.transcript);
}

async function rinneganCmd(args, api) {
  const user = args.user || 'dev-user';
  const res = await request('POST', `${api}/dev/rinnegan`, { user },
    { ca: args.ca, quic: args.quic });
  if (res.status !== 200) {
    die(`rinnegan mint failed (${res.status}): ${JSON.stringify(res.json)}` +
      '\n(dev issuer only; prod rinnegan comes from ufo-fsd.kimi.pro)', 2);
  }
  process.stdout.write(`${res.json.rinnegan}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.help || !args._.length) {
    process.stdout.write(HELP + '\n');
    process.exit(args.help ? 0 : 1);
  }
  const api = (args.api || process.env.XSNAP_API || 'https://xsnap.app')
    .replace(/\/+$/, '');
  const rinnegan = args.rinnegan || process.env.XSNAP_RINNEGAN;

  try {
    switch (args._[0]) {
      case 'upload':
        if (!rinnegan) die('rinnegan required (-r user:hash or XSNAP_RINNEGAN)', 3);
        await upload(args, api, rinnegan);
        break;
      case 'decrypt':
        if (!rinnegan) die('rinnegan required (-r user:hash or XSNAP_RINNEGAN)', 3);
        await decrypt(args, api, rinnegan);
        break;
      case 'rinnegan':
        await rinneganCmd(args, api);
        break;
      default:
        die(`unknown command ${args._[0]}`);
    }
  } catch (err) {
    die(err.message, 2);
  }
}

main();
