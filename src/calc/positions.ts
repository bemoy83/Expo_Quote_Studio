// Position numbers (docs/arbeidstegning.md, «Posisjonsnummer»): one number per article, the same everywhere. The
// article is the quote line a drawn thing is priced on, so two alike doors share a number and the number stands by
// that line on the quote. Numbered in the order the drawing gives them: textile, plate swap, (carpentry), graphics,
// door, furniture. Lines nothing is drawn for (walls, floor, takdrager, services) have no number. Pure.
import type { Catalog } from '../catalog/types';
import { indexCatalog } from '../catalog/lookup';
import { hiddenPlates } from '../domain/print';
import type { Variant } from '../domain/types';
import { builtModules, isStandWall } from '../domain/walls';
import { doorKey, openingKey } from './lines/doors';
import type { CalcLine, CalcResult } from './types';

/** A drawn thing with a number: what it is, its id in the variant, and its article. */
export interface Positioned {
  kind: 'textile' | 'freeTextile' | 'swap' | 'foil' | 'door' | 'object';
  /** Textile, free textile, foil, opening or object id; for a plate swap the module key. */
  id: string;
  /** The article: the key its quote line goes by (lineKey). */
  key: string;
  pos: number;
}

export interface Positions {
  items: Positioned[];
  /** The numbers on a quote line (none for a line nothing drawn is priced on). */
  ofLine: (l: CalcLine) => number[];
  /** Name of an article, from the first line priced on it: for the pointer chip in the plan. */
  nameOf: (pos: number) => string | undefined;
}

/**
 * The article a quote or kalkyle line is: textile walls by their quote key (frame and textile are one line on the
 * quote), a door by product and leaf colour (one line each), anything else by its article number.
 */
export function lineKey(catalog: Catalog, l: Pick<CalcLine, 'artnr' | 'meta' | 'quote'>, idx = indexCatalog(catalog)): string {
  const sys = catalog.system;
  const parts = l.artnr.split('+');
  if (l.quote?.key) return `quote:${l.quote.key}`;
  if (parts.includes(sys.textile)) return 'quote:tekstil';
  const opening = idx.byArtnr.get(l.artnr)?.product.opening;
  if (opening) return doorKey(l.artnr, opening === 'curtain' ? undefined : l.meta);
  return l.artnr;
}

/** Numbers for what is drawn, from the quote lines it is priced on. */
export function positions(v: Variant, lines: CalcLine[], catalog: Catalog): Positions {
  const sys = catalog.system;
  const idx = indexCatalog(catalog);
  const keys = new Map<string, CalcLine>();
  const keyOf = (l: CalcLine) => lineKey(catalog, l, idx);
  for (const l of lines) if (!keys.has(keyOf(l))) keys.set(keyOf(l), l);

  // Drawn things in drawing order, each with its article
  const drawn: Omit<Positioned, 'pos'>[] = [];
  const walls = new Set(v.walls.map((w) => w.id));
  for (const t of v.textiles) if (walls.has(t.wallId)) drawn.push({ kind: 'textile', id: t.id, key: 'quote:tekstil' });
  for (const t of v.freeTextiles) drawn.push({ kind: 'freeTextile', id: t.id, key: 'quote:tekstil' });
  const hidden = hiddenPlates(v);
  const stand = new Set(v.walls.filter(isStandWall).map((w) => w.id));
  const mods = builtModules(v);
  for (const m of mods) if (stand.has(m.wallId) && !m.opening && !hidden.has(m.key)) drawn.push({ kind: 'swap', id: m.key, key: `${sys.plateSwap}-${m.plate}` });
  for (const f of v.foils) if (walls.has(f.wallId)) drawn.push({ kind: 'foil', id: f.id, key: f.full ? sys.foilFull : sys.foil });
  for (const m of mods) if (m.opening) drawn.push({ kind: 'door', id: m.opening.id, key: openingKey(idx, v, m.opening) });
  for (const o of v.objects) drawn.push({ kind: 'object', id: o.id, key: o.product });

  // One number per article that has a line, first come first numbered
  const number = new Map<string, number>();
  const items: Positioned[] = [];
  for (const d of drawn) {
    if (!keys.has(d.key)) continue;
    if (!number.has(d.key)) number.set(d.key, number.size + 1);
    items.push({ ...d, pos: number.get(d.key)! });
  }
  const names = new Map([...number].map(([k, n]) => [n, keys.get(k)!]));
  return {
    items,
    ofLine: (l) => {
      const n = number.get(keyOf(l));
      return n ? [n] : [];
    },
    nameOf: (pos) => {
      const l = names.get(pos);
      return l && (l.quote?.name ?? l.name);
    },
  };
}

/** Numbers for a calculated variant, from all its lines (the kalkyle's: the quote's lines carry the same articles). */
export const positionsOf = (v: Variant, res: Pick<CalcResult, 'groups'>, catalog: Catalog): Positions =>
  positions(
    v,
    res.groups.flatMap((g) => g.lines),
    catalog,
  );
