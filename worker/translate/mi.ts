// worker/translate/mi.ts — deterministic ANY→mi renderer.
// Longest-phrase substitution (1..4 tokens) over the merged corpus.
// Unknown tokens pass through verbatim. Pure function: same input ⇒ same
// output, so a paste's public body is reproducible from its id alone.

import { CORPUS } from "./corpus";

const MAX_PHRASE = 4;
const TOKEN_RE = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;

interface Tok { word: boolean; s: string }

function tokenize(text: string): Tok[] {
  const toks: Tok[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    if (m.index! > last) toks.push({ word: false, s: text.slice(last, m.index) });
    toks.push({ word: true, s: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) toks.push({ word: false, s: text.slice(last) });
  return toks;
}

function matchCase(src: string, out: string): string {
  if (src === src.toUpperCase() && src.length > 1) return out.toUpperCase();
  if (src[0] === src[0].toUpperCase()) {
    // Title-case source → capitalize first letter of each corpus word
    return out.split(" ").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  }
  return out;
}
export function translateToMi(text: string): string {
  const toks = tokenize(text);
  let out = "";
  let i = 0;
  while (i < toks.length) {
    if (!toks[i].word) { out += toks[i].s; i++; continue; }
    let replaced = false;
    // Word tokens sit at even offsets from i, separated by single spaces;
    // reachability bounds how many corpus words a phrase can span.
    const nMax = Math.min(MAX_PHRASE, 1 + Math.floor((toks.length - 1 - i) / 2));
    for (let n = nMax; n >= 1 && !replaced; n--) {
      let phrase = toks[i].s;
      let ok = true;
      for (let k = 1; k < n; k++) {
        const sep = toks[i + 2 * k - 1];
        const w = toks[i + 2 * k];
        if (!sep || sep.word || sep.s !== " " || !w || !w.word) {
          ok = false;
          break;
        }
        phrase += " " + w.s;
      }
      if (!ok) continue;
      const hit = CORPUS[phrase.toLowerCase()];
      if (hit !== undefined) {
        out += matchCase(phrase, hit);
        i += 2 * n - 1;
        replaced = true;
      }
    }
    if (!replaced) { out += toks[i].s; i++; }
  }
  return out;
}
