// Felles plateregel, trinn A1 and A2 (Bjørn 18.11.2026). A1: every plate the stand has, from what is built, counted the
// same as the picking list counts it. A2: how well each way of addressing a plate (`id` by where it stands in the plan,
// `local` by its owner) survives the edits the app makes, measured on the example sketches; the numbers are kept as a
// snapshot (plates.test.ts.snap) and summed up in the PR. B1: how many colours the decor register carries through them.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { indexCatalog, placeContext } from '../catalog/lookup';
import { bom } from '../foga/engine';
import { bomSizes, fromVariant } from '../foga/fromVariant';
import { RECIPES } from '../foga/recipes';
import { parse } from '../persistence/file';
import { RULES } from '../rules/rules';
import { stockOf } from './podiumStock';
import { counterRal, moveObject, rotateObject } from './objects';
import { placeOpening, removeOpening } from './doors';
import { eraseWalls, moveWall, paintWalls } from './edit';
import { wallModules } from './grid';
import { standPlates, type Plate } from './plates';
import { setSectionHeight } from './podiums';
import { setPodiumShelf } from './podiumShelves';
import { moveRoom, resizeRoom } from './rooms';
import type { Variant } from './types';
import { stretchWall } from './wallEnds';
import { builtModules, isStandWall } from './walls';
import { carryDecor, colourPlates, setLeafRal } from './plateDecor';

const TEXTS = import.meta.glob<string>('../test/fixtures/*.json', { query: '?raw', import: 'default', eager: true });
const idx = indexCatalog(DEFAULT_CATALOG);
const ctx = placeContext(RULES, DEFAULT_CATALOG);
const look = { isCurtain: (a: string) => idx.byArtnr.get(a)?.product.opening === 'curtain', isCounter: ctx.isCounter, counterRal };
const plates = (v: Variant) => standPlates(v, RULES, look);
const variants = Object.entries(TEXTS)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([f, text]) => {
    const r = parse(text);
    if (!r.ok) throw new Error(r.error);
    return r.sketch.variants.map((v) => ({ name: `${f.replace(/.*\//, '').replace('.json', '')} · ${v.name}`, v }));
  });

describe('A1: every plate of the stand, from what is built', () => {
  it.each(variants.map((x) => [x.name, x.v] as const))('%s: as many plates as the picking list picks', (_n, v) => {
    const list = plates(v);
    const lines = bom(fromVariant(v, RULES), RECIPES, bomSizes(RULES)).lines;
    const qty = (group: string) => lines.filter((l) => l.group === group && l.ral).reduce((n, l) => n + l.qty, 0);
    // A standard counter is picked whole (K22), a door leaf with its door: not loose plates
    const loose = (p: Plate) => {
      const o = 'object' in p.owner ? v.objects.find((x) => x.id === (p.owner as { object: string }).object) : undefined;
      return !!o?.sections && !stockOf(o.sections);
    };
    expect(list.filter((p) => p.kind === 'felt').length).toBe(qty('vegg.plater'));
    expect(list.filter((p) => p.kind === 'header').length).toBe(qty('vegg.dorer'));
    expect(list.filter((p) => 'object' in p.owner && loose(p)).length).toBe(qty('disk.disker'));
  });

  it.each(variants.map((x) => [x.name, x.v] as const))('%s: each address once', (_n, v) => {
    const list = plates(v);
    expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
    expect(new Set(list.map((p) => p.local)).size).toBe(list.length);
  });
});

/** An edit to try on a sketch, or null where the sketch has nothing it applies to. */
interface Edit {
  name: string;
  /** What should happen to the plates: which should keep their decor. */
  expect: string;
  run: (v: Variant) => Variant | null;
}

const innerWall = (v: Variant) => v.walls.find((w) => !isStandWall(w) && !w.room);
const counterOf = (v: Variant) => v.objects.find((o) => o.sections && ctx.isCounter(o.product));
const changed = (v: Variant, next: Variant | null) => (next && next !== v ? next : null);

const EDITS: Edit[] = [
  { name: 'Flytt innervegg 1 m', expect: 'alle beholdes', run: (v) => { const w = innerWall(v); return w ? changed(v, moveWall(v, w.id, 1)) : null; } },
  { name: 'Endegrep innervegg +1 m', expect: 'alle beholdes, én ny', run: (v) => { const w = innerWall(v); return w ? changed(v, stretchWall(v, w.id, 'to', 1) ?? stretchWall(v, w.id, 'from', 1)) : null; } },
  {
    name: 'Ny vegg deler en modul (V10)',
    expect: 'én blir to, resten beholdes',
    run: (v) => {
      const w = innerWall(v) ?? v.walls.find((x) => !x.room);
      const m = w && wallModules(w)[0];
      if (!m) return null;
      const mid: [number, number] = [(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2];
      const far: [number, number] = m.orientation === 'h' ? [mid[0], mid[1] + (mid[1] >= 1 ? -1 : 1)] : [mid[0] + (mid[0] >= 1 ? -1 : 1), mid[1]];
      return changed(v, paintWalls(v, mid, far));
    },
  },
  { name: 'Tøm en modul midt i en vegg', expect: 'én borte, resten beholdes', run: (v) => { const w = innerWall(v) ?? v.walls.find((x) => !x.room); const ms = w ? wallModules(w) : []; return ms.length > 2 ? changed(v, eraseWalls(v, [ms[1].key])) : null; } },
  {
    name: 'Dør inn i en modul',
    expect: 'felt blir overstykke og blad, resten beholdes',
    run: (v) => {
      const w = innerWall(v) ?? v.walls.find((x) => !x.room && !v.openings.some((o) => o.wallId === x.id));
      const m = w && wallModules(w).find((_, i) => !v.openings.some((o) => o.wallId === w.id && o.module === i));
      return m ? changed(v, placeOpening(v, m.a, m.b, '6130', true, null)) : null;
    },
  },
  { name: 'Dør ut', expect: 'overstykke og blad blir felt, resten beholdes', run: (v) => (v.openings[0] ? changed(v, removeOpening(v, v.openings[0].id)) : null) },
  { name: 'Flytt bakrom 1 m', expect: 'alle beholdes', run: (v) => (v.rooms[0] ? changed(v, moveRoom(v, v.rooms[0].id, 1, 0)) : null) },
  { name: 'Gjør bakrom 1 m større', expect: 'alle beholdes, nye kommer til', run: (v) => (v.rooms[0] ? changed(v, resizeRoom(v, v.rooms[0].id, 1, 1)) : null) },
  { name: 'Hylle 500 i disk', expect: 'hver plate blir to', run: (v) => { const o = counterOf(v); return o ? changed(v, setPodiumShelf(v, o.id, o.sections!.map((_, i) => i), 500, true)) : null; } },
  { name: 'Senk disk ett steg', expect: 'alle beholdes, lavere', run: (v) => { const o = counterOf(v); return o ? changed(v, setSectionHeight(v, o.id, o.sections!.map((_, i) => i), Math.min(...o.sections!.map((s) => s.h)) - 250)) : null; } },
  { name: 'Flytt disk 1 m', expect: 'alle beholdes', run: (v) => { const o = counterOf(v); return o ? changed(v, moveObject(v, ctx, o.id, o.x + 1, o.y)) : null; } },
  { name: 'Roter disk 90°', expect: 'alle beholdes', run: (v) => { const o = counterOf(v); return o ? changed(v, rotateObject(v, ctx, o.id)) : null; } },
];

/** Every wall plate and door leaf of v with a colour of its own, so what the decor register carries can be counted. */
function colourAll(v: Variant): Variant {
  const mods = builtModules(v);
  let x = colourPlates(v, mods.map((m) => m.key), RED, () => v.defaultPlate);
  for (const o of v.openings) x = setLeafRal(x, o.id, RED);
  return x;
}
const RED = '3020';
const colouredCount = (v: Variant) => Object.values(v.decor ?? {}).filter((d) => d.ral).length;

/**
 * For one edit over every sketch it applies to: plates before, how many kept their address by each way, how many new;
 * and with every plate coloured (trinn B1): how many colours the register carries through the edit.
 */
function measure(e: Edit) {
  const out = { sketches: 0, before: 0, keptId: 0, keptLocal: 0, after: 0, colours: 0, coloursCarried: 0 };
  for (const { v } of variants) {
    const next = e.run(v);
    if (!next) continue;
    const a = plates(v);
    const b = plates(next);
    const ids = new Set(b.map((p) => p.id));
    const locals = new Set(b.map((p) => p.local));
    out.sketches++;
    out.before += a.length;
    out.after += b.length;
    out.keptId += a.filter((p) => ids.has(p.id)).length;
    out.keptLocal += a.filter((p) => locals.has(p.local)).length;
    const c = colourAll(v);
    out.colours += colouredCount(c);
    out.coloursCarried += colouredCount(carryDecor(c, e.run(c) ?? c));
  }
  return out;
}

describe('A2: how each address survives the edits', () => {
  const rows = EDITS.map((e) => ({ edit: e.name, expect: e.expect, ...measure(e) }));
  it('applies every edit to at least one sketch', () => {
    expect(rows.filter((r) => !r.sketches).map((r) => r.edit)).toEqual([]);
  });
  it('the numbers', () => {
    expect(rows).toMatchSnapshot();
  });
});
