// Editing innvendige takdragere: drawn straight on the 1 m grid inside the stand, never along a wall or on top of
// another beam. Layout, posts, hooks and foot plates: calc/innerBeams.ts.
import { nextId, segmentKeys as keys } from './edit';
import type { InnerBeam, Point, Variant } from './types';
import { builtModules } from './walls';

/** A straight run the brush refuses to lie along: a standard beam (from the calc). */
export interface Run {
  from: Point;
  to: Point;
}

export type BeamEdit = { v: Variant; id: string } | { error: string };

const inStand = (v: Variant, [x, y]: Point) => x >= 0 && y >= 0 && x <= v.stand.width && y <= v.stand.depth;

/** Why a beam from a to b can not go there, or null. `others`: drawn beams it must not lie on (itself left out). */
function refusal(v: Variant, a: Point, b: Point, standard: readonly Run[], others: readonly InnerBeam[]): string | null {
  if (a[0] !== b[0] && a[1] !== b[1]) return 'Takdrageren må gå rett langs rutenettet';
  if (!inStand(v, a) || !inStand(v, b)) return 'Takdrageren må stå innenfor standen';
  const ks = keys(a, b);
  if (!ks.length) return 'Takdrageren må være minst 1 m';
  const walls = new Set(builtModules(v).map((m) => m.key));
  if (ks.some((k) => walls.has(k))) return 'Takdrageren kan ikke gå langs en vegg';
  const beams = new Set([...standard, ...others].flatMap((r) => keys(r.from, r.to)));
  if (ks.some((k) => beams.has(k))) return 'Det går allerede en takdrager her';
  return null;
}

/** Draw a takdrager from a to b. `standard`: the standard beams it may not lie along. */
export function drawInnerBeam(v: Variant, a: Point, b: Point, standard: readonly Run[]): BeamEdit {
  const beams = v.innerBeams ?? [];
  const why = refusal(v, a, b, standard, beams);
  if (why) return { error: why };
  const id = nextId(beams.map((x) => x.id), 'td');
  return { v: { ...v, innerBeams: [...beams, { id, from: a, to: b }] }, id };
}

/** Take the part from a to b out of every drawn beam it lies along: a beam is split where a piece is taken out. */
export function eraseInnerBeams(v: Variant, a: Point, b: Point): Variant {
  const gone = new Set(keys(a, b));
  const beams = v.innerBeams ?? [];
  const out: InnerBeam[] = [];
  let changed = false;
  for (const x of beams) {
    const ks = keys(x.from, x.to);
    if (!ks.some((k) => gone.has(k))) {
      out.push(x);
      continue;
    }
    changed = true;
    const dx = Math.sign(x.to[0] - x.from[0]);
    const dy = Math.sign(x.to[1] - x.from[1]);
    const at = (t: number): Point => [x.from[0] + dx * t, x.from[1] + dy * t];
    let start: number | null = null;
    let first = true;
    for (let i = 0; i <= ks.length; i++) {
      const keep = i < ks.length && !gone.has(ks[i]);
      if (keep && start === null) start = i;
      if (!keep && start !== null) {
        const id = first ? x.id : nextId([...beams, ...out].map((y) => y.id), 'td');
        out.push({ id, from: at(start), to: at(i) });
        first = false;
        start = null;
      }
    }
  }
  return changed ? { ...v, innerBeams: out } : v;
}

export const removeInnerBeam = (v: Variant, id: string): Variant => ({ ...v, innerBeams: (v.innerBeams ?? []).filter((x) => x.id !== id) });

/** Move a drawn beam `delta` whole metres sideways and `along` in its own direction. Returns v when it would not fit. */
export function moveInnerBeam(v: Variant, id: string, delta: number, along: number, standard: readonly Run[]): Variant {
  const beams = v.innerBeams ?? [];
  const x = beams.find((y) => y.id === id);
  if (!x || (!delta && !along)) return v;
  const h = x.from[1] === x.to[1];
  const shift = ([px, py]: Point): Point => (h ? [px + along, py + delta] : [px + delta, py + along]);
  const from = shift(x.from);
  const to = shift(x.to);
  if (refusal(v, from, to, standard, beams.filter((y) => y.id !== id))) return v;
  return { ...v, innerBeams: beams.map((y) => (y.id === id ? { ...y, from, to } : y)) };
}

/** The drawn beam nearest p within `within` m. */
export function innerBeamAt(v: Variant, p: { x: number; y: number }, within = 0.15): InnerBeam | undefined {
  let best: InnerBeam | undefined;
  let bd = within;
  for (const x of v.innerBeams ?? []) {
    const lo = [Math.min(x.from[0], x.to[0]), Math.min(x.from[1], x.to[1])];
    const hi = [Math.max(x.from[0], x.to[0]), Math.max(x.from[1], x.to[1])];
    const d = Math.hypot(p.x - Math.max(lo[0], Math.min(hi[0], p.x)), p.y - Math.max(lo[1], Math.min(hi[1], p.y)));
    if (d < bd) {
      bd = d;
      best = x;
    }
  }
  return best;
}
