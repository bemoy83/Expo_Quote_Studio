// Tøm: what lies on top under the pointer in the example sketches, and that erasing it takes exactly that.
import { describe, expect, it } from 'vitest';
import { CELL } from '../../../domain/grid';
import { roomAt } from '../../../domain/rooms';
import type { Variant } from '../../../domain/types';
import { builtModules, standWallKeys } from '../../../domain/walls';
import { parse } from '../../../persistence/file';
import { eraseTargetAt } from './erase';
import { planHits } from './hits';

const TEXTS = import.meta.glob<string>('../../../test/fixtures/*.json', { query: '?raw', import: 'default', eager: true });
const sketch = (name: string): Variant => {
  const f = Object.keys(TEXTS).find((k) => k.includes(name))!;
  const r = parse(TEXTS[f]);
  if (!r.ok) throw new Error(r.error);
  return r.sketch.variants[0];
};
const at = (v: Variant, x: number, y: number) => eraseTargetAt(v, planHits(v, builtModules(v), {}), standWallKeys(v), { x, y });

describe('Tøm under the pointer', () => {
  it('takes a piece of furniture before the floor under it', () => {
    const v = sketch('10-mobler');
    const o = v.objects[0];
    const t = at(v, o.x, o.y)!;
    expect(t.group).toBe('object');
    expect(t.erase(v).objects.map((x) => x.id)).not.toContain(o.id);
  });

  it('takes a whole room from its floor and from its wall', () => {
    const v = sketch('03-rom');
    const r = v.rooms[0];
    const [x0, y0] = r.outline[0];
    const inside = [[x0 + 0.5, y0 + 0.5], [x0 + 0.5, y0 - 0.5], [x0 - 0.5, y0 + 0.5], [x0 - 0.5, y0 - 0.5]].find(([x, y]) => roomAt(v, x, y)?.id === r.id)!;
    const t = at(v, inside[0], inside[1])!;
    expect(t).toMatchObject({ group: 'room', id: r.id });
    expect(t.erase(v).rooms.map((x) => x.id)).not.toContain(r.id);
    const mid = builtModules(v).find((m) => v.walls.find((w) => w.id === m.wallId)?.room?.id === r.id && !m.opening)!;
    expect(at(v, (mid.a[0] + mid.b[0]) / 2, (mid.a[1] + mid.b[1]) / 2)).toMatchObject({ group: 'room', id: r.id });
  });

  it('a door before the wall it stands in', () => {
    const v = sketch('03-rom');
    const m = builtModules(v).find((x) => x.opening)!;
    const t = at(v, (m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2)!;
    expect(t.group).toBe('door');
    expect(t.erase(v).openings.map((o) => o.id)).not.toContain(m.opening!.id);
  });

  it('stand walls are locked', () => {
    const v = sketch('01-hjorne');
    const keys = standWallKeys(v);
    const m = builtModules(v).find((x) => keys.has(x.key))!;
    expect(at(v, (m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2)?.group).toBe('locked');
  });

  it('a drawn takdrager', () => {
    const v = sketch('04-oy');
    const b = v.innerBeams![0];
    const t = at(v, (b.from[0] + b.to[0]) / 2, (b.from[1] + b.to[1]) / 2)!;
    expect(t).toMatchObject({ group: 'beam', id: b.id });
  });

  it('graphics before the wall they sit on', () => {
    const v = sketch('09-dekor');
    const f = v.foils[0];
    const m = builtModules(v).find((x) => x.wallId === f.wallId && x.index === f.module)!;
    const t = at(v, (m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2)!;
    expect(t.group).toBe('graphic');
  });

  it('a whole floor tile or lane, and nothing off the stand', () => {
    const v = sketch('07-engangsteppe');
    const hits = planHits(v, builtModules(v), {});
    const free = (x: number, y: number) => !roomAt(v, x, y) && !hits.moduleAt({ x, y }) && !hits.objectAt({ x, y });
    const tile = v.floor.tiles.find((t) => free((t.i + 0.5) * CELL, (t.j + 0.5) * CELL))!;
    const t = at(v, (tile.i + 0.5) * CELL, (tile.j + 0.5) * CELL)!;
    expect(t.group).toBe('floor');
    expect(t.erase(v).floor.tiles).toHaveLength(v.floor.tiles.length - 1);
    expect(at(v, -2, -2)).toBeNull();
  });
});
