import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { splitBeamLength } from './beams/beamSegments';
import { framePiece } from './textile/inFrame';
import { buttEnds, printFileName } from './textile/common';

const S = RULES.textile.inFrame;

describe('InFrame frame piece', () => {
  it('one module: 970 × 2540, no braces', () => {
    const p = framePiece(1000, S);
    expect(p).toMatchObject({ W: 970, H: 2540, pw: 1010, ph: 2580, braces: null });
    expect(p.lm).toBeCloseTo((2 * 970 + 2 * 2540) / 1000);
    expect(p.area).toBeCloseTo(1.01 * 2.58);
  });
  it('braces when the width passes the max brace distance', () => {
    // At most 2 m between braces, the frame sides count as braces (Bjørn 7.11.2026)
    expect(framePiece(2000, S).braces).toBeNull();
    expect(framePiece(3000, S).braces).toEqual({ qty: 1, length: 2460 });
    expect(framePiece(4000, S).braces).toEqual({ qty: 1, length: 2460 });
    expect(framePiece(5000, S).braces).toEqual({ qty: 2, length: 2460 });
  });
  it('past 5 m the rails are spliced with 609 and braced by the splice, as on foot plates (one product)', () => {
    const p = framePiece(6000, S);
    expect(p).toMatchObject({ W: 5970, railCuts: [2985, 2985], braces: { qty: 4, length: 2460 } });
    expect(p.parts.loose).toEqual([
      ['617', 4],
      ['609', 2],
      ['520', 2],
    ]);
    expect(p.braceAt).toEqual([1418, 2835, 3135, 4553]);
    expect(framePiece(4000, S)).toMatchObject({ railCuts: [3970], braceAt: [1985] });
    expect(framePiece(4000, S).parts.loose.map(([c]) => c)).toEqual(['617', '520']);
  });
  it('a lower textile wall uses its own height', () => {
    const p = framePiece(3000, S, 1500);
    expect(p).toMatchObject({ H: 1500, ph: 1540, braces: { qty: 1, length: 1420 } });
  });
  it('file size at scale with bleed', () => {
    const p = framePiece(1000, S);
    expect([p.fw, p.fh]).toEqual([101, 258]);
    const p14 = framePiece(1000, { ...S, bleed: 14 });
    expect([p14.fw, p14.fh]).toEqual([99.8, 256.8]);
  });
  it('file name', () => {
    expect(printFileName('Nordlys AS', 'T1', framePiece(1000, S))).toBe('NordlysAS_T1_970x2540mm.pdf');
    expect(printFileName('', 'T2', framePiece(1000, S))).toBe('Firma_T2_970x2540mm.pdf');
  });
});

describe('butt ends (Bjørn 8.11.2026)', () => {
  it('mitred frame corners, butt at a splice and at a 92LTX', () => {
    expect(buttEnds([3970])).toEqual([]);
    expect(buttEnds([3000, 3000])).toEqual([
      [3000, 1, 2],
      [3000, 1, 2],
    ]);
    expect(buttEnds([2000, 2000, 2000])).toEqual([
      [2000, 1, 2],
      [2000, 2, 2],
      [2000, 1, 2],
    ]);
    expect(buttEnds([2963], { from: false, to: true })).toEqual([[2963, 1, 2]]);
    expect(buttEnds([2463, 2463], { from: true, to: false })).toEqual([
      [2463, 2, 2],
      [2463, 1, 2],
    ]);
  });
});

describe('beam split', () => {
  it.each([
    [3, [3]],
    [6, [6]],
    [7, [4, 3]],
    [12, [6, 6]],
    [13, [5, 4, 4]],
  ])('%d m → %j', (L, parts) => {
    expect(splitBeamLength(L, RULES.beam.max)).toEqual(parts);
  });
});
