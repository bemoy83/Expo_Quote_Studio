// The steps every grip shares (domain/grips.ts).
import { describe, expect, it } from 'vitest';
import { furthest, stepsOf, toward0 } from './grips';

describe('grips', () => {
  it('counts down toward 0 either way', () => {
    expect(toward0(3)).toEqual([3, 2, 1, 0]);
    expect(toward0(-2)).toEqual([-2, -1, 0]);
    expect(toward0(0)).toEqual([0]);
  });

  it('rounds a travel to whole steps', () => {
    expect(stepsOf(0.6, 0.25)).toBe(2);
    expect(stepsOf(-1.4, 1)).toBe(-1);
  });

  it('finds the furthest steps that work, the first way first', () => {
    // Only up to 2 the first way; the second way goes on
    const r = furthest(4, 3, (a, b) => (a <= 2 ? `${a},${b}` : null));
    expect(r).toEqual({ a: 2, b: 3, value: '2,3' });
    expect(furthest(2, 0, () => null)).toBeNull();
  });
});
