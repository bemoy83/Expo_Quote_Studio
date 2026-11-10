import { describe, expect, it } from 'vitest';
import type { Point, Variant } from './types';
import { createVariant } from './variant';
import { drawInnerBeam, eraseInnerBeams, innerBeamAt, moveInnerBeam, offGrid, shiftInnerBeam } from './innerBeams';

const ROW = createVariant('A', { width: 6, depth: 4, type: 'row' });
// The standard front beam of the row stand
const FRONT = [{ from: [0, 4] as Point, to: [6, 4] as Point }];
const draw = (v: Variant, a: Point, b: Point) => {
  const r = drawInnerBeam(v, a, b, FRONT);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};

describe('tegne innvendig takdrager', () => {
  it('draws a straight run inside the stand', () => {
    expect(draw(ROW, [3, 0], [3, 4]).innerBeams).toEqual([{ id: 'td1', from: [3, 0], to: [3, 4] }]);
  });

  it('refuses along a wall, along a beam, on another drawn beam and outside the stand', () => {
    const v = draw(ROW, [3, 0], [3, 4]);
    const why = (a: Point, b: Point) => {
      const r = drawInnerBeam(v, a, b, FRONT);
      return 'error' in r ? r.error : null;
    };
    expect(why([0, 0], [3, 0])).toBe('Takdrageren kan ikke gå langs en vegg');
    expect(why([1, 4], [3, 4])).toBe('Det går allerede en takdrager her');
    expect(why([3, 1], [3, 2])).toBe('Det går allerede en takdrager her');
    expect(why([3, 2], [7, 2])).toBe('Takdrageren må stå innenfor standen');
    expect(why([1, 2], [5, 2])).toBeNull();
  });

  it('erasing a part splits the beam', () => {
    const v = eraseInnerBeams(draw(ROW, [3, 0], [3, 4]), [3, 1], [3, 2]);
    expect(v.innerBeams).toEqual([
      { id: 'td1', from: [3, 0], to: [3, 1] },
      { id: 'td2', from: [3, 2], to: [3, 4] },
    ]);
  });

  it('moves in whole metres while it fits', () => {
    const v = draw(ROW, [1, 2], [4, 2]);
    expect(moveInnerBeam(v, 'td1', 1, 1, FRONT).innerBeams).toEqual([{ id: 'td1', from: [2, 3], to: [5, 3] }]);
    // Onto the front beam, or out of the stand: refused
    expect(moveInnerBeam(v, 'td1', 2, 0, FRONT)).toBe(v);
    expect(moveInnerBeam(v, 'td1', 0, 3, FRONT)).toBe(v);
  });

  it('finds the beam under the pointer', () => {
    const v = draw(ROW, [1, 2], [4, 2]);
    expect(innerBeamAt(v, { x: 2.5, y: 2.1 })?.id).toBe('td1');
    expect(innerBeamAt(v, { x: 2.5, y: 2.5 })).toBeUndefined();
  });
});

describe('Shift + dra (Byggeregel T15)', () => {
  const ROW = { width: 6, depth: 4, type: 'row' as const };
  const base = { ...createVariant('A', ROW), innerBeams: [{ id: 'td1', from: [2, 0] as Point, to: [2, 4] as Point }] };
  it('moves across in 50 mm steps off the grid, and back onto it on a whole metre', () => {
    const v = shiftInnerBeam(base, 'td1', 0.37, []);
    expect(v.innerBeams?.[0]).toMatchObject({ from: [2.35, 0], to: [2.35, 4] });
    expect(offGrid(v.innerBeams![0])).toBe(true);
    const back = shiftInnerBeam(v, 'td1', 0.65, []);
    expect(back.innerBeams?.[0]).toMatchObject({ from: [3, 0], to: [3, 4] });
    expect(offGrid(back.innerBeams![0])).toBe(false);
  });
  it('never onto a wall or out of the stand', () => {
    expect(shiftInnerBeam(base, 'td1', -2, [])).toBe(base);
    expect(shiftInnerBeam(base, 'td1', 4.5, [])).toBe(base);
  });
});
