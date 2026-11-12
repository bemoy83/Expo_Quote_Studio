// Placed objects and counted items (Arbeidstimer too: hours counted in the panel), in catalog order, then the loose
// lines typed in the panel. A counter (6560) keeps its catalog price and is costed from what it is built of
// (Byggeregler K1–K5): one price item per counter, picked whole. Its plates in another wall colour (K6) cost the swap,
// the price stays the same in every colour (Bjørn 11.11.2026); the line says which colours, for the montør.
import { counterBuildOf, layoutOf, piecesOf } from '../../domain/counterShape';
import { counterRal } from '../../domain/objects';
import type { PlacedObject } from '../../domain/types';
import { ITEM } from '../../pricing/data';
import { countBy, type CalcContext } from '../context';
import type { CalcLine } from '../types';

export function objectLines(c: CalcContext): CalcLine[] {
  const { v } = c;
  // A drawn counter (K7) has its own line below; the rest count by product
  const objectCounts = countBy(v.objects.filter((o) => !o.pieces).map((o) => o.product));
  for (const x of v.counted) objectCounts.set(x.product, (objectCounts.get(x.product) ?? 0) + x.qty);
  const lines = [...objectCounts].map(([a, n]) => {
    const counter = c.idx.byArtnr.get(a)?.product.counter;
    if (!counter) return c.line(a, n);
    const placed = v.objects.filter((o) => o.product === a && !o.pieces);
    const swapped = placed.filter((o) => o.ral).length;
    const colours = [...countBy(placed.map(counterRal))].sort(([x], [y]) => x.localeCompare(y));
    return c.line(a, n, swapped ? { meta: colours.map(([ral, k]) => `RAL ${ral}${colours.length > 1 ? ` × ${k}` : ''}`).join(' · ') } : {}, [
      { id: ITEM.counter(counter.length, counter.depth), qty: n },
      ...(swapped ? [{ id: ITEM.counterPlates(counter.length, counter.depth), qty: swapped }] : []),
    ]);
  });
  return [...lines, ...v.objects.filter((o) => o.pieces).map((o) => drawnCounterLine(c, o))];
}

/** A drawn counter (K7, K8): for now priced and costed as as many counters in stock as it has metres of parts. Its own
 *  price from the cost engine, calibrated so 1,0 m stays 1320 kr, comes in a later step (Bjørn 12.11.2026). */
function drawnCounterLine(c: CalcContext, o: PlacedObject): CalcLine {
  const hit = c.idx.byArtnr.get(o.product);
  const counter = hit?.product.counter;
  const b = counterBuildOf(o);
  const metres = layoutOf(o.pieces ?? []).cells.reduce((s, x) => s + Math.max(x.x[1] - x.x[0], x.z[1] - x.z[0]) / 1000, 0);
  const size = piecesOf(o).length > 1 ? `${b.length} × ${b.depth}` : `${Math.max(b.length, b.depth)} × ${Math.min(b.length, b.depth)}`;
  const meta = [`tegnet ${size} mm`, ...(o.ral ? [`RAL ${o.ral}`] : []), 'foreløpig pris per meter'].join(' · ');
  const uses = counter ? [{ id: ITEM.counter(counter.length, counter.depth), qty: metres }, ...(o.ral ? [{ id: ITEM.counterPlates(counter.length, counter.depth), qty: metres }] : [])] : null;
  return c.line(o.product, 1, { meta }, uses, (hit?.variant.price ?? 0) * metres);
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
