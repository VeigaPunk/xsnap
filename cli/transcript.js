'use strict';
// cli/transcript.js — session-transcript slicing for -whole/-inputs/-outputs.
//
// Supported inputs:
//   • asciinema cast (.cast JSONL, {"version":2,…} header): structural —
//     "i" events are inputs, "o" events are outputs.
//   • plain text (script(1) typescript, terminal scrollback, any blob):
//     prompt-line heuristic; if <2 prompt lines are detected we refuse
//     rather than mis-slice (use -whole).
//
// The server never sees the original unless the uploader sends it, so this
// slicing is the ONLY place transcript structure is interpreted.

const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*(?:\x07|\x1b\\)|\x1b[=>]|\r(?!\n)/g;

function stripANSI(s) {
  return s.replace(ANSI_RE, '');
}

/// Returns { inputs: string, outputs: string } for asciinema casts, else null.
function parseCast(text) {
  const lines = text.split('\n');
  let header;
  try {
    header = JSON.parse(lines[0]);
  } catch {
    return null;
  }
  if (!header || typeof header !== 'object' || header.version === undefined) {
    return null;
  }
  const inputs = [];
  const outputs = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    if (!Array.isArray(ev) || ev.length < 3) continue;
    if (ev[1] === 'i') inputs.push(String(ev[2]));
    else if (ev[1] === 'o') outputs.push(String(ev[2]));
  }
  if (!inputs.length && !outputs.length) return null;
  return { inputs: inputs.join(''), outputs: outputs.join('') };
}

// [time] / [user@host cwd] / user@host:cwd prefix, then $ # ❯ ➜ > or PS …>
// — then the command. `#` also matches shell comments; that ambiguity is
// accepted (mis-classifying a comment as input is harmless for pasting).
const PROMPT_RE = /^(?:\[[^\]]{0,80}\]\s*)?(?:PS\s+[^\n>]{0,120}>|(?:[A-Za-z0-9._-]+@[A-Za-z0-9._-]+\s+)?[A-Za-z0-9._\/~,-]{0,80}?[$#❯➯➜]|>)\s(.+)$/;

function promptText(line) {
  const m = line.match(PROMPT_RE);
  return m ? m[1].trim() : null;
}

/// Slice a transcript. mode: 'whole' | 'inputs' | 'outputs'.
function slice(text, mode) {
  if (mode === 'whole') return text;
  const cast = parseCast(text);
  if (cast) return mode === 'inputs' ? cast.inputs : cast.outputs;

  const lines = stripANSI(text).split('\n');
  const inputs = [];
  const outputs = [];
  for (const line of lines) {
    const cmd = promptText(line);
    if (cmd !== null) inputs.push(cmd);
    else if (line.trim() !== '') outputs.push(line);
  }
  if (inputs.length < 2) {
    throw new Error(
      'could not detect prompt lines in plain-text transcript; use -whole');
  }
  return mode === 'inputs' ? inputs.join('\n') : outputs.join('\n');
}

module.exports = { slice, stripANSI };
