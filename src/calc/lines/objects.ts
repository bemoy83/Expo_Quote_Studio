// Placed objects and counted items (Arbeidstimer too: hours counted in the panel), in catalog order, then the loose
// lines typed in the panel. A counter (6560) keeps its catalog price and is costed from what it is built of
// (Byggeregler K1–K5): one price item per counter, picked whole. Its plates in another wall colour (K6) cost the swap,
// the price stays the same in every colour (Bjørn 11.11.2026); the line says which colours, for the montør.
import { counterBuildOf, layoutOf, piecesOf } from '../../domain/counterShape';
import { innerCorners, podiumName, podiumSize } from '../../domain/podiums';
import { profileMetres, type CounterBuild } from '../../foga/counter';
import { RECIPES } from '../../foga/recipes';
import type { Use } from '../../pricing/model';
import { counterRal } from '../../domain/objects';
import type { PlacedObject } from '../../domain/types';
import { ITEM } from '../../pricing/data';
import { countBy, type CalcContext } from '../context';
import type { CalcLine } from '../types';

export function objectLines(c: CalcContext): CalcLine[] {
  const { v } = c;
  // A drawn counter (K7) and one of Disker og podier (K13) have their own line below; the rest count by product
  const objectCounts = countBy(v.objects.filter((o) => !o.pieces && !o.sections).map((o) => o.product));
  for (const x of v.counted) objectCounts.set(x.product, (objectCounts.get(x.product) ?? 0) + x.qty);
  const lines = [...objectCounts].map(([a, n]) => {
    const counter = c.idx.byArtnr.get(a)?.product.counter;
    if (!counter) return c.line(a, n);
    const placed = v.objects.filter((o) => o.product === a && !o.pieces && !o.sections);
    const swapped = placed.filter((o) => o.ral).length;
    const colours = [...countBy(placed.map(counterRal))].sort(([x], [y]) => x.localeCompare(y));
    return c.line(a, n, swapped ? { meta: colours.map(([ral, k]) => `RAL ${ral}${colours.length > 1 ? ` × ${k}` : ''}`).join(' · ') } : {}, [
      { id: ITEM.counter(counter.length, counter.depth), qty: n },
      ...(swapped ? [{ id: ITEM.counterPlates(counter.length, counter.depth), qty: swapped }] : []),
    ]);
  });
  return [...lines, ...v.objects.filter((o) => o.pieces).map((o) => drawnCounterLine(c, o)), ...v.objects.filter((o) => o.sections).map((o) => podiumLine(c, o))];
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
  const cells = counterCells(o);
  return builtUses(counterBuildOf(o), cells.filter((n) => n > HALF_PART).length, cells.filter((n) => n <= HALF_PART).length, piecesOf(o).length - 1);
}

/** What a counter or podium of Disker og podier costs (K13): as a drawn counter (K9), the work per section, whole when
 *  its longest side is over 500, else half, and per inner corner of its outline (placeholders). */
export function podiumUses(o: PlacedObject): Use[] {
  const sections = o.sections ?? [];
  const longest = sections.map((x) => Math.max(x.x[1] - x.x[0], x.z[1] - x.z[0]));
  return builtUses(counterBuildOf(o), longest.filter((n) => n > HALF_PART).length, longest.filter((n) => n <= HALF_PART).length, innerCorners(sections));
}

/** A counter built on site (K9, K13): its parts, and the work for its whole and half parts and its corners. */
function builtUses(b: CounterBuild, whole: number, half: number, corners: number): Use[] {
  const boards = countBy(b.boards.map((x) => `${Math.max(x.w, x.d)}|${Math.min(x.w, x.d)}`));
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return [
    ...Object.entries(profileMetres(b)).map(([code, m]) => ({ id: ITEM.counterProfile(code), qty: r3(m) })),
    { id: ITEM.counterCoupling, qty: b.couplings },
    { id: ITEM.counterPlateM2, qty: r3(b.plates.reduce((s, p) => s + p.w * p.h, 0) / 1e6) },
    ...[...boards].map(([k, n]) => ({ id: ITEM.counterBoard(+k.split('|')[0], +k.split('|')[1]), qty: n })),
    { id: ITEM.counterWhole, qty: whole },
    { id: ITEM.counterHalf, qty: half },
    { id: ITEM.counterCorner, qty: corners },
  ].filter((u) => u.qty > 0);
}

/** The article of one counter or podium of Disker og podier: each is built to its own shape. */
export const podiumKey = (id: string) => `disk:${id}`;

/** A counter or podium of Disker og podier (Byggeregel K13): as K9, built on site and priced by the cost engine from its
 *  parts and the work, one line each, «Disk» when no deeper than 500, else «Podium»; without a complete cost the
 *  catalog price per m² of top. Its parts are picked loose under Disker. */
function podiumLine(c: CalcContext, o: PlacedObject): CalcLine {
  const hit = c.idx.byArtnr.get(o.product);
  const s = podiumSize(o);
  const top = (o.sections ?? []).reduce((a, x) => a + ((x.x[1] - x.x[0]) * (x.z[1] - x.z[0])) / 1e6, 0);
  const meta = [`bygget på stedet ${s.length} × ${s.depth} × ${s.height} mm`, ...(o.ral ? [`RAL ${o.ral}`] : [])].join(' · ');
  const name = podiumName(o.sections ?? []);
  // Each its own article, so each gets its own position number (calc/positions.ts)
  return c.line(o.product, 1, { name, meta, strategy: 'sum', foga: true, quote: { key: podiumKey(o.id), name, lead: true } }, podiumUses(o), (hit?.variant.price ?? 0) * top);
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
