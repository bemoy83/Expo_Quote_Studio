// Placed objects (furniture, counters): footprint, collision and placement.
// They collide with walls (post depth), textile frames (in front of their face), door swings and each other.
import type { Footprint } from '../catalog/types';
import type { Rules } from '../rules/rules';
import { pointAlong, wallDirection } from './grid';
import type { PlacedObject, Variant } from './types';
import { builtModules } from './walls';
import { doorSwing } from './doors';
import { nextId } from './ids';
import { faceSegment, sideOf } from './faces';
import { RECIPES } from '../foga/recipes';
import { pieceRects, piecesFootprint, toPlan } from './counterShape';

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
  /** A counter (Byggeregel K1): drawn by the Disker pen, its ends drawn on from (K7). */
  isCounter: (product: string) => boolean;
}

const GAP = 0.02;

/** An object's footprint: its product's, or the box round a drawn counter (Byggeregel K7). */
export function objectFootprint(ctx: Pick<PlaceContext, 'footprint'>, o: Pick<PlacedObject, 'product' | 'pieces'>): Footprint | undefined {
  const f = ctx.footprint(o.product);
  return f && piecesFootprint(o, f);
}

/** What an object covers in the plan, m: its footprint box, or one box per piece of a drawn counter (K7), so an L
 *  leaves its open corner free. */
export function objectBoxes(ctx: Pick<PlaceContext, 'footprint'>, o: Pick<PlacedObject, 'product' | 'pieces' | 'x' | 'y' | 'rot'>): Omit<Box, 'kind'>[] {
  const f = objectFootprint(ctx, o);
  if (!f) return [];
  if (!o.pieces || o.pieces.length < 2) return [footprintBox(o, f)];
  // Rounded, so an L's arm and the thing it meets are not a float apart
  const mm = (n: number) => Math.round(n * 1e6) / 1e6;
  const plan = (x: number, y: number) => toPlan(o, [x, y]).map(mm);
  return pieceRects(o).map((r) => {
    const [ax, ay] = plan(r.x0, r.y0);
    const [bx, by] = plan(r.x1, r.y1);
    return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
  });
}

/** Moved by (dx, dy). */
const shifted = (b: Omit<Box, 'kind'>, dx: number, dy: number) => ({ x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy });

/** Axis-aligned footprint. A quarter turn swaps width and depth. */
export function footprintBox(o: Pick<PlacedObject, 'x' | 'y' | 'rot'>, f: Footprint): Omit<Box, 'kind'> {
  const quarter = Math.round(o.rot / 90) % 2 !== 0;
  const w = quarter ? f.d : f.w;
  const d = quarter ? f.w : f.d;
  return { x0: o.x - w / 2, y0: o.y - d / 2, x1: o.x + w / 2, y1: o.y + d / 2 };
}

export function blockers(v: Variant, ctx: PlaceContext, skipId?: string): Box[] {
  const { rules } = ctx;
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
    const s = doorSwing(v.stand, w, o);
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
    for (const b of objectBoxes(ctx, o)) out.push({ ...b, kind: 'object', id: o.id });
  }
  return out;
}

/** The first of `others` any of `boxes` hits. */
export function hitsAny(boxes: Omit<Box, 'kind'>[], others: Box[]): Box | null {
  for (const b of boxes) {
    const h = hits(b, others);
    if (h) return h;
  }
  return null;
}

export function hits(box: Omit<Box, 'kind'>, others: Box[]): Box | null {
  const a = { x0: box.x0 + GAP, y0: box.y0 + GAP, x1: box.x1 - GAP, y1: box.y1 - GAP };
  return others.find((r) => a.x0 < r.x1 && a.x1 > r.x0 && a.y0 < r.y1 && a.y1 > r.y0) ?? null;
}

function clampInto(v: Variant, o: PlacedObject, f: Footprint): PlacedObject {
  const b = footprintBox({ ...o, x: 0, y: 0 }, f);
  const hw = b.x1;
  const hd = b.y1;
  // On the 5 cm grid, never rounded out past the edge (a 1020 counter at the edge: 5,49 is 5,45, not 5,50)
  const r = (n: number, lo: number, hi: number) => {
    const q = Math.round(Math.max(lo, Math.min(hi, n)) * 20) / 20;
    return q > hi + 1e-9 ? Math.floor(hi * 20) / 20 : q < lo - 1e-9 ? Math.ceil(lo * 20) / 20 : q;
  };
  return { ...o, x: r(o.x, hw, v.stand.width - hw), y: r(o.y, hd, v.stand.depth - hd) };
}

/**
 * Nearest free spot for the object, searching outward up to `radius` metres. Null when there is no room.
 */
export function findSpot(v: Variant, ctx: PlaceContext, o: PlacedObject, radius: number): PlacedObject | null {
  const f = objectFootprint(ctx, o);
  if (!f) return null;
  const bl = blockers(v, ctx, o.id);
  const boxes = objectBoxes(ctx, o);
  const free = (q: PlacedObject) => !hitsAny(boxes.map((b) => shifted(b, q.x - o.x, q.y - o.y)), bl);
  const start = clampInto(v, o, f);
  if (free(start)) return start;
  for (let r = 0.05; r <= radius + 1e-9; r += 0.05) {
    let best: PlacedObject | null = null;
    let bd = Infinity;
    for (let k = 0; k < 24; k++) {
      const t = (k / 24) * Math.PI * 2;
      const q = clampInto(v, { ...o, x: o.x + Math.cos(t) * r, y: o.y + Math.sin(t) * r }, f);
      if (!free(q)) continue;
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
/** Place a product at x, y or the nearest free spot; a counter (`ral`) with its plates in that colour (Byggeregel K6). */
export function addObject(v: Variant, ctx: PlaceContext, product: string, x: number, y: number, ral?: string): Variant | null {
  const id = nextId(v.objects.map((o) => o.id), 'i');
  const colour = ral && ral !== COUNTER_STOCK_RAL ? { ral } : {};
  const spot = findSpot(v, ctx, { id, product, x, y, rot: 0, ...colour }, Math.max(v.stand.width, v.stand.depth));
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
      const f = objectFootprint(ctx, o);
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
    if (hitsAny(objectBoxes(ctx, o), blockers(v, ctx, o.id))) out.add(o.id);
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

/**
 * Turn an object a quarter turn (rot 0, 90, 180, 270), settled as after a drag: moved to the nearest free spot within
 * 1 m when it collides. Null when it does not fit turned.
 */
export function rotateObject(v: Variant, ctx: PlaceContext, id: string): Variant | null {
  const o = v.objects.find((x) => x.id === id);
  const f = o && objectFootprint(ctx, o);
  if (!o || !f) return null;
  const rot = (o.rot + 90) % 360;
  if (!fitsStand(v, footprintBox({ x: 0, y: 0, rot }, f))) return null;
  const turned = clampInto(v, { ...o, rot }, f);
  const r = settleObject({ ...v, objects: v.objects.map((x) => (x.id === id ? turned : x)) }, ctx, id, turned);
  return r.ok ? r.v : null;
}

/**
 * Swap an object for another variant of the same product (a colour), keeping its place and turn; settled as after a
 * drag when the new one is larger. Null when it does not fit.
 */
export function setObjectProduct(v: Variant, ctx: PlaceContext, id: string, product: string): Variant | null {
  const o = v.objects.find((x) => x.id === id);
  const f = ctx.footprint(product);
  if (!o || !f) return null;
  if (!fitsStand(v, footprintBox({ x: 0, y: 0, rot: o.rot }, f))) return null;
  const swapped = clampInto(v, { ...o, product }, f);
  const r = settleObject({ ...v, objects: v.objects.map((x) => (x.id === id ? swapped : x)) }, ctx, id, swapped);
  return r.ok ? r.v : null;
}

/** The footprint is no wider or deeper than the stand. */
const fitsStand = (v: Variant, b: Omit<Box, 'kind'>) => b.x1 - b.x0 <= v.stand.width + 1e-9 && b.y1 - b.y0 <= v.stand.depth + 1e-9;

/** Colour of a counter's plates in stock (Byggeregel K6). */
export const COUNTER_STOCK_RAL = RECIPES.counter.stock.ral;

/** The colour of a counter's plates (K6): its own, else as in stock. */
export const counterRal = (o: Pick<PlacedObject, 'ral'>): string => o.ral ?? COUNTER_STOCK_RAL;

/** A counter's plates in `ral`, all of them (K6). The stock colour is stored as none. */
export function setCounterRal(v: Variant, id: string, ral: string): Variant {
  return { ...v, objects: v.objects.map((o) => (o.id === id ? withRal(o, ral) : o)) };
}

/** The Disker pen's bucket: every counter on the stand in `ral` (K6). */
export function paintCounters(v: Variant, ctx: Pick<PlaceContext, 'isCounter'>, ral: string): Variant {
  return { ...v, objects: v.objects.map((o) => (ctx.isCounter(o.product) ? withRal(o, ral) : o)) };
}

function withRal(o: PlacedObject, ral: string): PlacedObject {
  const { ral: _, ...rest } = o;
  return ral === COUNTER_STOCK_RAL ? rest : { ...rest, ral };
}
