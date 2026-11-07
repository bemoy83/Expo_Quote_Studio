// Editing the kostgrunnlag: what a change is, the name of the next version, a pasted price list read into changes, and
// the history of saved versions (kept in this browser beside the basis, never sent anywhere). The page collects changes
// and saves them with `withValues` (fields.ts) as a new version, so an edit takes the same road as a loaded file.
// docs/kostmodell.md.
import type { CostBasis, FieldNote } from './basis';
import type { Field } from './fields';

/** One number changed, as the history keeps it. */
export interface ChangeRecord {
  path: string;
  label: string;
  unit: string;
  old: number;
  new: number;
  /** Status and source given with it. */
  note?: FieldNote;
}

/** One saved version. `before` is the basis it replaced, as its file (null: the example), so it can be gone back to. */
export interface HistoryEntry {
  /** When it was saved, ISO time. */
  at: string;
  version: string;
  /** The version it was made from. */
  from: string;
  comment: string;
  changes: ChangeRecord[];
  before: string | null;
}

/** How many saved versions the browser keeps. The oldest go first. */
export const HISTORY_MAX = 40;

/** The next version name: "2026-11 A" → "2026-11 B", "2026-11 Z" → "2026-11 AA". From the example, or a name without
 *  a letter at the end, the month of `today` with A (or the next free letter that month). */
export function nextVersion(current: string, today: string, taken: readonly string[] = []): string {
  const month = today.slice(0, 7);
  const m = /^(.*\S)\s+([A-Z]+)$/.exec(current.trim());
  let name = m && m[1] === month ? `${m[1]} ${nextLetters(m[2])}` : `${month} A`;
  while (name === current || taken.includes(name)) {
    const n = /^(.*\S)\s+([A-Z]+)$/.exec(name)!;
    name = `${n[1]} ${nextLetters(n[2])}`;
  }
  return name;
}

function nextLetters(s: string): string {
  const a = [...s];
  for (let i = a.length - 1; i >= 0; i--) {
    if (a[i] !== 'Z') {
      a[i] = String.fromCharCode(a[i].charCodeAt(0) + 1);
      return a.join('');
    }
    a[i] = 'A';
  }
  return `A${a.join('')}`;
}

/** A number as typed: decimal comma or point, spaces as thousands, "kr" or "%" after it. Null when it is not one. */
export function parseNumber(s: string): number | null {
  const t = s.replace(/[\s  ]/g, '').replace(/(kr|%)$/i, '').replace(',', '.').replace('−', '-');
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** A price list pasted from a spreadsheet or a PDF: one article per line, its art.nr and the price last on the line
 *  ("873 062 22<TAB>Profil 94<TAB>104,50"). Matched by art.nr against the prices of the list from `supplier`; what does
 *  not match is named. A line whose last cell is not a number (a heading) is skipped. */
export function readPastedList(text: string, fields: readonly Field[], supplier: string): { changes: { field: Field; value: number }[]; unknown: string[]; lines: number } {
  const byArtnr = new Map<string, Field>();
  for (const f of fields) if (f.list?.supplier === supplier) byArtnr.set(squash(f.list.artnr), f);
  const changes: { field: Field; value: number }[] = [];
  const unknown: string[] = [];
  let lines = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split(/\t|;|\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const price = parseNumber(cells[cells.length - 1]);
    if (price === null || price < 0) continue;
    lines++;
    const f = byArtnr.get(squash(cells[0]));
    if (!f) unknown.push(cells[0]);
    else if (f.value !== price) changes.push({ field: f, value: price });
  }
  return { changes, unknown, lines };
}

/** Art.nr without its spaces: "873 062 22" and "87306222" are the same article. */
const squash = (s: string) => s.replace(/\s+/g, '').toUpperCase();

/** The history with a new entry first, cut to HISTORY_MAX. */
export const withEntry = (h: readonly HistoryEntry[], e: HistoryEntry): HistoryEntry[] => [e, ...h].slice(0, HISTORY_MAX);

/** The history entry for saving `changes` on `b` as `version`. */
export function entryFor(b: CostBasis, before: string | null, version: string, comment: string, changes: readonly { field: Field; value: number; note?: FieldNote }[], at: string): HistoryEntry {
  return {
    at,
    version,
    from: b.version,
    comment,
    before,
    changes: changes.map((c) => ({ path: c.field.path, label: c.field.label, unit: c.field.unit, old: c.field.value, new: c.value, ...(c.note ? { note: c.note } : {}) })),
  };
}

/** A history read back from storage: entries that are not whole are left out. */
export function readHistory(x: unknown): HistoryEntry[] {
  if (!Array.isArray(x)) return [];
  return x.filter(
    (e): e is HistoryEntry =>
      typeof e === 'object' && e !== null && typeof e.at === 'string' && typeof e.version === 'string' && Array.isArray(e.changes) && (e.before === null || typeof e.before === 'string'),
  );
}
