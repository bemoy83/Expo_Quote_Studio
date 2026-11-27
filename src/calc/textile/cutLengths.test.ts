// Byggeregel X9: 43TX in a standard length is rented per metre; any other length is cut for the job (cost rule 2).
import { describe, expect, it } from 'vitest';
import { RECIPES } from '../../foga/recipes';
import { ITEM } from '../../pricing/data';
import { DEFAULT_PRICING } from '../../pricing/data';
import { EXAMPLE_BASIS } from '../../cost/basis';
import { cutMaterial, labourCost } from '../../cost/model';
import { frameParts, isStandardLength } from './common';
import { frameUses } from './lines';
import { lengthKind, standardChoices } from './standard';
import { framePiece } from './inFrame';
import { RULES } from '../../rules/rules';

const R = RECIPES.textileFrame;
const qty = (uses: { id: string; qty: number }[], id: string) => uses.find((u) => u.id === id)?.qty ?? 0;

describe('Byggeregel X9: standard lengths and cuts', () => {
  it('the standard lengths are data', () => {
    for (const l of [470, 970, 1040, 1970, 2040, 2540, 2970, 3040, 3970, 4970]) expect(isStandardLength(l)).toBe(true);
    for (const l of [1000, 1030, 2500, 3000]) expect(isStandardLength(l)).toBe(false);
  });

  it('a frame on standard lengths has no cut', () => {
    const p = frameParts(R, [2970], { qty: 2, length: 2540 }, { qty: 1, length: 2460 }, []);
    const u = frameUses(p);
    expect(qty(u, ITEM.frameProfileM)).toBeCloseTo((2 * 2970 + 2 * 2540) / 1000);
    expect(qty(u, ITEM.frameCutM)).toBe(0);
    expect(qty(u, ITEM.frameCut)).toBe(0);
  });

  it('a length outside the list is cut: its metres and one cut per piece', () => {
    // 6000 free-standing: 4970 + a 1030 splice piece in both rails, two uprights 2540
    const p = frameParts(R, [4970, 1030], { qty: 2, length: 2540 }, { qty: 4, length: 2460 }, []);
    const u = frameUses(p);
    expect(qty(u, ITEM.frameProfileM)).toBeCloseTo((2 * 4970 + 2 * 2540) / 1000);
    expect(qty(u, ITEM.frameCutM)).toBeCloseTo((2 * 1030) / 1000);
    expect(qty(u, ITEM.frameCut)).toBe(2);
  });

  it('a splice piece is cut even at a standard length', () => {
    const p = frameParts(R, [4970, 970], { qty: 2, length: 2540 }, { qty: 4, length: 2460 }, []);
    const u = frameUses(p);
    expect(qty(u, ITEM.frameProfileM)).toBeCloseTo((2 * 4970 + 2 * 2540) / 1000);
    expect(qty(u, ITEM.frameCutM)).toBeCloseTo((2 * 970) / 1000);
    expect(qty(u, ITEM.frameCut)).toBe(2);
  });

  it('cost rule 2: the cut metre is material with waste and reuse, the cut is labour', () => {
    const p = EXAMPLE_BASIS.params;
    const metre = DEFAULT_PRICING.items.get(ITEM.frameCutM)!;
    const cut = DEFAULT_PRICING.items.get(ITEM.frameCut)!;
    const row = metre.trace!.rows[0];
    expect(row.how).toMatchObject({ kind: 'cut', waste: p.cut.waste, reuse: p.cut.reuse });
    expect(metre.cost).toBeCloseTo(cutMaterial(row.how.kind === 'cut' ? row.how.buy : 0, p), 2);
    expect(cut.cost).toBeCloseTo(labourCost(p.cut.minutes, Number(EXAMPLE_BASIS.date.slice(0, 4)), p), 2);
    // A cut piece costs more than the same metres rented, by its cut (Bjørn 27.11.2026: more, not disproportionately)
    const rented = DEFAULT_PRICING.items.get(ITEM.frameProfileM)!.price;
    expect(metre.price + cut.price).toBeGreaterThan(rented);
    expect(metre.price + cut.price).toBeLessThan(2 * rented);
  });
});

describe('Byggeregel X9: a short splice piece takes 604', () => {
  it('too short for 609: 604 in pairs, as when held at both ends', () => {
    const short = framePiece(5130, RULES.textile.inFrame);
    expect(short.railCuts).toEqual([4970, 130]);
    expect(short.parts.loose).toContainEqual(['604', 4]);
    const long = framePiece(6000, RULES.textile.inFrame);
    expect(long.railCuts).toEqual([4970, 1000]);
    expect(long.parts.loose).toContainEqual(['609', 2]);
  });
});

describe('Byggeregel X9: suggesting a standard length', () => {
  const f = (railCuts: number[], nCorners = 0) => ({ length: railCuts.reduce((a, x) => a + x, 0), nCorners, railCuts });
  it('a cut frame gets the nearest standard length on each side', () => {
    expect(lengthKind(f([2500]))).toBe('kapp');
    expect(standardChoices(f([2500]), 250)).toEqual([2040, 2540]);
    expect(standardChoices(f([3000]), 250)).toEqual([2970, 3040]);
    expect(standardChoices(f([250]), 250)).toEqual([470]);
  });
  it('none for a standard frame, or one that is always cut (92LTX corner, spliced)', () => {
    expect(lengthKind(f([2970]))).toBe('standard');
    expect(standardChoices(f([2970]), 250)).toEqual([]);
    expect(lengthKind(f([2463], 1))).toBeNull();
    expect(lengthKind(f([4970, 1030]))).toBeNull();
  });
});
