// Mållinjer for fritt plasserte innvendige takdragere (Byggeregel T15, Bjørn 10.11.2026): from each end of a drawn beam
// off the 1 m grid, along the wall or beam it hangs on, to the nearest fixed point there (a post, or another hook), so the
// montør can measure it out. A free end on a half metre along the beam (Byggeregel T8, Bjørn 15.11.2026) is measured
// along the beam to the nearest wall or stand edge across it, as V12. The plan shows them on the beam being moved or
// selected, the work order for every one.
import { offGrid } from '../../domain/innerBeams';
import { onSpan, pointKey } from '../../domain/grid';
import { nearestAcross, whole } from '../../domain/wallOffsets';
import { builtModules } from '../../domain/walls';
import type { Point, Variant } from '../../domain/types';
import type { CalcResult } from '../calc';

export interface BeamOffset {
  beamId: string;
  /** The beam's end, on the wall or beam it hangs on. */
  from: Point;
  /** The nearest post or hook along that wall or beam. */
  to: Point;
  /** Distance, m. */
  length: number;
}

const EPS = 1e-6;

/** The measures of every drawn beam off the grid, or of one (`id`). */
export function beamOffsets(v: Variant, res: Pick<CalcResult, 'posts' | 'hooks' | 'lift'>, id?: string): BeamOffset[] {
  const fixed = [...res.posts, ...res.hooks.map((h) => h.at)];
  const hung = new Set([...res.hooks.map((h) => h.at), ...(res.lift?.walls ?? []), ...(res.lift?.hooks ?? [])].map(pointKey));
  const out: BeamOffset[] = [];
  const mods = builtModules(v);
  for (const b of v.innerBeams ?? []) {
    if (id && b.id !== id) continue;
    const h = b.from[1] === b.to[1];
    // Along the beam: x for a beam along x
    const k = h ? 0 : 1;
    for (const e of [b.from, b.to]) {
      // A free end on a half metre: on no wall, beam or hook
      if (whole(e[k]) || hung.has(pointKey(e)) || mods.some((m) => onSpan(m.a, m.b, e))) continue;
      const q = nearestAcross(v.stand, mods, e, k);
      if (q) out.push({ beamId: b.id, from: e, to: q, length: Math.round(Math.abs(q[k] - e[k]) * 1000) / 1000 });
    }
    if (!offGrid(b)) continue;
    // Across the beam: x for a beam along y, y for one along x
    const ax = h ? 1 : 0;
    for (const e of [b.from, b.to]) {
      if (!hung.has(pointKey(e))) continue;
      let best: Point | null = null;
      for (const p of fixed) {
        if (Math.abs(p[1 - ax] - e[1 - ax]) > EPS || Math.abs(p[ax] - e[ax]) < EPS) continue;
        if (!best || Math.abs(p[ax] - e[ax]) < Math.abs(best[ax] - e[ax])) best = p;
      }
      if (best) out.push({ beamId: b.id, from: e, to: best, length: Math.round(Math.abs(best[ax] - e[ax]) * 1000) / 1000 });
    }
  }
  return out;
}
