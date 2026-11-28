// Checks Byggeregel X14 (docs/byggeregler.md): a textile on a wall is its own unit, built to its own height, also over
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

  it('where the wires hang: along the frame, along its wall and in the plan, for the plan, elevation and 3D', () => {
    const v0 = onWall();
    const piece = production(updateTextile(v0.v, RULES, 't1', { height: 3.04 }), RULES, 'Kunde').pieces[0];
    // The frame on the back wall from 0 to 6 m (the frame ends 15 inside the run's ends)
    expect(piece.wireAt).toHaveLength(3);
    expect(piece.wireAlong!.map((a) => Math.round(a))).toEqual(piece.wireAt!.map((a) => Math.round(a + piece.runAt + (piece.shift ?? 0))));
    // In the plan on the frame's line, out from the wall's face (Bjørn 28.11.2026), not on the wall's line
    const runY = v0.v.textiles[0].from[1];
    expect(runY).toBeGreaterThan(0);
    expect(piece.wirePoints!.map(([x, y]) => [Math.round(x * 1000), y])).toEqual(piece.wireAlong!.map((a) => [Math.round(a), runY]));
  });
});
