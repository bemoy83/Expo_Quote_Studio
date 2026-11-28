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

const S = RULES.textile.inFrame;

describe('X14 a tall textile on a wall', () => {
  it('is built to its own height over the wall top', () => {
    expect(framePiece(3000, S, 3040)).toMatchObject({ H: 3040, ph: 3080 });
  });

  it('keeps its height on the way to production, also when taller than full height', () => {
    const v0 = addTextile(createVariant('A', { width: 6, depth: 3, type: 'row' }), RULES, 'side-back', 1, 1)!;
    if ('error' in v0) throw new Error(v0.error);
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
    const v0 = addTextile(createVariant('A', { width: 6, depth: 3, type: 'row' }), RULES, 'side-back', 1, 1)!;
    if ('error' in v0) throw new Error(v0.error);
    const tall = updateTextile(v0.v, RULES, 't1', { height: 3.54 });
    const line = (v: typeof tall) => calc(v, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' }).groups.flatMap((g) => g.lines).find((l) => l.name.includes('mm, på vegg'))!;
    expect(line(tall).top).toBe(3540);
    expect(line(v0.v).top).toBeUndefined();
  });
});
