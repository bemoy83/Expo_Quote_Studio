// Byggeregel V14 (Bjørn 15.11.2026): the stand is in whole and half metres. The metre grid starts in the back left
// corner, so the half metre lies toward the right and the front; a stand wall's half metre is sold by the metre, the
// organiser's too, while an inner wall's short module stays its own product per piece (V1).
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { paintWalls } from '../domain/edit';
import { cellsUpTo, metreLines } from '../domain/grid';
import { createVariant } from '../domain/variant';
import { builtModules } from '../domain/walls';
import { RULES } from '../rules/rules';
import { calc } from './calc';

const EXHIBITOR = { payer: 'utstiller', ral: '9010' } as const;
const ORGANISER = { payer: 'arrangør', ral: '9010' } as const;
const row = createVariant('A', { width: 3.5, depth: 2.5, type: 'row' });
const lines = (r: ReturnType<typeof calc>) => r.groups.flatMap((g) => g.lines);

describe('Byggeregel V14: a stand of 3,5 × 2,5', () => {
  it('V14 lays the stand walls in whole metres from the back left corner, the half metre last', () => {
    const half = builtModules(row).filter((m) => m.cc < 1);
    expect(half.map((m) => [m.a, m.b])).toEqual([
      [[3, 0], [3.5, 0]],
      [[0, 2], [0, 2.5]],
      [[3.5, 2], [3.5, 2.5]],
    ]);
  });

  it('V14 sells the exhibitor\'s stand walls by the metre, the half metres too', () => {
    const r = calc(row, RULES, DEFAULT_CATALOG, EXHIBITOR);
    const walls = lines(r).filter((l) => l.meta?.startsWith('Standvegg'));
    expect(walls.map((l) => [l.artnr, l.qty, l.unit])).toEqual([['6120-9010', 8.5, 'lm']]);
    expect(r.keyFigures).toMatchObject({ area: 8.75, standWallLm: 8.5 });
  });

  it('V14 bills the organiser 8,5 lm', () => {
    const r = calc(row, RULES, DEFAULT_CATALOG, ORGANISER);
    expect(r.organiser.lines.filter((l) => l.meta?.startsWith('Standvegg')).map((l) => [l.artnr, l.qty])).toEqual([['6120-9010', 8.5]]);
  });

  it('V14 keeps an inner wall\'s short module per piece (V1)', () => {
    const v = paintWalls(row, [1, 1], [2.5, 1]);
    const inner = lines(calc(v, RULES, DEFAULT_CATALOG, EXHIBITOR)).filter((l) => l.meta?.startsWith('Innervegg'));
    expect(inner.map((l) => [l.artnr, l.qty])).toEqual([['6120-9010', 1], ['6122-9010', 1]]);
  });

  it('V14 draws the metre grid on every whole metre inside the stand', () => {
    expect(metreLines(3.5)).toEqual([1, 2, 3]);
    expect(metreLines(4)).toEqual([1, 2, 3]);
    expect(metreLines(1)).toEqual([]);
    expect(metreLines(1.5)).toEqual([1]);
    expect(cellsUpTo(3.5)).toEqual([[0, 1], [1, 2], [2, 3], [3, 3.5]]);
    expect(cellsUpTo(1, 0.25)).toEqual([[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]]);
  });
});
