// Sider på disk (Byggeregel K16, trinn 2 PR 1): what each part of the outline of a counter of Disker og podier is, kept
// with the part when the counter is stretched, fused or parted, and held to a plate against a wall or another counter.
import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { counterBuildOf } from './counterShape';
import type { PlaceContext } from './objects';
import { lightOf, openStretches, partsOn, podiumHas, podiumParts, prunedSides, setLight } from './podiumFaces';
import { gripPodium, joined, podiumGrips } from './podiumGrips';
import { fusePodiums, inFrame, snapBeside } from './podiumLinks';
import { lockedParts, partLocks, placedBuild } from './podiumLocks';
import { podiumSides } from './podiums';
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
/** A counter 1000 + 500 long, 500 deep, its back (z−) open on both parts. */
const two = [sec(-750, 250, -250, 250), sec(250, 750, -250, 250)];
const backOf = (sections: CounterSection[]) => podiumParts(sections).filter((p) => p.axis === 'z' && p.out === -1);
const openBack = (sections: CounterSection[]) => setLight(sections, backOf(sections), 'open');
const at = (sections: CounterSection[], x = 3, y = 2.5, rot = 0): PlacedObject => ({ id: 'a', product: 'P', x, y, rot, sections });

describe('parts and their choice (K16)', () => {
  it('a part runs node to node on the outline, in front of the section behind it', () => {
    const parts = podiumParts(two);
    // Front and back: two each; the ends: one each; the joint inside is no part
    expect(parts).toHaveLength(6);
    const back = backOf(two).map((p) => [p.a, p.b]);
    expect(back.sort((p, q) => p[0] - q[0])).toEqual([[-750, 250], [250, 750]]);
    // An L: the side of the long section is split where the short one stands on it
    const ell = [sec(0, 1000, 0, 500), sec(0, 500, 500, 1000)];
    const top = podiumParts(ell).filter((p) => p.axis === 'z' && p.out === 1);
    expect(top.map((p) => [p.a, p.b, p.at]).sort()).toEqual([[0, 500, 1000], [500, 1000, 500]]);
  });

  it('a plate unless chosen; open stores on the section, plate takes it off again', () => {
    const s = openBack(two);
    expect(backOf(s).map((p) => lightOf(s, p))).toEqual(['open', 'open']);
    expect(s[0].sides).toEqual({ 'z-': { lights: ['open'] } });
    const back = setLight(s, backOf(s), null);
    expect(back).toEqual(two);
  });

  it('an open part has no plate and no bottom rail; its top rail and posts stand (K16, as the back of 6560)', () => {
    const closed = counterBuildOf({ sections: two });
    const open = counterBuildOf({ sections: openBack(two) });
    expect(closed.plates.length - open.plates.length).toBe(2);
    const bottoms = (b: typeof open) => b.profiles.filter((p) => p.role === 'bottomRail').map((p) => p.len).sort();
    expect(bottoms(closed)).toEqual([460, 460, 460, 460, 960, 960]);
    expect(bottoms(open)).toEqual([460, 460, 460, 960]);
    expect(open.profiles.filter((p) => p.role === 'post')).toHaveLength(closed.profiles.filter((p) => p.role === 'post').length);
  });

  it('table: one part of 1000 c/c, CC 1000, open: one plate 976 × 976 and one bottom rail 960 less', () => {
    const one = [sec(-500, 500, -250, 250)];
    const front = podiumParts(one).filter((p) => p.axis === 'z' && p.out === 1);
    const a = counterBuildOf({ sections: one });
    const b = counterBuildOf({ sections: setLight(one, front, 'open') });
    const big = (x: typeof a) => x.plates.filter((p) => p.w === 976 && p.h === 976).length;
    expect(big(a) - big(b)).toBe(1);
    expect(a.plates.length - b.plates.length).toBe(1);
    const rails = (x: typeof a) => x.profiles.filter((p) => p.role === 'bottomRail' && p.len === 960).length;
    expect(rails(a) - rails(b)).toBe(1);
  });
});

describe('the choice follows the part', () => {
  it('stretched by a grip, 1000 + 500 becomes 1000 + 1000 and keeps the back open on both (fasit)', () => {
    const o = at(openBack(two));
    const g = podiumGrips(o).find((x) => x.grip.kind === 'side' && x.grip.side.axis === 'x' && x.grip.side.out === 1)!;
    const r = ok(gripPodium(vOf(o), ctx, o, g.grip, g.at, [g.at[0] + 0.5, g.at[1]], false));
    const s = r.o.sections!;
    expect(s.map((x) => x.x[1] - x.x[0])).toEqual([1000, 1000]);
    expect(backOf(s).map((p) => lightOf(s, p))).toEqual(['open', 'open']);
  });

  it('a new section a grip lays on is a plate', () => {
    const o = at(openBack([sec(-500, 500, -250, 250)]));
    const g = podiumGrips(o).find((x) => x.grip.kind === 'side' && x.grip.side.axis === 'x' && x.grip.side.out === 1)!;
    const r = ok(gripPodium(vOf(o), ctx, o, g.grip, g.at, [g.at[0] + 0.5, g.at[1]], false));
    const s = r.o.sections!;
    expect(backOf(s).sort((p, q) => p.a - q.a).map((p) => lightOf(s, p))).toEqual(['open', null]);
  });

  it('fused with a podium against its short side: that side loses its choice, the rest keep theirs (fasit)', () => {
    const ends = podiumParts(two).filter((p) => p.axis === 'x' && p.out === 1);
    const a = at(setLight(openBack(two), ends, 'open'), 2, 2.5);
    const b: PlacedObject = { id: 'b', product: 'P', x: 3.03, y: 2.5, rot: 0, sections: [sec(-250, 250, -250, 250)] };
    const s = snapBeside(vOf(a, b), ctx, b)!;
    const r = ok(fusePodiums(vOf(a, s.o), ctx, 'a', 'b'));
    const o = r.v.objects[0].sections!;
    expect(o.flatMap((x) => Object.keys(x.sides ?? {}))).toEqual(['z-', 'z-']);
    expect(openStretches(o)).toHaveLength(2);
  });

  it('a side that becomes inner loses its choice; turned with the counter it is the same side', () => {
    const s = [sec(0, 500, 0, 500, 1000)];
    const right = podiumParts(s).filter((p) => p.axis === 'x' && p.out === 1);
    const chosen = setLight(s, right, 'open');
    expect(prunedSides([...chosen, sec(500, 1000, 0, 500)])[0].sides).toBeUndefined();
    // Seen from a counter turned a quarter, x+ of the other is its z+
    const turned = inFrame({ id: 'c', product: 'P', x: 0, y: 0, rot: 90, sections: [] }, { id: 'o', product: 'P', x: 0, y: 0, rot: 0, sections: chosen });
    expect(Object.keys(turned[0].sides!)).toEqual(['z-']);
  });

  it('joins two sections into one only with the same sides along them', () => {
    const halves = [sec(0, 500, 0, 500), sec(500, 1000, 0, 500)];
    expect(joined(halves)).toHaveLength(1);
    const back = setLight(halves, backOf(halves).filter((p) => p.a === 0), 'open');
    expect(joined(back)).toHaveLength(2);
    expect(joined(openBack(halves))).toEqual([{ ...sec(0, 1000, 0, 500), sides: { 'z-': { lights: ['open'] } } }]);
  });
});

describe('held to a plate against a wall or another counter (K16)', () => {
  const walled: Variant = { ...createVariant('A', { width: 6, depth: 5, type: 'row' }), objects: [] };

  it('a part nearer than 60 mm to a wall is a plate, its choice kept for when it is moved out', () => {
    // Back face 20 mm from the wall's face, then 100 mm out
    const o = at(openBack(two), 3, 0.02 + 0.02 + 0.26);
    const v = { ...walled, objects: [o] };
    expect(lockedParts(v, ctx, o)).toHaveLength(2);
    expect([...partLocks(v, ctx, o).values()]).toEqual(['wall', 'wall']);
    expect(placedBuild(v, ctx, o).plates).toHaveLength(counterBuildOf({ sections: two }).plates.length);
    const away = { ...o, y: 0.04 + 0.06 + 0.26 };
    expect(lockedParts({ ...walled, objects: [away] }, ctx, away)).toEqual([]);
    expect(podiumHas(away.sections!)).toEqual(['1 åpen side']);
    expect(podiumHas(o.sections!, lockedParts(v, ctx, o))).toEqual([]);
  });

  it('against another counter face to face; a counter only at its corner does not lock it', () => {
    const o = at(openBack(two), 3, 2.5);
    const behind: PlacedObject = { id: 'b', product: 'P', x: 2.74, y: 2.5 - 0.52, rot: 0, sections: [sec(-500, 500, -250, 250)] };
    expect([...partLocks(vOf(o, behind), ctx, o).values()]).toEqual(['counter']);
    const corner: PlacedObject = { ...behind, x: 2.24 - 0.51 };
    expect(partLocks(vOf(o, corner), ctx, o).size).toBe(0);
  });

  it('counts sides, not parts, for the quote', () => {
    expect(podiumHas(openBack(two))).toEqual(['1 åpen side']);
    const ends = podiumParts(two).filter((p) => p.axis === 'x');
    expect(podiumHas(setLight(openBack(two), ends, 'open'))).toEqual(['3 åpne sider']);
    expect(partsOn(two, podiumSides(two).find((s) => s.axis === 'z' && s.out === -1)!)).toHaveLength(2);
  });
});
