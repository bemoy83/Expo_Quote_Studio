// What a pen's edit changes as a consequence: drawn as it will be, ringed where it changes, told in the hint line.
import { describe, expect, it } from 'vitest';
import { calc } from '../../calc/calc';
import { paintWalls } from '../../domain/edit';
import { conflicts } from '../../domain/objects';
import type { Variant } from '../../domain/types';
import { createVariant } from '../../domain/variant';
import { builtModules } from '../../domain/walls';
import { editResult } from '../edits';
import { catalog, place, rules } from '../env';
import type { PlanState } from './nextArea';
import { followHint, textileFollows } from './nextFollow';

const state = (v: Variant): PlanState => ({ v, res: calc(v, rules, catalog), mods: builtModules(v), bad: conflicts(v, place) });
const corner = (): Variant => {
  const s = createVariant('A', { width: 4, depth: 3, type: 'corner', cornerSide: 'right' });
  return { ...s, textiles: [{ id: 't1', from: [1, 2], to: [2, 2] }, { id: 't2', from: [2, 2], to: [2, 3] }] };
};

describe('textileFollows', () => {
  it('a new inner wall at a free-standing corner: the arm it stops is a consequence, ringed at its end, told in words', () => {
    const v = corner();
    const next = editResult(v, (x) => paintWalls(x, [1, 2], [1, 3]), undefined);
    const fs = textileFollows(state(v), state(next));
    expect(fs.map((f) => f.id)).toEqual(['t1']);
    expect(fs[0].text).toBe('Tekstilvegg T1 kortes 20 mm');
    // The ring at the frame end that now stops at the wall
    expect(fs[0].marks).toHaveLength(1);
    expect(fs[0].marks[0][0]).toBeCloseTo(1.02, 6);
    expect(fs[0].marks[0][1]).toBeCloseTo(2, 6);
  });

  it('a textile run the edit itself moves is not a consequence', () => {
    const v = corner();
    const next: Variant = { ...v, textiles: [{ id: 't1', from: [0.5, 2], to: [2, 2] }, v.textiles[1]] };
    expect(textileFollows(state(v), state(next))).toEqual([]);
  });

  it('nothing follows when the edit leaves the textile alone', () => {
    const v = corner();
    const next = editResult(v, (x) => paintWalls(x, [3, 0], [3, 1]), undefined);
    expect(textileFollows(state(v), state(next))).toEqual([]);
  });
});

describe('followHint', () => {
  it('the pen first, then what follows', () => {
    const f = { id: 't1', box: { x0: 0, y0: 0, x1: 1, y1: 1 }, marks: [], text: 'Tekstilvegg T1 kortes 20 mm' };
    expect(followHint(null, [f])).toBe('Tekstilvegg T1 kortes 20 mm');
    expect(followHint('Slipp for å koble', [f])).toBe('Slipp for å koble · Tekstilvegg T1 kortes 20 mm');
    expect(followHint(null, [])).toBeNull();
  });
});
