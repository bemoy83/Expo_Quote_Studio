// What every block of quote lines shares (calc.ts runs the blocks in calc/lines/ and calc/textile/lines.ts): the
// catalog and prices, `line()` that prices one line, and what is built: wall modules, posts, takdrager, foot plates,
// textile production and the Foga structure, split by who pays.
import { resolveGroup } from '../catalog/groups';
import { displayName, indexCatalog, type CatalogIndex } from '../catalog/lookup';
import type { Catalog } from '../catalog/types';
import { pointKey } from '../domain/grid';
import { hiddenPlates } from '../domain/print';
import type { Point, StandWallTerms, Variant } from '../domain/types';
import { builtModules, wallKind, wallPoints, type BuiltModule, type WallKind } from '../domain/walls';
import { bomSizes, beamSpecs, structureOf } from '../foga/fromVariant';
import type { BomSizes } from '../foga/engine';
import { fogaPart } from '../foga/parts';
import { RECIPES } from '../foga/recipes';
import type { FogaStructure } from '../foga/structure';
import { ITEM, type PricingData } from '../pricing/data';
import { priceLine, type Use } from '../pricing/model';
import type { Rules } from '../rules/rules';
import { variantBeams, type BeamLayout } from './beams';
import type { InnerBeamLayout } from './innerBeams';
import { production, type Production } from './production';
import type { SupportBeamLayout } from './supportBeams';
import type { CalcLine } from './types';
import { wallSupports, type WallSupport } from './wallSupports';

export interface CalcContext {
  v: Variant;
  rules: Rules;
  pricing: PricingData;
  standWalls: StandWallTerms;
  idx: CatalogIndex;
  sys: Catalog['system'];
  sizes: BomSizes;
  /**
   * One quote line. `uses` is what the line is built from (all of it, not per unit), each at its OMS price: a product
   * priced as a sum gets its price from them. Otherwise the variant's own price (from the OMS); `own` overrides it.
   */
  line: (artnr: string, qty: number, extra?: Partial<CalcLine>, uses?: Use[] | null, own?: number) => CalcLine;
  /** Marks a line built from Foga parts: the picking list shows the parts instead. */
  built: { foga: true };
  mods: BuiltModule[];
  kindOf: (m: BuiltModule) => WallKind;
  /** Wall modules that are wall, not opening. */
  walled: BuiltModule[];
  /** The organiser's stand walls (when it pays them) and the rest, the exhibitor's. */
  theirs: BuiltModule[];
  ours: BuiltModule[];
  theirPoints: Map<string, Point>;
  ourPoints: Map<string, Point>;
  /** Every post on the sketch: wall posts, then the posts only the standard takdrager need, then the drawn ones'. */
  allPosts: Map<string, Point>;
  beams: { standard: BeamLayout; inner: InnerBeamLayout; all: BeamLayout; support: SupportBeamLayout; hooks: number };
  standardPosts: number;
  innerPosts: number;
  beamPosts: number;
  /** The organiser pays the standard takdrager (they follow its stand walls). */
  organiserBeams: boolean;
  /** Plate colours the exhibitor swaps into the organiser's stand walls, one per module. */
  swaps: string[];
  /** Foot plates under walls that stand free, and all of them (with those under drawn takdrager's own posts). */
  freeWallFeet: WallSupport[];
  wallFeet: WallSupport[];
  prod: Production;
  /** Foga structure of what the exhibitor orders. */
  foga: FogaStructure;
  /** A wall module's share of the posts of its builder. */
  share: (nPosts: number, nMods: number) => number;
  ourShare: number;
  /** Rails, posts and handling of `n` wall modules. */
  moduleUses: (n: number, postShare?: number) => Use[];
  lmOf: (b: BeamLayout) => number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function calcContext(v: Variant, rules: Rules, catalog: Catalog, standWalls: StandWallTerms, pricing: PricingData): CalcContext {
  const idx = indexCatalog(catalog);
  const sizes = bomSizes(rules);
  const items = pricing.items;

  const line: CalcContext['line'] = (artnr, qty, extra = {}, uses = null, own) => {
    const hit = idx.byArtnr.get(artnr);
    const q = hit?.product.unit === 'stk' ? qty : r1(qty);
    const cost = hit?.variant.cost;
    const t = hit?.product.time;
    const p = priceLine(
      q,
      hit?.product.pricing ?? 'fast',
      { price: own ?? hit?.variant.price ?? 0, ...(cost !== undefined && own === undefined ? { cost } : {}), ...(t ? { time: t } : {}) },
      uses,
      items,
    );
    return {
      name: hit ? displayName(hit) : artnr,
      qty: q,
      unit: hit?.product.unit ?? 'stk',
      price: p.price,
      sum: q * p.price,
      artnr,
      // A summed price is from OMS item prices, not a placeholder (the example price list is flagged in the kalkyle)
      placeholder: !hit || (p.strategy === 'fast' && !!hit.variant.placeholder),
      group: resolveGroup(hit?.product.group).subgroup.id,
      cost: p.cost,
      dg: p.dg,
      strategy: p.strategy,
      transfer: p.transfer,
      ...(p.transfer === 'blandet' ? { terms: pricing.terms[hit?.product.id ?? ''] ?? 'Delvis leie, delvis kjøp' } : {}),
      time: p.time,
      payer: 'utstiller',
      ...extra,
    };
  };

  // Walls and frame. Stand walls the organiser pays are built and billed by the organiser: they are left out of the
  // exhibitor's structure, and only their colour, when it is not the organiser's, is the exhibitor's plate swap.
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const { standard, inner, all, support, hooks } = variantBeams(v, mods, points, rules.beam.max);
  const wallsById = new Map(v.walls.map((w) => [w.id, w]));
  const kindOf = (m: BuiltModule): WallKind => {
    const w = wallsById.get(m.wallId);
    return w ? wallKind(w) : 'inner';
  };
  const organiserPays = standWalls.payer === 'arrangør';
  // An opening in a stand wall (only in old sketches) stays the exhibitor's door
  const theirs = mods.filter((m) => organiserPays && !m.opening && kindOf(m) === 'stand');
  const theirSet = new Set(theirs);
  const ours = mods.filter((m) => !theirSet.has(m));
  const theirPoints = wallPoints(theirs);
  const ourPoints = new Map([...wallPoints(ours)].filter(([k]) => !theirPoints.has(k)));
  // Every post on the sketch: wall posts, then the posts only the standard takdrager need, then the drawn ones'
  const allPosts = new Map(points);
  const ownPosts = (b: BeamLayout) => {
    let n = 0;
    for (const [k, p] of b.posts) {
      if (allPosts.has(k)) continue;
      allPosts.set(k, p);
      n++;
    }
    return n;
  };
  const standardPosts = ownPosts(standard);
  const innerPosts = ownPosts(inner);
  const beamPosts = standardPosts + innerPosts;
  // A plate printed over is the organiser's plate with the print on it: no swap, whatever colour it once had
  const hidden = hiddenPlates(v);
  const swaps = theirs.filter((m) => m.plate !== standWalls.ral && !hidden.has(m.key)).map((m) => m.plate);
  // Takdrager follow the stand walls (docs/vegger.md). Every beam the app lays out today is a standard beam, derived from
  // and supporting the stand walls, so the organiser pays them, with their own posts, when it pays the stand walls. Open
  // area without stand walls (island) gets no beams from the organiser: the exhibitor pays them in full. Beams the
  // customer draws (innvendige takdragere) are always the exhibitor's.
  const organiserBeams = theirs.length > 0 && standard.segments.length > 0;
  const ourBeams: BeamLayout = organiserBeams ? inner : all;
  const walled = mods.filter((m) => !m.opening);
  // A wall stands free without the takdrager frame: foot plates on its posts. With beams the stand walls are in the
  // frame. The plates are the customer's choice (no beams), so the exhibitor's even under the organiser's walls.
  // A drawn takdrager's own posts stand on plates too, across the beam, unless a beam drawn the other way meets them.
  const framed = standard.segments.length > 0;
  const freeWallFeet = wallSupports(mods, all, RECIPES.wall.support.rule, (m) => framed && kindOf(m) === 'stand', framed);
  const wallFeet = [...freeWallFeet, ...inner.feet];
  const prod = production(v, rules.textile.inFrame, '');
  // Foga structure of what the exhibitor orders: posts, walled modules, headers and beam lengths are counted from it
  const foga = structureOf({ mods: ours, posts: ourPoints.size + (organiserBeams ? innerPosts : beamPosts), beams: ourBeams, hooks, production: prod, swaps, wallFeet: wallFeet.length, barePosts: wallFeet.filter((f) => ourPoints.has(pointKey(f.at))).length + inner.feet.length });
  // Wall posts are shared between modules: each module (door and curtain included) carries an equal share of the
  // posts of its builder
  const share = (nPosts: number, nMods: number) => (nMods ? nPosts / nMods : 0);
  const ourShare = share(ourPoints.size, ours.length);
  const rail = (code: string) => ITEM.rail(code, sizes.cc - (fogaPart(RECIPES.wall.post).section?.[0] ?? 0));
  const moduleUses = (n: number, postShare = ourShare): Use[] => [
    { id: rail(RECIPES.wall.topRail), qty: n },
    { id: rail(RECIPES.wall.bottomRail), qty: n },
    { id: ITEM.post, qty: n * postShare },
    { id: ITEM.module, qty: n },
  ];

  return {
    v,
    rules,
    pricing,
    standWalls,
    idx,
    sys: catalog.system,
    sizes,
    line,
    built: { foga: true },
    mods,
    kindOf,
    walled,
    theirs,
    ours,
    theirPoints,
    ourPoints,
    allPosts,
    beams: { standard, inner, all, support, hooks },
    standardPosts,
    innerPosts,
    beamPosts,
    organiserBeams,
    swaps,
    freeWallFeet,
    wallFeet,
    prod,
    foga,
    share,
    ourShare,
    moduleUses,
    lmOf: (b) => beamSpecs(b).reduce((a, x) => a + x.lengthMm, 0) / 1000,
  };
}

/** «1 lengde», «3 lengder». */
export const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function countBy(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
}

/** A line goes to the organiser instead of the exhibitor. */
export const toOrganiser = (l: CalcLine): CalcLine => ({ ...l, payer: 'arrangør' });
