// Takdrager per metre, its own posts included in the price; the hooks are only picked, at no cost (Bjørn 10.11.2026).
// The standard ones are the organiser's when they follow its stand walls: then the drawn ones are a line of their own,
// so the customer sees what they pay for. Byggeregel B2 (docs/byggeregler.md).
import { beamSpecs } from '../../foga/fromVariant';
import { ITEM } from '../../pricing/data';
import type { Use } from '../../pricing/model';
import type { BeamLayout } from '../beams';
import { count, toOrganiser, type CalcContext } from '../context';
import type { CalcLine } from '../types';

function beamLine(c: CalcContext, b: BeamLayout, posts: number, hooks: number, what?: string): CalcLine {
  const specs = beamSpecs(b);
  const lm = c.lmOf(b);
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
  const meta = parts.join(' + ') + ' skjøtet opp';
  return [c.line(c.sys.beamLift, n, { ...c.built, meta }, [{ id: ITEM.beamLift, qty: n }])];
}

/** The exhibitor's takdrager, and the organiser's when it pays the standard ones. */
export function beamLines(c: CalcContext): { lines: CalcLine[]; organiser: CalcLine[] } {
  const { standard, inner, all, hooks } = c.beams;
  const drawn = hooks.filter((h) => h.inner).length;
  if (c.organiserBeams) return { lines: [beamLine(c, inner, c.innerPosts, drawn, 'innvendig')], organiser: [toOrganiser(beamLine(c, standard, c.standardPosts, hooks.length - drawn))] };
  return { lines: [beamLine(c, all, c.beamPosts, hooks.length)], organiser: [] };
}
