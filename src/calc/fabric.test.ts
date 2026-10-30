import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { splitLength } from './beams';
import { framePiece, printFileName } from './fabric';

const S = RULES.textile.inFrame;

describe('InFrame frame piece', () => {
  it('one module: 970 × 2540, no braces', () => {
    const p = framePiece(1000, S);
    expect(p).toMatchObject({ W: 970, H: 2540, pw: 1010, ph: 2580, braces: null });
    expect(p.lm).toBeCloseTo((2 * 970 + 2 * 2540) / 1000);
    expect(p.area).toBeCloseTo(1.01 * 2.58);
  });
  it('braces when the width passes the max brace distance', () => {
    expect(framePiece(2000, S).braces).toEqual({ qty: 1, length: 2460 });
    expect(framePiece(3000, S).braces).toEqual({ qty: 2, length: 2460 });
  });
  it('a lower textile wall uses its own height', () => {
    const p = framePiece(2000, S, 1500);
    expect(p).toMatchObject({ H: 1500, ph: 1540, braces: { qty: 1, length: 1420 } });
  });
  it('file size at scale with bleed', () => {
    const p = framePiece(1000, S);
    expect([p.fw, p.fh, p.fb]).toEqual([101, 258, 2]);
    const p14 = framePiece(1000, { ...S, bleed: 14 });
    expect([p14.fw, p14.fh, p14.fb]).toEqual([99.8, 256.8, 1.4]);
  });
  it('file name', () => {
    expect(printFileName('Nordlys AS', 'T1', framePiece(1000, S))).toBe('NordlysAS_T1_970x2540mm.pdf');
    expect(printFileName('', 'T2', framePiece(1000, S))).toBe('Firma_T2_970x2540mm.pdf');
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
    expect(splitLength(L, RULES.beam.max)).toEqual(parts);
  });
});
