// Expected values are derived by hand from the approved rules (rules.ts) and the InFrame rules (fabric.ts),
// not copied from the mockup's calc. Each case shows the arithmetic.
import { describe, expect, it } from 'vitest';
import { CURTAIN, DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog';
import type { Variant } from '../domain/types';
import { createVariant, fillFloor } from '../domain/variant';
import { addRoom, RECT_SIDE } from '../domain/rooms';
import { DEFAULT_PRICING } from '../pricing/data';
import { RULES } from '../rules/rules';
import { calc, type CalcResult } from './calc';
import { r1, r2, r3 } from './referenceStands';

const run = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG);
const lines = (res: CalcResult) => res.groups.flatMap((g) => g.lines);
const qty = (res: CalcResult, artnr: string) => lines(res).find((l) => l.artnr === artnr)?.qty ?? 0;
const S = DEFAULT_CATALOG.system;

describe('R1 · row stand 3 × 3, nothing added', () => {
  // Walls: back 3 + left 3 + right 3 = 9 modules. Front open → beam 3 m, ends rest on the side walls.
  const res = run(r1());
  it('wall sold per metre, the articles behind it only on the picking list', () => {
    expect(qty(res, '6120-9010')).toBe(9);
    expect(lines(res).map((l) => l.artnr)).toEqual(['6120-9010', S.beam]);
    // Back: 4 posts. Left and right: 3 more each (corners shared).
    expect(res.keyFigures.posts).toBe(10);
    expect(res.foga.posts).toBe(10);
    expect(res.keyFigures.beamPosts).toBe(0);
  });
  it('beam', () => {
    expect(qty(res, S.beam)).toBe(3);
    expect(res.keyFigures.beamLengths).toBe(1);
  });
  it('key figures', () => {
    expect(res.keyFigures).toMatchObject({ area: 9, openSides: 1, wallLm: 9, openings: 0 });
  });
});

describe('R2 · corner stand 6 × 4, backroom 2 × 2, textile wall 4 m', () => {
  // Walls: back 6 + left 4 + backroom right face 2 + front face 2 = 14 modules, one of them a door.
  const res = run(r2());
  it('wall metres: the door module is not wall, it is in the door product', () => {
    expect(qty(res, '6120-9010')).toBe(13);
    expect(res.keyFigures.modules).toBe(14);
    expect(res.keyFigures.wallLm).toBe(13);
  });
  it('posts: counted, not sold (beam posts are in the takdrager price)', () => {
    // Back 7 + left 4 + backroom (2,1),(2,2),(1,2) = 14 wall posts; free front-right corner of the beams = 1.
    expect(res.keyFigures.posts).toBe(15);
    expect(res.keyFigures.beamPosts).toBe(1);
    expect(lines(res).find((l) => l.artnr === S.beam)?.meta).toBe('2 lengder · 1 stolpe inkludert');
  });
  it('beams on the two open sides', () => {
    expect(qty(res, S.beam)).toBe(10);
    expect(res.keyFigures.beamLengths).toBe(2);
  });
  it('door with header is one product', () => {
    expect(qty(res, DOOR)).toBe(1);
    expect(res.keyFigures.openings).toBe(1);
  });
  it('textile wall follows InFrame rules', () => {
    // Span 4000 → W = 4000 − 20 − 10 = 3970, H = 2490 + 50 = 2540.
    // Braces: ceil(3970 / 1000) − 1 = 3, each 2540 − 2 × 40 = 2460.
    // Profile: 2 × 3970 + 2 × 2540 + 3 × 2460 = 20 400 mm → 20,4 lm.
    // Print: (3970 + 40) × (2540 + 40) = 4010 × 2580 mm = 10,3458 m² → 10,3.
    expect(res.production.lm).toBeCloseTo(20.4);
    expect(res.keyFigures.textileM2).toBeCloseTo(10.3458);
    const [p] = res.production.pieces;
    expect(p).toMatchObject({ W: 3970, H: 2540, pw: 4010, ph: 2580, braces: { qty: 3, length: 2460 } });
  });
  it('textile wall sold per piece, priced as the sum of its frame, braces, print and montering', () => {
    // 43TX 2 × 3970 + 2 × 2540 = 13,02 m × 10 = 130,2 · 4 × 613 × 4 = 16 · 2 × 520 × 5 = 10
    // braces 3 × 2,46 m × 6 = 44,28 + 3 × 20 = 60 · print 4,010 × 2,580 = 10,3458 m² × 470 = 4862,526
    // håndtering 140 · montering 3,970 × 2,540 = 10,0838 m² × 380 = 3831,844 → 9094,85 → 9095
    const l = lines(res).find((x) => x.artnr === S.textile)!;
    expect(l).toMatchObject({ name: 'Tekstilvegg, leie av ramme med trykt tekstil, 3970 × 2540 mm', qty: 1, unit: 'stk', price: 9095, strategy: 'sum' });
    // Frame rented, print bought: the quote says so
    expect(l).toMatchObject({ transfer: 'blandet', terms: 'Leie av ramme, kjøp av trykt tekstil' });
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
    expect(res.keyFigures.posts).toBe(6);
    expect(res.keyFigures.modules).toBe(0);
    expect(lines(res).map((l) => l.artnr)).toEqual([S.beam]);
  });
});

describe('openings', () => {
  const withOpenings = (...mods: number[]) => {
    const v = createVariant('A', { width: 4, depth: 3, type: 'row' });
    return { ...v, openings: mods.map((m, i) => ({ id: `o${i}`, wallId: 'side-back', module: m, product: i % 2 ? CURTAIN : DOOR })) };
  };
  it('several openings on one wall: each replaces a metre of wall', () => {
    // Walls: back 4 + left 3 + right 3 = 10 modules
    const res = run(withOpenings(0, 2));
    expect(qty(res, '6120-9010')).toBe(8);
    expect(qty(res, DOOR)).toBe(1);
    expect(qty(res, CURTAIN)).toBe(1);
    expect(res.foga.modules.filter((m) => m.opening)).toHaveLength(2);
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
    v = addRoom(v, { x: 0, y: 0, w: 1, d: 1 }, { side: RECT_SIDE.right, module: 0, product: DOOR }, 'a')!;
    v = addRoom(v, { x: 5, y: 0, w: 1, d: 1 }, { side: RECT_SIDE.left, module: 0, product: DOOR }, 'b')!;
    const res = run(v);
    // Stand walls 6 + 3 + 3 = 12. Each room adds right/left face 1 + front face 1 = 2 → 16 modules, 2 doors.
    expect(res.keyFigures.modules).toBe(16);
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

describe('price as sum of articles (example price list, pricing/data.ts)', () => {
  const res = run(r1());
  it('wall per metre = plates, rails, its share of the posts and montering', () => {
    // 9 modules, 10 posts: 9 × 150 + 9 × 35 + 9 × 35 + 10 × 80 + 9 × 590 = 8090 → 8090 / 9 = 898,9 → 899 per lm
    // Cost: 9 × 85 + 9 × 18 + 9 × 17 + 10 × 45 + 9 × 325 = 4455
    const l = lines(res).find((x) => x.artnr === '6120-9010')!;
    expect(l).toMatchObject({ price: 899, sum: 8091, cost: 4455, strategy: 'sum', transfer: 'leie' });
    expect(l.dg).toBeCloseTo((8091 - 4455) / 8091);
    expect(l.placeholder).toBe(false);
  });
  it('takdrager per metre = its lengths, its own posts and montering', () => {
    // One length 2960 mm: 85 + 3 m montering × 175 = 610 → 203,3 → 203 per lm; cost 29 + 3 × 98 = 323
    expect(lines(res).find((x) => x.artnr === S.beam)).toMatchObject({ price: 203, cost: 323 });
  });
  it('a fast product uses its own price and cost; one without cost has no margin', () => {
    const r = run({ ...r1(), counted: [{ product: '5280', qty: 2 }, { product: '7010', qty: 1 }] });
    // Example cost 55 % of 690 = 380 (rounded)
    expect(lines(r).find((x) => x.artnr === '5280')).toMatchObject({ price: 690, cost: 760, strategy: 'fast' });
    expect(lines(r).find((x) => x.artnr === '7010')).toMatchObject({ price: 1250, cost: null, dg: null });
    expect(r.margin.unknown).toBe(1);
    // Example time for furniture: 1 + 2 + 2 + 1 + 1 min per piece
    expect(lines(r).find((x) => x.artnr === '5280')!.time).toEqual({ plukk: 2, vask: 4, transport: 4, montering: 2, demontering: 2 });
    expect(r.margin.sum).toBe(r.sum - 1250);
  });
  it('a sum product with an item missing from the price list falls back to its own price', () => {
    const items = new Map(DEFAULT_PRICING.items);
    items.delete('montering-modul');
    const r = calc(r1(), RULES, DEFAULT_CATALOG, { ...DEFAULT_PRICING, items });
    expect(lines(r).find((x) => x.artnr === '6120-9010')).toMatchObject({ price: 870, cost: null, strategy: 'fast', placeholder: true });
  });
  it('handling time per step is in the prices, not a line', () => {
    // plukk: posts 10 + rails 18 × 0,5 + plates 9 + beam 1 = 29 · vask 10 + 9 + 27 + 1 = 47 · transport 29
    // montering 9 × 18 + 3 × 6 = 180 · demontering 9 × 12 + 3 × 3 = 117
    expect(res.keyFigures.time).toEqual({ plukk: 29, vask: 47, transport: 29, montering: 180, demontering: 117 });
    expect(qty(res, '9900')).toBe(0);
  });
  it('Arbeidstimer (customer\'s own equipment) counted in the panel goes under Andre tjenester', () => {
    const r = run({ ...r1(), counted: [{ product: '9900', qty: 6 }] });
    const g = r.groups.find((x) => x.id === 'tjen')!;
    expect(g.lines).toEqual([expect.objectContaining({ artnr: '9900', qty: 6, unit: 't', sum: 6 * 750, group: 'tjen.montering' })]);
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
  it('full foil per wall felt', () => {
    const v = createVariant('A', { width: 4, depth: 4, type: 'row' });
    const foils = Array.from({ length: 4 }, (_, i) => ({ id: `f${i}`, wallId: 'side-back', module: i, full: true, width: 0, height: 0, x: 0, y: 0 }));
    // 4 × 0,96 × 2,42 = 9,29 m²
    expect(qty(run({ ...v, foils }), S.foilFull)).toBe(9.3);
  });
  it('unknown art.nr is kept as a placeholder line', () => {
    const res = run({ ...r1(), counted: [{ product: 'X-1', qty: 2 }] });
    const l = res.groups.flatMap((g) => g.lines).find((x) => x.artnr === 'X-1')!;
    expect(l).toMatchObject({ price: 0, placeholder: true, qty: 2 });
  });
});
