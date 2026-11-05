// Door or curtain with header (overstykke), one product each; a door per leaf colour (the stand's unless chosen),
// lock and keys included.
import type { CatalogIndex } from '../../catalog/lookup';
import { doorRal } from '../../domain/doors';
import type { Opening, Variant } from '../../domain/types';
import { ITEM } from '../../pricing/data';
import { countBy, type CalcContext } from '../context';
import type { CalcLine } from '../types';

/** The leaf colour a door's line carries in `meta` («RAL 9010»); a curtain has none. */
const doorMeta = (ral: string) => `RAL ${ral}`;

/**
 * The article of a door or curtain: product and leaf colour, so two alike doors are one line and one position number
 * (calc/positions.ts). Built from the line (its `meta`) or from the opening; both must give the same key.
 */
export const doorKey = (product: string, meta: string | undefined) => `${product}|${meta ?? ''}`;

/** The article key of an opening in the variant. */
export function openingKey(idx: CatalogIndex, v: Variant, o: Opening): string {
  const curtain = idx.byArtnr.get(o.product)?.product.opening === 'curtain';
  return doorKey(o.product, curtain ? undefined : doorMeta(doorRal(v, o)));
}

export function doorLines(c: CalcContext): CalcLine[] {
  const { idx, v } = c;
  const isCurtain = (a: string) => idx.byArtnr.get(a)?.product.opening === 'curtain';
  const openingCounts = countBy(c.mods.flatMap((m) => (m.opening ? [`${m.opening.product}|${isCurtain(m.opening.product) ? '' : doorRal(v, m.opening)}`] : [])));
  return [...openingCounts].map(([k, n]) => {
    const [a, ral] = k.split('|');
    const leaf = isCurtain(a) ? ITEM.curtain : ITEM.door;
    const l = c.line(a, n, ral ? { meta: doorMeta(ral) } : {}, [{ id: leaf, qty: n }, { id: ITEM.headerPlate, qty: n }, ...c.moduleUses(n)]);
    const colour = ral && idx.wallByRal.get(ral)?.variant.name;
    return colour ? { ...l, name: `${l.name} · ${colour.toLowerCase()}` } : l;
  });
}
