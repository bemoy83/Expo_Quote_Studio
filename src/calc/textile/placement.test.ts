// Byggeregler X10, X11: frames never overlap. In an inner corner the frame on the shorter wall moves 40 mm, with the
// frames after it; a free-standing run stops at a frame on the wall it ends at.
import { describe, expect, it } from 'vitest';
import type { FreeTextile, InnerBeam, Point, Stand, TextileWall, Variant } from '../../domain/types';
import { createVariant } from '../../domain/variant';
import { builtModules, wallPoints } from '../../domain/walls';
import { RECIPES } from '../../foga/recipes';
import { RULES } from '../../rules/rules';
import { liftBeams } from '../beamLift';
import { variantBeams } from '../beams';
import { production } from '../production';
import { freeFrames } from './free';
import { freeTrims, placeFrames } from './placement';

const CORNER: Stand = { width: 6, depth: 4, type: 'corner', cornerSide: 'right' };
const SQUARE: Stand = { width: 4, depth: 4, type: 'corner', cornerSide: 'right' };
const ROW: Stand = { width: 6, depth: 4, type: 'row' };
const frame = (id: string, wallId: string, from: number, width: number): TextileWall => ({ id, wallId, from, width });
const free = (id: string, from: Point, to: Point): FreeTextile => ({ id, from, to });
const variant = (stand: Stand, x: Partial<Variant>): Variant => ({ ...createVariant('A', stand), ...x });
const shifts = (v: Variant) => Object.fromEntries(placeFrames(v, RULES).map((f) => [f.t.id, Math.round(f.shift * 1000)]));

describe('rammer i et innvendig hjørne (X10)', () => {
  // Corner stand 6 × 4: back wall (0,0)–(6,0), left wall (0,0)–(0,4)
  it('the frame on the shorter wall moves 40 mm away from the corner; the longer wall keeps its frame', () => {
    expect(shifts(variant(CORNER, { textiles: [frame('t1', 'side-back', 0, 2), frame('t2', 'side-left', 0, 1)] }))).toEqual({ t1: 0, t2: 40 });
  });

  it('the frames after it on the same face move with it, as far as they would clash', () => {
    const v = variant(CORNER, { textiles: [frame('t1', 'side-back', 0, 2), frame('t2', 'side-left', 0, 1), frame('t3', 'side-left', 1, 1), frame('t4', 'side-left', 3, 1)] });
    expect(shifts(v)).toEqual({ t1: 0, t2: 40, t3: 40, t4: 0 });
  });

  it('no clash, no move: a frame that does not reach the corner, or a wall without a frame there', () => {
    expect(shifts(variant(CORNER, { textiles: [frame('t1', 'side-back', 0, 2), frame('t2', 'side-left', 1, 1)] }))).toEqual({ t1: 0, t2: 0 });
    expect(shifts(variant(CORNER, { textiles: [frame('t2', 'side-left', 0, 1)] }))).toEqual({ t2: 0 });
  });

  it('equal walls: the one along x (the back wall) stays', () => {
    expect(shifts(variant(SQUARE, { textiles: [frame('t1', 'side-back', 0, 2), frame('t2', 'side-left', 0, 2)] }))).toEqual({ t1: 0, t2: 40 });
  });

  it('the frame keeps its standard length; production and plan get the move', () => {
    const p = production(variant(CORNER, { textiles: [frame('t1', 'side-back', 0, 2), frame('t2', 'side-left', 0, 1)] }), RULES, '');
    const t2 = p.pieces.find((x) => x.textileId === 't2')!;
    expect([t2.W, t2.shift]).toEqual([970, 40]);
    expect(p.pieces.find((x) => x.textileId === 't1')!.shift).toBeUndefined();
  });

  it('a moved frame past a post lifts the takdrager resting there (T13)', () => {
    // A drawn beam from the left wall's post at y = 1 across the stand
    const beam: InnerBeam = { id: 'b1', from: [0, 1], to: [5, 1] };
    const lifted = (v: Variant) => {
      const mods = builtModules(v);
      const points = wallPoints(mods);
      return liftBeams(v, RULES, variantBeams(v, mods, points, RULES.beam.max).all, points).segments.size;
    };
    expect(lifted(variant(CORNER, { innerBeams: [beam], textiles: [frame('t2', 'side-left', 0, 1)] }))).toBe(0);
    expect(lifted(variant(CORNER, { innerBeams: [beam], textiles: [frame('t1', 'side-back', 0, 2), frame('t2', 'side-left', 0, 1)] }))).toBeGreaterThan(0);
  });
});

describe('frittstående mot ramme (X11)', () => {
  // Row stand 6 × 4: back wall (0,0)–(6,0); a free-standing run from the back wall into the stand
  const run = free('f1', [3, 0], [3, 2]);
  const frames = (v: Variant) => freeFrames(v, RECIPES.freeFrame, RULES.textile.inFrame, '', freeTrims(v, RULES, placeFrames(v, RULES)));

  it('stops at the frame’s face, 60 mm from the wall line, and is that much shorter', () => {
    const v = variant(ROW, { freeTextiles: [run], textiles: [frame('t1', 'side-back', 2, 2)] });
    const [f] = frames(v);
    expect([f.length, f.start]).toEqual([1940, 60]);
  });

  it('without a frame there it runs to the wall as before', () => {
    const [f] = frames(variant(ROW, { freeTextiles: [run] }));
    expect([f.length, f.start]).toEqual([2000, undefined]);
    // A frame on the other face of the wall is not in its way
    const [g] = frames(variant(ROW, { freeTextiles: [run], textiles: [{ ...frame('t1', 'side-back', 2, 2), side: -1 }] }));
    expect(g.length).toBe(2000);
  });
});
