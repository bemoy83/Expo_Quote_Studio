// Walls per metre: the exhibitor's stand walls, then inner and room walls, each per colour. The organiser's stand walls,
// when it pays them, are a line of their own for the organiser.
import { countBy, toOrganiser, type CalcContext } from '../context';
import type { CalcLine } from '../types';

/** Wall per metre in one colour. A module with a door or curtain is never wall: it is in the opening product. A shorter
 *  module (Byggeregel V1) is its metres at the same price per metre, and its cut parts and the cutting in the cost. */
function wallLine(c: CalcContext, ral: string, mods: readonly { cc: number }[], meta: string, postShare = c.ourShare): CalcLine {
  const hit = c.idx.wallByRal.get(ral);
  const uses = c.wallUses(mods, postShare);
  const lm = mods.reduce((a, m) => a + m.cc, 0);
  const extra = { ...c.built, meta: `${meta} · RAL ${ral}` };
  return hit ? c.line(hit.variant.artnr, lm, extra, uses) : c.line(`${c.sys.wall}-${ral}`, lm, { ...extra, group: 'vegg.vegger' }, uses);
}

export function wallLines(c: CalcContext): CalcLine[] {
  const ourWalled = c.ours.filter((m) => !m.opening);
  return [true, false].flatMap((stand) => {
    const mods = ourWalled.filter((m) => (c.kindOf(m) === 'stand') === stand);
    return [...countBy(mods.map((m) => m.plate)).keys()].map((ral) => wallLine(c, ral, mods.filter((m) => m.plate === ral), stand ? 'Standvegg' : 'Innervegg'));
  });
}

/** The organiser's stand walls, in the organiser's colour, on their own posts. */
export function organiserWallLines(c: CalcContext): CalcLine[] {
  const { theirs, theirPoints, standWalls } = c;
  return theirs.length ? [toOrganiser(wallLine(c, standWalls.ral, theirs, 'Standvegg', c.share(theirPoints.size, theirs.length)))] : [];
}
