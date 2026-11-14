// Door or curtain with header (overstykke), one product each; a door per leaf colour (the stand's unless chosen),
// lock and keys included; a curtain per fabric colour (its first unless chosen, Byggeregel D6).
import { fabricOf, type CatalogIndex } from '../../catalog/lookup';
import { doorRal } from '../../domain/doors';
import type { Opening, Variant } from '../../domain/types';
import { ITEM } from '../../pricing/data';
import { countBy, type CalcContext } from '../context';
import type { CalcLine } from '../types';

/** The leaf colour a door's line carries in `meta` («RAL 9010»). */
const doorMeta = (ral: string) => `RAL ${ral}`;

/** The colour a curtain's line carries in `meta` («Sort»), none when its product has no fabrics. */
const curtainMeta = (idx: CatalogIndex, o: Opening) => fabricOf(idx.byArtnr.get(o.product)?.product, o.fabric)?.name;

/**
 * The article of a door or curtain: product and leaf colour, so two alike doors are one line and one position number
 * (calc/positions.ts). Built from the line (its `meta`) or from the opening; both must give the same key.
 */
export const doorKey = (product: string, meta: string | undefined) => `${product}|${meta ?? ''}`;

/** The article key of an opening in the variant. */
export function openingKey(idx: CatalogIndex, v: Variant, o: Opening): string {
  const curtain = idx.byArtnr.get(o.product)?.product.opening === 'curtain';
  return doorKey(o.product, curtain ? curtainMeta(idx, o) : doorMeta(doorRal(v, o)));
}

export function doorLines(c: CalcContext): CalcLine[] {
  const { idx, v } = c;
  const isCurtain = (a: string) => idx.byArtnr.get(a)?.product.opening === 'curtain';
  const openingCounts = countBy(c.mods.flatMap((m) => (m.opening ? [openingKey(idx, v, m.opening)] : [])));
  return [...openingCounts].map(([k, n]) => {
    const [a, meta] = k.split('|');
    const curtain = isCurtain(a);
    const leaf = curtain ? ITEM.curtain : ITEM.door;
    const l = c.line(a, n, meta ? { meta } : {}, [{ id: leaf, qty: n }, { id: ITEM.headerPlate, qty: n }, ...c.moduleUses(n)]);
    const colour = curtain ? meta : meta && idx.wallByRal.get(meta.slice('RAL '.length))?.variant.name;
    return colour ? { ...l, name: `${l.name} · ${colour.toLowerCase()}` } : l;
  });
}
