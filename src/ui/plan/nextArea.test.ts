// Where the preview of the next variant is drawn: only what changes, consequences included.
import { describe, expect, it } from 'vitest';
import { calc } from '../../calc/calc';
import { DOOR } from '../../catalog/defaultCatalog';
import { drawOpening } from '../../domain/doors';
import { paintWalls } from '../../domain/edit';
import { createVariant } from '../../domain/variant';
import { editResult } from '../edits';
import { applyFloor, floorAction } from '../../domain/floor/brush';
import { conflicts } from '../../domain/objects';
import type { Variant } from '../../domain/types';
import { builtModules } from '../../domain/walls';
import { parse } from '../../persistence/file';
import { catalog, place, rules } from '../env';
import { changedAreas, unchanged, type Box, type PlanState } from './nextArea';

const TEXTS = import.meta.glob<string>('../../test/fixtures/*.json', { query: '?raw', import: 'default', eager: true });
const sketch = (name: string): Variant => {
  const r = parse(TEXTS[`../../test/fixtures/${name}.json`]);
  if (!r.ok) throw new Error(r.error);
  return r.sketch.variants[0];
};
const state = (v: Variant): PlanState => ({ v, res: calc(v, rules, catalog), mods: builtModules(v), bad: conflicts(v, place) });
const inside = (b: Box, x: number, y: number) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;

describe('changedAreas', () => {
  it('finds nothing when the variant is the same', () => {
    const v = sketch('01-hjorne-arrangor');
    expect(unchanged(changedAreas(state(v), state(v)))).toBe(true);
  });

  it('a new wall changes the wall layer around it and the posts, not the floor', () => {
    const v = sketch('01-hjorne-arrangor');
    const a = changedAreas(state(v), state(paintWalls(v, [5, 1], [5, 3])));
    expect(a.walls.clip.some((b) => inside(b, 5, 2))).toBe(true);
    expect(a.walls.mask).toEqual([]);
    expect(a.beams.clip.length).toBeGreaterThan(0);
    expect(a.floor.clip).toEqual([]);
    expect(a.objects.clip).toEqual([]);
  });

  it('a new wall through furniture marks the furniture that now conflicts', () => {
    const v = sketch('10-mobler-utstyr');
    const o = v.objects[0];
    const x = Math.round(o.x);
    const a = changedAreas(state(v), state(paintWalls(v, [x, 0], [x, v.stand.depth])));
    const hit = conflicts(paintWalls(v, [x, 0], [x, v.stand.depth]), place).size > conflicts(v, place).size;
    expect(a.objects.clip.length > 0).toBe(hit);
  });

  it('a carpet tile laid over others only changes the cells it covers', () => {
    const v = sketch('01-hjorne-arrangor');
    const product = v.floor.tiles.length ? v.floor.tiles[0].product : 'x';
    const other = catalog.products.find((p) => p.tiles && p.variants.some((x) => x.artnr !== product))!;
    const artnr = other.variants.find((x) => x.artnr !== product)!.artnr;
    const act = floorAction(v, { x: 2.4, y: 2.4, size: { w: 2, h: 2 }, product: artnr, anchor: null });
    const next = applyFloor(v, act, artnr);
    const a = changedAreas(state(v), state(next));
    const area = a.floor.clip.reduce((s, b) => s + (b.x1 - b.x0 - 0.04) * (b.y1 - b.y0 - 0.04), 0);
    expect(area).toBeCloseTo(1, 5);
  });

  it('a wall that makes a room of a door drawn first only changes the new wall, not the stand walls by the door', () => {
    // Door on its own module first, then the wall that closes the corner: the door is stored again on the room side
    const corner = createVariant('A', { width: 4, depth: 3, type: 'corner', cornerSide: 'right' });
    const v = drawOpening(corner, [1, 0], [1, 1], DOOR);
    const next = editResult(v, (x) => paintWalls(x, [0, 1], [1, 1]), undefined);
    expect(next.rooms).toHaveLength(1);
    const a = changedAreas(state(v), state(next));
    expect(a.walls.mask).toEqual([]);
    // Only round the new wall: the back stand wall and the door's swing are not drawn again
    expect(a.walls.clip).toHaveLength(1);
    expect(a.walls.clip[0].y0).toBeGreaterThan(0.5);
  });

  it('a wall that shortens one arm of a free-standing textile corner redraws the whole corner, not half the other arm', () => {
    // Inner wall up to where the corner's top run starts: the top run stops at the wall (X11), the right run is unchanged
    // but lies partly in the top run's room, so it is hidden and drawn again whole, never cut across
    const s = createVariant('A', { width: 4, depth: 3, type: 'corner', cornerSide: 'right' });
    const v: Variant = { ...s, textiles: [{ id: 't1', from: [1, 2], to: [2, 2] }, { id: 't2', from: [2, 2], to: [2, 3] }] };
    const next = editResult(v, (x) => paintWalls(x, [1, 2], [1, 3]), undefined);
    const a = changedAreas(state(v), state(next));
    // The right arm's far end, near the aisle, is both hidden and redrawn
    expect(a.textile.mask.some((b) => inside(b, 2, 2.95))).toBe(true);
    expect(a.textile.clip.some((b) => inside(b, 2, 2.95))).toBe(true);
  });

  it('a free-standing textile run out of reach of the change is left alone', () => {
    const s = createVariant('A', { width: 6, depth: 3, type: 'corner', cornerSide: 'right' });
    const v: Variant = { ...s, textiles: [{ id: 't1', from: [1, 2], to: [2, 2] }, { id: 't3', from: [4, 1], to: [5, 1] }] };
    const next = editResult(v, (x) => paintWalls(x, [1, 2], [1, 3]), undefined);
    const a = changedAreas(state(v), state(next));
    expect(a.textile.clip.some((b) => inside(b, 4.5, 1))).toBe(false);
  });
});
