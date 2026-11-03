// Ids for things in a variant: the next free one with a prefix.

/** Next free id with the given prefix: `w1`, `w2` … */
export function nextId(taken: Iterable<string>, prefix: string): string {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
