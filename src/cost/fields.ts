// Every number in a kostgrunnlag as a field: what it is, its unit, whether it is the owner's or the app's example,
// its status, source and date, and how to write a new value into the file. The Kostgrunnlag page shows these, and edits
// go through `put`, then the file is read again, so an edit takes the same road as a loaded file. A test checks that
// every parameter the engine has is listed here: a number that is not on the page does not exist. docs/kostmodell.md.
import { FOGA_PARTS, type PartKind } from '../foga/parts';
import { ITEM_DEFS } from '../pricing/items';
import { HANDLING_STEPS, type HandlingStep } from '../pricing/model';
import { EXAMPLE_BASIS, listRowPath, parseBasis, serializeBasis, supplierList, type BasisResult, type CostBasis, type FieldNote, type FieldStatus } from './basis';
import { EXAMPLE_LIST } from './example-list';
import { EXAMPLE_OWN_LIST, OWN_SUPPLIER } from './own-list';
import type { CostParams } from './params';
import type { SupplierList } from './prices';

export type FieldTab = 'innkjop' | 'avskrivning' | 'arbeid' | 'ordrekost' | 'paslag' | 'katalog' | 'oppskrifter';

export const FIELD_TABS: readonly { id: FieldTab; name: string }[] = [
  { id: 'innkjop', name: 'Innkjøp' },
  { id: 'avskrivning', name: 'Avskrivning' },
  { id: 'arbeid', name: 'Arbeid og tider' },
  { id: 'ordrekost', name: 'Ordrekost' },
  { id: 'paslag', name: 'Påslag og DG' },
  { id: 'katalog', name: 'Katalog' },
  { id: 'oppskrifter', name: 'Oppskrifter' },
];

type Obj = Record<string, unknown>;

export interface Field {
  /** Where it is in the kostgrunnlag, as «Slik er det regnet» names it ("parametere.owned.interest"). */
  path: string;
  tab: FieldTab;
  /** Heading it is listed under in its tab. */
  group: string;
  label: string;
  value: number;
  /** kr, %, år, bruk i året, personmin, kr/t, m, stk. A share (0,05) is shown as % when the unit is '%'. */
  unit: string;
  /** The owner's own number (from the file or an edit), not the app's example. */
  own: boolean;
  status: FieldStatus;
  source: string;
  date: string;
  /** Cost rule the number belongs to (1–6, docs/kostmodell.md), when it is one of them. */
  rule?: number;
  /** In the kostgrunnlag, not used by the calc yet. */
  unused?: boolean;
  /** A price in a supplier's list: which list and article. */
  list?: { supplier: string; artnr: string };
  /** Writes `v` into a kostgrunnlag file (the shape serializeBasis writes), as the owner's number. */
  put: (file: Obj, v: number) => void;
}

/** What the app's example numbers are, per path prefix: status and source (from the comments in params.ts and the
 *  decisions recorded there). The longest matching prefix wins. */
const EXAMPLE_NOTES: Readonly<Record<string, Required<Pick<FieldNote, 'status' | 'kilde'>>>> = {
  parametere: { status: 'eksempel', kilde: 'Eksempeltall i appen' },
  'parametere.rates': { status: 'forslag', kilde: 'Plassholder, ikke en ekte kurs' },
  'parametere.freightShare': { status: 'forslag', kilde: 'Ikke sjekket (kanskje 1 700 kr per Foga-ordre)' },
  'parametere.materialIndex': { status: 'Bjørn', kilde: 'Bjørns kalkulator' },
  'parametere.labourIndex': { status: 'eksempel', kilde: 'Som materialindeksen til ekte tall finnes' },
  'parametere.owned.groups': { status: 'kalibrert', kilde: 'Kalibrert mot tre stander og katalogens tekstilvegger 7.11.2026' },
  'parametere.owned.interest': { status: 'forslag', kilde: 'Startverdi' },
  'parametere.owned.lossPerUse': { status: 'forslag', kilde: 'Startverdi' },
  'parametere.cut': { status: 'forslag', kilde: 'Startverdi' },
  'parametere.boughtWaste': { status: 'forslag', kilde: 'Startverdi' },
  'parametere.labour.baseRate': { status: 'Bjørn', kilde: 'Bjørn 7.11.2026, 2022-nivå' },
  'parametere.labour.baseYear': { status: 'Bjørn', kilde: 'Bjørn 7.11.2026' },
  'parametere.labour.overtimeSurcharge': { status: 'Bjørn', kilde: 'Bjørn 7.11.2026' },
  'parametere.labour.billableShare': { status: 'forslag', kilde: 'Startverdi' },
  'parametere.labour.wageShare': { status: 'forslag', kilde: 'Startverdi' },
  'parametere.indirect': { status: 'Bjørn', kilde: 'Bjørn 7.11.2026: katalog = kalkulator + 10 % administrasjon' },
  'parametere.dg': { status: 'eksempel', kilde: 'Bjørns kalkulator (påslag 300 / 125 / 30 %)' },
  'parametere.height.limit': { status: 'Bjørn', kilde: 'Bjørn 7.11.2026: over 3 m når ikke en 5-trinns stige' },
  'parametere.height': { status: 'forslag', kilde: 'Startverdi' },
  'parametere.carpet': { status: 'forslag', kilde: 'Startverdi, ikke godkjent' },
  ordrekost: { status: 'Bjørn', kilde: 'Bjørns kalkulator' },
  tider: { status: 'forslag', kilde: 'Første anslag' },
  oppskrifter: { status: 'forslag', kilde: 'Fra Foga-oppbygningen i appen' },
  katalog: { status: 'eksempel', kilde: 'Eksempeltall til OMS gir dem per produkt' },
  prisliste: { status: 'eksempel', kilde: 'Oppdiktede priser' },
};

/** Wall and takdrager items: their times are calibrated against three stands (7.11.2026); textile frame work too. */
const CALIBRATED_TIMES = new Set(['stolpe-94', 'skinne-92-960', 'skinne-91-960', 'veggplate', 'veggplate-overstykke', 'dor', 'forheng', 'montering-modul', 'montering-stotteplate', 'platebytte', 'fotplate-750', 'montering-takdrager', 'montering-takdragerstolpe', 'skjot-takdrager', 'handtering-ramme', 'montering-ramme-kobling', 'montering-tekstil-omkrets', 'stag-90-stk'])

function exampleNote(path: string): Required<Pick<FieldNote, 'status' | 'kilde'>> {
  if (path.startsWith('tider.') && CALIBRATED_TIMES.has(path.split('.')[1])) return { status: 'kalibrert', kilde: 'Kalibrert mot tre stander 7.11.2026' };
  if (path.startsWith('tider.takdrager-')) return { status: 'kalibrert', kilde: 'Kalibrert mot tre stander 7.11.2026' };
  let best = '';
  for (const k of Object.keys(EXAMPLE_NOTES)) if ((path === k || path.startsWith(`${k}.`) || path.startsWith(`${k} `)) && k.length > best.length) best = k;
  return EXAMPLE_NOTES[best] ?? { status: 'eksempel', kilde: 'Eksempeltall i appen' };
}

/** Is the number at `path` taken from the example? Its path or a parent of it is listed in `fromExample`. */
const fromExample = (b: CostBasis, path: string) => b.fromExample.some((p) => path === p || path.startsWith(`${p}.`));

const KIND_NAME: Record<PartKind, string> = {
  profile: 'Profiler (stolpe, skinne, takdrager)',
  frame: 'Tekstilrammer (43TX, 92LTX, 90)',
  plate: 'Plater',
  coupling: 'Koblinger',
  foot: 'Føtter og fotplater',
  accessory: 'Tilbehør (dør, forheng)',
};
const STEP_NAME: Record<HandlingStep, string> = {
  plukk: 'plukk',
  vask: 'vask',
  transport: 'transport',
  forhåndsmontering: 'forhåndsmontering',
  montering: 'montering',
  demontering: 'demontering',
};

/** Set a value at a dotted path in a plain object, making the objects on the way. */
function setAt(o: Obj, keys: readonly string[], v: unknown) {
  let x = o;
  for (const k of keys.slice(0, -1)) x = (x[k] = typeof x[k] === 'object' && x[k] !== null ? x[k] : {}) as Obj;
  x[keys[keys.length - 1]] = v;
}

interface ParamDef {
  label: string;
  unit: string;
  group: string;
  tab: FieldTab;
  rule?: number;
  unused?: boolean;
}

/** Every scalar parameter, by path under `parametere`. Groups and index years are added from the data. */
const PARAMS: Readonly<Record<string, ParamDef>> = {
  'rates.NOK': { label: 'Kurs NOK', unit: 'NOK', group: 'Valuta og frakt', tab: 'innkjop', rule: 1 },
  'rates.SEK': { label: 'Kurs SEK', unit: 'NOK per SEK', group: 'Valuta og frakt', tab: 'innkjop', rule: 1 },
  freightShare: { label: 'Frakt og toll på innkjøp', unit: '%', group: 'Valuta og frakt', tab: 'innkjop', rule: 1 },
  'owned.interest': { label: 'Rente på bundet kapital, per år', unit: '%', group: 'Rente og tap', tab: 'avskrivning', rule: 1 },
  'owned.lossPerUse': { label: 'Tap og knust per jobb', unit: '%', group: 'Rente og tap', tab: 'avskrivning', rule: 1 },
  'cut.reuse': { label: 'Spesialkapp: andel som brukes igjen', unit: '%', group: 'Spesialkapp (regel 2)', tab: 'avskrivning', rule: 2, unused: true },
  'cut.waste': { label: 'Spesialkapp: svinn', unit: '%', group: 'Spesialkapp (regel 2)', tab: 'avskrivning', rule: 2, unused: true },
  'cut.minutes': { label: 'Spesialkapp: minutter per kapp', unit: 'personmin', group: 'Spesialkapp (regel 2)', tab: 'avskrivning', rule: 2, unused: true },
  boughtWaste: { label: 'Svinn på det som kjøpes til jobben (trykk)', unit: '%', group: 'Kjøpt til jobben', tab: 'avskrivning', rule: 3 },
  'labour.baseRate': { label: 'Timekost montør, inkl. sosiale kostnader', unit: 'kr/t', group: 'Montør', tab: 'arbeid', rule: 4 },
  'labour.baseYear': { label: 'Timekostens år', unit: 'år', group: 'Montør', tab: 'arbeid', rule: 4 },
  'labour.billableShare': { label: 'Andel av betalte timer som kan faktureres', unit: '%', group: 'Montør', tab: 'arbeid', rule: 4 },
  'labour.overtimeSurcharge': { label: 'Overtidstillegg på lønnen', unit: '%', group: 'Montør', tab: 'arbeid', rule: 4 },
  'labour.wageShare': { label: 'Lønnsandel av timekosten', unit: '%', group: 'Montør', tab: 'arbeid', rule: 4 },
  'carpet.material': { label: 'Engangsteppe: materiale fra rullen', unit: 'kr/m²', group: 'Engangsteppe (rangerer leggeforslag)', tab: 'arbeid' },
  'carpet.tapeMaterial': { label: 'Engangsteppe: teip', unit: 'kr/lm', group: 'Engangsteppe (rangerer leggeforslag)', tab: 'arbeid' },
  'carpet.minLay': { label: 'Engangsteppe: legging', unit: 'min/m²', group: 'Engangsteppe (rangerer leggeforslag)', tab: 'arbeid' },
  'carpet.minCut': { label: 'Engangsteppe: kapp', unit: 'min/lm', group: 'Engangsteppe (rangerer leggeforslag)', tab: 'arbeid' },
  'carpet.minSeam': { label: 'Engangsteppe: skjøt', unit: 'min/lm', group: 'Engangsteppe (rangerer leggeforslag)', tab: 'arbeid' },
  'carpet.minTape': { label: 'Engangsteppe: teiping', unit: 'min/lm', group: 'Engangsteppe (rangerer leggeforslag)', tab: 'arbeid' },
  'height.limit': { label: 'Høyde der stige ikke rekker', unit: 'mm', group: 'Høyde og lift (regel 6)', tab: 'arbeid', rule: 6, unused: true },
  'height.factor': { label: 'Montering over grensen tar', unit: '×', group: 'Høyde og lift (regel 6)', tab: 'arbeid', rule: 6, unused: true },
  'height.liftPerDay': { label: 'Lift per dag', unit: 'kr', group: 'Høyde og lift (regel 6)', tab: 'arbeid', rule: 6, unused: true },
  indirect: { label: 'Indirekte kost (admin, lokaler, lager, biler)', unit: '%', group: 'Påslag', tab: 'paslag' },
  'dg.utleie': { label: 'DG-mål utleie', unit: '%', group: 'DG-mål per gruppe (det motoren priser)', tab: 'paslag' },
  'dg.arbeid': { label: 'DG-mål arbeid', unit: '%', group: 'DG-mål per gruppe (det motoren priser)', tab: 'paslag' },
  'dg.salg': { label: 'DG-mål salg', unit: '%', group: 'DG-mål per gruppe (det motoren priser)', tab: 'paslag' },
};

const isExampleList = (l: SupplierList) => l === EXAMPLE_LIST || l === EXAMPLE_OWN_LIST;

/** Every number in the kostgrunnlag, in the order the page shows them. */
export function basisFields(b: CostBasis): Field[] {
  const out: Field[] = [];
  const add = (path: string, f: Omit<Field, 'path' | 'own' | 'status' | 'source' | 'date'>, own = !fromExample(b, path)) => {
    const ex = exampleNote(path);
    const note = b.notes[path];
    out.push({
      path,
      ...f,
      own,
      status: note?.status ?? (own ? 'Bjørn' : ex.status),
      source: note?.kilde ?? (own ? b.source || 'Eget kostgrunnlag' : ex.kilde),
      date: note?.dato ?? (own ? b.date : EXAMPLE_BASIS.date),
    });
  };
  const p = b.params;
  const param = (key: string, value: number, d: ParamDef) =>
    add(`parametere.${key}`, { ...d, value, put: (file, v) => setAt(((file.parametere ??= {}) as Obj), key.split('.'), v) });

  // Innkjøp: the lists in use, then currency, freight and the material index
  for (const list of usedLists(b)) {
    const example = isExampleList(list);
    for (const it of list.items) {
      add(
        listRowPath(list.supplier, it.artnr),
        {
          tab: 'innkjop',
          group: `${list.supplier} · ${list.name} · ${list.date} · ${list.currency}`,
          label: `${it.artnr} ${it.name}`.trim(),
          value: it.price,
          unit: `${list.currency}/${it.unit}`,
          rule: 1,
          list: { supplier: list.supplier, artnr: it.artnr },
          put: (file, v) => putListPrice(file, b, list, it.artnr, v),
        },
        !example && !fromExample(b, listRowPath(list.supplier, it.artnr)),
      );
    }
  }
  for (const [key, d] of Object.entries(PARAMS)) if (d.tab === 'innkjop') param(key, valueAt(p, key), d);
  for (const [y, v] of Object.entries(p.materialIndex))
    add(`parametere.materialIndex.${y}`, {
      tab: 'innkjop',
      group: 'Materialindeks (endring fra året før)',
      label: y,
      value: v,
      unit: '%',
      rule: 1,
      put: (file, x) => setAt(((file.parametere ??= {}) as Obj), ['materialIndex'], { ...p.materialIndex, [y]: x }),
    });

  // Avskrivning: lifetime and uses per group, interest and loss, special cut, bought for the job
  for (const [kind, g] of Object.entries(p.owned.groups) as [PartKind, CostParams['owned']['groups'][PartKind]][]) {
    const group = 'Levetid og bruk per artikkelgruppe';
    param(`owned.groups.${kind}.lifetimeYears`, g.lifetimeYears, { label: `${KIND_NAME[kind]}: levetid`, unit: 'år', group, tab: 'avskrivning', rule: 1 });
    param(`owned.groups.${kind}.usesPerYear`, g.usesPerYear, { label: `${KIND_NAME[kind]}: bruk i året`, unit: 'bruk i året', group, tab: 'avskrivning', rule: 1 });
  }
  for (const [key, d] of Object.entries(PARAMS)) if (d.tab === 'avskrivning') param(key, valueAt(p, key), d);

  // Arbeid og tider: the montør, the labour index, carpet, height, and minutes per price item and step
  for (const [key, d] of Object.entries(PARAMS)) if (d.tab === 'arbeid') param(key, valueAt(p, key), d);
  for (const [y, v] of Object.entries(p.labourIndex))
    add(`parametere.labourIndex.${y}`, {
      tab: 'arbeid',
      group: 'Lønnsindeks (endring fra året før)',
      label: y,
      value: v,
      unit: '%',
      rule: 4,
      put: (file, x) => setAt(((file.parametere ??= {}) as Obj), ['labourIndex'], { ...p.labourIndex, [y]: x }),
    });
  for (const d of ITEM_DEFS) {
    const t = b.times[d.id] ?? {};
    for (const s of HANDLING_STEPS) {
      if (t[s] === undefined) continue;
      add(`tider.${d.id}.${s}`, {
        tab: 'arbeid',
        group: 'Minutter per prisartikkel og steg (personminutter per enhet)',
        label: `${d.name}: ${STEP_NAME[s]}`,
        value: t[s]!,
        unit: `personmin/${d.unit}`,
        rule: 4,
        put: (file, v) => setAt(((file.tider ??= {}) as Obj), [d.id], { ...t, ...((file.tider as Obj)[d.id] as Obj | undefined), [s]: v }),
      }, !fromExample(b, `tider.${d.id}`));
    }
  }

  // Ordrekost
  b.orderCosts.forEach((o, i) => {
    const put = (key: 'cost' | 'personMinutes') => (file: Obj, v: number) => {
      file.ordrekost = b.orderCosts.map((x, j) => (j === i ? { ...x, [key]: v } : x));
    };
    const group = 'Per tilbud, én gang';
    if (o.cost !== undefined)
      add(`ordrekost.${o.id}.cost`, { tab: 'ordrekost', group, label: `${o.name}${o.when === 'trykk' ? ' (bare med trykt tekstil)' : ''}${o.baseYear ? `, ${o.baseYear}-kroner` : ''}`, value: o.cost, unit: 'kr', rule: 5, put: put('cost') }, !fromExample(b, 'ordrekost'));
    if (o.personMinutes !== undefined)
      add(`ordrekost.${o.id}.personMinutes`, { tab: 'ordrekost', group, label: o.name, value: o.personMinutes, unit: 'personmin', rule: 5, put: put('personMinutes') }, !fromExample(b, 'ordrekost'));
  });

  // Påslag og DG
  for (const [key, d] of Object.entries(PARAMS)) if (d.tab === 'paslag') param(key, valueAt(p, key), d);

  // Katalog: products without a recipe
  for (const [prefix, share] of Object.entries(b.catalog.cost))
    add(`katalog.kost.${prefix}`, {
      tab: 'katalog',
      group: 'Kost som andel av salgsprisen, per gruppe',
      label: prefix,
      value: share,
      unit: '%',
      put: (file, v) => setAt(((file.katalog ??= {}) as Obj), ['kost'], { ...b.catalog.cost, [prefix]: v }),
    }, !fromExample(b, 'katalog.kost'));
  for (const [prefix, t] of Object.entries(b.catalog.time))
    for (const s of HANDLING_STEPS) {
      if (t[s] === undefined) continue;
      add(`katalog.tider.${prefix}.${s}`, {
        tab: 'katalog',
        group: 'Minutter per enhet og steg, per gruppe',
        label: `${prefix} ${STEP_NAME[s]}`,
        value: t[s]!,
        unit: 'personmin',
        put: (file, v) => setAt(((file.katalog ??= {}) as Obj), ['tider'], { ...b.catalog.time, [prefix]: { ...t, [s]: v } }),
      }, !fromExample(b, 'katalog.tider'));
    }

  // Oppskrifter: the quantity of each part in each price item
  for (const d of ITEM_DEFS) {
    const r = b.recipes[d.id];
    if (!r) continue;
    const own = !fromExample(b, `oppskrifter.${d.id}`);
    const put = (key: 'parts' | 'own' | 'bought', i: number) => (file: Obj, v: number) => {
      const rows = (r[key] ?? []).map((row, j) => (j === i ? [row[0], v, ...row.slice(2)] : [...row]));
      setAt(((file.oppskrifter ??= {}) as Obj), [d.id], { ...r, [key]: rows });
    };
    const group = `${d.name} (DG-gruppe ${r.dg})`;
    for (const key of ['parts', 'own', 'bought'] as const)
      (r[key] ?? []).forEach((row, i) =>
        add(`oppskrifter.${d.id}.${key}.${i}`, { tab: 'oppskrifter', group, ...partText(key, row[0], d.unit), value: row[1], put: put(key, i) }, own),
      );
  }
  return out;
}

/** A recipe row's label and unit: the Foga part's name and its list unit (m for profiles and frames). */
function partText(key: 'parts' | 'own' | 'bought', code: string, itemUnit: string): { label: string; unit: string } {
  if (key !== 'parts') return { label: `${code}${key === 'bought' ? ' (kjøpt til jobben)' : ''}`, unit: key === 'bought' ? `per ${itemUnit}` : 'stk' };
  const part = FOGA_PARTS.find((x) => x.code === code);
  return { label: part ? `${code} ${part.name}` : code, unit: part && (part.kind === 'profile' || part.kind === 'frame') ? 'm' : 'stk' };
}

/** The Foga list and the own list the engine looks up (supplierList: the example's where the basis has none), then any
 *  other list the basis holds. */
function usedLists(b: CostBasis): SupplierList[] {
  const used = [supplierList(b, 'Foga'), supplierList(b, OWN_SUPPLIER)];
  return [...used, ...b.lists.filter((l) => !used.includes(l))];
}

function valueAt(o: unknown, key: string): number {
  return key.split('.').reduce<unknown>((x, k) => (x as Obj)[k], o) as number;
}

/** A new price in a list: the list goes into the file (an example list then becomes the owner's, prices and all). */
function putListPrice(file: Obj, b: CostBasis, list: SupplierList, artnr: string, v: number) {
  const lists = (file.prislister as SupplierList[] | undefined) ?? (b.fromExample.includes('prisliste') ? [] : [...b.lists]);
  const i = lists.findIndex((l) => l.supplier === list.supplier);
  const set = (x: SupplierList['items'][number]) => ({ ...x, price: v, broken: x.broken === x.price ? v : x.broken });
  const base = (i >= 0 ? lists[i] : list).items;
  // A row filled in from the example (withExampleRows) is not in the file yet: it goes in with the new price
  const row = list.items.find((x) => x.artnr === artnr);
  const items = base.some((x) => x.artnr === artnr) ? base.map((x) => (x.artnr === artnr ? set(x) : x)) : row ? [...base, set(row)] : base;
  const next = { ...(i >= 0 ? lists[i] : list), items };
  file.prislister = i >= 0 ? lists.map((l, j) => (j === i ? next : l)) : [...lists, next];
}

/** The fields under a path «Slik er det regnet» names: the field itself, or every field below it. */
export const fieldsAt = (fields: readonly Field[], path: string) => fields.filter((f) => f.path === path || f.path.startsWith(`${path}.`));

/** A kostgrunnlag with new values in it, read again from the file it would be, so it takes the road a loaded file
 *  takes. `version`, `date` and `source` name the new basis; `notes` go beside the numbers. */
export function withValues(
  b: CostBasis,
  changes: readonly { field: Field; value: number; note?: FieldNote }[],
  name: { version: string; date: string; source?: string },
): BasisResult {
  const file = JSON.parse(serializeBasis(b)) as Obj;
  const notes = { ...b.notes };
  for (const c of changes) {
    c.field.put(file, c.value);
    if (c.note) notes[c.field.path] = c.note;
  }
  file.kostversjon = name.version;
  file.dato = name.date;
  if (name.source !== undefined) file.kilde = name.source;
  file.merknader = Object.keys(notes).length ? notes : undefined;
  return parseBasis(JSON.stringify(file));
}
