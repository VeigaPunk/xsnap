// worker/translate/llm.ts — optional fluent ANY→mi adapter.
// OpenAI-compatible chat endpoint (e.g. Kimi/Moonshot on Alibaba Cloud).
// Configure TRANSLATE_URL, TRANSLATE_KEY, TRANSLATE_MODEL; absent or failing
// ⇒ caller falls back to the deterministic corpus renderer.

export interface TranslateEnv {
  TRANSLATE_URL?: string;
  TRANSLATE_KEY?: string;
  TRANSLATE_MODEL?: string;
}

const SYSTEM = [
  "Translate the user's text into te reo Māori.",
  "The input may be in ANY language; do not assume English.",
  "Keep code, shell commands, identifiers, URLs and non-word tokens verbatim.",
  "Emit only the translation, no commentary.",
].join(" ");

export async function translateLLM(
  text: string, env: TranslateEnv,
): Promise<string> {
  if (!env.TRANSLATE_URL || !env.TRANSLATE_KEY) {
    throw new Error("llm translator not configured");
  }
  const res = await fetch(env.TRANSLATE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.TRANSLATE_KEY}`,
    },
    body: JSON.stringify({
      model: env.TRANSLATE_MODEL || "kimi-maori",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`translator HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const mi = body.choices?.[0]?.message?.content?.trim();
  if (!mi) throw new Error("translator returned no content");
  return mi;
}
