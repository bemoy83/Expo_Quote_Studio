// Expected values are derived by hand from the approved rules (rules.ts) and the InFrame rules (fabric.ts),
// not copied from the mockup's calc. Each case shows the arithmetic.
import { describe, expect, it } from 'vitest';
import { CURTAIN, DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog';
import type { FloorTile, Point, Variant } from '../domain/types';
import { createVariant, fillFloor } from '../domain/variant';
import { addRoom, RECT_SIDE } from '../domain/rooms';
import { DEFAULT_PRICING, ITEM } from '../pricing/data';
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
/** An item of the default price list (costed from the example kostgrunnlag for wall and takdrager). */
const item = (id: string) => DEFAULT_PRICING.items.get(id)!;
const sumOf = (uses: [string, number][], k: 'cost' | 'price') => uses.reduce((a, [id, n]) => a + item(id)[k] * n, 0);
/** R1's back wall: 9 modules on 10 posts, each module a plate, a top and a bottom rail, and montering. */
const R1_WALL: [string, number][] = [
  [ITEM.plate, 9],
  [ITEM.rail('92', 960), 9],
  [ITEM.rail('91', 960), 9],
  [ITEM.post, 10],
  [ITEM.module, 9],
];
/** Catalog products sell at their fixed OMS price; the cost engine gives cost and time (Bjørn 7.11.2026). */
const WALL_PRICE = 765;

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
    // Braces at most 2 m apart, the frame sides count (Bjørn 7.11.2026): ceil(3970 / 2000) − 1 = 1, 2540 − 2 × 40 = 2460.
    // Profile: 2 × 3970 + 2 × 2540 + 1 × 2460 = 15 480 mm → 15,48 lm.
    // Print: (3970 + 40) × (2540 + 40) = 4010 × 2580 mm = 10,3458 m² → 10,3.
    expect(res.production.lm).toBeCloseTo(15.48);
    expect(res.keyFigures.textileM2).toBeCloseTo(10.3458);
    const [p] = res.production.pieces;
    expect(p).toMatchObject({ W: 3970, H: 2540, pw: 4010, ph: 2580, braces: { qty: 1, length: 2460 } });
  });
  // Textile is priced by the cost engine (sum of its items), not from OMS: the frame parts rented out, the textile
  // bought for the job, the work (Bjørn 7.11.2026). Catalog fixed prices are what it will be calibrated against.
  const FRAME: [string, number][] = [
    [ITEM.frameProfileM, (2 * 3970 + 2 * 2540) / 1000],
    [ITEM.corner, 4],
    [ITEM.wallFixing, 2],
    [ITEM.braceM, 2.46],
    [ITEM.bracePiece, 1],
    [ITEM.frameCoupling, 4 + 2],
    [ITEM.frame, 1],
  ];
  const EDGE = (2 * (3970 + 2540)) / 1000;
  it('textile wall: frame rented per piece and textile bought per m², two lines here and one on the quote', () => {
    const frame = lines(res).find((x) => x.artnr === S.textile)!;
    expect(frame).toMatchObject({ name: 'Tekstilramme på systemvegg, leie, 3970 × 2540 mm', qty: 1, unit: 'stk', price: Math.round(sumOf(FRAME, 'price')), strategy: 'sum', transfer: 'leie' });
    expect(frame.cost).toBeCloseTo(sumOf(FRAME, 'cost'));
    // Textile: visible 3,970 × 2,540 = 10,0838 → 10,1 m². Print incl. bleed 4,010 × 2,580 = 10,3458 m², pressed in
    // along 2 × (3,97 + 2,54) = 13,02 m
    const textile: [string, number][] = [[ITEM.print, 4.01 * 2.58], [ITEM.textileEdge, EDGE]];
    const print = lines(res).find((x) => x.artnr === S.textileFill.print)!;
    expect(print).toMatchObject({ qty: 10.1, unit: 'm²', price: Math.round(sumOf(textile, 'price') / 10.1), strategy: 'sum' });
    const [q] = quoteLines(res.groups.find((g) => g.id === 'prof')!.lines);
    expect(q).toMatchObject({ name: 'Tekstilvegg på systemvegg', qty: 1, unit: 'stk', sum: frame.sum + print.sum, terms: 'Leie av ramme, kjøp av tekstil' });
  });
  it("the customer's own textile is only mounted", () => {
    const v = r2();
    const res2 = run({ ...v, textiles: v.textiles.map((t) => ({ ...t, fill: 'reuse' as const })) });
    expect(qty(res2, S.textileFill.print)).toBe(0);
    expect(lines(res2).find((x) => x.artnr === S.textileFill.reuse)).toMatchObject({ qty: 10.1, price: Math.round(sumOf([[ITEM.textileEdge, EDGE]], 'price') / 10.1) });
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
      noBeams: false,
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
    expect(res.beams.segments.filter((s) => s.cross && !s.support).map((s) => s.length)).toEqual([2]);
  });
  it('a wall ending under a beam splits it there and shares the post', () => {
    // Row 6 × 3, inner wall from 1 m off the back wall to the front: front 6 → 3 + 3 at (3,3), on the wall's own post.
    const res = run(rowWithWall(6, 3, [3, 1], [3, 3]));
    expect(res.beams.segments.filter((s) => !s.support).map((s) => s.length)).toEqual([3, 3]);
    // The 6 m back wall's støttedrager (3,0) → (3,1) lands on the inner wall's other end, on its post: no plates
    expect(res.beams.segments.filter((s) => s.support).map((s) => s.length)).toEqual([1]);
    expect(res.keyFigures).toMatchObject({ beamLm: 7, beamLengths: 3, beamPosts: 0 });
    expect(res.wallSupports).toHaveLength(0);
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
    // 9 m around the open sides, and the 6 m back wall's 3 m støttedrager, hooked on the front beam
    expect(res.keyFigures.beamLm).toBe(12);
    expect(res.keyFigures.beamHooks).toBe(1);
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
  it('engangsteppe: m² laid on the quote, running metres of 2 m roll with 10 cm at each end, the cut strip as waste', () => {
    // 3 × 3 m: a 2 m lane and one cut to 1 m
    const v = r1();
    const tiles: FloorTile[] = [{ i: 0, j: 0, w: 6, h: 4, roll: 'x', product: '5920' }, { i: 0, j: 4, w: 6, h: 2, roll: 'x', product: '5920' }];
    const res = run({ ...v, floor: { ...v.floor, tiles } });
    expect(qty(res, '5920')).toBe(9);
    const roll = lines(res).find((l) => l.artnr === '5920')!.roll!;
    expect(roll.lanes).toEqual([{ length: 3, width: 2, cut: false, qty: 1 }, { length: 3, width: 1, cut: true, qty: 1 }]);
    expect(roll.lm).toBeCloseTo(6.4);
    expect(roll.waste).toBeCloseTo(6.4 * 2 - 9);
    // Taped all round and along the one seam
    expect(roll.tape).toBeCloseTo(12 + 3);
  });
  it('engangsteppe filled the cheapest way: the narrow rest in two halves from one piece, still only m² laid', () => {
    const res = run(fillFloor(r1(), '5920', 2));
    expect(qty(res, '5920')).toBe(9);
    const roll = lines(res).find((l) => l.artnr === '5920')!.roll!;
    expect(roll.lm).toBeCloseTo(3.2 + 1.7);
    expect(roll.pieces).toEqual([{ length: 3.2, parts: [2], endToEnd: false, qty: 1 }, { length: 1.7, parts: [1, 1], endToEnd: true, qty: 1 }]);
  });
});

describe('calibrated against three stands Bjørn priced (7.11.2026)', () => {
  // Exhibitor pays walls and takdrager. His estimate: person-hours for the whole goods journey, montering and
  // demontering included. Prices are checked with the real Foga list outside the repo (it is not published).
  const stands: [Variant['stand'], number, number, number][] = [
    [{ width: 4, depth: 3, type: 'corner', cornerSide: 'right' }, 7, 7, 1.84],
    [{ width: 5, depth: 3, type: 'row' }, 11, 5, 2.69],
    [{ width: 7, depth: 4, type: 'corner', cornerSide: 'right' }, 11, 15, 3.03],
  ];
  it.each(stands)('%o: his metres, and his hours within 3 %', (stand, wallLm, beamLm, hours) => {
    const r = run(createVariant('A', stand));
    expect(r.keyFigures).toMatchObject({ wallLm, beamLm });
    const minutes = lines(r).reduce((a, l) => a + Object.values(l.time).reduce((b, m) => b + (m ?? 0), 0), 0);
    expect(Math.abs(minutes / 60 / hours - 1)).toBeLessThan(0.03);
  });
});

describe('catalog price, cost from what is built (pricing/data.ts, cost engine)', () => {
  const res = run(r1());
  it('wall per metre at its OMS price; cost = plates, rails, its share of the posts and montering', () => {
    // 9 modules, 10 posts: 9 plates + 9 + 9 rails + 10 posts + 9 × montering
    const l = lines(res).find((x) => x.artnr === '6120-9010')!;
    expect(l).toMatchObject({ price: WALL_PRICE, sum: WALL_PRICE * 9, strategy: 'fast' });
    expect(l.cost).toBeCloseTo(sumOf(R1_WALL, 'cost'));
    expect(l.dg).toBeCloseTo((l.sum - l.cost!) / l.sum);
    expect(l.placeholder).toBe(false);
  });
  it('takdrager per metre at its OMS price; cost = its lengths, its own posts and montering', () => {
    // One length 2960 mm and 3 m montering, per lm
    const beam: [string, number][] = [
      [ITEM.beam(2960), 1],
      [ITEM.beamLm, 3],
    ];
    const l = lines(res).find((x) => x.artnr === S.beam)!;
    expect(l.price).toBe(121);
    expect(l.cost).toBeCloseTo(sumOf(beam, 'cost'));
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
  it('an article missing from the price list leaves the cost unknown, the price stays', () => {
    const items = new Map(DEFAULT_PRICING.items);
    items.delete('montering-modul');
    const r = calc(r1(), RULES, DEFAULT_CATALOG, EXHIBITOR, { ...DEFAULT_PRICING, items });
    expect(lines(r).find((x) => x.artnr === '6120-9010')).toMatchObject({ price: WALL_PRICE, cost: null, strategy: 'fast', placeholder: false });
  });
  it('handling time per step is in the prices, not a line', () => {
    // The wall's and the takdrager's items, each with its minutes per step (calibrated, pricing/data.ts)
    const uses: [string, number][] = [...R1_WALL, [ITEM.beam(2960), 1], [ITEM.beamLm, 3]];
    for (const step of ['plukk', 'vask', 'transport', 'montering', 'demontering'] as const) {
      expect(res.keyFigures.time[step], step).toBeCloseTo(uses.reduce((a, [id, n]) => a + (item(id).time?.[step] ?? 0) * n, 0));
    }
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
    expect(res.organiser.lines[0].price).toBe(WALL_PRICE);
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
    // Platebytte at its catalog price; cost is a plate and the swap per metre
    const l = lines(res).find((x) => x.artnr === '6125-5007')!;
    expect(l).toMatchObject({ qty: 3, price: 400, payer: 'utstiller', foga: true });
    expect(l.cost).toBeCloseTo(3 * (item(ITEM.plate).cost + item(ITEM.plateSwap).cost));
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

  it('island: no takdrager by default, they follow the stand walls (Bjørn 3.11.2026)', () => {
    const v = createVariant('A', { width: 8, depth: 3, type: 'island' });
    expect(run(v).keyFigures.beamLm).toBe(0);
    expect(org(v).organiser.lines).toEqual([]);
  });
  it('island (open area, no stand walls): the exhibitor pays the takdrager in full when chosen', () => {
    const v = { ...createVariant('A', { width: 8, depth: 3, type: 'island' }), noBeams: false, walls: [{ id: 'w1', from: [3, 0] as [number, number], to: [3, 3] as [number, number] }] };
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

describe('frittstående tekstilvegg mellom to vegger', () => {
  it('the splice has no room to be threaded: 604 in the channel', () => {
    const v = createVariant('A', { width: 8, depth: 3, type: 'row' });
    const res = run({ ...v, freeTextiles: [{ id: 'f1', from: [0, 1.5], to: [8, 1.5] }] });
    const [f] = res.production.free;
    expect(f.spliceCode).toBe('604');
    const tx = res.bom.lines.filter((l) => l.group === 'prof.tekstil');
    expect(tx.find((l) => l.artnr === '871 037 92')).toBeUndefined();
    expect(qty(res, S.freeTextile)).toBeGreaterThan(0);
    expect(f.connectors.splice).toBe(4);
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
    // Feet at 200, 3150 and 5800; braces there, 150 each side of the splice at 3000 and between, at most 2 m apart
    expect(tx.find((l) => l.name.startsWith('Støttestag'))).toMatchObject({ qty: 6 });
    // 617: top and bottom at both free ends · 609: top and bottom splice (both ends free)
    expect(tx.find((l) => l.artnr === '871 045 92')).toMatchObject({ qty: 4 });
    expect(tx.find((l) => l.artnr === '871 037 92')).toMatchObject({ qty: 2 });
    expect(tx.find((l) => l.artnr === '876 740 92')).toMatchObject({ qty: 3 });
  });
});
