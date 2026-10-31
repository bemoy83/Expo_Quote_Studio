// Expected values are derived by hand from the approved rules (rules.ts) and the InFrame rules (fabric.ts),
// not copied from the mockup's calc. Each case shows the arithmetic.
import { describe, expect, it } from 'vitest';
import { CURTAIN, DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog';
import type { Variant } from '../domain/types';
import { createVariant, fillFloor } from '../domain/variant';
import { addRoom } from '../domain/rooms';
import { RULES } from '../rules/rules';
import { calc, type CalcResult } from './calc';
import { r1, r2, r3 } from './referenceStands';

const run = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG);
const qty = (res: CalcResult, artnr: string) =>
  res.groups.flatMap((g) => g.lines).find((l) => l.artnr === artnr)?.qty ?? 0;
const S = DEFAULT_CATALOG.system;

describe('R1 · row stand 3 × 3, nothing added', () => {
  // Walls: back 3 + left 3 + right 3 = 9 modules. Front open → beam 3 m, ends rest on the side walls.
  const res = run(r1());
  it('wall parts', () => {
    expect(qty(res, '6120-9010')).toBe(9);
    expect(qty(res, S.topRail)).toBe(9);
    expect(qty(res, S.bottomRail)).toBe(9);
    // Back: 4 posts. Left and right: 3 more each (corners shared).
    expect(qty(res, S.post)).toBe(10);
    expect(res.keyFigures.beamPosts).toBe(0);
  });
  it('beam', () => {
    expect(qty(res, S.beam)).toBe(3);
    expect(res.keyFigures.beamLengths).toBe(1);
  });
  it('labour: estimated, not on the quote', () => {
    // 9 × 0,5 + 3 × 0,15 = 4,95 → 5
    expect(res.keyFigures.hours).toBe(5);
    expect(qty(res, '9900')).toBe(0);
  });
  it('key figures', () => {
    expect(res.keyFigures).toMatchObject({ area: 9, openSides: 1, wallLm: 9, openings: 0 });
  });
});

describe('R2 · corner stand 6 × 4, backroom 2 × 2, textile wall 4 m', () => {
  // Walls: back 6 + left 4 + backroom right face 2 + front face 2 = 14 modules, one of them a door.
  const res = run(r2());
  it('wall parts: the door module has its rails in the header', () => {
    expect(qty(res, '6120-9010')).toBe(13);
    expect(qty(res, S.topRail)).toBe(13);
    expect(qty(res, S.bottomRail)).toBe(13);
    expect(res.keyFigures.topRails).toBe(14);
    expect(res.keyFigures.wallLm).toBe(13);
  });
  it('posts', () => {
    // Back 7 + left 4 + backroom (2,1),(2,2),(1,2) = 14 wall posts; free front-right corner of the beams = 1.
    expect(qty(res, S.post)).toBe(15);
    expect(res.keyFigures.beamPosts).toBe(1);
  });
  it('beams on the two open sides', () => {
    expect(qty(res, S.beam)).toBe(10);
    expect(res.keyFigures.beamLengths).toBe(2);
  });
  it('door and header', () => {
    expect(qty(res, DOOR)).toBe(1);
    expect(qty(res, S.header)).toBe(1);
  });
  it('textile wall follows InFrame rules', () => {
    // Span 4000 → W = 4000 − 20 − 10 = 3970, H = 2490 + 50 = 2540.
    // Braces: ceil(3970 / 1000) − 1 = 3, each 2540 − 2 × 40 = 2460.
    // Profile: 2 × 3970 + 2 × 2540 + 3 × 2460 = 20 400 mm → 20,4 lm.
    // Print: (3970 + 40) × (2540 + 40) = 4010 × 2580 mm = 10,3458 m² → 10,3.
    expect(qty(res, S.frame)).toBe(20.4);
    expect(qty(res, S.print)).toBe(10.3);
    const [p] = res.production.pieces;
    expect(p).toMatchObject({ W: 3970, H: 2540, pw: 4010, ph: 2580, braces: { qty: 3, length: 2460 } });
  });
  it('labour', () => {
    // 14 × 0,5 + 10 × 0,15 + 1 × 0,25 + 10,3458 × 0,35 = 12,37 → 12,5
    expect(res.keyFigures.hours).toBe(12.5);
  });
});

describe('R3 · island 8 × 6, beams only', () => {
  const res = run(r3());
  it('beams', () => {
    // Perimeter 28: front and back 8 → 4 + 4, sides 6. Cross beam 6 from joint to joint.
    expect(qty(res, S.beam)).toBe(34);
    expect(res.keyFigures.beamLengths).toBe(7);
  });
  it('posts', () => {
    // 4 corners + 2 joints
    expect(qty(res, S.post)).toBe(6);
    expect(qty(res, S.topRail)).toBe(0);
  });
  it('labour', () => {
    // 34 × 0,15 + 6 × 0,25 = 6,6 → 6,5
    expect(res.keyFigures.hours).toBe(6.5);
  });
});

describe('openings', () => {
  const withOpenings = (...mods: number[]) => {
    const v = createVariant('A', { width: 4, depth: 3, type: 'row' });
    return { ...v, openings: mods.map((m, i) => ({ id: `o${i}`, wallId: 'side-back', module: m, product: i % 2 ? CURTAIN : DOOR })) };
  };
  it('several openings on one wall: no plate, rails in the header (Foga), one header each', () => {
    // Walls: back 4 + left 3 + right 3 = 10 modules
    const res = run(withOpenings(0, 2));
    expect(qty(res, '6120-9010')).toBe(8);
    expect(qty(res, S.bottomRail)).toBe(8);
    expect(qty(res, S.topRail)).toBe(8);
    expect(qty(res, DOOR)).toBe(1);
    expect(qty(res, CURTAIN)).toBe(1);
    expect(qty(res, S.header)).toBe(2);
    expect(res.keyFigures.wallLm).toBe(8);
  });
  it('an opening on a perimeter wall still counts as wall for beams', () => {
    const v = createVariant('A', { width: 3, depth: 3, type: 'island' });
    const walled: Variant = {
      ...v,
      walls: [{ id: 'f', from: [0, 3], to: [3, 3] }],
      openings: [{ id: 'o', wallId: 'f', module: 1, product: DOOR }],
    };
    // Back 3 + left 3 + right 3 = 9 m beams, none over the front wall.
    expect(run(walled).keyFigures.beamLm).toBe(9);
  });
});

describe('rooms build only the walls that are missing', () => {
  it('two backrooms on one stand, shared walls counted once', () => {
    let v = createVariant('A', { width: 6, depth: 3, type: 'row' });
    v = addRoom(v, { x: 0, y: 0, w: 1, d: 1 }, { face: 'right', module: 0, product: DOOR }, 'a')!;
    v = addRoom(v, { x: 5, y: 0, w: 1, d: 1 }, { face: 'left', module: 0, product: DOOR }, 'b')!;
    const res = run(v);
    // Stand walls 6 + 3 + 3 = 12. Each room adds right/left face 1 + front face 1 = 2 → 16 modules, 2 doors.
    expect(res.keyFigures.topRails).toBe(16);
    expect(res.keyFigures.openings).toBe(2);
    expect(res.keyFigures.wallLm).toBe(14);
    expect(qty(res, DOOR)).toBe(2);
  });
  it('a wall drawn on top of an existing one adds nothing', () => {
    const v = r1();
    const doubled = { ...v, walls: [...v.walls, { id: 'dup', from: [1, 0] as const, to: [3, 0] as const }] };
    expect(run(doubled).keyFigures).toEqual(run(v).keyFigures);
  });
  it('per-wall plate colour', () => {
    const v = r1();
    const res = run({ ...v, walls: v.walls.map((w) => (w.id === 'side-back' ? { ...w, plate: '9005' } : w)) });
    expect(qty(res, '6120-9005')).toBe(3);
    expect(qty(res, '6120-9010')).toBe(6);
  });
});

describe('beams', () => {
  it('cross beam from a joint runs to the facing wall', () => {
    // Row 8 × 4: front 8 → 4 + 4, joint at (4,4). Cross beam to back wall (4,0): 4 m.
    const res = run(createVariant('A', { width: 8, depth: 4, type: 'row' }));
    expect(res.keyFigures.beamLm).toBe(12);
    expect(res.keyFigures.beamPosts).toBe(1);
    // Walls 9 + 4 + 4 = 17 posts, plus the joint.
    expect(res.keyFigures.posts).toBe(18);
  });
  it('cross beam stops at an inner wall', () => {
    const v = createVariant('A', { width: 8, depth: 4, type: 'row' });
    const res = run({ ...v, walls: [...v.walls, { id: 'iw', from: [3, 2], to: [5, 2] }] });
    expect(res.keyFigures.beamLm).toBe(10);
  });
  it('a free end gets a post, an end against a wall does not', () => {
    // Corner 6 × 3 open right: front 6 + right 3, one free corner.
    const res = run(createVariant('A', { width: 6, depth: 3, type: 'corner', cornerSide: 'right' }));
    expect(res.keyFigures.beamLm).toBe(9);
    expect(res.keyFigures.beamPosts).toBe(1);
    expect(res.keyFigures.posts).toBe(11);
  });
});

describe('floor', () => {
  it('fill: cells × 0,25 m², with protection over the total', () => {
    const v = fillFloor(r1(), '5901');
    const res = run({ ...v, floor: { ...v.floor, protection: true } });
    expect(qty(res, '5901')).toBe(9);
    expect(qty(res, S.floorProtection)).toBe(9);
  });
  it('several floor types side by side, cells outside the stand ignored', () => {
    const v = r1();
    const res = run({ ...v, floor: { protection: false, cells: { '0,0': '5901', '1,0': '5901', '0,1': '5930', '6,0': '5901' } } });
    expect(res.keyFigures.floor).toEqual({ '5901': 0.5, '5930': 0.25 });
    expect(qty(res, S.floorProtection)).toBe(0);
  });
});

describe('labour', () => {
  it('minimum 4 hours', () => {
    // 1 × 1 row: 3 modules × 0,5 + 1 × 0,15 = 1,65 → 4
    expect(run(createVariant('A', { width: 1, depth: 1, type: 'row' })).keyFigures.hours).toBe(4);
  });
  it('preliminary rate is flagged', () => {
    expect(run(r1()).keyFigures.hoursPreliminary).toBe(true);
    const approved = calc(r1(), { ...RULES, labour: { ...RULES.labour, status: 'godkjent' } }, DEFAULT_CATALOG);
    expect(approved.keyFigures.hoursPreliminary).toBe(false);
  });
  it('Montering counted in the panel goes on the quote under Andre tjenester', () => {
    const res = run({ ...r1(), counted: [{ product: '9900', qty: 6 }] });
    const g = res.groups.find((x) => x.id === 'tjen')!;
    expect(g.lines).toEqual([expect.objectContaining({ artnr: '9900', qty: 6, unit: 't', sum: 6 * 750, group: 'tjen.montering' })]);
  });
  it('foil adds 0,25 t/m²', () => {
    const v = createVariant('A', { width: 4, depth: 4, type: 'row' });
    const base = run(v).keyFigures.hours;
    const foils = Array.from({ length: 4 }, (_, i) => ({ id: `f${i}`, wallId: 'side-back', module: i, full: true, width: 0, height: 0, x: 0, y: 0 }));
    const res = run({ ...v, foils });
    // 4 × 0,96 × 2,42 = 9,29 m² × 0,25 = 2,32 h
    expect(qty(res, S.foilFull)).toBe(9.3);
    expect(res.keyFigures.hours).toBeCloseTo(base + 2.5);
  });
});

describe('objects, counted items and sums', () => {
  it('groups by main group, lines in subgroup order, and sums qty × price', () => {
    const v = r1();
    const res = run({
      ...v,
      objects: [
        { id: 'a', product: '5276', x: 1, y: 2, rot: 0 },
        { id: 'b', product: '5276', x: 2, y: 2, rot: 0 },
      ],
      counted: [{ product: '5190-1', qty: 4 }, { product: '7010', qty: 1 }],
    });
    const mob = res.groups.find((g) => g.id === 'mob')!;
    // Bord before Sittemøbler
    expect(mob.lines.map((l) => [l.artnr, l.qty])).toEqual([['5276', 2], ['5190-1', 4]]);
    expect(mob.sum).toBe(2 * 500 + 4 * 220);
    expect(res.groups.find((g) => g.id === 'lys')!.sum).toBe(1250);
    expect(res.groups.map((g) => g.id)).toEqual(['vegg', 'mob', 'lys']);
    expect(res.sum).toBe(res.groups.reduce((a, g) => a + g.sum, 0));
  });
  it('unknown art.nr is kept as a placeholder line', () => {
    const res = run({ ...r1(), counted: [{ product: 'X-1', qty: 2 }] });
    const l = res.groups.flatMap((g) => g.lines).find((x) => x.artnr === 'X-1')!;
    expect(l).toMatchObject({ price: 0, placeholder: true, qty: 2 });
  });
});
