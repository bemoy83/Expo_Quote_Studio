// Walls: the exhibitor's stand walls, then inner and room walls, each per colour, whole modules per metre and shorter
// ones per piece (Byggeregel V1), except a stand wall's half metre on a stand in half metres: by the metre (V14). The
// organiser's stand walls,
// when it pays them, are a line of their own for the organiser.
import { raisedPosts } from '../../domain/walls';
import { fogaPart } from '../../foga/parts';
import { raisePlate } from '../../foga/plates';
import { RECIPES } from '../../foga/recipes';
import { ITEM } from '../../pricing/data';
import { raiseTop } from '../../rules/rules';
import type { Use } from '../../pricing/model';
import { countBy, toOrganiser, type CalcContext } from '../context';
import type { CalcLine } from '../types';

/** Wall in one colour: whole modules per metre, a shorter module (Byggeregel V1) per piece of its own product, priced as
 *  a whole metre (Bjørn 14.11.2026), its cut parts and the cutting in the cost. A module with a door or curtain is never
 *  wall: it is in the opening product. */
function wallLine(c: CalcContext, ral: string, mods: readonly Mod[], meta: string, stand: boolean, postShare = c.ourShare): CalcLine[] {
  const extra = { ...c.built, meta: `${meta} · RAL ${ral}` };
  const shortOf = (m: Mod) => shortProduct(c, m, ral, stand);
  const whole = mods.filter((m) => !shortOf(m));
  const short = countBy(mods.map(shortOf).filter((id): id is string => !!id));
  const perMetre = whole.length ? [lmLine(c, ral, whole, extra, postShare)] : [];
  return [
    ...perMetre,
    ...[...short.keys()].map((id) => c.line(`${id}-${ral}`, short.get(id)!, extra, c.wallUses(mods.filter((m) => shortOf(m) === id), postShare))),
  ];
}

/** A built module as the lines count it: its length, and the whole module it was cut from when another wall split it (V10). */
type Mod = { cc: number; whole?: string };

/** The product of a shorter module, when the catalog has one for its length and colour; else it is sold by the metre. A
 *  stand wall's own short module, the half metre of a stand in half metres, is sold by the metre (Bjørn 15.11.2026,
 *  Byggeregel V14); the parts of a stand wall another wall splits stay per piece (V11). */
function shortProduct(c: CalcContext, m: Mod, ral: string, stand: boolean): string | undefined {
  if (m.cc >= c.rules.wall.cc - 1e-6) return undefined;
  if (stand && !m.whole) return undefined;
  const id = c.sys.shortWalls?.[Math.round(m.cc * 1000)];
  return id && c.idx.byArtnr.has(`${id}-${ral}`) ? id : undefined;
}

function lmLine(c: CalcContext, ral: string, mods: readonly Mod[], extra: Partial<CalcLine>, postShare: number): CalcLine {
  const hit = c.idx.wallByRal.get(ral);
  const uses = c.wallUses(mods, postShare);
  const lm = mods.reduce((a, m) => a + m.cc, 0);
  return hit ? c.line(hit.variant.artnr, lm, extra, uses) : c.line(`${c.sys.wall}-${ral}`, lm, { ...extra, group: 'vegg.vegger' }, uses);
}

export function wallLines(c: CalcContext): CalcLine[] {
  const ourWalled = c.ours.filter((m) => !m.opening);
  return [true, false].flatMap((stand) => {
    const mods = ourWalled.filter((m) => (c.kindOf(m) === 'stand') === stand);
    return [...countBy(mods.map((m) => m.plate)).keys()].flatMap((ral) => wallLine(c, ral, mods.filter((m) => m.plate === ral), stand ? 'Standvegg' : 'Innervegg', stand));
  });
}

/** The organiser's stand walls, in the organiser's colour, on their own posts. */
export function organiserWallLines(c: CalcContext): CalcLine[] {
  const { theirs, theirPoints, standWalls } = c;
  return theirs.length ? wallLine(c, standWalls.ral, theirs, 'Standvegg', true, c.share(theirPoints.size, theirs.length)).map(toOrganiser) : [];
}

/**
 * Raised walls (Byggeregler V18, V22, Bjørn 27.11.2026): one line per height, per metre of raised wall, priced by the cost
 * engine from what is built: the 94 joined onto the posts (a post between two heights counts with the higher), the 292
 * top rail and the plate of each upper felt, and putting the felt up and down. Always the exhibitor's, also over the
 * organiser's stand walls (B2).
 */
export function raiseLines(c: CalcContext): CalcLine[] {
  const raised = c.mods.filter((m) => m.raise);
  const id = c.sys.wallRaise;
  if (!raised.length || !id) return [];
  const posts = raisedPosts(raised);
  const r = RECIPES.wall;
  const postW = fogaPart(r.post).section?.[0] ?? 0;
  return [...countBy(raised.map((m) => String(m.raise!.len))).keys()]
    .map(Number)
    .sort((a, b) => a - b)
    .map((len) => {
      const mods = raised.filter((m) => m.raise!.len === len);
      const nPosts = [...posts.values()].filter((p) => p.len === len).length;
      const ccMm = (cc: number) => Math.round(cc * 1000);
      const uses: Use[] = [
        { id: ITEM.raisePost(len), qty: nPosts },
        ...[...countBy(mods.map((m) => String(ccMm(m.cc))))].flatMap(([cc, n]): Use[] => {
          const plate = raisePlate({ plate: '', len, cc: +cc }, RECIPES, c.sizes);
          return [
            { id: ITEM.rail(r.raise.topRail, +cc - postW), qty: n },
            { id: ITEM.raisePlate(plate.w, plate.h), qty: n },
            ...(+cc < c.sizes.cc ? [{ id: ITEM.railCut, qty: n }] : []),
          ];
        }),
        { id: ITEM.raiseModule, qty: mods.length },
      ];
      const lm = mods.reduce((a, m) => a + m.cc, 0);
      return { ...c.line(`${id}-${len}`, lm, { ...c.built, meta: `+${len} mm` }, uses), top: raiseTop(len, c.rules) };
    });
}
