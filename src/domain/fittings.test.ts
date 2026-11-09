import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { fittingBlocked, fittingFelts } from './fittings';
import { shelfBlocked } from './shelves/model';
import { addTextile } from './textile/inFrame';
import type { Variant } from './types';
import { createVariant } from './variant';

const row = (): Variant => createVariant('A', { width: 6, depth: 3, type: 'row' });

describe('wall fittings in the posts\' face channels (Byggeregel H1, H6)', () => {
  it('a corner post holds no fitting on the inside, the felts between do', () => {
    const v = row();
    expect(fittingBlocked(v, 'side-back', 0, 1)).toMatch(/kanal/);
    expect(fittingBlocked(v, 'side-back', 2, 1)).toBeNull();
  });

  it('names the fitting in the reason, and shelves follow the same rules', () => {
    const v = addTextile(row(), RULES, 'side-back', 1, 1.5)!.v;
    expect(fittingBlocked(v, 'side-back', 1, 1)).toMatch(/Tekstilveggen/);
    for (let m = 0; m < 6; m++) expect(shelfBlocked(v, 'side-back', m, 1)).toBe(fittingBlocked(v, 'side-back', m, 1, 'Hylle'));
    expect(fittingBlocked(row(), 'side-back', 2, -1, 'Heng')).toBe('Heng kan ikke stå på denne siden av veggen');
  });

  it('fills a face from the middle out', () => {
    const felts = fittingFelts(row(), 'side-back', 1);
    expect(felts.length).toBeGreaterThan(1);
    const mid = (m: number) => Math.abs(m + 0.5 - 3);
    for (let i = 1; i < felts.length; i++) expect(mid(felts[i])).toBeGreaterThanOrEqual(mid(felts[i - 1]));
  });
});
