// Counter colour (Byggeregel K6): stored only when it is not the stock colour, the bucket paints counters alone.
import { describe, expect, it } from 'vitest';
import { addObject, counterRal, paintCounters, setCounterRal, type PlaceContext } from './objects';
import { createVariant } from './variant';
import { RULES } from '../rules/rules';

const ctx: PlaceContext = { rules: RULES, footprint: () => ({ w: 1.02, d: 0.52, h: 1.04 }), swings: () => false };
const base = createVariant('A', { width: 4, depth: 3, type: 'row' });

describe('counter colour (K6)', () => {
  it('places a counter in the pen colour, the stock colour stored as none', () => {
    const red = addObject(base, ctx, '6560', 2, 1.5, '3002')!;
    expect(red.objects[0].ral).toBe('3002');
    const white = addObject(base, ctx, '6560', 2, 1.5, '9010')!;
    expect('ral' in white.objects[0]).toBe(false);
    expect(counterRal(white.objects[0])).toBe('9010');
  });

  it('recolours one counter, and back to stock clears it', () => {
    const v = addObject(base, ctx, '6560', 2, 1.5)!;
    const id = v.objects[0].id;
    expect(setCounterRal(v, id, '5012').objects[0].ral).toBe('5012');
    expect('ral' in setCounterRal(setCounterRal(v, id, '5012'), id, '9010').objects[0]).toBe(false);
  });

  it('the bucket paints every counter and nothing else', () => {
    const v = { ...base, objects: [{ id: 'i1', product: '6560', x: 1, y: 1, rot: 0 }, { id: 'i2', product: '5276', x: 3, y: 1, rot: 0 }] };
    const out = paintCounters(v, (a) => a === '6560', '7012');
    expect(out.objects.map((o) => o.ral)).toEqual(['7012', undefined]);
  });
});
