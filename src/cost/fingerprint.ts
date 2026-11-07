// A short code for content: the same numbers give the same code, any change gives another. Shown beside the
// kostgrunnlag's version name and kept on the quote, so "2026-11 A" with other numbers in it can be told apart
// (Bjørn 7.11.2026). Not a security hash: FNV-1a over JSON with sorted keys.

/** JSON with object keys sorted and Maps as their values sorted by key, so the order things were built in does not
 *  change the code. */
function canonical(x: unknown): unknown {
  if (x instanceof Map) return [...x.entries()].sort(([a], [b]) => (String(a) < String(b) ? -1 : 1)).map(([k, v]) => [k, canonical(v)]);
  if (Array.isArray(x)) return x.map(canonical);
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => [k, canonical(o[k])]));
  }
  return x;
}

/** Four hex digits, e.g. "a3f9". */
export function fingerprint(x: unknown): string {
  const text = JSON.stringify(canonical(x));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Fold the 32 bits to 16, so every input character still counts
  return (((h >>> 16) ^ h) & 0xffff).toString(16).padStart(4, '0');
}
