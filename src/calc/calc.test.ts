// Expected values are derived by hand from the approved rules (rules.ts) and the InFrame rules (fabric.ts),
// not copied from the mockup's calc. Each case shows the arithmetic.
import { describe, expect, it } from 'vitest';
import { CURTAIN, DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog';
import type { Point, Variant } from '../domain/types';
import { createVariant, fillFloor } from '../domain/variant';
import { addRoom, RECT_SIDE } from '../domain/rooms';
import { DEFAULT_PRICING } from '../pricing/data';
import { RULES } from '../rules/rules';
import { calc, type CalcResult } from './calc';
import { quoteLines } from './quoteLines';
import { r1, r2, r3 } from './referenceStands';

// The exhibitor pays every wall, stand walls too: the whole drawing is theirs. Organiser-paid stand walls below.
const EXHIBITOR = { payer: 'utstiller', ral: '9010' } as const;
const run = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG, EXHIBITOR);
const lines = (res: CalcResult) => res.groups.flatMap((g) => g.lines);
const qty = (res: CalcResult, artnr: string) => lines(res).filter((l) => l.artnr === artnr).reduce((a, l) => a + l.qty, 0);
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

describe('R1 with takdrager turned off', () => {
  // The customer wants a more open stand: no beam and no beam posts, the walls keep their own posts.
  const res = run({ ...r1(), noBeams: true });
  it('no beam on the quote, in the key figures or in the structure', () => {
    expect(qty(res, S.beam)).toBe(0);
    expect(res.keyFigures).toMatchObject({ beamLm: 0, beamPosts: 0, posts: 10 });
    expect(res.foga.posts).toBe(10);
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
  it('textile wall: frame rented per piece and textile bought per m², two lines here and one on the quote', () => {
    // Frame: 43TX 2 × 3970 + 2 × 2540 = 13,02 m × 10 = 130,2 · 4 × 617 × 4 = 16 · 2 × 520 × 5 = 10
    // braces 3 × 2,46 m × 6 = 44,28 + 3 × 20 = 60 · håndtering 140 → 400,48 → 400
    const frame = lines(res).find((x) => x.artnr === S.textile)!;
    expect(frame).toMatchObject({ name: 'Tekstilramme på systemvegg, leie, 3970 × 2540 mm', qty: 1, unit: 'stk', price: 400, strategy: 'sum', transfer: 'leie' });
    // Textile: visible 3,970 × 2,540 = 10,0838 → 10,1 m². Print 4,010 × 2,580 = 10,3458 m² × 470 = 4862,526,
    // pressed in along 2 × (3,97 + 2,54) = 13,02 m × 120 = 1562,4 → 6424,926 / 10,1 = 636
    const print = lines(res).find((x) => x.artnr === S.textileFill.print)!;
    expect(print).toMatchObject({ qty: 10.1, unit: 'm²', price: 636, strategy: 'sum' });
    const [q] = quoteLines(res.groups.find((g) => g.id === 'prof')!.lines);
    expect(q).toMatchObject({ name: 'Tekstilvegg på systemvegg', qty: 1, unit: 'stk', sum: 400 + 10.1 * 636, terms: 'Leie av ramme, kjøp av tekstil' });
  });
  it("the customer's own textile is only mounted", () => {
    const v = r2();
    const res2 = run({ ...v, textiles: v.textiles.map((t) => ({ ...t, fill: 'reuse' as const })) });
    expect(qty(res2, S.textileFill.print)).toBe(0);
    // 13,02 m × 120 = 1562,4 / 10,1 = 155
    expect(lines(res2).find((x) => x.artnr === S.textileFill.reuse)).toMatchObject({ qty: 10.1, price: 155 });
    expect(res2.production.pieces[0]).toMatchObject({ fill: 'reuse', fileName: null });
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
  /** A row stand with one inner wall from `from` to `to`. */
  const rowWithWall = (width: number, depth: number, from: Point, to: Point): Variant => {
    const v = createVariant('A', { width, depth, type: 'row' });
    return { ...v, walls: [...v.walls, { id: 'iw', from, to }] };
  };
  it('cross beam from a joint runs to the facing wall', () => {
    // Row 8 × 4: front 8 → 4 + 4, joint at (4,4). Cross beam to back wall (4,0): 4 m.
    const res = run(createVariant('A', { width: 8, depth: 4, type: 'row' }));
    expect(res.keyFigures.beamLm).toBe(12);
    expect(res.keyFigures.beamPosts).toBe(1);
    // Walls 9 + 4 + 4 = 17 posts, plus the joint.
    expect(res.keyFigures.posts).toBe(18);
  });
  it('cross beam runs on across an inner wall, split on its post', () => {
    const res = run(rowWithWall(8, 4, [3, 2], [5, 2]));
    expect(res.beams.segments.filter((s) => s.cross).map((s) => s.length)).toEqual([2, 2]);
    expect(res.keyFigures.beamLm).toBe(12);
  });
  it('cross beam runs on past a wall ending on its line, split there', () => {
    // Row 8 × 4, cross beam (4,4) → (4,0). Inner wall (2,2)–(4,2) ends on it: 2 + 2 on the wall's post, still 12 m.
    const res = run(rowWithWall(8, 4, [2, 2], [4, 2]));
    expect(res.beams.segments.filter((s) => s.cross).map((s) => s.length)).toEqual([2, 2]);
    expect(res.keyFigures).toMatchObject({ beamLm: 12, beamLengths: 4, beamPosts: 1 });
  });
  it('cross beam stops where a wall runs along its line', () => {
    const res = run(rowWithWall(8, 4, [4, 2], [4, 1]));
    expect(res.beams.segments.filter((s) => s.cross).map((s) => s.length)).toEqual([2]);
  });
  it('a wall ending under a beam splits it there and shares the post', () => {
    // Row 6 × 3, inner wall from the back wall to the front: front 6 → 3 + 3 at (3,3), on the wall's own post.
    const res = run(rowWithWall(6, 3, [3, 1], [3, 3]));
    expect(res.beams.segments.map((s) => s.length)).toEqual([3, 3]);
    expect(res.keyFigures).toMatchObject({ beamLm: 6, beamLengths: 2, beamPosts: 0 });
    // The beam holds the wall's end: only the other, free end gets a plate.
    expect(res.wallSupports).toHaveLength(1);
  });
  it('each side of a wall end is split by the 6 m rule on its own', () => {
    // Row 10 × 3, inner wall at x = 2: 2 + 8, and 8 → 4 + 4 with a joint at (6,3) and a 3 m cross beam to the back.
    const res = run(rowWithWall(10, 3, [2, 0], [2, 3]));
    expect(res.beams.segments.filter((s) => !s.cross).map((s) => s.length)).toEqual([2, 4, 4]);
    expect(res.keyFigures).toMatchObject({ beamLm: 13, beamLengths: 4, beamPosts: 1 });
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
  it('fill: 1 × 1 tiles over the stand, with protection over the total', () => {
    const v = fillFloor(r1(), '5901');
    const res = run({ ...v, floor: { ...v.floor, protection: true } });
    expect(qty(res, '5901')).toBe(9);
    expect(qty(res, S.floorProtection)).toBe(9);
    expect(lines(res).find((l) => l.artnr === '5901')!.tiles).toEqual([{ size: '100 × 100', qty: 9 }]);
  });
  it('several floor types side by side; carpet tiles counted per size, a turned tile the same size', () => {
    const v = r1();
    const tiles = [
      { i: 0, j: 0, w: 2, h: 2, product: '5901' },
      { i: 2, j: 0, w: 2, h: 1, product: '5901' },
      { i: 4, j: 0, w: 1, h: 2, product: '5901' },
      { i: 5, j: 0, w: 1, h: 1, product: '5901' },
      { i: 0, j: 2, w: 2, h: 2, product: '5902' },
      { i: 2, j: 2, w: 1, h: 1, product: '5930' },
    ];
    const res = run({ ...v, floor: { protection: false, tiles } });
    expect(res.keyFigures.floor).toEqual({ '5901': 2.25, '5902': 1, '5930': 0.25 });
    const of = (a: string) => lines(res).find((l) => l.artnr === a)!.tiles;
    expect(of('5901')).toEqual([{ size: '100 × 100', qty: 1 }, { size: '100 × 50', qty: 2 }, { size: '50 × 50', qty: 1 }]);
    expect(of('5902')).toEqual([{ size: '100 × 100', qty: 1 }]);
    expect(of('5930')).toBeUndefined();
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
    const r = calc(r1(), RULES, DEFAULT_CATALOG, EXHIBITOR, { ...DEFAULT_PRICING, items });
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

describe('stand walls the organiser pays (docs/vegger.md)', () => {
  const ORGANISER = { payer: 'arrangør', ral: '9010' } as const;
  const org = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG, ORGANISER);
  const coloured = (v: Variant, wallId: string, plate: string): Variant => ({ ...v, walls: v.walls.map((w) => (w.id === wallId ? { ...w, plate } : w)) });
  const picked = (res: CalcResult, ral: string) => res.bom.lines.filter((l) => l.ral === ral).reduce((a, l) => a + l.qty, 0);

  it('R1: the stand walls and their takdrager are billed to the organiser, not on the quote or picking list', () => {
    const res = org(r1());
    expect(lines(res)).toEqual([]);
    expect(res.organiser.lines).toMatchObject([
      { artnr: '6120-9010', qty: 9, payer: 'arrangør', meta: 'Standvegg · RAL 9010' },
      { artnr: S.beam, qty: 3, payer: 'arrangør' },
    ]);
    // Same price as when the exhibitor pays: 9 modules on their own 10 posts
    expect(res.organiser.lines[0].price).toBe(899);
    expect(res.organiser.sum).toBe(res.organiser.lines.reduce((a, l) => a + l.sum, 0));
    expect(res.sum).toBe(0);
    expect(res.foga.posts).toBe(0);
    expect(res.bom.lines).toEqual([]);
    // Key figures still describe the whole sketch
    expect(res.keyFigures).toMatchObject({ wallLm: 9, standWallLm: 9, organiserWallLm: 9, innerWallLm: 0, posts: 10, beamLm: 3, organiserBeamLm: 3 });
  });

  it('a coloured stand wall: the organiser still pays white, the exhibitor the plate swap', () => {
    const res = org(coloured(r1(), 'side-back', '5007'));
    expect(res.organiser.lines[0]).toMatchObject({ artnr: '6120-9010', qty: 9 });
    // Plate 150 + swap 200 per metre
    expect(lines(res).find((l) => l.artnr === '6125-5007')).toMatchObject({ qty: 3, price: 350, payer: 'utstiller', foga: true });
    expect(res.keyFigures.swapLm).toBe(3);
    // The picker takes the three blue plates, nothing of the wall itself
    expect(picked(res, '5007')).toBe(3);
    expect(picked(res, '9010')).toBe(0);
  });

  it('an inner wall against a stand wall: the post on the stand wall is the organiser\'s', () => {
    const v = { ...r1(), walls: [...r1().walls, { id: 'w1', from: [1, 0] as [number, number], to: [1, 2] as [number, number] }] };
    const res = org(v);
    expect(res.foga.posts).toBe(2);
    expect(lines(res).find((l) => l.artnr === '6120-9010')).toMatchObject({ qty: 2, meta: 'Innervegg · RAL 9010' });
    expect(res.keyFigures).toMatchObject({ standWallLm: 9, innerWallLm: 2 });
  });

  it('R2: the room uses the stand walls and builds only its own sides', () => {
    const res = org(r2());
    expect(res.organiser.lines.map((l) => [l.artnr, l.qty])).toEqual([
      ['6120-9010', 10],
      [S.beam, 10],
    ]);
    expect(res.organiser.lines[1].meta).toBe('2 lengder · 1 stolpe inkludert');
    expect(qty(res, '6120-9010')).toBe(3);
    // Room posts (2,1), (2,2), (1,2); the free beam post is the organiser's
    expect(res.foga.posts).toBe(3);
    expect(res.foga.beams).toEqual([]);
    expect(qty(res, DOOR)).toBe(1);
  });

  it('island (open area, no stand walls): the exhibitor pays the takdrager in full', () => {
    const v = { ...createVariant('A', { width: 8, depth: 3, type: 'island' }), walls: [{ id: 'w1', from: [3, 0] as [number, number], to: [3, 3] as [number, number] }] };
    const res = org(v);
    expect(res.organiser.lines).toEqual([]);
    expect(qty(res, S.beam)).toBeGreaterThan(0);
    expect(res.keyFigures.organiserBeamLm).toBe(0);
  });

  it('the exhibitor pays: stand walls are their own line, the organiser gets nothing', () => {
    const res = run(r2());
    expect(lines(res).filter((l) => l.artnr === '6120-9010').map((l) => [l.meta, l.qty])).toEqual([
      ['Standvegg · RAL 9010', 10],
      ['Innervegg · RAL 9010', 3],
    ]);
    expect(res.organiser.lines).toEqual([]);
    expect(res.keyFigures).toMatchObject({ standWallLm: 10, organiserWallLm: 0, roomWallLm: 3 });
  });
});

describe('frittstående tekstilvegg', () => {
  const v = createVariant('A', { width: 10, depth: 8, type: 'island' });
  const res = run({ ...v, freeTextiles: [{ id: 'f1', from: [1, 2], to: [7, 2], b: { fill: 'white' } }] });
  it('frame per metre, textile per face', () => {
    expect(qty(res, S.freeTextile)).toBe(6);
    // 6 × 2,54 = 15,24 m² each side
    expect(qty(res, S.textileFill.print)).toBeCloseTo(15.2);
    expect(qty(res, S.textileFill.white)).toBeCloseTo(15.2);
    const [q] = quoteLines(res.groups.find((g) => g.id === 'prof')!.lines);
    expect(q).toMatchObject({ name: 'Tekstilvegg frittstående', qty: 6, unit: 'lm' });
  });
  it('picking list', () => {
    const tx = res.bom.lines.filter((l) => l.group === 'prof.tekstil');
    expect(tx.find((l) => l.name.startsWith('43TX'))).toMatchObject({ qty: 6, detail: '4 × 3000 · 2 × 2540 mm' });
    expect(tx.find((l) => l.name.startsWith('Støttestag'))).toMatchObject({ qty: 3 });
    // 617: top and bottom at both free ends · 609: top and bottom splice
    expect(tx.find((l) => l.artnr === '871 045 92')).toMatchObject({ qty: 4 });
    expect(tx.find((l) => l.artnr === '871 037 92')).toMatchObject({ qty: 2 });
    expect(tx.find((l) => l.artnr === '876 740 92')).toMatchObject({ qty: 3 });
  });
});
