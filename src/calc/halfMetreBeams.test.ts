// Byggeregel V14 (Bjørn 15.11.2026): a stand in half metres keeps the takdrager rules. The standard takdrager along an
// open side is split in whole metres with the half metre last (T2, T18), a cross beam from a joint the same way, the
// støttedrager stays 3 m from the corner (T7) and free-standing stand walls get their foot plates (S2).
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { createVariant } from '../domain/variant';
import type { Point, Stand, Variant } from '../domain/types';
import { RULES } from '../rules/rules';
import { calc } from './calc';

const EXHIBITOR = { payer: 'utstiller', ral: '9010' } as const;
const run = (stand: Stand, extra: Partial<Variant> = {}) => calc({ ...createVariant('A', stand), ...extra }, RULES, DEFAULT_CATALOG, EXHIBITOR);
const segs = (r: ReturnType<typeof calc>, pick: (s: { cross: boolean; support?: boolean }) => boolean) =>
  r.beams.segments.filter(pick).map((s) => [s.from, s.to, s.length] as [Point, Point, number]);

describe('Byggeregel V14 with the takdrager rules', () => {
  it('V14 T18 splits a front of 6,5 in whole metres, the half metre last', () => {
    const r = run({ width: 6.5, depth: 4, type: 'row' });
    expect(segs(r, (s) => !s.cross)).toEqual([
      [[0, 4], [3, 4], 3],
      [[3, 4], [6.5, 4], 3.5],
    ]);
    expect(segs(r, (s) => s.cross)).toEqual([[[3, 4], [3, 0], 4]]);
  });

  it('V14 T18 lays the open side of a corner stand of 4,5 × 3,5 as one length each', () => {
    const r = run({ width: 4.5, depth: 3.5, type: 'corner', cornerSide: 'right' });
    expect(segs(r, () => true)).toEqual([
      [[4.5, 0], [4.5, 3.5], 3.5],
      [[0, 3.5], [4.5, 3.5], 4.5],
    ]);
    expect(r.keyFigures).toMatchObject({ beamLm: 8, beamLengths: 4 });
  });

  it('V14 T7 puts the støttedrager 3 m from the corner on a side wall of 6,5', () => {
    const r = run({ width: 12.5, depth: 6.5, type: 'row' });
    expect(segs(r, (s) => !!s.support)).toEqual([
      [[0, 3], [4, 3], 4],
      [[12.5, 3], [8, 3], 4.5],
    ]);
  });

  it('V14 S2 gives free-standing stand walls of 6,5 their foot plates', () => {
    const r = run({ width: 6.5, depth: 3, type: 'row' }, { noBeams: true });
    expect(r.wallSupports.map((s) => s.at)).toEqual([[2, 0], [4, 0], [0, 3], [6.5, 3]]);
  });
});
