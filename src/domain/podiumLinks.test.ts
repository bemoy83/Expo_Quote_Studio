// Fusjon og lenker (Byggeregel K15): counters of Disker og podier joined when dragged against each other, parted at a joint.
import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import type { PlaceContext } from './objects';
import { counterBuildOf } from './counterShape';
import { breakJoint, fusePodiums, NOT_ALONE, podiumJoints, podiumLinks, snapBeside } from './podiumLinks';
import { podiumSize } from './podiums';
import type { CounterSection, PlacedObject, Variant } from './types';
import { createVariant } from './variant';

const ctx: PlaceContext = { rules: RULES, footprint: () => ({ w: 0.52, d: 0.52, h: 1.04 }), swings: () => false, isCounter: () => true };
const sec = (x0: number, x1: number, z0: number, z1: number, h = 1000): CounterSection => ({ x: [x0, x1], z: [z0, z1], h });
const base = { ...createVariant('A', { width: 6, depth: 5, type: 'row' }), walls: [] };
const vOf = (...objects: PlacedObject[]): Variant => ({ ...base, objects });
const ok = <T extends object>(r: T | { error: string }): T => {
  if ('error' in r) throw new Error(r.error);
  return r;
};
const outer = (o: PlacedObject) => [podiumSize(o).length, podiumSize(o).depth];

const a: PlacedObject = { id: 'a', product: 'P', x: 2, y: 2.5, rot: 0, ral: '3002', sections: [sec(-500, 500, -500, 500)] };
const b: PlacedObject = { id: 'b', product: 'P', x: 3, y: 2.6, rot: 0, ral: '7012', sections: [sec(-250, 250, -250, 250)] };

describe('fusion (K15)', () => {
  it('a counter dragged within 300 mm lies face against face, its nodes in the other one\'s grid', () => {
    const s = snapBeside(vOf(a, b), ctx, b)!;
    expect(s.onto).toBe('a');
    expect([s.o.x, s.o.y]).toEqual([2.77, 2.5]);
    expect(snapBeside(vOf(a, { ...b, x: 3.1 }), ctx, { ...b, x: 3.1 })).toBeNull();
  });

  it('on release they become one: the one that stood still keeps its colour and place', () => {
    const s = snapBeside(vOf(a, b), ctx, b)!;
    const r = ok(fusePodiums(vOf(a, s.o), ctx, 'a', 'b'));
    expect(r.v.objects).toHaveLength(1);
    const o = r.v.objects[0];
    expect(o.ral).toBe('3002');
    expect(outer(o)).toEqual([1520, 1020]);
    // a stays where it stood: its left node line at 1.5
    expect(o.x + Math.min(...o.sections!.map((x) => x.x[0])) / 1000).toBeCloseTo(1.5);
  });

  it('counters of two heights become one, each section keeping its own, the step closed (K12)', () => {
    const low = { ...b, x: 2.77, y: 2.5, sections: [sec(-250, 250, -250, 250, 500)] };
    const o = ok(fusePodiums(vOf(a, low), ctx, 'a', 'b')).v.objects[0];
    expect(o.sections!.map((s) => s.h).sort((p, q) => p - q)).toEqual([500, 1000]);
    expect(counterBuildOf(o).plates.filter((p) => p.level === 'step')).toHaveLength(1);
  });

  it('a turned counter joins in the other one\'s grid', () => {
    const turned = { ...b, rot: 90, sections: [sec(-500, 500, -250, 250)] };
    const s = snapBeside(vOf(a, turned), ctx, turned)!;
    const r = ok(fusePodiums(vOf(a, s.o), ctx, 'a', 'b'));
    expect(outer(r.v.objects[0])).toEqual([1520, 1020]);
  });
});

describe('joints and links (K15)', () => {
  const bar: PlacedObject = { ...a, sections: [sec(-750, 250, -250, 250), sec(250, 750, -250, 250)] };

  it('a joint is a straight line where sections meet, across the whole counter', () => {
    expect(podiumJoints(bar.sections!)).toEqual([{ axis: 'x', at: 250, a: -250, b: 250 }]);
    const grid = [sec(-500, 0, -500, 0), sec(0, 500, -500, 0), sec(-500, 0, 0, 500), sec(0, 500, 0, 500)];
    expect(podiumJoints(grid)).toEqual(expect.arrayContaining([{ axis: 'x', at: 0, a: -500, b: 500 }, { axis: 'z', at: 0, a: -500, b: 500 }]));
  });

  it('broken, the counter becomes two standing face against face; linked again, one', () => {
    const r = ok(breakJoint(vOf(bar), ctx, 'a', podiumJoints(bar.sections!)[0]));
    expect(r.v.objects.map(outer)).toEqual([[1020, 520], [520, 520]]);
    const [keep, part] = r.v.objects;
    expect(keep.id).toBe('a');
    expect(part.ral).toBe('3002');
    // The part stands 20 mm off: face against face
    expect(part.x - keep.x).toBeCloseTo(0.77);
    const links = podiumLinks(r.v, keep);
    expect(links).toEqual([{ kind: 'neighbour', id: part.id, at: [2.26, 2.5] }]);
    const back = ok(fusePodiums(r.v, ctx, 'a', part.id));
    expect(back.v.objects.map(outer)).toEqual([[1520, 520]]);
  });

  it('a joint met from either side parts the counter (a square against the leg of an L)', () => {
    const ell: PlacedObject = { ...a, sections: [sec(-250, 250, -750, -250), sec(250, 1250, -750, -250), sec(-250, 250, -250, 750), sec(-1250, -250, -500, 500)] };
    const j = podiumJoints(ell.sections!).find((x) => x.axis === 'x' && x.at === -250)!;
    expect(ok(breakJoint(vOf(ell), ctx, 'a', j)).v.objects).toHaveLength(2);
    // The short leg's joint has the square on both sides of it: not alone
    const k = podiumJoints(ell.sections!).find((x) => x.axis === 'z')!;
    expect(breakJoint(vOf(ell), ctx, 'a', k)).toEqual({ error: NOT_ALONE });
  });

  it('a joint that does not part the counter alone is refused', () => {
    const t = { ...a, sections: [sec(-500, 500, -500, 0), sec(-500, 0, 0, 500), sec(0, 500, 0, 500)] };
    const j = podiumJoints(t.sections!).find((x) => x.axis === 'x')!;
    expect(breakJoint(vOf(t), ctx, 'a', j)).toEqual({ error: NOT_ALONE });
  });

  it('the chosen counter shows a link in the middle of each joint', () => {
    expect(podiumLinks(vOf(bar), bar)).toEqual([{ kind: 'joint', joint: { axis: 'x', at: 250, a: -250, b: 250 }, at: [2.25, 2.5] }]);
  });
});
