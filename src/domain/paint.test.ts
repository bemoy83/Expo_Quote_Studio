import { describe, expect, it } from 'vitest';
import { CURTAIN, DOOR } from '../catalog/defaultCatalog';
import { RULES } from '../rules/rules';
import { r2 } from '../calc/referenceStands';
import { addFoil } from './decor';
import { doorRal, placeOpening } from './doors';
import { paintWalls, setWallPlate } from './edit';
import { moduleKey, wallModules } from './grid';
import { counterParts } from '../foga/counter';
import { counterBuildOf } from './counterShape';
import { counterRal } from './objects';
import { paintAllCounters, paintAllDoors, paintAllWalls, paintCounter, paintCounterPlates, paintCounterSide, paintLeaf, paintPlate, paintWallFace, printedCount } from './paint';
import { printOf, setPodiumPrint, takesDecor } from './podiumDecor';
import { partKey, podiumParts, ralsOf, setPodiumLight } from './podiumFaces';
import { stockSections } from './podiumStock';
import { setPanels } from './panels';
import { printDoorPart, printPlate, printsOn, printWall } from './print';
import { addRoom } from './rooms';
import { roomWallId } from './roomKeys';
import type { PlacedObject, Variant } from './types';
import { createVariant } from './variant';
import { builtModules } from './walls';

const ok = <T,>(r: T | { error: string }): T => {
  if (typeof r === 'object' && r && 'error' in r) throw new Error(r.error);
  return r as T;
};
const row = (): Variant => createVariant('A', { width: 6, depth: 4, type: 'row' });
/** A row stand with an inner wall from (3, 1) to (3, 3): two plates, both faces decor faces. */
const inner = () => paintWalls(row(), [3, 1], [3, 3]);
const innerWall = (v: Variant) => v.walls.find((w) => w.from[0] === 3 && w.to[0] === 3)!;
const plate = (v: Variant, key: string) => builtModules(v).find((m) => m.key === key)!.plate;
const door = (v: Variant) => placeOpening(v, [3, 1], [3, 2], DOOR, true, null);

describe('the paint bucket on a face: print is a choice made on purpose (V16, Bjørn 18.11.2026)', () => {
  it('colours the whole wall but leaves a printed plate as it was, print and colour', () => {
    let v = inner();
    const w = innerWall(v);
    const [k0, k1] = wallModules(w).map((m) => m.key);
    v = printPlate(v, RULES, w.id, 0, 1, 'logo');
    const r = paintWallFace(v, w.id, 1, '3020');
    expect(r.skipped).toBe(1);
    expect(printsOn(r.v, w.id, 1).map((f) => f.module)).toEqual([0]);
    // The printed plate keeps its colour (it shows on the other face); the other takes the bucket's
    expect(plate(r.v, k0)).toBe(v.defaultPlate);
    expect(plate(r.v, k1)).toBe('3020');
  });

  it('a plate whose print hides it everywhere has no colour of its own to keep', () => {
    let v = row();
    v = printPlate(v, RULES, 'side-back', 2, 1, 'logo');
    const r = paintWallFace(v, 'side-back', 1, '3020');
    expect(r.skipped).toBe(1);
    expect(r.v.panels).toBeUndefined();
    expect(r.v.foils).toHaveLength(1);
  });

  it('a wall printed all over keeps its colour: the bucket has nothing left to colour, and no colour no one sees is priced', () => {
    const v = printWall(row(), RULES, 'side-back', 1, 'logo', 2);
    const r = paintWallFace(v, 'side-back', 1, '3020');
    expect(r.skipped).toBe(6);
    expect(r.v).toBe(v);
  });

  it('colours the door leaves in the wall too, except a printed door; a room wall the whole room', () => {
    const v = r2();
    const o = v.openings[0];
    const painted = paintWallFace(v, o.wallId, 1, '5010').v;
    expect(doorRal(painted, painted.openings[0])).toBe('5010');
    // Back to the stand colour: stored as nothing, so the door follows the stand again
    expect(paintWallFace(painted, o.wallId, 1, v.defaultPlate).v.openings[0].ral).toBeUndefined();
    const other = v.walls.find((w) => w.room?.id === v.walls.find((x) => x.id === o.wallId)!.room?.id && w.id !== o.wallId)!;
    const y = paintWallFace(v, other.id, 1, '3020').v;
    expect(doorRal(y, y.openings[0])).toBe('3020');

    let d = door(inner());
    const w = innerWall(d);
    d = printPlate(d, RULES, w.id, 0, 1, 'logo');
    const kept = paintWallFace(d, w.id, 1, '3020');
    expect(doorRal(kept.v, kept.v.openings[0])).toBe(d.defaultPlate);
    expect(kept.v.foils).toHaveLength(1);
  });
});

describe('a colour on what is pointed at: the last stroke wins (V15)', () => {
  it('a plate loses its print on the face shown, decals and the other face stay', () => {
    let v = inner();
    const w = innerWall(v);
    const key = wallModules(w)[1].key;
    v = printPlate(printPlate(v, RULES, w.id, 1, 1, 'logo'), RULES, w.id, 1, -1, 'logo');
    v = ok(addFoil(v, RULES, w.id, 0, 1, 'small', 1)).v;
    const x = paintPlate(v, w.id, 1, 1, key, '3020');
    expect(plate(x, key)).toBe('3020');
    expect(printsOn(x, w.id, 1)).toHaveLength(0);
    expect(printsOn(x, w.id, -1)).toHaveLength(1);
    expect(x.foils.some((f) => !f.full)).toBe(true);
  });

  it('a door leaf loses the print on the face shown; the header keeps its share of a picture over both', () => {
    let v = door(inner());
    const w = innerWall(v);
    v = printPlate(v, RULES, w.id, 0, 1, 'logo');
    const x = paintLeaf(v, v.openings[0].id, 1, '3020');
    expect(doorRal(x, x.openings[0])).toBe('3020');
    expect(x.foils.map((f) => [f.door, f.width])).toEqual([['header', v.foils[0].width]]);
    // The header painted too: nothing printed is left
    expect(paintPlate(x, w.id, 1, 0, builtModules(x).find((m) => m.opening)!.key, '3020').foils).toHaveLength(0);
  });

  it('the brush prints the header and the leaf each by itself; the same motif again does nothing (Bjørn 18.11.2026)', () => {
    let v = door(inner());
    const w = innerWall(v);
    v = printDoorPart(v, RULES, w.id, 0, 1, 'logo', 'header');
    expect(v.foils.map((f) => f.door)).toEqual(['header']);
    expect(printDoorPart(v, RULES, w.id, 0, 1, 'logo', 'header')).toBe(v);
    v = printDoorPart(v, RULES, w.id, 0, 1, 'banner', 'leaf');
    expect(v.foils.map((f) => [f.door, f.motif])).toEqual([['header', 'logo'], ['leaf', 'banner']]);
    // Over a picture over both: that picture stays on the other surface
    const both = printDoorPart(printPlate(door(inner()), RULES, w.id, 0, 1, 'logo'), RULES, w.id, 0, 1, 'banner', 'leaf');
    expect(both.foils.map((f) => [f.door, f.motif])).toEqual([['header', 'logo'], ['leaf', 'banner']]);
  });
});

describe('Fyll on the whole stand', () => {
  const decorated = () => {
    let v = paintWalls(createVariant('A', { width: 6, depth: 4, type: 'corner', cornerSide: 'right' }), [4, 1], [4, 3]);
    v = setWallPlate(v, v.walls.find((w) => w.from[0] === 4)!.id, '5010');
    v = addRoom(v, { x: 1, y: 2, w: 2, d: 2 })!;
    v = setWallPlate(v, roomWallId(v.rooms[0].id, 0), '3002');
    v = setPanels(v, [moduleKey([0, 0], [1, 0])], '9005', () => v.defaultPlate);
    const foil = { wallId: 'side-back', module: 1, side: 1 as const, width: 0.96, height: 2.42, x: 0, y: 1.29, motif: 'logo' };
    return { ...v, foils: [{ ...foil, id: 'p', full: true }, { ...foil, id: 'd', module: 3, full: false, width: 0.5, height: 0.5 }] };
  };

  it('gives every wall one colour, own colours off, and leaves printed plates as they are', () => {
    const v = decorated();
    expect(printedCount(v)).toBe(1);
    const r = paintAllWalls(v, '5012');
    expect(r.skipped).toBe(1);
    expect(r.v.defaultPlate).toBe('5012');
    expect(new Set(builtModules(r.v).map((m) => m.plate))).toEqual(new Set(['5012']));
    expect(r.v.foils.map((f) => f.id)).toEqual(['p', 'd']);
  });

  it('«Farg også dem» colours the printed plates too and takes their print off; decals stay', () => {
    const r = paintAllWalls(decorated(), '5012', 'off');
    expect(r.v.panels).toBeUndefined();
    expect(r.v.foils.map((f) => f.id)).toEqual(['d']);
  });

  it('with a door in hand colours every door leaf, not curtains; a printed door stays unless asked', () => {
    let v = placeOpening(placeOpening(inner(), [3, 1], [3, 2], DOOR, true, null), [3, 2], [3, 3], CURTAIN, false, null);
    const isDoor = (p: string) => p === DOOR;
    expect(paintAllDoors(v, '7012', isDoor).v.openings.map((o) => [o.product, o.ral])).toEqual([[DOOR, '7012'], [CURTAIN, undefined]]);
    v = printPlate(v, RULES, innerWall(v).id, 0, 1, 'logo');
    const kept = paintAllDoors(v, '7012', isDoor);
    expect([kept.skipped, kept.v.openings[0].ral, kept.v.foils.length]).toEqual([1, undefined, 1]);
    const off = paintAllDoors(v, '7012', isDoor, 'off');
    expect([off.v.openings[0].ral, off.v.foils.length]).toEqual(['7012', 0]);
  });
});

describe('a counter of Disker og podier: a colour per plate (Byggeregel K6, Bjørn 18.11.2026)', () => {
  const counter: PlacedObject = { id: 'c1', product: '6571', x: 2, y: 1.5, rot: 0, sections: stockSections() };
  const v0 = (): Variant => ({ ...createVariant('A', { width: 4, depth: 3, type: 'row' }), objects: [counter, { id: 'i2', product: '5276', x: 3, y: 1, rot: 0 }] });
  const keys = (v: Variant) => podiumParts(v.objects[0].sections!).map(partKey);
  const rals = (v: Variant) => counterBuildOf(v.objects[0]).plates.map((p) => p.ral ?? counterRal(v.objects[0]));
  const front = (v: Variant) => podiumParts(v.objects[0].sections!).filter((p) => takesDecor(v.objects[0].sections!, p))[0];

  it('one light opening of a part takes its own colour, built, picked and drawn; the counter colour stored as none', () => {
    const k = partKey(front(v0()));
    const v = paintCounterPlates(v0(), 'c1', [k], '3020', 0);
    expect(rals(v).filter((r) => r === '3020')).toHaveLength(1);
    expect(Object.keys(counterParts(counterBuildOf(v.objects[0]), counterRal(v.objects[0])).plates).some((x) => x.startsWith('3020|'))).toBe(true);
    // Back to the counter's colour: nothing of its own
    expect(paintCounterPlates(v, 'c1', [k], counterRal(counter), 0).objects[0]).toEqual(counter);
  });

  it('a sliding door is one surface: both its leaves take the colour of its light opening', () => {
    const k = partKey(front(v0()));
    const v = paintCounterPlates(setPodiumLight(v0(), 'c1', [k], 'door', 0), 'c1', [k], '3020', 0);
    const leaves = counterBuildOf(v.objects[0]).plates.filter((p) => p.level === 'door');
    expect(leaves.map((p) => p.ral)).toEqual(['3020', '3020']);
  });

  it('a colour on a part takes its print off; on the side shown the printed part stays as it is', () => {
    const k = partKey(front(v0()));
    const printed = setPodiumPrint(v0(), 'c1', [k], 'logo');
    expect(printOf(paintCounterPlates(printed, 'c1', [k], '3020').objects[0].sections!, front(v0()))).toBeUndefined();
    const r = paintCounterSide(printed, 'c1', keys(printed), '3020');
    expect(r.skipped).toBe(1);
    expect(printOf(r.v.objects[0].sections!, front(v0()))).toBe('logo');
    expect(ralsOf(r.v.objects[0].sections!, front(v0())).every((x) => x === null)).toBe(true);
  });

  it('the counter colour (pill, Fyll) takes the colours of their own off, a printed part keeps the colour it had; nothing else is painted', () => {
    const k = partKey(front(v0()));
    let v = paintCounterPlates(v0(), 'c1', keys(v0()), '5010');
    v = setPodiumPrint(v, 'c1', [k], 'logo');
    const r = paintAllCounters(v, '7012');
    expect(r.skipped).toBe(1);
    expect(r.v.objects.map((o) => o.ral)).toEqual(['7012', undefined]);
    expect(new Set(rals(r.v))).toEqual(new Set(['7012', '5010']));
    expect(ralsOf(r.v.objects[0].sections!, front(v0())).every((x) => x === '5010')).toBe(true);
    // Back to stock: no colour stored on the counter
    expect('ral' in paintCounter(v0(), 'c1', counterRal(counter)).v.objects[0]).toBe(false);
  });
});
