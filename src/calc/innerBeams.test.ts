// Innvendige takdragere (Bjørn 1.11.2026): hooks on other beams, the longer span runs through a crossing, posts only
// at free ends and 6 m joints, a foot plate under each free post unless a beam drawn the other way meets it.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { pointKey } from '../domain/grid';
import type { InnerBeam, Point, Stand, Variant } from '../domain/types';
import { drawOpening } from '../domain/edit';
import { addRoom, moveRoom } from '../domain/rooms';
import { createVariant } from '../domain/variant';
import { builtModules, wallPoints } from '../domain/walls';
import { RULES } from '../rules/rules';
import { variantBeams } from './beams';
import { calc } from './calc';

const beam = (id: string, from: Point, to: Point): InnerBeam => ({ id, from, to });
const variant = (stand: Stand, innerBeams: InnerBeam[], noBeams = false): Variant => ({ ...createVariant('A', stand), innerBeams, ...(noBeams ? { noBeams } : {}) });
const layout = (v: Variant) => {
  const mods = builtModules(v);
  return variantBeams(v, new Set(mods.map((m) => m.key)), wallPoints(mods), RULES.beam.max);
};
const lengths = (v: Variant) => layout(v).inner.segments.map((s) => s.length);
const has = (ps: ReadonlyMap<string, Point>, p: Point) => ps.has(pointKey(p));

const ROW: Stand = { width: 6, depth: 4, type: 'row' };
const ISLAND: Stand = { width: 10, depth: 6, type: 'island' };

describe('innvendig takdrager', () => {
  it('from the back wall to the front beam: on the wall post, hooked on the front beam', () => {
    // Row 6 × 4: front open → standard front beam 6 m. Drawn x = 3 from the back wall (post) to the front beam.
    const l = layout(variant(ROW, [beam('b1', [3, 0], [3, 4])]));
    expect(l.inner.segments.map((s) => s.length)).toEqual([4]);
    expect(l.inner.hooks).toBe(1);
    expect(l.inner.feet).toEqual([]);
    // The standard beam is not split by it
    expect(l.standard.segments.map((s) => s.length)).toEqual([6]);
  });

  it('free-standing: a post with a foot plate across the beam at each end', () => {
    const l = layout(variant(ISLAND, [beam('b1', [1, 1], [5, 1])], true));
    expect(l.inner.hooks).toBe(0);
    expect([...l.inner.posts.values()]).toEqual([[1, 1], [5, 1]]);
    expect(l.inner.feet).toEqual([
      { at: [1, 1], orientation: 'h' },
      { at: [5, 1], orientation: 'h' },
    ]);
  });

  it('over 6 m: split evenly, a post and foot plate in the joint, no cross beam', () => {
    const v = variant(ISLAND, [beam('b1', [1, 1], [9, 1])], true);
    expect(lengths(v)).toEqual([4, 4]);
    const l = layout(v);
    expect(l.inner.feet.map((f) => f.at)).toEqual([[5, 1], [1, 1], [9, 1]]);
    expect(l.inner.segments.every((s) => !s.cross)).toBe(true);
  });

  it('a cross beam drawn at the joint takes the place of the foot plate there', () => {
    const l = layout(variant(ISLAND, [beam('b1', [1, 1], [9, 1]), beam('b2', [5, 1], [5, 4])], true));
    expect(has(new Map(l.inner.feet.map((f) => [pointKey(f.at), f.at])), [5, 1])).toBe(false);
    // b2's far end is free: post and plate across b2
    expect(l.inner.feet).toContainEqual({ at: [5, 4], orientation: 'v' });
    expect(l.inner.hooks).toBe(0);
  });

  it('crossing: the longer runs through, the shorter is split and hooked on both sides', () => {
    const v = variant(ISLAND, [beam('short', [3, 1], [3, 5]), beam('long', [1, 3], [8, 3])], true);
    const l = layout(v);
    // long 7 m: 4 + 3 with a joint post; short 4 m split at y = 3 into 2 + 2
    expect(l.inner.segments.map((s) => s.length)).toEqual([2, 2, 4, 3]);
    expect(l.inner.hooks).toBe(2);
    expect(has(l.inner.posts, [3, 3])).toBe(false);
  });

  it('a wall under it splits it on the wall post', () => {
    // Row 6 × 4, inner wall x = 0..3 at y = 2; beam x = 2 from back wall to front beam crosses it at (2, 2)
    const v = { ...variant(ROW, [beam('b1', [2, 0], [2, 4])]), walls: [...createVariant('A', ROW).walls, { id: 'w1', from: [0, 2] as Point, to: [3, 2] as Point }] };
    expect(lengths(v)).toEqual([2, 2]);
    expect(layout(v).inner.feet).toEqual([]);
  });

  it('calc: always the exhibitor, own line when the organiser pays the standard beams', () => {
    const v = variant(ROW, [beam('b1', [3, 0], [3, 4])]);
    const res = calc(v, RULES, DEFAULT_CATALOG, { payer: 'arrangør', ral: '9010' });
    const beamLines = res.groups.flatMap((g) => g.lines).filter((l) => l.artnr === DEFAULT_CATALOG.system.beam);
    expect(beamLines.map((l) => [l.qty, l.meta])).toEqual([[4, 'innvendig · 1 lengde · 1 krok']]);
    expect(res.organiser.lines.find((l) => l.artnr === DEFAULT_CATALOG.system.beam)?.qty).toBe(6);
    expect(res.keyFigures).toMatchObject({ beamLm: 10, organiserBeamLm: 6, innerBeamLm: 4, beamHooks: 1 });
    expect(res.foga.beamHooks).toBe(1);
    expect(res.bom.lines.find((l) => l.name.startsWith('KROK'))?.qty).toBe(1);
  });

  it('calc: free-standing beam posts are included and stand on plates without the foot', () => {
    const res = calc(variant(ISLAND, [beam('b1', [1, 1], [5, 1])], true), RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
    expect(res.keyFigures).toMatchObject({ beamLm: 4, beamPosts: 2, wallSupports: 2 });
    expect(res.foga.barePosts).toBe(2);
  });

  describe('a wall along it wins (Bjørn 1.11.2026)', () => {
    // Island 10 × 6, standard beams off: a drawn beam y = 3 across the whole stand, then a room 3 × 2 whose side lies on it
    const withRoom = () => addRoom(variant(ISLAND, [beam('b1', [0, 3], [10, 3])], true), { x: 2, y: 1, w: 3, d: 2 })!;

    it('a room side along the beam: that piece is not built, the beam stops on the room posts', () => {
      const l = layout(withRoom());
      expect(l.inner.segments.map((s) => [s.from, s.to])).toEqual([
        [[0, 3], [2, 3]],
        [[5, 3], [10, 3]],
      ]);
      expect(l.inner.lm).toBe(7);
      // The free ends at the stand edge get plates; the ends on the room corners share the wall posts
      expect(l.inner.feet.map((f) => f.at)).toEqual([[0, 3], [10, 3]]);
    });

    it('the wall under it is no longer held by it, so it gets its own foot plates', () => {
      const res = calc(withRoom(), RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
      const without = calc(addRoom(variant(ISLAND, [], true), { x: 2, y: 1, w: 3, d: 2 })!, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
      expect(res.keyFigures.beamLm).toBe(7);
      expect(res.keyFigures.wallSupports).toBe(without.keyFigures.wallSupports + 2);
    });

    it('the beam stays in the sketch and comes back when the room moves away', () => {
      const v = withRoom();
      expect(v.innerBeams).toEqual([beam('b1', [0, 3], [10, 3])]);
      const moved = moveRoom(v, v.rooms[0].id, 0, -1);
      expect(layout(moved).inner.lm).toBe(10);
    });

    it('a door in a wall along it counts as wall', () => {
      const walls = [...createVariant('A', ISLAND).walls, { id: 'w1', from: [1, 3] as Point, to: [4, 3] as Point }];
      const v = drawOpening({ ...variant(ISLAND, [beam('b1', [0, 3], [10, 3])], true), walls }, [2, 3], [3, 3], 'door');
      expect(v.openings).toHaveLength(1);
      expect(layout(v).inner.segments.map((s) => [s.from, s.to])).toEqual([
        [[0, 3], [1, 3]],
        [[4, 3], [10, 3]],
      ]);
    });
  });
});
