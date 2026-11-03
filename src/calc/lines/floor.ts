// Floor: m² laid per product. Waste is ours and not counted. Carpet tiles are also counted per size for picking,
// rolled floor (engangsteppe) in running metres of roll. Floor protection over all of it.
import { carpetMetrics } from '../../domain/floor/rollFill';
import { rollUsage } from '../../domain/floor/lanes';
import { tileAreas, tileCounts } from '../../domain/floor/tiles';
import type { Variant } from '../../domain/types';
import type { CalcContext } from '../context';
import type { CalcLine } from '../types';

/** m² laid per product, and in all, for the lines and the key figures. */
export function floorAreas(v: Variant): { floor: Record<string, number>; floorTotal: number } {
  const floor = tileAreas(v.floor.tiles);
  return { floor, floorTotal: Object.values(floor).reduce((a, b) => a + b, 0) };
}

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('nb-NO');

export function floorLines(c: CalcContext): CalcLine[] {
  const { v, idx } = c;
  const { floor, floorTotal } = floorAreas(v);
  return [
    ...Object.entries(floor).map(([a, m2]) => {
      const p = idx.byArtnr.get(a)?.product;
      const tiles = p?.tiles ? tileCounts(v.floor.tiles.filter((t) => t.product === a)) : undefined;
      const roll = p?.roll ? rollLine(v.floor.tiles, a, p.roll) : undefined;
      const meta = roll ? `${a} · ${roll.lanes.reduce((n, l) => n + l.qty, 0)} baner · ${fmt1(roll.lm)} lm rull` : `${a} · ferdig lagt`;
      return c.line(a, m2, { meta, ...(tiles ? { tiles } : {}), ...(roll ? { roll } : {}) });
    }),
    c.line(c.sys.floorProtection, v.floor.protection ? floorTotal : 0),
  ];
}

/** A rolled product's lanes grouped by size as cut, longest and widest first. */
function rollLine(tiles: Variant['floor']['tiles'], product: string, roll: number): NonNullable<CalcLine['roll']> {
  const u = rollUsage(tiles, product, roll);
  const pieces = new Map<string, { length: number; parts: number[]; endToEnd: boolean; qty: number }>();
  for (const p of u.pieces) {
    const parts = p.lanes.map((l) => (p.split ? roll / p.lanes.length : l.width));
    const k = `${p.length.toFixed(2)}|${parts.join(',')}|${p.endToEnd}`;
    const s = pieces.get(k) ?? { length: p.length, parts, endToEnd: p.endToEnd, qty: 0 };
    s.qty++;
    pieces.set(k, s);
  }
  const sizes = new Map<string, { length: number; width: number; cut: boolean; qty: number }>();
  for (const l of u.lanes) {
    const k = `${l.length}|${l.width}`;
    const s = sizes.get(k) ?? { length: l.length, width: l.width, cut: l.cut, qty: 0 };
    s.qty++;
    sizes.set(k, s);
  }
  return {
    width: roll,
    lm: u.lm,
    waste: u.waste,
    lanes: [...sizes.values()].sort((a, b) => b.width - a.width || b.length - a.length),
    pieces: [...pieces.values()].sort((a, b) => a.parts.length - b.parts.length || b.length - a.length),
    tape: carpetMetrics(tiles.filter((t) => t.roll && t.product === product), roll, tiles).tape,
  };
}
