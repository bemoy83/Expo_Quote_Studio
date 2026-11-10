// Kostgrunnlag: everything the cost engine runs on, as one dated and versioned file. The price lists, the parameters,
// the per-order costs, the minutes and recipe of every price item, and what catalog products without a recipe cost and
// take. Rules (how a drawing becomes quantities) stay in code; every number they price with is here. The app ships with an example basis (made-up prices, example numbers); the real one is a
// file loaded in the browser and kept there, later fetched from the OMS (Bjørn 7.11.2026). It is never published.
// What the file leaves out is taken from the example, and the basis says so, so the app can show it. The browser and a
// downloaded file keep only the owner's own numbers: the rest is filled from the app's current example every time it is
// read, so a new example number reaches a stored basis instead of being frozen at the app version that loaded it.
// File: JSON `{ format: 'kostgrunnlag', versjon, kostversjon, dato, kilde, parametere, ordrekost, prislister, tider,
// oppskrifter, katalog }`. Version 1 files (no tider, oppskrifter, katalog) are read too.
// Kostmodell: docs/kostmodell.md.
import { FOGA_PARTS, type PartKind } from '../foga/parts';
import { EXAMPLE_CATALOG, EXAMPLE_RECIPES, EXAMPLE_TIMES, ITEM_DEFS } from '../pricing/items';
import { HANDLING_STEPS, type Time } from '../pricing/model';
import { EXAMPLE_LIST } from './example-list';
import type { ItemRecipe } from './items';
import { EXAMPLE_OWN_LIST, OWN_SUPPLIER } from './own-list';
import type { OrderCost } from './model';
import { DEFAULT_COST_PARAMS, ORDER_COSTS, type CostParams, type DgGroup } from './params';
import type { Currency, SupplierItem, SupplierList } from './prices';

export const BASIS_FORMAT = 'kostgrunnlag';
export const BASIS_FILE_VERSION = 2;
const READS = [1, 2];

/** Who set a number: Bjørn (confirmed), kalibrert (fitted to real jobs), forslag (a starting value), eksempel. */
export type FieldStatus = 'Bjørn' | 'kalibrert' | 'forslag' | 'eksempel';
export const FIELD_STATUSES: readonly FieldStatus[] = ['Bjørn', 'kalibrert', 'forslag', 'eksempel'];

/** Where one number came from, kept beside it (file `merknader`, by the number's path, e.g. "parametere.indirect"). */
export interface FieldNote {
  status?: FieldStatus;
  /** Free text: "Megaprint faktura okt. 2026". */
  kilde?: string;
  /** When it was last set, YYYY-MM-DD. */
  dato?: string;
}

/** Catalog products without a recipe: cost as a share of the sales price, and minutes per step, by group prefix. */
export interface CatalogRates {
  cost: Readonly<Record<string, number>>;
  time: Readonly<Record<string, Time>>;
}

export interface CostBasis {
  /** The basis' own version, as its owner names it ("2026-11 A"). A quote remembers it. */
  version: string;
  /** When the numbers were set, YYYY-MM-DD. */
  date: string;
  /** Who or what it came from ("Bjørn", "OMS"). */
  source: string;
  params: CostParams;
  orderCosts: readonly OrderCost[];
  lists: readonly SupplierList[];
  /** Person-minutes per unit and handling step, by price item id. */
  times: Readonly<Record<string, Time>>;
  /** What each price item is made of, by price item id. */
  recipes: Readonly<Record<string, ItemRecipe>>;
  catalog: CatalogRates;
  /** Status, source and date per number, where the owner has given them. */
  notes: Readonly<Record<string, FieldNote>>;
  /** What is taken from the example ("prisliste", "parametere.owned.interest", "tider.stolpe-94"). Empty when nothing is. */
  fromExample: readonly string[];
}

/** What a quote remembers about the basis it was calculated with. */
export interface CostBasisRef {
  version: string;
  date: string;
  example: boolean;
  /** Fingerprint of everything the calc ran on (`PricingData.code`, src/pricing/data.ts). Missing in older files. */
  code?: string;
}

export const EXAMPLE_BASIS: CostBasis = {
  version: 'eksempel',
  date: '2026-11-07',
  source: 'Eksempeltall i appen',
  params: DEFAULT_COST_PARAMS,
  orderCosts: ORDER_COSTS,
  lists: [EXAMPLE_LIST, EXAMPLE_OWN_LIST],
  times: EXAMPLE_TIMES,
  recipes: EXAMPLE_RECIPES,
  catalog: EXAMPLE_CATALOG,
  notes: {},
  fromExample: ['prisliste', 'parametere', 'ordrekost', 'tider', 'oppskrifter', 'katalog'],
};

const EXAMPLE_LISTS = [EXAMPLE_LIST, EXAMPLE_OWN_LIST];
const SUPPLIERS = ['Foga', OWN_SUPPLIER] as const;
const supplierIs = (l: SupplierList, supplier: string) => l.supplier.startsWith(supplier);

export const usesExample = (b: CostBasis) => b.fromExample.length > 0;

/** The path of one row in a price list, as fromExample and the Kostgrunnlag page name it. */
export const listRowPath = (supplier: string, artnr: string) => `prisliste ${supplier} ${artnr}`;

/**
 * An own-purchases list (Egne innkjøp) saved before the app had some of its articles, with the example's rows for
 * those filled in, each noted as example numbers (Bjørn 10.11.2026: corner boards were «uten kost» in 2026-11 A). Only
 * this list: a Foga list is a real price list and keeps what it has.
 */
function withExampleRows(lists: readonly SupplierList[], fromExample: string[]): SupplierList[] {
  return lists.map((l) => {
    if (!supplierIs(l, OWN_SUPPLIER)) return l;
    const have = new Set(l.items.map((x) => x.artnr));
    const add = EXAMPLE_OWN_LIST.items.filter((x) => !have.has(x.artnr));
    for (const x of add) fromExample.push(listRowPath(l.supplier, x.artnr));
    return add.length ? { ...l, items: [...l.items, ...add] } : l;
  });
}

/** The lists as the owner wrote them: without the rows withExampleRows filled in. */
const ownRows = (b: CostBasis) =>
  b.lists.map((l) => {
    const items = l.items.filter((x) => !b.fromExample.includes(listRowPath(l.supplier, x.artnr)));
    return items.length === l.items.length ? l : { ...l, items };
  });

export const basisRef = (b: CostBasis, code: string): CostBasisRef => ({ version: b.version, date: b.date, example: usesExample(b), code });

/** Same version and same numbers. A ref without a code (older file) is judged by its version alone. */
export const sameBasis = (a: CostBasisRef, b: CostBasisRef) => a.version === b.version && (!a.code || !b.code || a.code === b.code);

/** The basis' list from this supplier ("Foga", "Egne innkjøp"; the name starts with it), else the example's. */
export const supplierList = (b: CostBasis, supplier = 'Foga'): SupplierList =>
  b.lists.find((l) => supplierIs(l, supplier)) ?? EXAMPLE_LISTS.find((l) => supplierIs(l, supplier)) ?? EXAMPLE_LIST;

/** "2026-11 A, 7.11.2026" and whether it is example numbers, for the screen; with `withCode` its fingerprint after,
 *  "2026-11 A, 7.11.2026 · a3f9", where a ref has one. */
export function basisLabel(b: CostBasis | CostBasisRef, withCode = false): string {
  const [y, m, d] = b.date.split('-').map(Number);
  const when = d ? `${d}.${m}.${y}` : b.date;
  const label = b.version === 'eksempel' ? 'Eksempeltall' : `${b.version}, ${when}`;
  const code = withCode && 'code' in b ? b.code : undefined;
  return code ? `${label} · ${code}` : label;
}

/** A copy of `x` without the parts at these paths ("parametere.owned.interest"; `root` is the first segment). */
function without(x: unknown, root: string, paths: readonly string[]): unknown {
  if (paths.includes(root) || x === undefined) return undefined;
  const at = paths.filter((p) => p.startsWith(`${root}.`)).map((p) => p.slice(root.length + 1).split('.'));
  if (!at.length || !isObj(x)) return x;
  const copy = structuredClone(x);
  for (const keys of at) {
    let o: unknown = copy;
    for (const k of keys.slice(0, -1)) o = isObj(o) ? o[k] : undefined;
    if (isObj(o)) delete o[keys[keys.length - 1]];
  }
  return copy;
}

/** The basis as a file with only its owner's numbers: what is example numbers is left out, and is filled from the
 *  app's example again when read. For the browser and for "Last ned". */
export function serializeBasis(b: CostBasis): string {
  return JSON.stringify(
    {
      format: BASIS_FORMAT,
      versjon: BASIS_FILE_VERSION,
      kostversjon: b.version,
      dato: b.date,
      kilde: b.source,
      parametere: without(b.params, 'parametere', b.fromExample),
      ordrekost: b.fromExample.includes('ordrekost') ? undefined : b.orderCosts,
      prislister: b.fromExample.includes('prisliste') ? undefined : ownRows(b),
      tider: without(b.times, 'tider', b.fromExample),
      oppskrifter: without(b.recipes, 'oppskrifter', b.fromExample),
      katalog: without({ kost: b.catalog.cost, tider: b.catalog.time }, 'katalog', b.fromExample),
      merknader: Object.keys(b.notes).length ? b.notes : undefined,
    },
    null,
    2,
  );
}

/** A file with every number written out, to fill in: the example's parameters and order costs and both example lists. */
export function basisTemplate(): string {
  const b = EXAMPLE_BASIS;
  return JSON.stringify(
    {
      format: BASIS_FORMAT,
      versjon: BASIS_FILE_VERSION,
      kostversjon: '2026-11 A',
      dato: b.date,
      kilde: '',
      parametere: b.params,
      ordrekost: b.orderCosts,
      prislister: b.lists,
      tider: b.times,
      oppskrifter: b.recipes,
      katalog: { kost: b.catalog.cost, tider: b.catalog.time },
    },
    null,
    2,
  );
}

export type BasisResult = { ok: true; basis: CostBasis } | { ok: false; error: string };

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';

/** Thrown inside the parse, caught at the top: the message goes to the user. */
class BasisError extends Error {}
const fail = (msg: string): never => {
  throw new BasisError(msg);
};

/** An index series: year → yearly change. Given as a whole or not at all. */
function indexSeries(x: unknown, path: string): Record<number, number> {
  if (!isObj(x)) return fail(`${path} må være år og endring, for eksempel { "2023": 0.1 }.`);
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(x)) {
    if (!/^\d{4}$/.test(k) || !isNum(v)) return fail(`${path}: ${k} må være et år med en endring som tall.`);
    out[Number(k)] = v;
  }
  return out;
}

const INDEX_KEYS = new Set(['materialIndex', 'labourIndex']);

/** The file's parameters over the example's, key by key, noting every number taken from the example. */
function mergeParams(def: Obj, file: unknown, path: string, fromExample: string[]): Obj {
  if (file === undefined) {
    fromExample.push(path);
    return def;
  }
  if (!isObj(file)) return fail(`${path} må være et objekt.`);
  const out: Obj = {};
  for (const [k, d] of Object.entries(def)) {
    const p = `${path}.${k}`;
    const v = file[k];
    if (INDEX_KEYS.has(k)) {
      if (v === undefined) fromExample.push(p);
      out[k] = v === undefined ? d : indexSeries(v, p);
    } else if (isObj(d)) out[k] = mergeParams(d, v, p, fromExample);
    else if (v === undefined) {
      fromExample.push(p);
      out[k] = d;
    } else if (!isNum(v)) return fail(`${p} må være et tall.`);
    else out[k] = v;
  }
  return out;
}

function orderCosts(x: unknown): OrderCost[] {
  if (!Array.isArray(x)) return fail('ordrekost må være en liste.');
  return x.map((o, i) => {
    const at = `ordrekost ${i + 1}`;
    if (!isObj(o) || !isStr(o.id) || !isStr(o.name)) return fail(`${at} mangler id eller navn.`);
    for (const k of ['cost', 'baseYear', 'personMinutes']) if (o[k] !== undefined && !isNum(o[k])) return fail(`${at}: ${k} må være et tall.`);
    if (o.when !== undefined && o.when !== 'trykk') return fail(`${at}: when kan bare være "trykk".`);
    if (o.workOrder !== undefined && typeof o.workOrder !== 'boolean') return fail(`${at}: workOrder må være true eller false.`);
    return {
      id: o.id,
      name: o.name,
      cost: o.cost as number | undefined,
      baseYear: o.baseYear as number | undefined,
      personMinutes: o.personMinutes as number | undefined,
      ...(o.when ? { when: 'trykk' as const } : {}),
      ...(o.workOrder ? { workOrder: true } : {}),
    };
  });
}

const CURRENCIES: readonly Currency[] = ['NOK', 'SEK'];

function supplierLists(x: unknown): SupplierList[] {
  if (!Array.isArray(x) || !x.length) return fail('prislister må være en liste med minst én prisliste.');
  return x.map((l, i) => {
    const at = `prisliste ${i + 1}`;
    if (!isObj(l) || !isStr(l.supplier) || !isStr(l.name)) return fail(`${at} mangler leverandør eller navn.`);
    if (typeof l.date !== 'string' || !/^\d{4}-\d{2}$/.test(l.date)) return fail(`${at}: dato må være ÅÅÅÅ-MM.`);
    if (!CURRENCIES.includes(l.currency as Currency)) return fail(`${at}: valuta må være ${CURRENCIES.join(' eller ')}.`);
    if (!Array.isArray(l.items) || !l.items.length) return fail(`${at} har ingen artikler.`);
    const items = l.items.map((it, j): SupplierItem => {
      const row = `${at}, artikkel ${j + 1}`;
      if (!isObj(it) || !isStr(it.artnr)) return fail(`${row} mangler art.nr.`);
      if (it.unit !== 'm' && it.unit !== 'm²' && it.unit !== 'stk') return fail(`${row} (${it.artnr}): enhet må være m, m² eller stk.`);
      if (!isNum(it.price) || it.price < 0) return fail(`${row} (${it.artnr}): pris må være et tall.`);
      const broken = it.broken === undefined ? it.price : it.broken;
      if (!isNum(broken)) return fail(`${row} (${it.artnr}): brutt pakke må være et tall.`);
      return {
        artnr: it.artnr,
        name: typeof it.name === 'string' ? it.name : '',
        group: typeof it.group === 'string' ? it.group : '',
        pack: isNum(it.pack) ? it.pack : 1,
        unit: it.unit,
        price: it.price,
        broken,
      };
    });
    return { supplier: l.supplier, name: l.name, date: l.date, currency: l.currency as Currency, items };
  });
}

const STEPS: readonly string[] = HANDLING_STEPS;
const ITEM_IDS = new Set(ITEM_DEFS.map((d) => d.id));
const PART_CODES = new Set(FOGA_PARTS.map((p) => p.code));
const KINDS: readonly PartKind[] = ['profile', 'frame', 'coupling', 'foot', 'accessory', 'plate'];
const DG_GROUPS: readonly DgGroup[] = ['utleie', 'arbeid', 'salg'];
const isQty = (x: unknown): x is number => isNum(x) && x >= 0;

/** Minutes per handling step: { "plukk": 0.34, "montering": 6 }. */
function readTime(x: unknown, at: string): Time {
  if (!isObj(x)) return fail(`${at} må være minutter per steg, for eksempel { "plukk": 1 }.`);
  const out: Time = {};
  for (const [k, v] of Object.entries(x)) {
    if (!STEPS.includes(k)) return fail(`${at}: ${k} er ikke et steg (${STEPS.join(', ')}).`);
    if (!isQty(v)) return fail(`${at}.${k} må være minutter, et tall.`);
    out[k as keyof Time] = v;
  }
  return out;
}

/** A recipe: { "parts": [["94", 2.49]], "own": [["HDF-976x2440", 1, "plate"]], "bought": [["TRYKK-BLACKBACK", 1]], "dg": "utleie" }. */
function readRecipe(x: unknown, at: string): ItemRecipe {
  if (!isObj(x)) return fail(`${at} må være en oppskrift.`);
  if (!DG_GROUPS.includes(x.dg as DgGroup)) return fail(`${at}: dg må være ${DG_GROUPS.join(', ')}.`);
  const rows = (key: string, n: number): unknown[][] => {
    const v = x[key];
    if (v === undefined) return [];
    if (!Array.isArray(v) || !v.every((r) => Array.isArray(r) && r.length === n)) return fail(`${at}.${key} må være en liste med [${n === 3 ? 'art.nr, mengde, gruppe' : 'kode, mengde'}].`);
    return v as unknown[][];
  };
  const parts = rows('parts', 2).map(([code, qty]): readonly [string, number] => {
    if (!isStr(code) || !PART_CODES.has(code)) return fail(`${at}.parts: ${String(code)} er ikke en Foga-del appen kjenner.`);
    if (!isQty(qty)) return fail(`${at}.parts: mengden for ${code} må være et tall.`);
    return [code, qty];
  });
  const own = rows('own', 3).map(([artnr, qty, kind]): readonly [string, number, PartKind] => {
    if (!isStr(artnr) || !isQty(qty)) return fail(`${at}.own: art.nr og mengde mangler.`);
    if (!KINDS.includes(kind as PartKind)) return fail(`${at}.own: gruppen for ${artnr} må være ${KINDS.join(', ')}.`);
    return [artnr, qty, kind as PartKind];
  });
  const bought = rows('bought', 2).map(([artnr, qty]): readonly [string, number] => {
    if (!isStr(artnr) || !isQty(qty)) return fail(`${at}.bought: art.nr og mengde mangler.`);
    return [artnr, qty];
  });
  return { ...(parts.length ? { parts } : {}), ...(own.length ? { own } : {}), ...(bought.length ? { bought } : {}), dg: x.dg as DgGroup };
}

/** Per price item: the file's entry where it has one, else the example's, noted. A file without the part at all takes
 *  the example's whole. An id that is not a price item is refused, so a typo does not go unnoticed. */
function byItem<T>(x: unknown, key: string, example: Readonly<Record<string, T>>, read: (v: unknown, at: string) => T, fromExample: string[]): Readonly<Record<string, T>> {
  if (x === undefined) {
    fromExample.push(key);
    return example;
  }
  if (!isObj(x)) return fail(`${key} må være et objekt med prisartikler.`);
  const out: Record<string, T> = {};
  for (const [id, v] of Object.entries(x)) {
    if (!ITEM_IDS.has(id)) return fail(`${key}: ${id} er ikke en prisartikkel.`);
    out[id] = read(v, `${key}.${id}`);
  }
  for (const [id, v] of Object.entries(example)) {
    if (id in out) continue;
    out[id] = v;
    fromExample.push(`${key}.${id}`);
  }
  return out;
}

/** katalog: { kost: { "mob.": 0.55 }, tider: { "mob.": { "plukk": 1 } } }, each given whole or taken from the example. */
function catalogRates(x: unknown, fromExample: string[]): CatalogRates {
  if (x === undefined) {
    fromExample.push('katalog');
    return EXAMPLE_CATALOG;
  }
  if (!isObj(x)) return fail('katalog må være et objekt.');
  let cost = EXAMPLE_CATALOG.cost;
  if (x.kost === undefined) fromExample.push('katalog.kost');
  else {
    if (!isObj(x.kost)) return fail('katalog.kost må være andel av salgsprisen per gruppe, for eksempel { "mob.": 0.55 }.');
    for (const [g, v] of Object.entries(x.kost)) if (!isNum(v) || v < 0 || v > 1) return fail(`katalog.kost.${g} må være en andel mellom 0 og 1.`);
    cost = x.kost as Record<string, number>;
  }
  let time = EXAMPLE_CATALOG.time;
  if (x.tider === undefined) fromExample.push('katalog.tider');
  else {
    if (!isObj(x.tider)) return fail('katalog.tider må være minutter per steg per gruppe.');
    time = Object.fromEntries(Object.entries(x.tider).map(([g, v]) => [g, readTime(v, `katalog.tider.${g}`)]));
  }
  return { cost, time };
}

function readNotes(x: unknown): Record<string, FieldNote> {
  if (x === undefined) return {};
  if (!isObj(x)) return fail('merknader må være et objekt med en merknad per tall.');
  return Object.fromEntries(
    Object.entries(x).map(([path, n]) => {
      if (!isObj(n)) return fail(`merknader.${path} må være et objekt.`);
      if (n.status !== undefined && !FIELD_STATUSES.includes(n.status as FieldStatus)) return fail(`merknader.${path}: status må være ${FIELD_STATUSES.join(', ')}.`);
      if (n.dato !== undefined && (typeof n.dato !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(n.dato))) return fail(`merknader.${path}: dato må være ÅÅÅÅ-MM-DD.`);
      const note: FieldNote = {
        ...(n.status ? { status: n.status as FieldStatus } : {}),
        ...(isStr(n.kilde) ? { kilde: n.kilde } : {}),
        ...(n.dato ? { dato: n.dato as string } : {}),
      };
      return [path, note];
    }),
  );
}

/** Read a kostgrunnlag file. What it leaves out comes from the example and is listed in `fromExample`. */
export function parseBasis(text: string): BasisResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Filen er ikke gyldig JSON.' };
  }
  if (!isObj(data) || data.format !== BASIS_FORMAT) return { ok: false, error: 'Filen er ikke et kostgrunnlag.' };
  if (!READS.includes(data.versjon as number)) {
    return { ok: false, error: `Kostgrunnlaget har filversjon ${String(data.versjon)}; appen leser versjon ${READS.join(' og ')}.` };
  }
  if (!isStr(data.kostversjon)) return { ok: false, error: 'Kostgrunnlaget mangler kostversjon (for eksempel "2026-11 A").' };
  if (data.kostversjon === EXAMPLE_BASIS.version) return { ok: false, error: '«eksempel» er appens egne tall; gi kostgrunnlaget en annen kostversjon.' };
  if (typeof data.dato !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.dato)) return { ok: false, error: 'dato må være ÅÅÅÅ-MM-DD.' };
  // A basis stored before the browser kept only own numbers wrote everything out, with `fraEksempel` saying which were
  // example numbers. Those are dropped here, so they come from the current example like the rest
  const old: string[] = Array.isArray(data.fraEksempel) ? data.fraEksempel.filter(isStr) : [];
  const f: Obj = {
    ...data,
    parametere: without(data.parametere, 'parametere', old),
    ordrekost: old.includes('ordrekost') ? undefined : data.ordrekost,
    prislister: old.includes('prisliste') ? undefined : data.prislister,
    tider: without(data.tider, 'tider', old),
    oppskrifter: without(data.oppskrifter, 'oppskrifter', old),
    katalog: without(data.katalog, 'katalog', old),
  };
  const fromExample: string[] = [];
  try {
    const params = mergeParams(DEFAULT_COST_PARAMS as unknown as Obj, f.parametere, 'parametere', fromExample) as unknown as CostParams;
    if (f.ordrekost === undefined) fromExample.push('ordrekost');
    const lists = f.prislister === undefined ? EXAMPLE_LISTS : withExampleRows(supplierLists(f.prislister), fromExample);
    if (f.prislister === undefined) fromExample.push('prisliste');
    // By the names the engine looks the lists up by (`supplierList`), so a list named just "Foga" counts
    else for (const name of SUPPLIERS) if (!lists.some((l) => supplierIs(l, name))) fromExample.push(`prisliste ${name}`);
    return {
      ok: true,
      basis: {
        version: data.kostversjon,
        date: data.dato,
        source: isStr(data.kilde) ? data.kilde : '',
        params,
        orderCosts: f.ordrekost === undefined ? ORDER_COSTS : orderCosts(f.ordrekost),
        lists,
        times: byItem(f.tider, 'tider', EXAMPLE_TIMES, readTime, fromExample),
        recipes: byItem(f.oppskrifter, 'oppskrifter', EXAMPLE_RECIPES, readRecipe, fromExample),
        catalog: catalogRates(f.katalog, fromExample),
        notes: readNotes(data.merknader),
        fromExample: [...new Set(fromExample)],
      },
    };
  } catch (e) {
    if (e instanceof BasisError) return { ok: false, error: e.message };
    throw e;
  }
}
