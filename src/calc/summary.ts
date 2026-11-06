// From the quote lines to the result: groups, margin, time, key figures, the BOM and the organiser's block.
import { groupItems } from '../catalog/groups';
import { openSides } from '../domain/grid';
import { beamSpecs } from '../foga/fromVariant';
import { bom } from '../foga/engine';
import { RECIPES } from '../foga/recipes';
import { addTime, dgOf, type Time } from '../pricing/model';
import type { CalcContext } from './context';
import { foilAreas } from './lines/decor';
import { floorAreas } from './lines/floor';
import type { CalcGroup, CalcLine, CalcResult } from './types';

export function summary(c: CalcContext, lines: CalcLine[], organiserLines: CalcLine[]): CalcResult {
  const { v, walled, kindOf, theirs, organiserBeams, beams, allPosts, wallFeet, mods, prod, foga } = c;
  const groups: CalcGroup[] = groupItems(lines, (l) => l.group).map(({ group, subgroups }) => {
    const ls = subgroups.flatMap((x) => x.items);
    return { id: group.id, name: group.name, lines: ls, sum: ls.reduce((a, l) => a + l.sum, 0), cost: ls.reduce((a, l) => a + (l.cost ?? 0), 0) };
  });

  const time = lines.reduce<Time>((a, l) => addTime(a, l.time), {});
  const known = lines.filter((l) => l.cost !== null);
  const knownSum = known.reduce((a, l) => a + l.sum, 0);
  const knownCost = known.reduce((a, l) => a + l.cost!, 0);
  const { floor, floorTotal } = floorAreas(v);
  const foil = foilAreas(c);

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
      organiserBeamLm: organiserBeams ? c.lmOf(beams.standard) : 0,
      innerBeamLm: c.lmOf(beams.inner),
      beamHooks: beams.hooks,
      innerWallLm: walled.filter((m) => kindOf(m) === 'inner').length,
      roomWallLm: walled.filter((m) => kindOf(m) === 'room').length,
      swapLm: c.swaps.length,
      openings: foga.modules.filter((m) => m.opening).length,
      beamLm: c.lmOf(beams.all),
      beamLengths: beamSpecs(beams.all).length,
      posts: allPosts.size,
      beamPosts: c.beamPosts,
      wallSupports: wallFeet.length,
      modules: mods.length,
      floor,
      floorTotal,
      textileM2: prod.area,
      foilM2: foil.full + foil.decal,
      time,
    },
    beams: c.lift.segments.size ? { ...beams.all, segments: beams.all.segments.map((s) => (c.lift.segments.has(s) ? { ...s, lifted: true as const } : s)) } : beams.all,
    ...(c.lift.segments.size ? { lift: { posts: c.lift.posts, hooks: c.lift.hooks } } : {}),
    posts: [...allPosts.values()],
    wallSupports: wallFeet,
    production: prod,
    foga,
    bom: bom(foga, RECIPES, c.sizes),
    organiser: { lines: organiserLines, sum: organiserLines.reduce((a, l) => a + l.sum, 0), cost: organiserLines.reduce((a, l) => a + (l.cost ?? 0), 0) },
  };
}
