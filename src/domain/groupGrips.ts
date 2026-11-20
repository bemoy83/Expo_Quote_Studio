// Byggeregel M6: inner walls and free-standing textile walls in the shared grip system (domain/grips.ts), as counters
// and rooms: an end grip on each free end (V13, X12), a corner grip where two arms meet, a move grip and a turn grip for
// a group that stands free (M2). Pure.
import type { Rules } from '../rules/rules';
import { slideWall } from './edit';
import { placeGroup, slideTextile, type Group, type Part } from './joints';
import type { Point, Variant } from './types';
import { freeTextiles } from './textile/mounts';

const EPS = 1e-6;

type Seg = { from: Point; to: Point };

/** Where a part stands, if it is there. */
export function segOf(v: Variant, p: Part): Seg | undefined {
  return p.kind === 'wall' ? v.walls.find((w) => w.id === p.id) : freeTextiles(v).find((t) => t.id === p.id);
}

const horizontal = (s: Seg) => Math.abs(s.from[1] - s.to[1]) < EPS;
const same = (p: Point, q: Point) => Math.abs(p[0] - q[0]) < EPS && Math.abs(p[1] - q[1]) < EPS;

/** A corner of a group: where an end of an arm along x (`h`) meets an end of an arm along y (`v`). */
export interface CornerGrip {
  at: Point;
  h: Part;
  v: Part;
}

/** Byggeregel M6: the corners of a group, where two of its arms meet end to end at a right angle. */
export function cornerGrips(v: Variant, g: Group): CornerGrip[] {
  const parts: Part[] = [...g.walls.map((id) => ({ kind: 'wall' as const, id })), ...g.textiles.map((id) => ({ kind: 'textile' as const, id }))];
  const out: CornerGrip[] = [];
  for (const a of parts) {
    const sa = segOf(v, a);
    if (!sa || !horizontal(sa)) continue;
    for (const b of parts) {
      const sb = segOf(v, b);
      if (!sb || horizontal(sb)) continue;
      for (const p of [sa.from, sa.to]) if (same(p, sb.from) || same(p, sb.to)) out.push({ at: p, h: a, v: b });
    }
  }
  return out;
}

/** One arm moved across itself, what is joined to it stretching (M3); null when it cannot. */
function slide(v: Variant, rules: Rules, p: Part, ox: number, oy: number): Variant | null {
  if (p.kind === 'textile') return slideTextile(v, rules, p.id, ox, oy);
  const next = slideWall(v, p.id, ox || oy, 0, rules);
  return next === v ? null : next;
}

/**
 * Byggeregel M6: a corner grip moved (dx, dy): the arm along y moves dx sideways and the arm along x moves dy sideways,
 * each stretching what ends on it, so the corner goes where the grip is and both arms grow or shrink. Null when it cannot.
 */
export function dragCorner(v: Variant, rules: Rules, c: CornerGrip, dx: number, dy: number): Variant | null {
  let x: Variant | null = v;
  if (dx) x = slide(x, rules, c.v, dx, 0);
  if (x && dy) x = slide(x, rules, c.h, 0, dy);
  return x;
}

/** The box round a group, plan m. */
export function groupBox(v: Variant, g: Group): { x0: number; y0: number; x1: number; y1: number } {
  const pts = [...g.walls.map((id) => ({ kind: 'wall' as const, id })), ...g.textiles.map((id) => ({ kind: 'textile' as const, id }))]
    .map((p) => segOf(v, p))
    .flatMap((s) => (s ? [s.from, s.to] : []));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/**
 * Byggeregel M6: a group that stands free turned `quarters` quarter turns clockwise in the plan round the middle of its
 * box, on the 250 grid, moved back inside the stand where it would stick out. Doors, shelves and textiles on its walls
 * turn with them. Null when it cannot stand there.
 */
export function turnGroup(v: Variant, rules: Rules, g: Group, quarters: number): Variant | null {
  const q = ((quarters % 4) + 4) % 4;
  if (!q || g.anchored) return q ? null : v;
  const b = groupBox(v, g);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const turn = (p: Point): Point => {
    let r = p;
    for (let i = 0; i < q; i++) r = [cx - (r[1] - cy), cy + (r[0] - cx)];
    return r;
  };
  // Turned, its box: on the grid, and inside the stand
  const w = q % 2 ? b.y1 - b.y0 : b.x1 - b.x0;
  const d = q % 2 ? b.x1 - b.x0 : b.y1 - b.y0;
  if (w > v.stand.width + EPS || d > v.stand.depth + EPS) return null;
  const grid = rules.textile.grid;
  const x0 = cx - w / 2;
  const y0 = cy - d / 2;
  const snapped = (a: number, size: number, max: number) => Math.min(Math.max(Math.round(a / grid) * grid, 0), max - size);
  const sx = snapped(x0, w, v.stand.width) - x0;
  const sy = snapped(y0, d, v.stand.depth) - y0;
  return placeGroup(v, rules, g, (p) => {
    const r = turn(p);
    return [r[0] + sx, r[1] + sy];
  });
}
