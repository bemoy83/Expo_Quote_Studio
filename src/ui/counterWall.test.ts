// A counter of Disker og podier against a stand wall (Byggeregel K10, Bjørn 16.11.2026): it lies flush against the
// wall, never into it.
import { describe, expect, it } from 'vitest';
import { blockers, conflicts, moveObject, objectBoxes } from '../domain/objects';
import { podiumAt } from '../domain/podiums';
import { parse } from '../persistence/file';
import { place } from './env';

const TEXTS = import.meta.glob<string>('../test/fixtures/*.json', { query: '?raw', import: 'default', eager: true });
const r = parse(TEXTS['../test/fixtures/02-hjorne-utstiller.json']);
if (!r.ok) throw new Error(r.error);
const v0 = r.sketch.variants[0];

describe('a counter moved against the back wall', () => {
  const c = podiumAt(v0, place, { product: '6571', stock: '6560' }, [1.5, 2.6]);
  if ('error' in c) throw new Error(c.error);
  for (const y of [0.3, 0.26, 0.2]) {
    it(`dropped at ${y} lies against the wall's face, not in it`, () => {
      const v = moveObject(c.v, place, c.id, 1.5, y);
      const o = v.objects.find((x) => x.id === c.id)!;
      expect(Math.min(...objectBoxes(place, o).map((b) => b.y0))).toBeCloseTo(0.02);
      expect(conflicts(v, place).has(c.id)).toBe(false);
    });
  }
  it('pushed into the wall it is refused there', () => {
    const v = { ...c.v, objects: c.v.objects.map((o) => (o.id === c.id ? { ...o, y: 0.26 } : o)) };
    expect(conflicts(v, place).has(c.id)).toBe(true);
  });
});

describe('a counter in the corner of a takdrager’s free post (Bjørn 16.11.2026)', () => {
  // Example 02: the standard takdrager along the open sides stand on a post of their own at (0, 4)
  it('is in the way of what stands there', () => {
    expect(blockers(v0, place).filter((b) => b.kind === 'post').map((b) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2])).toEqual([[0, 4]]);
  });
  it('a counter pushed into the corner stands clear of it, not over it', () => {
    const c = podiumAt(v0, place, { product: '6571', stock: '6560' }, [0.6, 3.6]);
    if ('error' in c) throw new Error(c.error);
    const v = moveObject(c.v, place, c.id, 0.5, 3.75);
    expect(conflicts(v, place).has(c.id)).toBe(false);
    const b = objectBoxes(place, v.objects.find((x) => x.id === c.id)!)[0];
    expect(b.x0 >= 0.02 - 1e-9 || b.y1 <= 3.98 + 1e-9).toBe(true);
  });
});

