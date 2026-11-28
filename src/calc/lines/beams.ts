// Takdrager per metre, its own posts included in the price and never named in the text: the posts are part of the beam,
// as of the wall (Bjørn 15.11.2026); the hooks are only picked, at no cost (Bjørn 10.11.2026).
// The standard ones are the organiser's when they follow its stand walls: then the drawn ones are a line of their own,
// so the customer sees what they pay for. Byggeregel B2 (docs/byggeregler.md).
import { beamSpecs } from '../../foga/fromVariant';
import { ITEM } from '../../pricing/data';
import { RECIPES } from '../../foga/recipes';
import { raiseTop } from '../../rules/rules';
import { atHeight } from '../height';
import type { Use } from '../../pricing/model';
import type { BeamLayout } from '../beams/beamSegments';
import { count, toOrganiser, type CalcContext } from '../context';
import type { CalcLine } from '../types';

function beamLine(c: CalcContext, b: BeamLayout, posts: number, hooks: number, what?: string): CalcLine {
  const specs = beamSpecs(b);
  const lm = c.lmOf(b);
  const meta = [
    ...(what ? [what] : []),
    count(b.segments.length, 'lengde', 'lengder'),
    ...(hooks ? [count(hooks, 'krok', 'kroker')] : []),
  ];
  const uses: Use[] = [
    ...specs.map((x) => ({ id: ITEM.beam(x.lengthMm - 40), qty: 1 })),
    // Byggeregel T18: the joint of each half metre
    ...(specs.some((x) => x.joined) ? [{ id: ITEM.beamHalf, qty: specs.filter((x) => x.joined).length }] : []),
    { id: ITEM.post, qty: posts },
    { id: ITEM.beamLm, qty: lm },
    { id: ITEM.beamPost, qty: posts },
  ];
  return c.line(c.sys.beam, lm, { ...c.built, meta: meta.join(' · ') }, uses);
}

/** Takdrager lifted over textile walls: one per extended post and per mixed-level hook point. Always the exhibitor's: the
 *  textile wall is. */
export function beamLiftLines(c: CalcContext): CalcLine[] {
  const { posts, hooks, walls } = c.lift;
  const n = posts.length + hooks.length + walls.length;
  const parts = [
    ...(posts.length || !(hooks.length + walls.length) ? [count(posts.length, 'stolpe', 'stolper')] : []),
    ...(hooks.length ? [count(hooks.length, 'krok', 'kroker')] : []),
    ...(walls.length ? [`${walls.length} oppå vegg`] : []),
  ];
  // Byggeregel T19: lifted higher than 80, each piece is a 94 in a raise length with its 609, as on a raised wall, and
  // the work is up at the beam's top (cost rule 6)
  const { length } = c.lift;
  if (length === RECIPES.beam.lift.length) return [c.line(c.sys.beamLift, n, { ...c.built, meta: parts.join(' + ') + ' skjøtet opp' }, [{ id: ITEM.beamLift, qty: n }])];
  const top = raiseTop(length, c.rules);
  const meta = `${parts.join(' + ')} skjøtet opp ${length} mm`;
  return [{ ...c.line(c.sys.beamLift, n, { ...c.built, meta }, atHeight(c, [{ id: ITEM.raisePost(length), qty: n }], top)), top }];
}

/** The exhibitor's takdrager, and the organiser's when it pays the standard ones. */
export function beamLines(c: CalcContext): { lines: CalcLine[]; organiser: CalcLine[] } {
  const { standard, inner, all, hooks } = c.beams;
  const drawn = hooks.filter((h) => h.inner).length;
  if (c.organiserBeams) return { lines: [beamLine(c, inner, c.innerPosts, drawn, 'innvendig')], organiser: [toOrganiser(beamLine(c, standard, c.standardPosts, hooks.length - drawn))] };
  return { lines: [beamLine(c, all, c.beamPosts, hooks.length)], organiser: [] };
}
