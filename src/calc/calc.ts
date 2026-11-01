import { groupItems, resolveGroup } from '../catalog/groups';
import { displayName, indexCatalog } from '../catalog/lookup';
import type { Catalog, Unit } from '../catalog/types';
import { openSides, pointKey } from '../domain/grid';
import { carpetMetrics } from '../domain/carpet';
import { lanesOf, rollUsage, tileAreas, tileCounts } from '../domain/floor';
import type { Payer, Point, StandWallTerms, TextileFill, Variant } from '../domain/types';
import { DEFAULT_STAND_WALLS } from '../domain/variant';
import { builtModules, wallKind, wallPoints, type BuiltModule, type WallKind } from '../domain/walls';
import { bom, type Bom } from '../foga/engine';
import { beamSpecs, bomSizes, structureOf } from '../foga/fromVariant';
import { RECIPES } from '../foga/recipes';
import type { FogaStructure } from '../foga/structure';
import { fogaPart } from '../foga/parts';
import { DEFAULT_PRICING, ITEM, type PricingData } from '../pricing/data';
import { addTime, dgOf, priceLine, type Strategy, type Time, type Transfer, type Use } from '../pricing/model';
import type { Rules } from '../rules/rules';
import { variantBeams, type BeamLayout } from './beams';
import { production, type Production } from './production';
import { wallSupports, type WallSupport } from './wallSupports';

export interface CalcLine {
  name: string;
  meta?: string;
  qty: number;
  unit: Unit;
  /** Sales price per unit eks. mva.: from cost and target DG (sum) or the catalog price (fast). */
  price: number;
  sum: number;
  artnr: string;
  /** Example or unknown price: * on the quote. */
  placeholder: boolean;
  /** Subgroup id (catalog/groups.ts), from the product. */
  group: string;
  /** Built from Foga parts: the picking list shows the parts (foga/engine.ts) instead of this line. */
  foga?: true;
  /** Internal, never on the quote. Cost of the whole line, null when not known (no cost data). */
  cost: number | null;
  /** Dekningsgrad of the line, null when the cost is not known. */
  dg: number | null;
  /** How the price was set. `fast` also when a sum product lacks cost data. */
  strategy: Strategy;
  transfer: Transfer | 'blandet' | null;
  /** Shown to the customer when the product is part rental, part sale. */
  terms?: string;
  /** Minutes per handling step for the whole line (from the OMS price list or the product). */
  time: Time;
  /** Who the line is invoiced to. Only stand walls and the takdrager that follow them can go to the organiser. */
  payer: Payer;
  /** Lines with the same key are one line on the quote, named `name`, with the quantity and unit of the `lead` line
   *  (textile walls: frame and textile). */
  quote?: { key: string; name: string; lead: boolean };
  /** Carpet tiles: pieces per tile size, largest first. The picking list counts these instead of m². */
  tiles?: { size: string; qty: number }[];
  /** Rolled floor in lanes: running metres of roll (with the end allowance), waste in m², and the lanes as cut. The
   *  picking list counts the metres instead of m². */
  roll?: {
    width: number;
    lm: number;
    waste: number;
    lanes: { length: number; width: number; cut: boolean; qty: number }[];
    /** Pieces cut from the roll, alike ones counted together: length as cut, the widths it is split into. */
    pieces: { length: number; parts: number[]; endToEnd: boolean; qty: number }[];
    /** Tape, lm: the outline and the seams. Picked, never priced. */
    tape: number;
  };
}

/** One main group of the product grouping, lines in subgroup order. */
export interface CalcGroup {
  id: string;
  name: string;
  lines: CalcLine[];
  sum: number;
  /** Cost of the lines with known cost. */
  cost: number;
}

export interface KeyFigures {
  area: number;
  openSides: number;
  /** Wall modules that are wall, not opening. Shared walls count once. */
  wallLm: number;
  /** Part of wallLm in stand walls (from the stand type), whoever pays them. */
  standWallLm: number;
  /** Part of standWallLm the organiser pays: not on the exhibitor's quote, picking list or work order. */
  organiserWallLm: number;
  /** Takdrager the organiser pays (the standard ones, or none), with the posts only they need. */
  organiserBeamLm: number;
  /** Part of beamLm in innvendige takdragere the customer draws: always the exhibitor's. */
  innerBeamLm: number;
  /** Ends of drawn takdrager hung on another beam. */
  beamHooks: number;
  /** Part of wallLm in inner walls the exhibitor draws (room walls not included). */
  innerWallLm: number;
  /** Part of wallLm that rooms build themselves (sides shared with other walls not included). */
  roomWallLm: number;
  /** Metres of stand wall the organiser pays where the exhibitor swaps in a coloured plate. */
  swapLm: number;
  openings: number;
  beamLm: number;
  beamLengths: number;
  posts: number;
  /** Posts that exist only because of the beams. */
  beamPosts: number;
  /** Støtteplater under the posts of system walls that stand free, and under drawn takdrager's own posts. */
  wallSupports: number;
  /** Wall modules including those with a door or curtain (each gets top and bottom rail, in its header if an opening). */
  modules: number;
  /** m² per floor art.nr. */
  floor: Record<string, number>;
  floorTotal: number;
  textileM2: number;
  foilM2: number;
  /** Minutes per handling step for the whole stand. In the prices, not a line; the work order plans from it. */
  time: Time;
}

/** Internal margin of the whole variant. Never on the quote. */
export interface Margin {
  /** Cost of the lines with known cost. */
  cost: number;
  /** Sales sum of those lines. */
  sum: number;
  /** Dekningsbidrag and dekningsgrad over the lines with known cost. */
  db: number;
  dg: number;
  /** Lines without cost data: their price is the catalog price and they are not in the margin. */
  unknown: number;
}

export interface CalcResult {
  groups: CalcGroup[];
  sum: number;
  margin: Margin;
  keyFigures: KeyFigures;
  beams: BeamLayout;
  posts: Point[];
  /** Støtteplater under free-standing system walls and drawn takdrager's own posts: always the exhibitor's, also under
   *  the organiser's stand walls. */
  wallSupports: WallSupport[];
  production: Production;
  /** What is built, in Foga terms: the quote counts from it and the picking list lists its parts. */
  foga: FogaStructure;
  /** Level 2 and 3: the Foga parts list of `foga`. The picking list and the kalkyle's articles show it. */
  bom: Bom;
  /** Billed to the organiser: the stand walls when the organiser pays them, and the takdrager that follow them. Outside the exhibitor's sum, margin, time,
   *  `foga` and `bom`, so not on the quote, picking list or work order: the organiser's walls come as their own order
   *  from the OMS, counted once for the hall (two stands back to back share one wall). */
  organiser: { lines: CalcLine[]; sum: number; cost: number };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Pure: the quote lines, their cost and margin, and the key figures of one variant. `standWalls`: who pays the stand
 *  walls (from the project). */
export function calc(v: Variant, rules: Rules, catalog: Catalog, standWalls: StandWallTerms = DEFAULT_STAND_WALLS, pricing: PricingData = DEFAULT_PRICING): CalcResult {
  const idx = indexCatalog(catalog);
  const sys = catalog.system;
  const sizes = bomSizes(rules);
  const items = pricing.items;

  /**
   * One quote line. `uses` is what the line is built from (all of it, not per unit), each at its OMS price: a product
   * priced as a sum gets its price from them. Otherwise the variant's own price (from the OMS); `own` overrides it.
   */
  const line = (artnr: string, qty: number, extra: Partial<CalcLine> = {}, uses: Use[] | null = null, own?: number): CalcLine => {
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
  const keys = new Set(mods.map((m) => m.key));
  const { standard, inner, all: beams } = variantBeams(v, keys, points, rules.beam.max);
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
  const swaps = theirs.filter((m) => m.plate !== standWalls.ral).map((m) => m.plate);
  // Takdrager follow the stand walls (docs/vegger.md). Every beam the app lays out today is a standard beam, derived from
  // and supporting the stand walls, so the organiser pays them, with their own posts, when it pays the stand walls. Open
  // area without stand walls (island) gets no beams from the organiser: the exhibitor pays them in full. Beams the
  // customer draws (innvendige takdragere) are always the exhibitor's.
  const organiserBeams = theirs.length > 0 && standard.segments.length > 0;
  const ourBeams: BeamLayout = organiserBeams ? inner : beams;
  const walled = mods.filter((m) => !m.opening);
  // A wall stands free without the takdrager frame: foot plates on its posts. With beams the stand walls are in the
  // frame. The plates are the customer's choice (no beams), so the exhibitor's even under the organiser's walls.
  // A drawn takdrager's own posts stand on plates too, across the beam, unless a beam drawn the other way meets them.
  const framed = standard.segments.length > 0;
  const freeWallFeet = wallSupports(mods, beams, RECIPES.wall.support.rule, (m) => framed && kindOf(m) === 'stand');
  const wallFeet = [...freeWallFeet, ...inner.feet];
  const prod = production(v, rules.textile.inFrame, '');
  // Foga structure of what the exhibitor orders: posts, walled modules, headers and beam lengths are counted from it
  const foga = structureOf({ mods: ours, posts: ourPoints.size + (organiserBeams ? innerPosts : beamPosts), beams: ourBeams, hooks: inner.hooks, production: prod, swaps, wallFeet: wallFeet.length, barePosts: wallFeet.filter((f) => ourPoints.has(pointKey(f.at))).length + inner.feet.length });
  const headers = foga.modules.filter((m) => m.opening).length;
  const lmOf = (b: BeamLayout) => beamSpecs(b).reduce((a, x) => a + x.lengthMm, 0) / 1000;
  const beamLengths = beamSpecs(beams);
  const beamLm = lmOf(beams);
  const plateSize = `${rules.wall.plate.width} × ${rules.wall.plate.height} mm`;
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

  // Level 1 only: what the customer buys. The articles behind wall, takdrager and textile (plates, posts, rails,
  // profiles) are on the picking list, counted from the same Foga structure; `foga` marks the lines they replace there.
  // Each line's cost is the sum of what is actually built for it.
  const lines: CalcLine[] = [];
  const add = (...ls: CalcLine[]) => lines.push(...ls.filter((l) => l.qty > 0));
  const built = { foga: true } as const;

  /** Wall per metre in one colour. A module with a door or curtain is never wall: it is in the opening product. */
  const wallLine = (ral: string, n: number, meta: string, postShare = ourShare) => {
    const hit = idx.wallByRal.get(ral);
    const uses = [{ id: ITEM.plate, qty: n }, ...moduleUses(n, postShare)];
    const extra = { ...built, meta: `${meta} · RAL ${ral}` };
    return hit ? line(hit.variant.artnr, n * rules.wall.cc, extra, uses) : line(`${sys.wall}-${ral}`, n * rules.wall.cc, { ...extra, group: 'vegg.vegger' }, uses);
  };
  // The exhibitor's stand walls first, then inner and room walls, each per colour
  const ourWalled = ours.filter((m) => !m.opening);
  for (const stand of [true, false]) {
    const byRal = countBy(ourWalled.filter((m) => (kindOf(m) === 'stand') === stand).map((m) => m.plate));
    add(...[...byRal].map(([ral, n]) => wallLine(ral, n, stand ? 'Standvegg' : 'Innervegg')));
  }
  // Støtteplater, per piece: the plate and putting it on
  const foot = RECIPES.wall.support.foot;
  const heldFree = [...(freeWallFeet.length ? ['vegg'] : []), ...(inner.feet.length ? ['takdrager'] : [])].join(' og ');
  add(
    line(sys.wallSupport, wallFeet.length, { ...built, meta: `${fogaPart(foot.code).name} · frittstående ${heldFree}` }, [
      { id: ITEM.foot(foot.code), qty: wallFeet.length },
      { id: ITEM.wallFootMount, qty: wallFeet.length },
    ]),
  );
  // Plate swap: the plate in the exhibitor's colour, swapped into the organiser's wall
  add(
    ...[...countBy(swaps)].map(([ral, n]) =>
      line(`${sys.plateSwap}-${ral}`, n * rules.wall.cc, { ...built, meta: `i standvegg · RAL ${ral}` }, [
        { id: ITEM.plate, qty: n },
        { id: ITEM.plateSwap, qty: n },
      ]),
    ),
  );
  // The organiser's stand walls, in the organiser's colour, on their own posts
  const toOrganiser = (l: CalcLine): CalcLine => ({ ...l, payer: 'arrangør' });
  const organiserLines: CalcLine[] = theirs.length ? [toOrganiser(wallLine(standWalls.ral, theirs.length, 'Standvegg', share(theirPoints.size, theirs.length)))] : [];

  // Takdrager per metre, its own posts and hooks included in the price. The standard ones are the organiser's when they
  // follow its stand walls: then the drawn ones are a line of their own, so the customer sees what they pay for.
  const nLengths = beamLengths.length;
  const beamLine = (b: BeamLayout, posts: number, hooks: number, what?: string) => {
    const specs = beamSpecs(b);
    const lm = lmOf(b);
    const meta = [
      ...(what ? [what] : []),
      count(specs.length, 'lengde', 'lengder'),
      ...(posts ? [`${count(posts, 'stolpe', 'stolper')} inkludert`] : []),
      ...(hooks ? [count(hooks, 'krok', 'kroker')] : []),
    ];
    const uses: Use[] = [
      ...specs.map((x) => ({ id: ITEM.beam(x.lengthMm - 40), qty: 1 })),
      { id: ITEM.post, qty: posts },
      { id: ITEM.beamLm, qty: lm },
      { id: ITEM.beamPost, qty: posts },
      { id: ITEM.beamHook, qty: hooks },
    ];
    return line(sys.beam, lm, { ...built, meta: meta.join(' · ') }, uses);
  };
  if (organiserBeams) {
    organiserLines.push(toOrganiser(beamLine(standard, standardPosts, 0)));
    add(beamLine(inner, innerPosts, inner.hooks, 'innvendig'));
  } else add(beamLine(beams, beamPosts, inner.hooks));

  // Door or curtain with header (overstykke), one product each
  const openingCounts = countBy(mods.flatMap((m) => (m.opening ? [m.opening.product] : [])));
  add(
    ...[...openingCounts].map(([a, n]) => {
      const leaf = idx.byArtnr.get(a)?.product.opening === 'curtain' ? ITEM.curtain : ITEM.door;
      return line(a, n, {}, [{ id: leaf, qty: n }, { id: ITEM.headerPlate, qty: n }, ...moduleUses(n)]);
    }),
  );

  // Textile walls: the frame (rental) and the textile (sale) are two lines here and one on the quote (`quote`).
  // InFrame frame per piece by size B × H: the loose frame parts (43TX at 2W + 2H, 617, 520), braces and handling.
  // Fast price: m² rate × B × H.
  const inFrameQuote = { key: 'tekstil-vegg', name: 'Tekstilvegg på systemvegg' };
  const freeQuote = { key: 'tekstil-fri', name: 'Tekstilvegg frittstående' };
  const bySize = new Map<string, typeof prod.pieces>();
  for (const p of prod.pieces) bySize.set(`${p.W}×${p.H}`, [...(bySize.get(`${p.W}×${p.H}`) ?? []), p]);
  const textile = idx.byArtnr.get(sys.textile);
  add(
    ...[...bySize].map(([size, pieces]) => {
      const [W, H] = size.split('×').map(Number);
      const n = pieces.length;
      const uses: Use[] = [
        { id: ITEM.frameProfileM, qty: (n * (2 * W + 2 * H)) / 1000 },
        { id: ITEM.corner, qty: 4 * n },
        { id: ITEM.wallFixing, qty: RECIPES.frame.wallFixing.perFrame * n },
        { id: ITEM.braceM, qty: pieces.reduce((a, p) => a + ((p.braces?.qty ?? 0) * (p.braces?.length ?? 0)) / 1000, 0) },
        { id: ITEM.bracePiece, qty: pieces.reduce((a, p) => a + (p.braces?.qty ?? 0), 0) },
        { id: ITEM.frame, qty: n },
      ];
      const fast = Math.round((textile?.variant.price ?? 0) * ((W * H) / 1e6));
      const name = `${textile ? displayName(textile) : sys.textile}, ${W} × ${H} mm`;
      return { ...line(sys.textile, n, { ...built, quote: { ...inFrameQuote, lead: true } }, uses, fast), name, unit: 'stk' as const };
    }),
  );
  // Textile per m² of visible face, by fill. Printed and white: the textile incl. bleed; all: pressed in along the
  // whole perimeter. The customer's own textile is only mounted.
  const textileLines = (faces: { W: number; H: number; pw: number; ph: number; fill: TextileFill }[], meta: string, quote: CalcLine['quote']) =>
    (['print', 'white', 'reuse'] as const).map((fill) => {
      const fs = faces.filter((f) => f.fill === fill);
      const uses: Use[] = [
        ...(fill === 'reuse' ? [] : [{ id: fill === 'print' ? ITEM.print : ITEM.white, qty: fs.reduce((a, f) => a + (f.pw * f.ph) / 1e6, 0) }]),
        { id: ITEM.textileEdge, qty: fs.reduce((a, f) => a + (2 * (f.W + f.H)) / 1000, 0) },
      ];
      const n = fs.length;
      return line(sys.textileFill[fill], fs.reduce((a, f) => a + (f.W * f.H) / 1e6, 0), { ...built, meta: `${meta} · ${n} ${n === 1 ? 'duk' : 'duker'}`, quote }, uses);
    });
  add(...textileLines(prod.pieces, 'på systemvegg', { ...inFrameQuote, lead: false }));

  // Frittstående per metre: 43TX rails and free-end uprights, 92LTX corner posts, a foot plate and a brace at every
  // support, 617 corner and 609 splice connectors, mounting per coupling and handling per frame
  const free = prod.free;
  const supports = free.reduce((a, f) => a + f.supports.length, 0);
  const freeUses: Use[] = [
    { id: ITEM.frameProfileM, qty: free.reduce((a, f) => a + f.profileMm, 0) / 1000 },
    { id: ITEM.cornerPostM, qty: (prod.cornerPosts.qty * prod.cornerPosts.H) / 1000 },
    ...[...new Set(free.map((f) => f.foot.code))].map((code) => ({ id: ITEM.foot(code), qty: free.filter((f) => f.foot.code === code).reduce((a, f) => a + f.supports.length, 0) })),
    { id: ITEM.corner, qty: free.reduce((a, f) => a + f.connectors.corner, 0) },
    { id: ITEM.splice, qty: free.reduce((a, f) => a + f.connectors.splice, 0) },
    { id: ITEM.braceM, qty: free.reduce((a, f) => a + f.supports.length * f.braceLength, 0) / 1000 },
    { id: ITEM.bracePiece, qty: supports },
    { id: ITEM.frameCoupling, qty: free.reduce((a, f) => a + f.couplings, 0) },
    { id: ITEM.frame, qty: free.length },
  ];
  const freeMeta = [count(free.length, 'vegg', 'vegger'), `h ${free[0]?.H ?? 0} mm`, ...(prod.cornerPosts.qty ? [count(prod.cornerPosts.qty, 'hjørne', 'hjørner')] : [])];
  add(line(sys.freeTextile, prod.freeLm, { ...built, meta: freeMeta.join(' · '), quote: { ...freeQuote, lead: true } }, freeUses));
  add(...textileLines(free.flatMap((f) => f.faces), 'frittstående, begge sider', { ...freeQuote, lead: false }));

  // Foil
  const wallIds = new Set(v.walls.map((w) => w.id));
  const fullFelt = (rules.wall.plate.width * rules.wall.plate.height) / 1e6;
  const foils = v.foils.filter((f) => wallIds.has(f.wallId));
  const foilFull = foils.filter((f) => f.full).length * fullFelt;
  const foilDecal = foils.filter((f) => !f.full).reduce((a, f) => a + f.width * f.height, 0);
  add(
    line(sys.foil, foilDecal, { meta: 'innenfor ett veggfelt' }),
    line(sys.foilFull, foilFull, { meta: `${foils.filter((f) => f.full).length} felt · ${plateSize}` }),
  );

  // Floor: m² laid per product. Waste is ours and not counted. Carpet tiles are also counted per size for picking,
  // rolled floor in running metres of roll.
  const floor = tileAreas(v.floor.tiles);
  const floorTotal = Object.values(floor).reduce((a, b) => a + b, 0);
  add(
    ...Object.entries(floor).map(([a, m2]) => {
      const p = idx.byArtnr.get(a)?.product;
      const tiles = p?.tiles ? tileCounts(v.floor.tiles.filter((t) => t.product === a)) : undefined;
      const roll = p?.roll ? rollLine(v.floor.tiles, a, p.roll) : undefined;
      const meta = roll ? `${a} · ${roll.lanes.reduce((n, l) => n + l.qty, 0)} baner · ${fmt1(roll.lm)} lm rull` : `${a} · ferdig lagt`;
      return line(a, m2, { meta, ...(tiles ? { tiles } : {}), ...(roll ? { roll } : {}) });
    }),
    line(sys.floorProtection, v.floor.protection ? floorTotal : 0),
  );

  // Placed objects and counted items (Arbeidstimer too: hours counted in the panel), in catalog order
  const objectCounts = countBy(v.objects.map((o) => o.product));
  for (const c of v.counted) objectCounts.set(c.product, (objectCounts.get(c.product) ?? 0) + c.qty);
  add(...[...objectCounts].map(([a, n]) => line(a, n)));

  add(
    ...v.loose.map((l): CalcLine => ({
      name: l.name,
      qty: l.qty,
      unit: 'stk',
      price: l.price,
      sum: l.qty * l.price,
      artnr: '',
      placeholder: false,
      group: 'tjen.lose',
      meta: l.price ? undefined : 'pris settes i tilbudet',
      cost: null,
      dg: null,
      strategy: 'fast',
      transfer: null,
      time: {},
      payer: 'utstiller',
    })),
  );

  const groups: CalcGroup[] = groupItems(lines, (l) => l.group).map(({ group, subgroups }) => {
    const ls = subgroups.flatMap((x) => x.items);
    return { id: group.id, name: group.name, lines: ls, sum: ls.reduce((a, l) => a + l.sum, 0), cost: ls.reduce((a, l) => a + (l.cost ?? 0), 0) };
  });

  const time = lines.reduce<Time>((a, l) => addTime(a, l.time), {});
  const known = lines.filter((l) => l.cost !== null);
  const knownSum = known.reduce((a, l) => a + l.sum, 0);
  const knownCost = known.reduce((a, l) => a + l.cost!, 0);

  return {
    groups,
    sum: groups.reduce((a, g) => a + g.sum, 0),
    margin: { cost: knownCost, sum: knownSum, db: knownSum - knownCost, dg: dgOf(knownSum, knownCost), unknown: lines.length - known.length },
    keyFigures: {
      area: v.stand.width * v.stand.depth,
      openSides: openSides(v.stand).length,
      wallLm: walled.length,
      standWallLm: walled.filter((m) => kindOf(m) === 'stand').length,
      organiserWallLm: theirs.length,
      organiserBeamLm: organiserBeams ? lmOf(standard) : 0,
      innerBeamLm: lmOf(inner),
      beamHooks: inner.hooks,
      innerWallLm: walled.filter((m) => kindOf(m) === 'inner').length,
      roomWallLm: walled.filter((m) => kindOf(m) === 'room').length,
      swapLm: swaps.length,
      openings: headers,
      beamLm,
      beamLengths: nLengths,
      posts: allPosts.size,
      beamPosts,
      wallSupports: wallFeet.length,
      modules: mods.length,
      floor,
      floorTotal,
      textileM2: prod.area,
      foilM2: foilFull + foilDecal,
      time,
    },
    beams,
    posts: [...allPosts.values()],
    wallSupports: wallFeet,
    production: prod,
    foga,
    bom: bom(foga, RECIPES, sizes),
    organiser: { lines: organiserLines, sum: organiserLines.reduce((a, l) => a + l.sum, 0), cost: organiserLines.reduce((a, l) => a + (l.cost ?? 0), 0) },
  };
}


const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function countBy(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
}

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('nb-NO');

/** A rolled product's lanes grouped by size as cut, longest and widest first. */
function rollLine(tiles: Variant['floor']['tiles'], product: string, roll: number): NonNullable<CalcLine['roll']> {
  const u = rollUsage(tiles, product, roll);
  const pieces = new Map<string, { length: number; parts: number[]; endToEnd: boolean; qty: number }>();
  for (const p of u.pieces) {
    const parts = p.lanes.map((l) => (p.split ? roll / p.lanes.length : l.width));
    const k = `${p.length.toFixed(2)}|${parts.join(',')}|${p.endToEnd}`;
    const s = pieces.get(k) ?? { length: p.length, parts, endToEnd: p.endToEnd, qty: 0 };
    s.qty++;
    pieces.set(k, s);
  }
  const sizes = new Map<string, { length: number; width: number; cut: boolean; qty: number }>();
  for (const l of u.lanes) {
    const k = `${l.length}|${l.width}`;
    const s = sizes.get(k) ?? { length: l.length, width: l.width, cut: l.cut, qty: 0 };
    s.qty++;
    sizes.set(k, s);
  }
  return {
    width: roll,
    lm: u.lm,
    waste: u.waste,
    lanes: [...sizes.values()].sort((a, b) => b.width - a.width || b.length - a.length),
    pieces: [...pieces.values()].sort((a, b) => a.parts.length - b.parts.length || b.length - a.length),
    tape: carpetMetrics(lanesOf(tiles, product, roll).map((l) => l.tile), roll, tiles).tape,
  };
}
