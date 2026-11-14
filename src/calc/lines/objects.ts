// Placed objects and counted items (Arbeidstimer too: hours counted in the panel), in catalog order, then the loose
// lines typed in the panel. A standard counter (6560, K22) keeps its catalog price and is costed from what it is built
// of (Byggeregler K1–K5): one price item per counter, picked whole. Its plates in another wall colour (K6) cost the swap,
// the price stays the same in every colour (Bjørn 11.11.2026); the line says which colours, for the montør.
import { counterBuildOf } from '../../domain/counterShape';
import { innerCorners, podiumHeights, podiumSize } from '../../domain/podiums';
import { podiumHas } from '../../domain/podiumFaces';
import { lockedParts } from '../../domain/podiumLocks';
import { soldAs, stockByArtnr, stockOf, stockSize } from '../../domain/podiumStock';
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
  // A counter of Disker og podier (K13) has its own line below, unless it is a standard counter (K22); the rest count by
  // the product they are sold as
  const stock = (o: PlacedObject) => !o.sections || !!stockOf(o.sections);
  const objectCounts = countBy(v.objects.filter(stock).map(soldAs));
  for (const x of v.counted) objectCounts.set(x.product, (objectCounts.get(x.product) ?? 0) + x.qty);
  const lines = [...objectCounts].map(([a, n]) => {
    // A standard counter or podie by its own size and height (K22), else the product's
    const ready = stockByArtnr(a);
    const counter: { length: number; depth: number; h?: number } | undefined = ready ? stockSize(ready) : c.idx.byArtnr.get(a)?.product.counter;
    if (!counter) return c.line(a, n);
    const { h } = counter;
    const placed = v.objects.filter((o) => stock(o) && soldAs(o) === a);
    const swapped = placed.filter((o) => o.ral).length;
    const colours = [...countBy(placed.map(counterRal))].sort(([x], [y]) => x.localeCompare(y));
    return c.line(a, n, swapped ? { meta: colours.map(([ral, k]) => `RAL ${ral}${colours.length > 1 ? ` × ${k}` : ''}`).join(' · ') } : {}, [
      { id: ITEM.counter(counter.length, counter.depth, h), qty: n },
      ...(swapped ? [{ id: ITEM.counterPlates(counter.length, counter.depth, h), qty: swapped }] : []),
    ]);
  });
  return [...lines, ...v.objects.filter((o) => !stock(o)).map((o) => podiumLine(c, o))];
}

/** A section this long (mm, its longest side) or shorter is a half (K13). */
const HALF_PART = RECIPES.counter.module.half;

/** What a counter or podium of Disker og podier costs (K13): its parts as K9, the work per section, whole when
 *  its longest side is over 500, else half, and per inner corner of its outline (placeholders). `b`: its build as it
 *  stands (podiumLocks.ts placedBuild: a side against a wall a plate, K16). */
export function podiumUses(o: PlacedObject, b: CounterBuild = counterBuildOf(o)): Use[] {
  const sections = o.sections ?? [];
  const longest = sections.map((x) => Math.max(x.x[1] - x.x[0], x.z[1] - x.z[0]));
  // K21: a sliding door is two leaves, fitted as one
  const doors = b.plates.filter((p) => p.level === 'door').length / 2;
  // K19: a shelf is fitted on its rails (H7's times, placeholder); the shelf at CC 750 in a section 500 deep is in the
  // work per section, as in 6560 (K9, Bjørn 13.11.2026)
  const shelves = sections.reduce((n, x) => n + (x.shelves ?? []).filter((y) => !(y === RECIPES.counter.middle && Math.min(x.x[1] - x.x[0], x.z[1] - x.z[0]) === HALF_PART)).length, 0);
  return [
    ...builtUses(b, longest.filter((n) => n > HALF_PART).length, longest.filter((n) => n <= HALF_PART).length, innerCorners(sections)),
    ...(doors ? [{ id: ITEM.counterDoor, qty: doors }] : []),
    ...(shelves ? [{ id: ITEM.counterShelf, qty: shelves }] : []),
  ];
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
 *  parts and the work, one line each, named as its product in the product list («Disk», «Podie»); without a complete cost the
 *  catalog price per m² of top. Its parts are picked loose under Disker. */
function podiumLine(c: CalcContext, o: PlacedObject): CalcLine {
  const hit = c.idx.byArtnr.get(o.product);
  const s = podiumSize(o);
  const top = (o.sections ?? []).reduce((a, x) => a + ((x.x[1] - x.x[0]) * (x.z[1] - x.z[0])) / 1e6, 0);
  // Two heights or more after a fusion: each, low to high (K12)
  const locked = lockedParts(c.v, c.place, o);
  const meta = [`bygget på stedet ${s.length} × ${s.depth} × ${podiumHeights(o).join('/')} mm`, ...podiumHas(o.sections ?? [], locked), ...(o.ral ? [`RAL ${o.ral}`] : [])].join(' · ');
  // Its name from the product list: the product it is built as, «Disk» or «Podie» (Bjørn 14.11.2026)
  const name = hit?.product.name ?? o.product;
  // Each its own article, so each gets its own position number (calc/positions.ts)
  return c.line(o.product, 1, { name, meta, strategy: 'sum', foga: true, quote: { key: podiumKey(o.id), name, lead: true } }, podiumUses(o, counterBuildOf(o, undefined, locked)), (hit?.variant.price ?? 0) * top);
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
