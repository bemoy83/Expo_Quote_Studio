// Takdrager mot høy tekstil (Bjørn 28.11.2026): a lifted beam goes no higher than a whole 3040 post on its 40 mm foot,
// top 3080 (`rules.beam.maxTop`). A frame up to 3000 lifts the beam on 94 × 540; a taller one takes the beam away, with
// what hangs on it, and the walls get their support by the S rules. Checks Byggeregel T19 (docs/byggeregler.md).
import { describe, expect, it } from 'vitest';
import type { FreeTextile, InnerBeam, Point, Stand, TextileWall, Variant } from '../../domain/types';
import { createVariant } from '../../domain/variant';
import { builtModules, wallPoints } from '../../domain/walls';
import { RULES, type Rules } from '../../rules/rules';
import { beamGone, beamNote, liftBeams, liftClear, liftLength, withJoins } from './beamLift';
import { variantBeams } from './beams';
import { calc } from '../calc';
import { DEFAULT_CATALOG } from '../../catalog/defaultCatalog';
import { withTextiles } from '../../test/textiles';

const ROW: Stand = { width: 6, depth: 4, type: 'row' };
const beam = (id: string, from: Point, to: Point): InnerBeam => ({ id, from, to });
const free = (id: string, from: Point, to: Point, height?: number): FreeTextile => ({ id, from, to, ...(height ? { height } : {}) });
type Draft = Omit<Partial<Variant>, 'textiles'> & { textiles?: (TextileWall | FreeTextile)[] };
const variant = (stand: Stand, { textiles = [], ...x }: Draft): Variant => withTextiles({ ...createVariant('A', stand), ...x }, textiles);
const lift = (v: Variant, rules: Rules = RULES) => {
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const { all: laid } = variantBeams(v, mods, points, rules.beam.max);
  const l = liftBeams(v, rules, laid, points, mods);
  return { laid, all: withJoins(laid, l), lift: l };
};
const drawn = [beam('b1', [3, 0], [3, 4])];

describe('Byggeregel T19: takdrager mot høy tekstil', () => {
  it('the limit is derived from the beam top: 3080 less the beam, 3000', () => {
    expect(liftClear(RULES)).toBeCloseTo(3.0);
    // 80 clears a standard frame, 540 (2540 + 540 = 3080) the rest, nothing more
    expect(liftLength(RULES, 80)).toBe(80);
    expect(liftLength(RULES, 81)).toBe(540);
    expect(liftLength(RULES, 540)).toBe(540);
    expect(liftLength(RULES, 541)).toBeNull();
  });

  it('a 3000 frame lifts the beam on 94 × 540', () => {
    const { lift: l } = lift(variant(ROW, { innerBeams: drawn, textiles: [free('f1', [2, 2], [4, 2], 3.0)] }));
    expect(l.segments.size).toBe(1);
    expect(l.length).toBe(540);
    expect(l.removed.size).toBe(0);
    expect([...l.by.lifted]).toEqual(['f1']);
  });

  it('a standard frame keeps the 94 × 80', () => {
    const { lift: l } = lift(variant(ROW, { innerBeams: drawn, textiles: [free('f1', [2, 2], [4, 2])] }));
    expect(l.length).toBe(80);
  });

  it('a 3040 frame takes the beam away, with its own posts and foot plates', () => {
    const v = variant(ROW, { innerBeams: [beam('b1', [3, 0], [3, 3])], textiles: [free('f1', [2, 2], [4, 2], 3.04)] });
    const { laid, all, lift: l } = lift(v);
    const gone = laid.segments.filter((s) => s.inner);
    expect(gone).toHaveLength(1);
    expect(l.removed.has(gone[0])).toBe(true);
    expect(all.segments.some((s) => s.inner)).toBe(false);
    expect([...l.by.removed]).toEqual(['f1']);
    // The free end's own post at (3, 3) goes with it
    expect([...all.posts.values()]).not.toContainEqual([3, 3]);
  });

  it('a beam hanging on one taken away goes too', () => {
    // b2 hangs on b1 between its posts; b1 runs over the tall frame
    const v = variant(ROW, { innerBeams: [beam('b1', [3, 0], [3, 4]), beam('b2', [3, 1], [5, 1])], textiles: [free('f1', [2, 2], [4, 2], 3.5)] });
    const { all } = lift(v);
    expect(all.segments.some((s) => s.inner)).toBe(false);
  });

  it('the limit follows the rule value: no code to change', () => {
    const higher: Rules = { ...RULES, beam: { ...RULES.beam, maxTop: 3.58 } };
    const { lift: l } = lift(variant(ROW, { innerBeams: drawn, textiles: [free('f1', [2, 2], [4, 2], 3.5)] }), higher);
    expect(l.removed.size).toBe(0);
    expect(l.length).toBe(1040);
  });

  it('the calc picks the 540 piece, and no beam once it is taken away', () => {
    const at = (h: number) => calc(variant(ROW, { innerBeams: drawn, textiles: [free('f1', [2, 2], [4, 2], h)] }), RULES, DEFAULT_CATALOG);
    const lifted = at(3.0);
    expect(lifted.lift?.length).toBe(540);
    expect(lifted.bom.lines.some((b) => b.name.includes('94, 540 mm'))).toBe(true);
    const gone = at(3.04);
    expect(gone.beams.segments.some((s) => s.inner)).toBe(false);
  });
});

describe('Byggeregel T19: a stand-wall beam taken away', () => {
  it('the walls it held stand on foot plates instead, the exhibitor’s', () => {
    const at = (h: number) => calc(variant(ROW, { textiles: [free('f1', [1, 3.98], [3, 3.98], h)] }), RULES, DEFAULT_CATALOG);
    const kept = at(3.0);
    const gone = at(3.04);
    expect(kept.beams.segments.length).toBeGreaterThan(0);
    expect(gone.beams.segments.length).toBeLessThan(kept.beams.segments.length);
    expect(gone.wallSupports.length).toBeGreaterThan(kept.wallSupports.length);
  });
});

describe('Byggeregel T19: the hint', () => {
  it('says the beam goes, with the 3 m rule, and when it is lifted higher', () => {
    const at = (h: number) => variant(ROW, { innerBeams: drawn, textiles: [free('f1', [2, 2], [4, 2], h)] });
    expect(beamNote(at(3.04), RULES, 'f1')).toBe('Takdrageren over tas bort: ingen hevet drager over 3,00 m. Veggene får fotplater i stedet, på kundens regning');
    expect(beamGone(at(3.04), RULES, 'f1')).toBe(true);
    expect(beamNote(at(3.0), RULES, 'f1')).toBe('Takdrageren heves til 3,08 m. Høyere enn 3,00 m tas den bort');
    expect(beamNote(at(2.54), RULES, 'f1')).toBeNull();
    expect(beamGone(at(3.0), RULES, 'f1')).toBe(false);
  });
});
