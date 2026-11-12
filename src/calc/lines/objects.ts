// Placed objects and counted items (Arbeidstimer too: hours counted in the panel), in catalog order, then the loose
// lines typed in the panel. A counter (6560) keeps its catalog price and is costed from what it is built of
// (Byggeregler K1–K5): one price item per counter, picked whole. Its plates in another wall colour (K6) cost the swap,
// the price stays the same in every colour (Bjørn 11.11.2026); the line says which colours, for the montør.
import { counterBuildOf, layoutOf, piecesOf } from '../../domain/counterShape';
import { profileMetres } from '../../foga/counter';
import { RECIPES } from '../../foga/recipes';
import type { Use } from '../../pricing/model';
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

/** A drawn counter (Byggeregler K7–K9): built on site, so priced by the cost engine from what it is built of and the
 *  work, the same in every colour (K6); without a complete cost the catalog price per metre of parts. Its parts are
 *  picked loose (foga/engine.ts), so the line is not picked itself. */
function drawnCounterLine(c: CalcContext, o: PlacedObject): CalcLine {
  const hit = c.idx.byArtnr.get(o.product);
  const b = counterBuildOf(o);
  const metres = counterMetres(o);
  const size = piecesOf(o).length > 1 ? `${b.length} × ${b.depth}` : `${Math.max(b.length, b.depth)} × ${Math.min(b.length, b.depth)}`;
  const meta = [`bygget på stedet ${size} mm`, ...(o.ral ? [`RAL ${o.ral}`] : [])].join(' · ');
  return c.line(o.product, 1, { meta, strategy: 'sum', foga: true }, drawnCounterUses(o), (hit?.variant.price ?? 0) * metres);
}

/** A part this long (mm, along) or shorter is a half (K7). */
const HALF_PART = RECIPES.counter.module.half;

/** Metres of a drawn counter's parts: 1 per whole, 0,5 per half (K7). */
export const counterMetres = (o: PlacedObject) => counterCells(o).reduce((s, n) => s + n / 1000, 0);
const counterCells = (o: PlacedObject) => layoutOf(o.pieces ?? []).cells.map((x) => Math.max(x.x[1] - x.x[0], x.z[1] - x.z[0]));

/** What a drawn counter costs (K9): profiles by the metre, 600, plates by the m², boards by size, the work. */
export function drawnCounterUses(o: PlacedObject): Use[] {
  const b = counterBuildOf(o);
  const cells = counterCells(o);
  const boards = countBy(b.boards.map((x) => `${Math.max(x.w, x.d)}|${Math.min(x.w, x.d)}`));
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return [
    ...Object.entries(profileMetres(b)).map(([code, m]) => ({ id: ITEM.counterProfile(code), qty: r3(m) })),
    { id: ITEM.counterCoupling, qty: b.couplings },
    { id: ITEM.counterPlateM2, qty: r3(b.plates.reduce((s, p) => s + p.w * p.h, 0) / 1e6) },
    ...[...boards].map(([k, n]) => ({ id: ITEM.counterBoard(+k.split('|')[0], +k.split('|')[1]), qty: n })),
    { id: ITEM.counterWhole, qty: cells.filter((n) => n > HALF_PART).length },
    { id: ITEM.counterHalf, qty: cells.filter((n) => n <= HALF_PART).length },
    { id: ITEM.counterCorner, qty: piecesOf(o).length - 1 },
  ].filter((u) => u.qty > 0);
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
