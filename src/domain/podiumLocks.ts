// Parts of a counter of Disker og podier locked to a plate (Byggeregel K16): a part with a wall or another counter nearer
// than 60 mm outside it is built, drawn and priced as a plate whatever its side says; the choice is kept, and comes back
// when the counter is moved out. Pure, on the variant.
import { counterBuildOf, toPlan } from './counterShape';
import { blockers, type PlaceContext } from './objects';
import { partKey, podiumParts, type PodiumPart } from './podiumFaces';
import { RECIPES } from '../foga/recipes';
import type { CounterBuild } from '../foga/counter';
import type { PlacedObject, Variant } from './types';

const FACE = RECIPES.counter.face;
/** «Mot vegg»: something nearer than this outside a part, mm (Bjørn 13.11.2026). */
export const AGAINST = 60;

/** What a part stands against: a wall (or a textile frame on one), another counter, or nothing. */
export type PartLock = 'wall' | 'counter' | null;

/** What stands within AGAINST outside each part of `o`, by partKey; parts with nothing against them are left out. */
export function partLocks(v: Variant, ctx: Pick<PlaceContext, 'rules' | 'footprint' | 'swings' | 'isCounter'>, o: PlacedObject): Map<string, Exclude<PartLock, null>> {
  const out = new Map<string, Exclude<PartLock, null>>();
  if (!o.sections?.length) return out;
  const others = blockers(v, ctx as PlaceContext, o.id).filter((b) => b.kind === 'wall' || (b.kind === 'object' && isCounterId(v, ctx, b.id)));
  if (!others.length) return out;
  for (const p of podiumParts(o.sections)) {
    const box = outside(o, p);
    const hit = others.find((r) => box.x0 < r.x1 - 1e-9 && box.x1 > r.x0 + 1e-9 && box.y0 < r.y1 - 1e-9 && box.y1 > r.y0 + 1e-9);
    if (hit) out.set(partKey(p), hit.kind === 'wall' ? 'wall' : 'counter');
  }
  return out;
}

const isCounterId = (v: Variant, ctx: Pick<PlaceContext, 'isCounter'>, id?: string) => {
  const x = v.objects.find((o) => o.id === id);
  return !!x && (!!x.sections || !!x.pieces || ctx.isCounter(x.product));
};

/** The band outside a part on the plan, m: from its outer face out AGAINST, along it less a mm each end (a counter or
 *  wall only touching its corner does not lock it), from half a mm inside the face so one standing flush counts. */
function outside(o: PlacedObject, p: PodiumPart) {
  const near = p.at + p.out * (FACE - 0.5);
  const far = p.at + p.out * (FACE + AGAINST);
  const [u0, u1] = [p.a + 1, p.b - 1];
  const pts = p.axis === 'x' ? [toPlan(o, [near, u0]), toPlan(o, [far, u1])] : [toPlan(o, [u0, near]), toPlan(o, [u1, far])];
  return { x0: Math.min(pts[0][0], pts[1][0]), x1: Math.max(pts[0][0], pts[1][0]), y0: Math.min(pts[0][1], pts[1][1]), y1: Math.max(pts[0][1], pts[1][1]) };
}

/** The partKeys of `o` locked to a plate (K16). */
export const lockedParts = (v: Variant, ctx: Pick<PlaceContext, 'rules' | 'footprint' | 'swings' | 'isCounter'>, o: PlacedObject): string[] =>
  // Only a side that is not a plate can be held to one
  o.sections?.some((s) => s.sides) ? [...partLocks(v, ctx, o).keys()].sort() : [];

/** The build of a counter as it stands in the sketch: a counter of Disker og podier with its locked parts plates (K16),
 *  any other as counterBuildOf. */
export function placedBuild(v: Variant, ctx: Pick<PlaceContext, 'rules' | 'footprint' | 'swings' | 'isCounter'>, o: PlacedObject, size?: { length: number; depth: number }): CounterBuild {
  return counterBuildOf(o, size, o.sections ? lockedParts(v, ctx, o) : []);
}
