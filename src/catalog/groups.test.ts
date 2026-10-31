import { describe, expect, it } from 'vitest';
import { calc } from '../calc/calc';
import { r2 } from '../calc/referenceStands';
import { BOM_GROUP } from '../foga/engine';
import { RULES } from '../rules/rules';
import { DEFAULT_CATALOG } from './defaultCatalog';
import { FALLBACK_SUBGROUP, groupItems, isSubgroup, mainGroupOf, PRODUCT_GROUPS, subgroupByName } from './groups';

describe('product grouping', () => {
  it('every catalog product and every Foga part points to a subgroup in the tree', () => {
    expect(DEFAULT_CATALOG.products.filter((p) => !isSubgroup(p.group)).map((p) => p.id)).toEqual([]);
    expect(Object.values(BOM_GROUP).filter((g) => !isSubgroup(g))).toEqual([]);
    expect(isSubgroup(FALLBACK_SUBGROUP)).toBe(true);
  });

  it('ids and names are unique', () => {
    const subs = PRODUCT_GROUPS.flatMap((g) => g.subgroups);
    expect(new Set(PRODUCT_GROUPS.map((g) => g.name)).size).toBe(PRODUCT_GROUPS.length);
    expect(new Set(subs.map((s) => s.id)).size).toBe(subs.length);
    expect(subs.every((s) => mainGroupOf(s.id) === s.id.split('.')[0])).toBe(true);
  });

  it('groupItems follows tree order and keeps item order inside a subgroup', () => {
    const items = [
      { g: 'tjen.lose', n: 1 },
      { g: 'mob.sitte', n: 2 },
      { g: 'vegg.stolper', n: 3 },
      { g: 'mob.bord', n: 4 },
      { g: 'mob.sitte', n: 5 },
      { g: 'ukjent', n: 6 },
    ];
    const out = groupItems(items, (x) => x.g);
    expect(out.map((x) => x.group.id)).toEqual(['vegg', 'mob', 'tilb', 'tjen']);
    expect(out[1].subgroups.map((s) => [s.subgroup.id, s.items.map((i) => i.n)])).toEqual([
      ['mob.bord', [4]],
      ['mob.sitte', [2, 5]],
    ]);
  });

  it('finds a subgroup by name, or the first subgroup of a main group', () => {
    expect(subgroupByName('dører og forheng')).toBe('vegg.dorer');
    expect(subgroupByName('Tepper og gulv')).toBe('gulv.belegg');
    expect(subgroupByName('Annet')).toBeUndefined();
  });

  it('the calc groups R2 in tree order: walls, then textile under Profilering', () => {
    const res = calc(r2(), RULES, DEFAULT_CATALOG);
    expect(res.groups.map((g) => g.name)).toEqual(['Vegger og bakrom', 'Profilering']);
    expect(res.groups.flatMap((g) => g.lines).every((l) => isSubgroup(l.group))).toBe(true);
  });
});
