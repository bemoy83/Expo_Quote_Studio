// Door or curtain with header (overstykke), one product each; a door per leaf colour (the stand's unless chosen),
// lock and keys included.
import { ITEM } from '../../pricing/data';
import { countBy, type CalcContext } from '../context';
import type { CalcLine } from '../types';

export function doorLines(c: CalcContext): CalcLine[] {
  const { idx, v } = c;
  const isCurtain = (a: string) => idx.byArtnr.get(a)?.product.opening === 'curtain';
  const openingCounts = countBy(c.mods.flatMap((m) => (m.opening ? [`${m.opening.product}|${isCurtain(m.opening.product) ? '' : (m.opening.ral ?? v.defaultPlate)}`] : [])));
  return [...openingCounts].map(([k, n]) => {
    const [a, ral] = k.split('|');
    const leaf = isCurtain(a) ? ITEM.curtain : ITEM.door;
    const l = c.line(a, n, ral ? { meta: `RAL ${ral}` } : {}, [{ id: leaf, qty: n }, { id: ITEM.headerPlate, qty: n }, ...c.moduleUses(n)]);
    const colour = ral && idx.wallByRal.get(ral)?.variant.name;
    return colour ? { ...l, name: `${l.name} · ${colour.toLowerCase()}` } : l;
  });
}
