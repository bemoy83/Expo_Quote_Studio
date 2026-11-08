// Safety net for refactoring (docs/kodekart.md): the example sketches in fixtures/ are saved sketch files, read the way
// the app reads them. For each, everything the app derives without React is kept as a snapshot: the calculation, the
// quote lines, the picking list, the production rows and the engangsteppe cut list. A refactor that changes nothing
// keeps every snapshot. Never update them (vitest -u) as part of a refactor: a difference is a bug until explained.
// The work order and the drawings are covered by the screenshot script (scripts/shots.mjs).
import { describe, expect, it } from 'vitest';
import { calc } from '../calc/calc';
import { foilRows, production, textileRows } from '../calc/production';
import { quoteGroups } from '../calc/quoteLines';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { indexCatalog } from '../catalog/lookup';
import { lanesOf, rollPieces } from '../domain/floor/lanes';
import { customerName, standWallTerms } from '../domain/variant';
import { parse, serialize } from '../persistence/file';
import { RULES } from '../rules/rules';
import { cutRows } from '../ui/cutList';
import { pickRows } from '../ui/workorder/pickRows';

const TEXTS = import.meta.glob<string>('./fixtures/*.json', { query: '?raw', import: 'default', eager: true });
const FILES = Object.keys(TEXTS).sort();
const idx = indexCatalog(DEFAULT_CATALOG);

const read = (f: string) => {
  const text = TEXTS[f];
  const res = parse(text);
  if (!res.ok) throw new Error(`${f}: ${res.error}`);
  return { text, sketch: res.sketch };
};

it('has the example sketches', () => {
  expect(FILES.length).toBeGreaterThanOrEqual(10);
});

describe.each(FILES.map((f) => [f.replace('./fixtures/', ''), f]))('%s', (_name, f) => {
  const { text, sketch } = read(f);

  it('saved format: opens and saves back to the same file', () => {
    expect(serialize(sketch) + '\n').toBe(text);
  });

  describe.each(sketch.variants.map((v) => [v.name, v] as const))('variant %s', (_, v) => {
    const res = calc(v, RULES, DEFAULT_CATALOG, standWallTerms(sketch.project));
    const customer = customerName(sketch.project);

    it('calculation', () => {
      expect(res).toMatchSnapshot();
    });
    it('quote lines', () => {
      expect(quoteGroups(res.groups)).toMatchSnapshot();
    });
    it('picking list', () => {
      expect(pickRows(res)).toMatchSnapshot();
    });
    it('production: textile and print rows', () => {
      const p = production(v, RULES, customer);
      expect({ production: p, textile: textileRows(p), foil: foilRows(v, RULES.wall.plate, customer) }).toMatchSnapshot();
    });
    it('engangsteppe cut list', () => {
      const products = [...new Set(v.floor.tiles.filter((t) => t.roll).map((t) => t.product))];
      const cuts = products.map((a) => {
        const roll = idx.byArtnr.get(a)!.product.roll!;
        return { artnr: a, rows: cutRows(rollPieces(lanesOf(v.floor.tiles, a, roll)), roll) };
      });
      expect(cuts).toMatchSnapshot();
    });
  });
});
