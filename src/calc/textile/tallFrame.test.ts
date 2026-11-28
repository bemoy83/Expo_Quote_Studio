// Checks Byggeregel X14 (docs/byggeregler.md): a textile on a wall is its own unit, built to its own height, also over
// the wall's top.
import { describe, expect, it } from 'vitest';
import { createVariant } from '../../domain/variant';
import { addTextile, updateTextile } from '../../domain/textile/inFrame';
import { wallTextiles } from '../../domain/textile/mounts';
import { RULES } from '../../rules/rules';
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
});
