// Checks Byggeregler X14 og X18 (docs/byggeregler.md): a textile on a wall is its own unit, built to its own height, also over
// the wall's top.
import { describe, expect, it } from 'vitest';
import { createVariant } from '../../domain/variant';
import { addTextile, updateTextile } from '../../domain/textile/inFrame';
import { wallTextiles } from '../../domain/textile/mounts';
import { RULES } from '../../rules/rules';
import { DEFAULT_CATALOG } from '../../catalog/defaultCatalog';
import { calc } from '../calc';
import { postPieces } from './common';
import { framePiece } from './inFrame';
import { production, textileHeightMm } from './production';
import { setWallRaise } from '../../domain/raise';
import { addFreeTextile } from '../../domain/textile/free';
import { setTextileSize } from '../../domain/textile/edit';
import { settleCorners, withOnWall } from '../../domain/textile/mounts';
import type { Point, Variant } from '../../domain/types';

const S = RULES.textile.inFrame;
/** A row stand with one textile on its back wall, t1. */
const onWall = () => {
  const r = addTextile(createVariant('A', { width: 6, depth: 3, type: 'row' }), RULES, 'side-back', 1, 1);
  if (!r) throw new Error('no textile');
  return r;
};

describe('X14 a tall textile on a wall', () => {
  it('is built to its own height over the wall top', () => {
    expect(framePiece(3000, S, 3040)).toMatchObject({ H: 3040, ph: 3080 });
  });

  it('keeps its height on the way to production, also when taller than full height', () => {
    const v0 = onWall();
    const v = updateTextile(v0.v, RULES, 't1', { height: 3.04 });
    expect(textileHeightMm(wallTextiles(v)[0], S)).toBe(3040);
    const p = production(v, RULES, 'Kunde');
    expect(p.pieces.find((x) => x.textileId === 't1')!.H).toBe(3040);
  });

  it('an upright over the longest piece is spliced with 609 inside, nothing more', () => {
    const p = framePiece(3000, S, 5030);
    // The longest standard that leaves the splice piece long enough: 4540 + 490
    expect(p.parts.cuts).toEqual(expect.arrayContaining([[4540, 2], [490, 2]]));
    expect(p.parts.spliced).toEqual(expect.arrayContaining([[490, 2]]));
    expect(p.parts.loose).toEqual(expect.arrayContaining([['609', 2]]));
    // Under the longest piece nothing is spliced
    expect(framePiece(3000, S, 4540).parts.loose.some(([c]) => c === '609')).toBe(false);
  });

  it('X7: a 92LTX over the longest piece is in pieces butt to butt, the 43TX lengths less the end caps', () => {
    expect(postPieces(2540)).toEqual([2526]);
    const tall = postPieces(5030);
    expect(tall.reduce((a, x) => a + x, 0)).toBe(5016);
    expect(tall.every((x) => x <= 5000)).toBe(true);
  });

  it('cost rule 6: a frame reaching over the height limit takes the lift and the extra time up there', () => {
    const v0 = onWall();
    const tall = updateTextile(v0.v, RULES, 't1', { height: 3.54 });
    const line = (v: typeof tall) => calc(v, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' }).groups.flatMap((g) => g.lines).find((l) => l.name.includes('mm, på vegg'))!;
    expect(line(tall).top).toBe(3540);
    expect(line(v0.v).top).toBeUndefined();
  });

  it('over its wall top a frame hangs from the ceiling: wires by the foot plate rule, through-eyebolt in the top rail', () => {
    const v0 = onWall();
    const tall = updateTextile(v0.v, RULES, 't1', { height: 3.04 });
    const res = calc(tall, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
    const piece = res.production.pieces[0];
    // 6 m wide, free at both ends: the ends and one between, no more than 3 m apart (S3)
    expect(piece.wires).toBe(3);
    const wire = res.groups.flatMap((g) => g.lines).find((l) => l.artnr === '4300')!;
    expect(wire).toMatchObject({ qty: 3, top: 3040 });
    expect(res.bom.lines.find((l) => l.name === 'Gjennomgående øyebolt')!.qty).toBe(3);
    // Inside a wall raised past it, the wall holds it
    const raised = { ...tall, walls: tall.walls.map((w) => (w.id === 'side-back' ? { ...w, raise: 540 } : w)) };
    expect(calc(raised, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' }).production.pieces[0].wires).toBeUndefined();
    // Lowered again, the wires are back (Bjørn 28.11.2026)
    expect(calc(setWallRaise(raised, 'side-back', 0), RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' }).production.pieces[0].wires).toBe(3);
  });

  it('where the wires hang: along the frame (3D) and along its wall (plan and elevation)', () => {
    const v0 = onWall();
    const piece = production(updateTextile(v0.v, RULES, 't1', { height: 3.04 }), RULES, 'Kunde').pieces[0];
    // The frame on the back wall from 0 to 6 m (the frame ends 15 inside the run's ends)
    expect(piece.wireAt).toHaveLength(3);
    expect(piece.wireAlong!.map((a) => Math.round(a))).toEqual(piece.wireAt!.map((a) => Math.round(a + piece.runAt + (piece.shift ?? 0))));
  });
});

// Byggeregel X18 (Bjørn 28.11.2026): one product, so free height on a wall is free height on foot plates too, with no
// code of its own; only the support differs. Over 2540 on foot plates it always hangs in wire, and a 92LTX corner has a
// wire of its own, on a wall too (X14).
describe('X18 a tall textile wall on foot plates', () => {
  const island = () => createVariant('A', { width: 10, depth: 8, type: 'island' });
  const draw = (v: Variant, a: Point, b: Point) => {
    const r = addFreeTextile(v, RULES, a, b);
    if ('error' in r) throw new Error(r.error);
    return r;
  };
  const run = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });

  it('is built to its own height, its uprights spliced like one on a wall, and hangs in wires by the foot plate rule', () => {
    const r = draw(island(), [1, 2], [7, 2]);
    const v = setTextileSize(r.v, RULES, r.id, { height: 5.03 });
    const res = run(v);
    const [f] = res.production.free;
    expect(f).toMatchObject({ H: 5030, top: 5030, wires: 3, wireAt: [0, 3000, 6000] });
    // Uprights over 5000 are spliced with 609 inside (X14)
    expect(f.parts.cuts).toEqual(expect.arrayContaining([[4540, 2], [490, 2]]));
    expect(res.production.textileWires).toHaveLength(3);
    // The textile is printed at its own height, on both faces
    expect(f.faces.map((x) => x.H)).toEqual([5030, 5030]);
    // One wire line, worked from the lift (cost rule 6)
    expect(res.groups.flatMap((g) => g.lines).find((l) => l.artnr === '4300')).toMatchObject({ qty: 3, top: 5030 });
  });

  it('at full height it stands on its feet alone', () => {
    const r = draw(island(), [1, 2], [7, 2]);
    expect(run(r.v).production.textileWires).toEqual([]);
  });

  it('a 92LTX corner between tall frames has its own wire, once for both', () => {
    let v = draw(island(), [1, 2], [4, 2]).v;
    v = draw(v, [4, 2], [4, 5]).v;
    for (const t of v.textiles) v = setTextileSize(v, RULES, t.id, { height: 3.04 });
    const P = run(v).production;
    // Each arm 3 m with the corner as a wire point: one at its free end, and the corner's own
    expect(P.free.map((f) => f.wires)).toEqual([1, 1]);
    expect(P.textileWires.map((w) => w.at)).toContainEqual([4, 2]);
    expect(P.textileWires).toHaveLength(3);
  });

  it('X14: a 92LTX corner between tall frames on walls has its own wire too', () => {
    const v0 = createVariant('A', { width: 4, depth: 3, type: 'corner' });
    const back = v0.walls.find((w) => w.from[1] === 0 && w.to[1] === 0)!;
    const left = v0.walls.find((w) => w.from[0] === 0 && w.to[0] === 0)!;
    // Both drawn into the inside corner, onto the other wall's line: they meet in a 92LTX
    const v = settleCorners(
      withOnWall(v0, [
        { id: 'a', wallId: back.id, side: 1, from: 0, width: 2, height: 3.04 },
        { id: 'b', wallId: left.id, side: -1, from: 0, width: 2, height: 3.04 },
      ]),
    );
    const P = production(v, RULES, '');
    expect(P.pieces.map((p) => p.corners.from || p.corners.to)).toEqual([true, true]);
    // The corner no longer holds the frames' ends: it hangs in its own wire, counted once
    expect(P.textileWires.length).toBe(P.pieces.reduce((a, p) => a + (p.wires ?? 0), 0) + 1);
    // The elevation shows it at each frame's end
    expect(P.pieces.every((p) => p.wireAlong!.length === (p.wires ?? 0) + 1)).toBe(true);
  });
});
