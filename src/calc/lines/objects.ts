// Placed objects and counted items (Arbeidstimer too: hours counted in the panel), in catalog order, then the loose
// lines typed in the panel. A counter (6560) keeps its catalog price and is costed from what it is built of
// (Byggeregler K1–K5): one price item per counter, picked whole. Its plates in another wall colour (K6) cost the swap,
// the price stays the same in every colour (Bjørn 11.11.2026); the line says which colours, for the montør.
import { counterRal } from '../../domain/objects';
import { ITEM } from '../../pricing/data';
import { countBy, type CalcContext } from '../context';
import type { CalcLine } from '../types';

export function objectLines(c: CalcContext): CalcLine[] {
  const { v } = c;
  const objectCounts = countBy(v.objects.map((o) => o.product));
  for (const x of v.counted) objectCounts.set(x.product, (objectCounts.get(x.product) ?? 0) + x.qty);
  return [...objectCounts].map(([a, n]) => {
    const counter = c.idx.byArtnr.get(a)?.product.counter;
    if (!counter) return c.line(a, n);
    const placed = v.objects.filter((o) => o.product === a);
    const swapped = placed.filter((o) => o.ral).length;
    const colours = [...countBy(placed.map(counterRal))].sort(([x], [y]) => x.localeCompare(y));
    return c.line(a, n, swapped ? { meta: colours.map(([ral, k]) => `RAL ${ral}${colours.length > 1 ? ` × ${k}` : ''}`).join(' · ') } : {}, [
      { id: ITEM.counter(counter.length, counter.depth), qty: n },
      ...(swapped ? [{ id: ITEM.counterPlates(counter.length, counter.depth), qty: swapped }] : []),
    ]);
  });
}

export function looseLines(c: CalcContext): CalcLine[] {
  return c.v.loose.map((l): CalcLine => ({
    name: l.name,
    qty: l.qty,
    unit: 'stk',
    price: l.price,
    sum: l.qty * l.price,
    artnr: '',
    placeholder: false,
    group: 'tjen.lose',
    meta: l.price ? undefined : 'pris settes i tilbudet',
    cost: null,
    dg: null,
    strategy: 'fast',
    transfer: null,
    time: {},
    payer: 'utstiller',
  }));
}
