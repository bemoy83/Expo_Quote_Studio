// The one product grouping (hovedgruppe → undergruppe) that the panel, the product list, the calc, the quote and
// the picking list all derive from. Every product and every Foga part points to one subgroup by id. Order here is
// the order everywhere. Later this is expected to come from OMS, which will own products and groups.

export interface Subgroup {
  id: string;
  name: string;
  /** Not on the picking list (services, loose quote lines). */
  notPicked?: true;
}

export interface ProductGroup {
  id: string;
  name: string;
  subgroups: Subgroup[];
}

const g = (id: string, name: string, subs: [key: string, name: string, notPicked?: true][]): ProductGroup => ({
  id,
  name,
  subgroups: subs.map(([key, n, notPicked]) => ({ id: `${id}.${key}`, name: n, ...(notPicked ? { notPicked } : {}) })),
});

export const PRODUCT_GROUPS: ProductGroup[] = [
  g('vegg', 'Vegger og bakrom', [
    ['vegger', 'Vegger'],
    ['plater', 'Veggplater'],
    ['stolper', 'Stolper'],
    ['skinner', 'Skinner'],
    ['takdrager', 'Takdrager'],
    ['dorer', 'Dører og forheng'],
  ]),
  g('gulv', 'Tepper og gulv', [
    ['belegg', 'Gulvbelegg'],
    ['beskyttelse', 'Monteringsbeskyttelse'],
  ]),
  g('mob', 'Møbler', [
    ['bord', 'Bord'],
    ['sitte', 'Sittemøbler'],
    ['grupper', 'Møbelgrupper'],
  ]),
  g('disk', 'Disker og podier', [
    ['disker', 'Disker'],
    ['podier', 'Podier'],
  ]),
  g('hyll', 'Hyller og heng', [
    ['hyller', 'Hyller'],
    ['heng', 'Heng'],
    ['skap', 'Skap'],
  ]),
  g('lys', 'Strøm, lys og oppheng', [
    ['strom', 'Strøm'],
    ['lys', 'Lys og oppheng'],
  ]),
  g('prof', 'Profilering', [
    ['tekstil', 'Tekstilvegger'],
    ['folie', 'Folie'],
    ['disk', 'Disk og frontbord'],
  ]),
  g('av', 'Lyd og bilde', [
    ['skjermer', 'Skjermer'],
    ['lyd', 'Lyd'],
  ]),
  g('plant', 'Planter og fruktkurv', [
    ['planter', 'Planter'],
    ['frukt', 'Fruktkurv'],
  ]),
  g('tilb', 'Tilbehør', [['tilbehor', 'Tilbehør']]),
  g('tjen', 'Andre tjenester', [
    ['montering', 'Montering', true],
    ['lose', 'Løse linjer', true],
  ]),
];

/** Where a product goes when its group is unknown (e.g. an old saved product or an import without a group). */
export const FALLBACK_SUBGROUP = 'tilb.tilbehor';

interface Resolved {
  group: ProductGroup;
  subgroup: Subgroup;
  /** Position in the whole tree, for sorting. */
  order: number;
}

const BY_ID = new Map<string, Resolved>();
let n = 0;
for (const group of PRODUCT_GROUPS) for (const subgroup of group.subgroups) BY_ID.set(subgroup.id, { group, subgroup, order: n++ });

export const isSubgroup = (id: string | undefined): id is string => !!id && BY_ID.has(id);

/** The group and subgroup of a subgroup id. Unknown ids resolve to the fallback. */
export function resolveGroup(subgroupId: string | undefined): Resolved {
  return BY_ID.get(subgroupId ?? '') ?? BY_ID.get(FALLBACK_SUBGROUP)!;
}

export const mainGroupOf = (subgroupId: string | undefined) => resolveGroup(subgroupId).group.id;

/** Find a subgroup by its name or its main group's name (first subgroup), ignoring case. For imports. */
export function subgroupByName(name: string): string | undefined {
  const s = name.trim().toLowerCase();
  if (!s) return undefined;
  for (const r of BY_ID.values()) if (r.subgroup.name.toLowerCase() === s) return r.subgroup.id;
  return PRODUCT_GROUPS.find((x) => x.name.toLowerCase() === s)?.subgroups[0].id;
}

export interface GroupedSub<T> {
  subgroup: Subgroup;
  items: T[];
}

export interface Grouped<T> {
  group: ProductGroup;
  subgroups: GroupedSub<T>[];
}

/** Sort items into the tree, in tree order; empty groups and subgroups left out, item order kept inside a subgroup. */
export function groupItems<T>(items: readonly T[], subgroupOf: (t: T) => string | undefined): Grouped<T>[] {
  const bySub = new Map<string, T[]>();
  for (const t of items) {
    const id = resolveGroup(subgroupOf(t)).subgroup.id;
    bySub.set(id, [...(bySub.get(id) ?? []), t]);
  }
  return PRODUCT_GROUPS.map((group) => ({
    group,
    subgroups: group.subgroups.flatMap((subgroup) => (bySub.has(subgroup.id) ? [{ subgroup, items: bySub.get(subgroup.id)! }] : [])),
  })).filter((x) => x.subgroups.length);
}
