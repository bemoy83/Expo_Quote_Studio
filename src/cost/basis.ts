// Kostgrunnlag: everything the cost engine runs on, as one dated and versioned file. The price lists, the parameters
// and the per-order costs. The app ships with an example basis (made-up prices, example numbers); the real one is a
// file loaded in the browser and kept there, later fetched from the OMS (Bjørn 7.11.2026). It is never published.
// What the file leaves out is taken from the example, and the basis says so, so the app can show it. The browser and a
// downloaded file keep only the owner's own numbers: the rest is filled from the app's current example every time it is
// read, so a new example number reaches a stored basis instead of being frozen at the app version that loaded it.
// File: JSON `{ format: 'kostgrunnlag', versjon, kostversjon, dato, kilde, parametere, ordrekost, prislister }`.
// Kostmodell: docs/kostmodell.md.
import { EXAMPLE_LIST } from './example-list';
import { EXAMPLE_OWN_LIST, OWN_SUPPLIER } from './own-list';
import type { OrderCost } from './model';
import { DEFAULT_COST_PARAMS, ORDER_COSTS, type CostParams } from './params';
import type { Currency, SupplierItem, SupplierList } from './prices';

export const BASIS_FORMAT = 'kostgrunnlag';
export const BASIS_FILE_VERSION = 1;

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
  /** What is taken from the example ("prisliste", "parametere.owned.interest"). Empty when nothing is. */
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
  fromExample: ['prisliste', 'parametere', 'ordrekost'],
};

const EXAMPLE_LISTS = [EXAMPLE_LIST, EXAMPLE_OWN_LIST];
const SUPPLIERS = ['Foga', OWN_SUPPLIER] as const;
const supplierIs = (l: SupplierList, supplier: string) => l.supplier.startsWith(supplier);

export const usesExample = (b: CostBasis) => b.fromExample.length > 0;

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
      prislister: b.fromExample.includes('prisliste') ? undefined : b.lists,
    },
    null,
    2,
  );
}

/** A file with every number written out, to fill in: the example's parameters and order costs and both example lists. */
export function basisTemplate(): string {
  const b = EXAMPLE_BASIS;
  return JSON.stringify(
    { format: BASIS_FORMAT, versjon: BASIS_FILE_VERSION, kostversjon: '2026-11 A', dato: b.date, kilde: '', parametere: b.params, ordrekost: b.orderCosts, prislister: b.lists },
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
    return {
      id: o.id,
      name: o.name,
      cost: o.cost as number | undefined,
      baseYear: o.baseYear as number | undefined,
      personMinutes: o.personMinutes as number | undefined,
      ...(o.when ? { when: 'trykk' as const } : {}),
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

/** Read a kostgrunnlag file. What it leaves out comes from the example and is listed in `fromExample`. */
export function parseBasis(text: string): BasisResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Filen er ikke gyldig JSON.' };
  }
  if (!isObj(data) || data.format !== BASIS_FORMAT) return { ok: false, error: 'Filen er ikke et kostgrunnlag.' };
  if (data.versjon !== BASIS_FILE_VERSION) {
    return { ok: false, error: `Kostgrunnlaget har filversjon ${String(data.versjon)}; appen leser versjon ${BASIS_FILE_VERSION}.` };
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
  };
  const fromExample: string[] = [];
  try {
    const params = mergeParams(DEFAULT_COST_PARAMS as unknown as Obj, f.parametere, 'parametere', fromExample) as unknown as CostParams;
    if (f.ordrekost === undefined) fromExample.push('ordrekost');
    const lists = f.prislister === undefined ? EXAMPLE_LISTS : supplierLists(f.prislister);
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
        fromExample: [...new Set(fromExample)],
      },
    };
  } catch (e) {
    if (e instanceof BasisError) return { ok: false, error: e.message };
    throw e;
  }
}
