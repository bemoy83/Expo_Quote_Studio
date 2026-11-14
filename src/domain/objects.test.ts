// Counter colour (Byggeregel K6): stored only when it is not the stock colour; the bucket paints counters alone.
import { describe, expect, it } from 'vitest';
import { counterRal, paintPodiums, setCounterRal } from './objects';
import { stockSections } from './podiumStock';
import type { PlacedObject } from './types';
import { createVariant } from './variant';

const base = createVariant('A', { width: 4, depth: 3, type: 'row' });
const counter: PlacedObject = { id: 'i1', product: '6571', x: 2, y: 1.5, rot: 0, sections: stockSections() };

describe('counter colour (K6)', () => {
  it('recolours one counter, and back to stock clears it', () => {
    const v = { ...base, objects: [counter] };
    expect(counterRal(counter)).toBe('9010');
    expect(setCounterRal(v, 'i1', '5012').objects[0].ral).toBe('5012');
    expect('ral' in setCounterRal(setCounterRal(v, 'i1', '5012'), 'i1', '9010').objects[0]).toBe(false);
  });

  it('the bucket paints every counter and nothing else', () => {
    const v = { ...base, objects: [counter, { id: 'i2', product: '5276', x: 3, y: 1, rot: 0 }] };
    expect(paintPodiums(v, '7012').objects.map((o) => o.ral)).toEqual(['7012', undefined]);
  });
});
