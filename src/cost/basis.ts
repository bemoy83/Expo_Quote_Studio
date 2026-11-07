// Kostgrunnlag: everything the cost engine runs on, as one dated and versioned file. The price lists, the parameters
// and the per-order costs. The app ships with an example basis (made-up prices, example numbers); the real one is a
// file loaded in the browser and kept there, later fetched from the OMS (Bjørn 7.11.2026). It is never published.
// What the file leaves out is taken from the example, and the basis says so, so the app can show it.
// File: JSON `{ format: 'kostgrunnlag', versjon, kostversjon, dato, kilde, parametere, ordrekost, prislister, fraEksempel }`.
// Kostmodell: docs/kostmodell.md.
import { EXAMPLE_LIST } from './example-list';
import { EXAMPLE_OWN_LIST } from './own-list';
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
const supplierIs = (l: SupplierList, supplier: string) => l.supplier.startsWith(supplier);

export const usesExample = (b: CostBasis) => b.fromExample.length > 0;

export const basisRef = (b: CostBasis): CostBasisRef => ({ version: b.version, date: b.date, example: usesExample(b) });

/** The basis' list from this supplier ("Foga", "Egne innkjøp"; the name starts with it), else the example's. */
export const supplierList = (b: CostBasis, supplier = 'Foga'): SupplierList =>
  b.lists.find((l) => supplierIs(l, supplier)) ?? EXAMPLE_LISTS.find((l) => supplierIs(l, supplier)) ?? EXAMPLE_LIST;

/** "2026-11 A, 7.11.2026" and whether it is example numbers, for the screen. */
export function basisLabel(b: CostBasis | CostBasisRef): string {
  const [y, m, d] = b.date.split('-').map(Number);
  const when = d ? `${d}.${m}.${y}` : b.date;
  return b.version === 'eksempel' ? 'Eksempeltall' : `${b.version}, ${when}`;
}

export function serializeBasis(b: CostBasis): string {
  return JSON.stringify(
    {
      format: BASIS_FORMAT,
      versjon: BASIS_FILE_VERSION,
      kostversjon: b.version,
      dato: b.date,
      kilde: b.source,
      parametere: b.params,
      ordrekost: b.orderCosts,
      prislister: b.lists,
      // Written out so a downloaded basis still says what in it is example numbers
      fraEksempel: b.fromExample,
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
    return { id: o.id, name: o.name, cost: o.cost as number | undefined, baseYear: o.baseYear as number | undefined, personMinutes: o.personMinutes as number | undefined };
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
      if (it.unit !== 'm' && it.unit !== 'stk') return fail(`${row} (${it.artnr}): enhet må være m eller stk.`);
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
  const fromExample: string[] = Array.isArray(data.fraEksempel) ? data.fraEksempel.filter(isStr) : [];
  try {
    const params = mergeParams(DEFAULT_COST_PARAMS as unknown as Obj, data.parametere, 'parametere', fromExample) as unknown as CostParams;
    if (data.ordrekost === undefined) fromExample.push('ordrekost');
    const lists = data.prislister === undefined ? EXAMPLE_LISTS : supplierLists(data.prislister);
    if (data.prislister === undefined) fromExample.push('prisliste');
    else for (const ex of EXAMPLE_LISTS) {
      const name = ex.supplier.replace(/ \(.*\)$/, '');
      if (!lists.some((l) => supplierIs(l, name))) fromExample.push(`prisliste ${name}`);
    }
    return {
      ok: true,
      basis: {
        version: data.kostversjon,
        date: data.dato,
        source: isStr(data.kilde) ? data.kilde : '',
        params,
        orderCosts: data.ordrekost === undefined ? ORDER_COSTS : orderCosts(data.ordrekost),
        lists,
        fromExample: [...new Set(fromExample)],
      },
    };
  } catch (e) {
    if (e instanceof BasisError) return { ok: false, error: e.message };
    throw e;
  }
}
