// Shelves in the kalkyle and on the picking list (Byggeregler H2, H3, H7).
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { addShelfRow, shelvesOf, updateShelf } from '../domain/shelves';
import { createVariant } from '../domain/variant';
import { DEFAULT_PRICING, ITEM } from '../pricing/data';
import { RULES } from '../rules/rules';
import { calc } from './calc';

const EXHIBITOR = { payer: 'utstiller', ral: '9010' } as const;
const row = () => createVariant('A', { width: 6, depth: 3, type: 'row' });
const threeInARow = () => addShelfRow(row(), RULES, 'side-back', 1, 3, 1).v;
const item = (id: string) => DEFAULT_PRICING.items.get(id)!;

describe('shelf line (Byggeregel H7)', () => {
  const res = calc(threeInARow(), RULES, DEFAULT_CATALOG, EXHIBITOR);
  const line = res.groups.flatMap((g) => g.lines).find((l) => l.artnr === '6311')!;

  it('one line, 247 kr per shelf alone or in a row', () => {
    expect(line).toMatchObject({ qty: 3, price: 247, sum: 741, unit: 'stk', group: 'hyll.hyller', placeholder: false, foga: true });
  });

  it('costs the brackets as counted, the boards, the work per shelf and the picking once', () => {
    const cost = 2 * item(ITEM.shelfEnd).cost + 2 * item(ITEM.shelfTwin).cost + 3 * item(ITEM.shelfBoard).cost + 3 * item(ITEM.shelfMount).cost + item(ITEM.shelfPick).cost;
    expect(line.cost).toBeCloseTo(cost, 6);
    expect(line.time.montering).toBe(9);
    expect(line.time.plukk).toBe(10);
  });

  it('picking: 91F at the ends, 91FF between, each with its 600, and the boards (Byggeregler H2, H3)', () => {
    const rows = res.bom.lines.filter((l) => l.group === 'hyll.hyller').map((l) => [l.name, l.qty, l.preassembled]);
    expect(rows).toEqual([
      ['Hylleknekt 91F, 290 mm, med 600', 2, true],
      ['Hylleknekt 91FF, 290 mm, med 600', 2, true],
      ['Hobbyplate melamin hvit 18 mm', 3, false],
    ]);
  });

  it('a shelf moved to another height leaves the row: its brackets become ends', () => {
    const v = threeInARow();
    const moved = updateShelf(v, RULES, shelvesOf(v)[2].id, { y: 1.2 });
    const bom = calc(moved, RULES, DEFAULT_CATALOG, EXHIBITOR).bom.lines.filter((l) => l.group === 'hyll.hyller');
    expect(bom.map((l) => l.qty)).toEqual([4, 1, 3]);
  });

  it('no shelves, no line', () => {
    expect(calc(row(), RULES, DEFAULT_CATALOG, EXHIBITOR).groups.flatMap((g) => g.lines).some((l) => l.artnr === '6311')).toBe(false);
  });
});
