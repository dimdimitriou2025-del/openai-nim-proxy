// Pure oath validation (no Minecraft APIs) so it can be unit-tested in Node.

/**
 * Normalise text for comparison: case-insensitive, unified apostrophes/quotes,
 * collapsed whitespace, trimmed; punctuation removed unless strict.
 * @param {unknown} text
 * @param {boolean} strict keep punctuation
 */
export function normalizeOath(text, strict = false) {
  let t = String(text ?? "").toLowerCase();
  t = t.replace(/[‘’‚‛′´`]/g, "'").replace(/[“”„″]/g, '"');
  t = t.replace(/[–—]/g, "-");
  if (!strict) {
    t = t.replace(/'/g, ""); // "evil's" == "evils"
    t = t.replace(/[^\p{L}\p{N}\s]/gu, " ");
  }
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Compare a typed oath with the configured lines.
 * @param {unknown} input what the player typed
 * @param {string[]} lines configured oath lines
 * @param {boolean} strict require exact punctuation
 * @returns {{ok: boolean, matched: number, total: number, expected?: string, typed?: string, empty: boolean}}
 */
export function checkOath(input, lines, strict = false) {
  const want = normalizeOath(lines.join(" "), strict).split(" ").filter(Boolean);
  const got = normalizeOath(input, strict).split(" ").filter(Boolean);
  let i = 0;
  while (i < want.length && i < got.length && want[i] === got[i]) i++;
  const ok = i === want.length && got.length === want.length;
  return {
    ok,
    matched: i,
    total: want.length,
    expected: ok ? undefined : want[i],
    typed: ok ? undefined : got[i],
    empty: got.length === 0,
  };
}

/** The first `n` words of the oath as written in the config (for feedback). */
export function oathPrefix(lines, n) {
  const words = lines.join(" ").split(/\s+/).filter(Boolean);
  return words.slice(0, n).join(" ");
}
