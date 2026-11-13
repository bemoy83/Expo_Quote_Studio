// Grep på valgt disk (Byggeregel K14): sides and box corners of a counter of Disker og podier moved in 500 steps.
import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import type { PlaceContext } from './objects';
import { gripPodium, podiumGrips, type PodiumGrip } from './podiumGrips';
import { podiumSize } from './podiums';
import type { CounterSection, PlacedObject, Variant } from './types';
import { createVariant } from './variant';

const ctx: PlaceContext = { rules: RULES, footprint: () => ({ w: 0.52, d: 0.52, h: 1.04 }), swings: () => false, isCounter: () => true };
const sec = (x0: number, x1: number, z0: number, z1: number, h = 1000): CounterSection => ({ x: [x0, x1], z: [z0, z1], h });
const at = (sections: CounterSection[], rot = 0): PlacedObject => ({ id: 'i1', product: 'P', x: 3, y: 2.5, rot, sections });
const vOf = (o: PlacedObject): Variant => ({ ...createVariant('A', { width: 6, depth: 5, type: 'row' }), walls: [], objects: [o] });

/** The grip of o found by `pick`, dragged by (dx, dy) mm on the plan. */
function drag(o: PlacedObject, pick: (g: PodiumGrip) => boolean, dx: number, dy: number, fine = false) {
  const g = podiumGrips(o).find((x) => pick(x.grip));
  if (!g) throw new Error('no grip');
  return gripPodium(vOf(o), ctx, o, g.grip, g.at, [g.at[0] + dx / 1000, g.at[1] + dy / 1000], fine);
}
const side = (axis: 'x' | 'z', out: -1 | 1, at?: number) => (g: PodiumGrip) => g.kind === 'side' && g.side.axis === axis && g.side.out === out && (at === undefined || g.side.at === at);
const corner = (x: -1 | 1, z: -1 | 1) => (g: PodiumGrip) => g.kind === 'corner' && g.x === x && g.z === z;
/** Each section's size c/c, sorted. */
const cells = (r: ReturnType<typeof drag>) => {
  if ('error' in r) throw new Error(r.error);
  return r.o.sections!.map((s) => [s.x[1] - s.x[0], s.z[1] - s.z[0]]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
};
const outer = (r: ReturnType<typeof drag>) => {
  if ('error' in r) throw new Error(r.error);
  return [podiumSize(r.o).length, podiumSize(r.o).depth];
};

describe('grips on a chosen counter (K14)', () => {
  const one = at([sec(-250, 250, -250, 250)]);

  it('one in the middle of each straight side and one in each corner of the box, on the outer face', () => {
    const g = podiumGrips(one);
    expect(g.filter((x) => x.grip.kind === 'side')).toHaveLength(4);
    expect(g.filter((x) => x.grip.kind === 'corner')).toHaveLength(4);
    expect(g.find((x) => side('x', 1)(x.grip))!.at).toEqual([3.26, 2.5]);
    expect(g.find((x) => corner(-1, -1)(x.grip))!.at).toEqual([2.74, 2.24]);
    // An L has six sides: one grip each, also on a side over several sections
    const ell = at([sec(0, 1000, 0, 500), sec(1000, 1500, 0, 500), sec(0, 500, 500, 1000)]);
    expect(podiumGrips(ell).filter((x) => x.grip.kind === 'side')).toHaveLength(6);
  });

  it('out: the section by the side is stretched to 1000 before a new one is laid', () => {
    expect(cells(drag(one, side('x', 1), 500, 0))).toEqual([[1000, 500]]);
    expect(cells(drag(one, side('x', 1), 1000, 0))).toEqual([[1000, 500], [500, 500]]);
    expect(cells(drag(one, side('x', 1), 1800, 0))).toEqual([[1000, 500], [1000, 500], [500, 500]]);
    // 500 steps: 200 is nothing yet, 300 is a step
    expect(cells(drag(one, side('x', 1), 200, 0))).toEqual([[500, 500]]);
    expect(cells(drag(one, side('x', 1), 300, 0))).toEqual([[1000, 500]]);
    // With Shift, 250 steps
    expect(cells(drag(one, side('x', 1), 300, 0, true))).toEqual([[750, 500]]);
  });

  it('keeps the other sides where they are', () => {
    const r = drag(one, side('z', -1), 0, -500);
    if ('error' in r) throw new Error(r.error);
    expect(r.o.y).toBe(2.25);
    expect(r.o.y + r.o.sections![0].z[1] / 1000).toBe(2.75);
  });

  it('in: shrunk and taken away, shown as gone, never below 250 × 250', () => {
    const bar = at([sec(-750, 250, -250, 250), sec(250, 750, -250, 250)]);
    const r = drag(bar, side('x', 1), -750, 0, true);
    expect(cells(r)).toEqual([[750, 500]]);
    expect(r.gone!.sections!.map((s) => s.x)).toEqual(expect.arrayContaining([[250, 750], [0, 250]]));
    expect(cells(drag(one, side('x', 1), -2000, 0, true))).toEqual([[250, 500]]);
    expect(cells(drag(one, side('x', 1), -2000, 0))).toEqual([[500, 500]]);
  });

  it('a corner moves the two box sides that meet there', () => {
    expect(cells(drag(one, corner(1, 1), 500, 500))).toEqual([[1000, 1000]]);
    const sq = at([sec(-500, 500, -500, 500)]);
    expect(cells(drag(sq, corner(1, 1), 500, 500))).toEqual([[1000, 1000], [1000, 500], [500, 1000], [500, 500]]);
    expect(outer(drag(sq, corner(-1, 1), -500, -500, true))).toEqual([1520, 520]);
  });

  it('a side partly along a section lays on beside it instead of stretching it', () => {
    // An L: the bottom of the long leg, beside the short one, moved down fills the corner (and what fits in one is one)
    const ell = at([sec(-500, 500, -500, 0), sec(-500, 0, 0, 500)]);
    const r = drag(ell, side('z', 1, 0), 0, 500);
    expect(cells(r)).toEqual([[1000, 1000]]);
    const tall = at([sec(-500, 500, -500, 0), sec(-500, 0, 0, 1000)]);
    expect(cells(drag(tall, side('z', 1, 0), 0, 500))).toEqual([[1000, 500], [500, 1000], [500, 500]]);
    expect(outer(r)).toEqual([1020, 1020]);
  });

  it('refuses a part left loose, the counter over itself, and no room', () => {
    // An H: taking the bar away leaves the two legs apart
    const h = at([sec(-750, -250, -750, 750), sec(250, 750, -750, 750), sec(-250, 250, -250, 250)]);
    expect(drag(h, side('z', -1, -250), 0, 500)).toMatchObject({ error: 'En del ville stått løst' });
    // A U: the inside of one arm moved out across the gap onto the other
    const u = at([sec(-750, -250, -500, 500), sec(250, 750, -500, 500), sec(-250, 250, 0, 500)]);
    expect(drag(u, side('x', 1, -250), 1000, 0)).toMatchObject({ error: 'Disken kan ikke gå over seg selv' });
    expect(drag(one, side('x', 1), 3000, 0)).toMatchObject({ error: 'Ikke plass til disken her' });
  });

  it('works the same on a turned counter', () => {
    const turned = at([sec(-500, 500, -250, 250)], 90);
    // Turned a quarter, its length runs along plan y
    const g = podiumGrips(turned).find((x) => x.grip.kind === 'side' && x.grip.side.axis === 'x' && x.grip.side.out === 1)!;
    const r = gripPodium(vOf(turned), ctx, turned, g.grip, g.at, [g.at[0] + (g.at[0] - 3) * 1, g.at[1] + (g.at[1] - 2.5) * 1], false);
    expect(outer(r)).toEqual([1520, 520]);
    expect(r.o.rot).toBe(90);
  });
});

describe('what is left after a grip moves in (K14)', () => {
  it('joins two sections that fit in one again, whole metres first', () => {
    const bar = at([sec(-750, 250, -250, 250), sec(250, 750, -250, 250)]);
    // 1500 in by 500 from the left: 500 + 500 is left, joined to one 1000
    expect(cells(drag(bar, side('x', -1), 500, 0))).toEqual([[1000, 500]]);
    // From the right, the 500 goes and the 1000 stays
    expect(cells(drag(bar, side('x', 1), -500, 0))).toEqual([[1000, 500]]);
  });
});
