import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog';
import { calc } from '../calc/calc';
import { RULES } from '../rules/rules';
import { moveOpeningAlong, removeOpening, setOpening } from './doors';
import { moveWall, paintWalls } from './edit';
import { moduleCc, moduleCount, moduleKey, moduleSpans, moduleStart } from './grid';
import { fitBreaks } from './replaceWalls';
import { addRoom, moveRoomSides, RECT_SIDE } from './rooms';
import { createVariant } from './variant';

const row = () => createVariant('A', { width: 6, depth: 4, type: 'row' });

/** A 4 m inner wall across the stand with a door in its second module. */
function innerWithDoor() {
  const v = paintWalls(row(), [1, 2], [5, 2]);
  const d = setOpening(v, moduleKey([2, 2], [3, 2]), DOOR);
  const w = d.walls.find((x) => x.from[1] === 2 && x.to[1] === 2)!;
  return { v: d, w, id: d.openings[0].id };
}

describe('a door off the whole metres (Byggeregel D8)', () => {
  it('lays the wall out round the door, the rest nearest it: 1000 · 250 · door · 1000 · 750', () => {
    const { v, id } = innerWithDoor();
    const m = moveOpeningAlong(v, id, 1.25);
    const w = m.walls.find((x) => x.id === v.openings[0].wallId)!;
    expect(w.breaks).toEqual([1.25]);
    expect(moduleSpans(w)).toEqual([[0, 1], [1, 1.25], [1.25, 2.25], [2.25, 3.25], [3.25, 4]]);
    const o = m.openings[0];
    expect(moduleStart(w, o.module)).toBe(1.25);
    expect(moduleCc(w, o.module)).toBe(1);
  });

  it('back on a whole metre, the wall has no breaks again', () => {
    const { v, id } = innerWithDoor();
    const back = moveOpeningAlong(moveOpeningAlong(v, id, 1.25), id, 2);
    const w = back.walls.find((x) => x.id === v.openings[0].wallId)!;
    expect(w.breaks).toBeUndefined();
    expect(moduleCount(w)).toBe(4);
  });

  it('refuses past the end and keeps the wall as it is', () => {
    const { v, id } = innerWithDoor();
    expect(moveOpeningAlong(v, id, 3.25)).toBe(v);
    expect(moveOpeningAlong(v, id, -0.25)).toBe(v);
  });

  it('a door taken away takes its breaks with it (fitBreaks)', () => {
    const { v, id } = innerWithDoor();
    const gone = fitBreaks(removeOpening(moveOpeningAlong(v, id, 1.25), id));
    expect(gone.walls.every((w) => !w.breaks)).toBe(true);
    // Nothing to do: the same variant
    expect(fitBreaks(v)).toBe(v);
  });

  it('the short modules beside the door are priced by their own products (6121–6123)', () => {
    const { v, id } = innerWithDoor();
    const lines = calc(moveOpeningAlong(v, id, 1.25), RULES, DEFAULT_CATALOG).groups.flatMap((g) => g.lines);
    const ids = lines.map((l) => l.artnr ?? '');
    expect(ids.some((a) => a.startsWith('6123'))).toBe(true);
    expect(ids.some((a) => a.startsWith('6121'))).toBe(true);
  });

  it('a room side moved 250 keeps its door in its place (D4 with D8)', () => {
    // Door in the front of a 2 × 2 room; the right side moves 250 out, so the front (drawn right to left, clockwise)
    // grows at its start
    const v = addRoom(row(), { x: 2, y: 1, w: 2, d: 2 }, { side: RECT_SIDE.front, module: 0, product: DOOR })!;
    const before = v.walls.find((w) => w.id === v.openings[0].wallId)!;
    const world = (x: typeof v) => {
      const o = x.openings[0];
      const w = x.walls.find((y) => y.id === o.wallId)!;
      const t = moduleStart(w, o.module);
      const d = [w.to[0] - w.from[0], w.to[1] - w.from[1]];
      const L = Math.hypot(d[0], d[1]);
      return [w.from[0] + (d[0] / L) * t, w.from[1] + (d[1] / L) * t].map((n) => Math.round(n * 1000) / 1000);
    };
    const at = world(v);
    const r = moveRoomSides(v, 'rom1', [{ side: RECT_SIDE.right, k: 0.25 }])!;
    expect(r).not.toBeNull();
    expect(world(r.v)).toEqual(at);
    const w = r.v.walls.find((x) => x.id === r.v.openings[0].wallId)!;
    expect(w.breaks?.length).toBe(1);
    expect(before.breaks).toBeUndefined();
  });
});

describe('an inner wall with a door off the whole metres', () => {
  it('moved sideways keeps the door where it is on the wall (D8)', () => {
    const { v, id } = innerWithDoor();
    const m = moveOpeningAlong(v, id, 1.25);
    const wallId = m.openings[0].wallId;
    const moved = moveWall(m, wallId, 1);
    const w = moved.walls.find((x) => x.id === wallId)!;
    expect(w.breaks).toEqual([1.25]);
    expect(moduleStart(w, moved.openings[0].module)).toBe(1.25);
  });
});
