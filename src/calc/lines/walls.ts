// Walls: the exhibitor's stand walls, then inner and room walls, each per colour, whole modules per metre and shorter
// ones per piece (Byggeregel V1). The organiser's stand walls,
// when it pays them, are a line of their own for the organiser.
import { countBy, toOrganiser, type CalcContext } from '../context';
import type { CalcLine } from '../types';

/** Wall in one colour: whole modules per metre, a shorter module (Byggeregel V1) per piece of its own product, priced as
 *  a whole metre (Bjørn 14.11.2026), its cut parts and the cutting in the cost. A module with a door or curtain is never
 *  wall: it is in the opening product. */
function wallLine(c: CalcContext, ral: string, mods: readonly { cc: number }[], meta: string, postShare = c.ourShare): CalcLine[] {
  const extra = { ...c.built, meta: `${meta} · RAL ${ral}` };
  const whole = mods.filter((m) => !shortOf(c, m, ral));
  const short = countBy(mods.map((m) => shortOf(c, m, ral)).filter((id): id is string => !!id));
  const perMetre = whole.length ? [lmLine(c, ral, whole, extra, postShare)] : [];
  return [
    ...perMetre,
    ...[...short.keys()].map((id) => c.line(`${id}-${ral}`, short.get(id)!, extra, c.wallUses(mods.filter((m) => shortOf(c, m, ral) === id), postShare))),
  ];
}

/** The product of a shorter module, when the catalog has one for its length and colour; else it is sold by the metre. */
function shortOf(c: CalcContext, m: { cc: number }, ral: string): string | undefined {
  if (m.cc >= c.rules.wall.cc - 1e-6) return undefined;
  const id = c.sys.shortWalls?.[Math.round(m.cc * 1000)];
  return id && c.idx.byArtnr.has(`${id}-${ral}`) ? id : undefined;
}

function lmLine(c: CalcContext, ral: string, mods: readonly { cc: number }[], extra: Partial<CalcLine>, postShare: number): CalcLine {
  const hit = c.idx.wallByRal.get(ral);
  const uses = c.wallUses(mods, postShare);
  const lm = mods.reduce((a, m) => a + m.cc, 0);
  return hit ? c.line(hit.variant.artnr, lm, extra, uses) : c.line(`${c.sys.wall}-${ral}`, lm, { ...extra, group: 'vegg.vegger' }, uses);
}

export function wallLines(c: CalcContext): CalcLine[] {
  const ourWalled = c.ours.filter((m) => !m.opening);
  return [true, false].flatMap((stand) => {
    const mods = ourWalled.filter((m) => (c.kindOf(m) === 'stand') === stand);
    return [...countBy(mods.map((m) => m.plate)).keys()].flatMap((ral) => wallLine(c, ral, mods.filter((m) => m.plate === ral), stand ? 'Standvegg' : 'Innervegg'));
  });
}

/** The organiser's stand walls, in the organiser's colour, on their own posts. */
export function organiserWallLines(c: CalcContext): CalcLine[] {
  const { theirs, theirPoints, standWalls } = c;
  return theirs.length ? wallLine(c, standWalls.ral, theirs, 'Standvegg', c.share(theirPoints.size, theirs.length)).map(toOrganiser) : [];
}
