// Checks Byggeregel X16 (docs/byggeregler.md): one number series for all textile walls, and the visible face as the
// size on the quote, one line per frame even when its two faces differ.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../../catalog/defaultCatalog';
import { addFreeTextile } from '../../domain/textile/free';
import { withOnWall } from '../../domain/textile/mounts';
import type { Point, Variant } from '../../domain/types';
import { createVariant } from '../../domain/variant';
import { RULES } from '../../rules/rules';
import { calc } from '../calc';
import { quoteLines } from '../quoteLines';
import { frameSizes, sizeOf } from './lines';

const draw = (v: Variant, a: Point, b: Point) => {
  const r = addFreeTextile(v, RULES, a, b);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};
const island = () => createVariant('A', { width: 10, depth: 8, type: 'island' });
const quoted = (v: Variant) =>
  calc(v, RULES, DEFAULT_CATALOG)
    .groups.flatMap((g) => quoteLines(g.lines))
    .filter((l) => l.quote?.key.startsWith('tekstil:'));

describe('X16 names and sizes', () => {
  it('a size is the visible face; two faces of one width are one size, two widths are named per side', () => {
    expect(sizeOf([{ W: 1970, H: 2540 }])).toEqual({ name: '1970 × 2540 mm' });
    expect(sizeOf([{ W: 1960, H: 2540, face: 'a' }, { W: 1960, H: 2540, face: 'b' }])).toEqual({ name: '1960 × 2540 mm' });
    expect(sizeOf([{ W: 1940, H: 2540, face: 'a' }, { W: 1980, H: 2540, face: 'b' }])).toEqual({
      name: '1940/1980 × 2540 mm',
      sides: ['side A 1940 × 2540 mm', 'side B 1980 × 2540 mm'],
    });
  });
  it('a free-standing corner is one frame on the quote, with both sides under it', () => {
    let v = draw(island(), [1, 2], [4, 2]);
    v = draw(v, [4, 2], [4, 5]);
    const lines = quoted(v);
    // Both arms are the same: one line, 2 stk, the two sides named under it
    expect(lines.map((l) => [l.name, l.qty, l.unit])).toEqual([['Tekstilvegg 2980/3020 × 2540 mm', 2, 'stk']]);
    expect(lines[0].quote?.sides).toEqual(['side A 2980 × 2540 mm', 'side B 3020 × 2540 mm']);
  });
  it('one T series whatever the mounting, the free-standing faces T…A and T…B', () => {
    const v0 = createVariant('A', { width: 6, depth: 3, type: 'row' });
    const back = v0.walls.find((w) => w.from[1] === w.to[1] && w.from[1] === 0)!;
    let v = withOnWall(v0, [{ id: 'w1', wallId: back.id, side: 1, from: 0, width: 2 }]);
    v = draw(v, [3, 1.5], [5, 1.5]);
    const r = calc(v, RULES, DEFAULT_CATALOG);
    expect(r.production.pieces.map((p) => p.pos)).toEqual(['T1']);
    expect(r.production.free.map((f) => [f.pos, ...f.faces.map((x) => x.pos)])).toEqual([['T2', 'T2A', 'T2B']]);
    expect(frameSizes(r.production).map((x) => [x.size.name, x.mount, x.qty])).toEqual([
      ['1970 × 2540 mm', 'vegg', 1],
      ['2000 × 2540 mm', 'fotplater', 1],
    ]);
  });
});
