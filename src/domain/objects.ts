// Placed objects (furniture, counters): footprint, collision and placement.
// They collide with walls (post depth), textile frames (in front of their face), door swings and each other.
import type { Footprint } from '../catalog/types';
import type { Rules } from '../rules/rules';
import { pointAlong, wallDirection } from './grid';
import type { PlacedObject, Variant } from './types';
import { builtModules } from './walls';
import { defaultSwing, nextId } from './edit';
import { faceSegment, sideOf } from './decor';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  kind: 'wall' | 'door' | 'object';
  id?: string;
}

/** What placement needs to know besides the variant. */
export interface PlaceContext {
  rules: Rules;
  footprint: (product: string) => Footprint | undefined;
  /** Doors swing and block the swing area; curtains do not. */
  swings: (product: string) => boolean;
}

const GAP = 0.02;

/** Axis-aligned footprint. A quarter turn swaps width and depth. */
export function footprintBox(o: Pick<PlacedObject, 'x' | 'y' | 'rot'>, f: Footprint): Omit<Box, 'kind'> {
  const quarter = Math.round(o.rot / 90) % 2 !== 0;
  const w = quarter ? f.d : f.w;
  const d = quarter ? f.w : f.d;
  return { x0: o.x - w / 2, y0: o.y - d / 2, x1: o.x + w / 2, y1: o.y + d / 2 };
}

export function blockers(v: Variant, ctx: PlaceContext, skipId?: string): Box[] {
  const { rules, footprint: fp } = ctx;
  const out: Box[] = [];
  const half = rules.wall.post / 2;
  for (const m of builtModules(v)) {
    if (!m.opening) {
      out.push({
        x0: Math.min(m.a[0], m.b[0]) - half,
        y0: Math.min(m.a[1], m.b[1]) - half,
        x1: Math.max(m.a[0], m.b[0]) + half,
        y1: Math.max(m.a[1], m.b[1]) + half,
        kind: 'wall',
      });
    }
  }
  // A textile frame adds its depth in front of its face, along its span only
  for (const t of v.textiles) {
    const w = v.walls.find((x) => x.id === t.wallId);
    if (!w) continue;
    const s = sideOf(v, t);
    const [a, b] = faceSegment(w, s, t.from, t.from + t.width, half);
    const [c, d] = faceSegment(w, s, t.from, t.from + t.width, half + rules.textile.depth);
    const xs = [a[0], b[0], c[0], d[0]];
    const ys = [a[1], b[1], c[1], d[1]];
    out.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), kind: 'wall', id: t.id });
  }
  for (const o of v.openings) {
    const w = v.walls.find((x) => x.id === o.wallId);
    if (!w || !ctx.swings(o.product)) continue;
    const [dx, dy] = wallDirection(w);
    const s = o.swing ?? defaultSwing(v.stand, w);
    const n = [-dy * s, dx * s];
    const a = pointAlong(w, o.module);
    const b = pointAlong(w, o.module + 1);
    const r = rules.door.swing;
    const xs = [a[0], b[0], a[0] + n[0] * r, b[0] + n[0] * r];
    const ys = [a[1], b[1], a[1] + n[1] * r, b[1] + n[1] * r];
    out.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), kind: 'door', id: o.id });
  }
  for (const o of v.objects) {
    if (o.id === skipId) continue;
    const f = fp(o.product);
    if (f) out.push({ ...footprintBox(o, f), kind: 'object', id: o.id });
  }
  return out;
}

export function hits(box: Omit<Box, 'kind'>, others: Box[]): Box | null {
  const a = { x0: box.x0 + GAP, y0: box.y0 + GAP, x1: box.x1 - GAP, y1: box.y1 - GAP };
  return others.find((r) => a.x0 < r.x1 && a.x1 > r.x0 && a.y0 < r.y1 && a.y1 > r.y0) ?? null;
}

function clampInto(v: Variant, o: PlacedObject, f: Footprint): PlacedObject {
  const b = footprintBox({ ...o, x: 0, y: 0 }, f);
  const hw = b.x1;
  const hd = b.y1;
  const r = (n: number) => Math.round(n * 20) / 20;
  return { ...o, x: r(Math.max(hw, Math.min(v.stand.width - hw, o.x))), y: r(Math.max(hd, Math.min(v.stand.depth - hd, o.y))) };
}

/**
 * Nearest free spot for the object, searching outward up to `radius` metres. Null when there is no room.
 */
export function findSpot(v: Variant, ctx: PlaceContext, o: PlacedObject, radius: number): PlacedObject | null {
  const f = ctx.footprint(o.product);
  if (!f) return null;
  const bl = blockers(v, ctx, o.id);
  const start = clampInto(v, o, f);
  if (!hits(footprintBox(start, f), bl)) return start;
  for (let r = 0.05; r <= radius + 1e-9; r += 0.05) {
    let best: PlacedObject | null = null;
    let bd = Infinity;
    for (let k = 0; k < 24; k++) {
      const t = (k / 24) * Math.PI * 2;
      const q = clampInto(v, { ...o, x: o.x + Math.cos(t) * r, y: o.y + Math.sin(t) * r }, f);
      if (hits(footprintBox(q, f), bl)) continue;
      const d = Math.hypot(q.x - o.x, q.y - o.y);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    if (best) return best;
  }
  return null;
}

/** Add one object near (x, y). Null when it does not fit anywhere. */
export function addObject(v: Variant, ctx: PlaceContext, product: string, x: number, y: number): Variant | null {
  const id = nextId(v.objects.map((o) => o.id), 'i');
  const spot = findSpot(v, ctx, { id, product, x, y, rot: 0 }, Math.max(v.stand.width, v.stand.depth));
  return spot ? { ...v, objects: [...v.objects, spot] } : null;
}

/** Add one object in the first free spot, front rows first (used by the + counter). */
export function addObjectAnywhere(v: Variant, ctx: PlaceContext, product: string): Variant | null {
  const f = ctx.footprint(product);
  if (!f) return null;
  return addObject(v, ctx, product, v.stand.width / 2, Math.max(f.d / 2, v.stand.depth - f.d / 2 - 0.4));
}

/** Move an object; it may overlap while dragging, the plan shows the conflict. Kept inside the stand. */
export function moveObject(v: Variant, ctx: PlaceContext, id: string, x: number, y: number): Variant {
  return {
    ...v,
    objects: v.objects.map((o) => {
      if (o.id !== id) return o;
      const f = ctx.footprint(o.product);
      return f ? clampInto(v, { ...o, x, y }, f) : o;
    }),
  };
}

export function removeObject(v: Variant, id: string): Variant {
  return { ...v, objects: v.objects.filter((o) => o.id !== id) };
}

/** Remove the last `n` objects of a product (used by the − counter). */
export function removeObjects(v: Variant, product: string, n: number): Variant {
  const idx = v.objects.map((o, i) => (o.product === product ? i : -1)).filter((i) => i >= 0).slice(-n);
  const drop = new Set(idx);
  return { ...v, objects: v.objects.filter((_, i) => !drop.has(i)) };
}

/** Ids of objects that overlap something. */
export function conflicts(v: Variant, ctx: PlaceContext): Set<string> {
  const out = new Set<string>();
  for (const o of v.objects) {
    const f = ctx.footprint(o.product);
    if (f && hits(footprintBox(o, f), blockers(v, ctx, o.id))) out.add(o.id);
  }
  return out;
}

/**
 * After a drag: an object left overlapping something moves to the nearest free spot within 1 m,
 * or back to where the drag started. `ok` is false when it had to go back.
 */
export function settleObject(v: Variant, ctx: PlaceContext, id: string, start: { x: number; y: number }): { v: Variant; ok: boolean } {
  const o = v.objects.find((x) => x.id === id);
  if (!o || !conflicts(v, ctx).has(id)) return { v, ok: true };
  const spot = findSpot(v, ctx, o, 1);
  if (spot) return { v: { ...v, objects: v.objects.map((x) => (x.id === id ? spot : x)) }, ok: true };
  return { v: moveObject(v, ctx, id, start.x, start.y), ok: false };
}

/** After a room was moved or resized: every object left overlapping something moves to the nearest free spot within 1 m. */
export function settleAll(v: Variant, ctx: PlaceContext): Variant {
  let out = v;
  for (const id of conflicts(v, ctx)) {
    const o = out.objects.find((x) => x.id === id);
    const spot = o && findSpot(out, ctx, o, 1);
    if (spot) out = { ...out, objects: out.objects.map((x) => (x.id === id ? spot : x)) };
  }
  return out;
}
