// Placed objects (furniture, counters): footprint, collision and placement.
// They collide with walls (post depth), textile frames (in front of their face), door swings and each other.
import type { Footprint, SetPiece } from '../catalog/types';
import type { Rules } from '../rules/rules';
import { pointAlong, wallDirection, moduleEnd } from './grid';
import type { PlacedObject, Variant } from './types';
import { builtModules } from './walls';
import { doorSwing } from './doors';
import { nextId } from './ids';
import { faceSegment, sideOf } from './faces';
import { RECIPES } from '../foga/recipes';
import { counterFootprint, sectionRects, toPlan } from './counterShape';

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
  /** A counter (Byggeregel K1): built of Foga profiles, of Disker og podier or the counter in stock (K10, K22). */
  isCounter: (product: string) => boolean;
}

const GAP = 0.02;

/** An object's footprint: its product's, or the box round a counter of Disker og podier (Byggeregel K10). */
export function objectFootprint(ctx: Pick<PlaceContext, 'footprint'>, o: Pick<PlacedObject, 'product' | 'sections'>): Footprint | undefined {
  const f = ctx.footprint(o.product);
  return f && counterFootprint(o, f);
}

/** What an object covers in the plan, m: its footprint box, or one box per section of Disker og podier (K10), so an L
 *  leaves its open corner free. */
export function objectBoxes(ctx: Pick<PlaceContext, 'footprint'>, o: Pick<PlacedObject, 'product' | 'sections' | 'x' | 'y' | 'rot'>): Omit<Box, 'kind'>[] {
  const f = objectFootprint(ctx, o);
  if (!f) return [];
  if (!o.sections) return [footprintBox(o, f)];
  const rects = sectionRects(o);
  // Rounded, so an L's arm and the thing it meets are not a float apart
  const mm = (n: number) => Math.round(n * 1e6) / 1e6;
  const plan = (x: number, y: number) => toPlan(o, [x, y]).map(mm);
  return rects.map((r) => {
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

/** The objects that move, turn and settle as one with `o`: its furniture set, else `o` alone. */
export const setMembers = (v: Variant, o: PlacedObject): PlacedObject[] => (o.set ? v.objects.filter((x) => x.set === o.set) : [o]);

/** What stands in the way of the object `skipId`: walls, textiles, door swings and every other object but those of its
 *  own set. */
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
    const b = pointAlong(w, moduleEnd(w, o.module));
    const r = rules.door.swing;
    const xs = [a[0], b[0], a[0] + n[0] * r, b[0] + n[0] * r];
    const ys = [a[1], b[1], a[1] + n[1] * r, b[1] + n[1] * r];
    out.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), kind: 'door', id: o.id });
  }
  const self = skipId !== undefined ? v.objects.find((o) => o.id === skipId) : undefined;
  const own = self?.set;
  for (const o of v.objects) {
    if (o.id === skipId || (own && o.set === own)) continue;
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
export function addObject(v: Variant, ctx: PlaceContext, product: string, x: number, y: number): Variant | null {
  return addAt(v, ctx, { id: nextId(v.objects.map((o) => o.id), 'i'), product, x, y, rot: 0 });
}

/** `o` stored in the free spot nearest where it is, or null where the stand has none. */
export function addAt(v: Variant, ctx: PlaceContext, o: PlacedObject): Variant | null {
  const spot = findSpot(v, ctx, o, Math.max(v.stand.width, v.stand.depth));
  return spot ? { ...v, objects: [...v.objects, spot] } : null;
}

/** Where the + counter puts what it adds: the middle of the stand, toward the front, for a footprint `d` deep (m). */
export const anywhere = (v: Variant, d: number): [number, number] => [v.stand.width / 2, Math.max(d / 2, v.stand.depth - d / 2 - 0.4)];

/** Add one object in the first free spot, front rows first (used by the + counter). */
export function addObjectAnywhere(v: Variant, ctx: PlaceContext, product: string): Variant | null {
  const f = ctx.footprint(product);
  if (!f) return null;
  return addObject(v, ctx, product, ...anywhere(v, f.d));
}

/** Move an object; it may overlap while dragging, the plan shows the conflict. Kept inside the stand. A piece of a set
 *  moves its whole set (Bjørn 14.11.2026). */
export function moveObject(v: Variant, ctx: PlaceContext, id: string, x: number, y: number): Variant {
  const self = v.objects.find((o) => o.id === id);
  if (self?.set) return moveSet(v, ctx, self, x - self.x, y - self.y);
  return {
    ...v,
    objects: v.objects.map((o) => {
      if (o.id !== id) return o;
      const f = objectFootprint(ctx, o);
      return f ? clampInto(v, { ...o, x, y }, f) : o;
    }),
  };
}

/** The box round all `boxes`. */
function union(boxes: Omit<Box, 'kind'>[]): Omit<Box, 'kind'> {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

/** Every piece of `self`'s set moved by (dx, dy), on the 5 cm grid, the whole set kept inside the stand. */
function moveSet(v: Variant, ctx: PlaceContext, self: PlacedObject, dx: number, dy: number): Variant {
  const members = setMembers(v, self);
  const u = union(members.flatMap((m) => objectBoxes(ctx, m)));
  if (!Number.isFinite(u.x0)) return v;
  const step = (n: number, lo: number, hi: number) => {
    const q = Math.round(Math.max(lo, Math.min(hi, n)) * 20) / 20;
    return q > hi + 1e-9 ? Math.floor(hi * 20) / 20 : q < lo - 1e-9 ? Math.ceil(lo * 20) / 20 : q;
  };
  const mx = step(dx, -u.x0, v.stand.width - u.x1);
  const my = step(dy, -u.y0, v.stand.depth - u.y1);
  return shiftSet(v, self.set!, mx, my);
}

const shiftSet = (v: Variant, set: string, dx: number, dy: number): Variant =>
  dx || dy ? { ...v, objects: v.objects.map((o) => (o.set === set ? { ...o, x: r6(o.x + dx), y: r6(o.y + dy) } : o)) } : v;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** The pieces of a set overlap something. */
const setBlocked = (v: Variant, ctx: PlaceContext, set: string) =>
  v.objects.some((o) => o.set === set && hitsAny(objectBoxes(ctx, o), blockers(v, ctx, o.id)));

/** The nearest shift of a set, within `radius` m, that leaves all its pieces free and inside the stand; null when none. */
function setSpot(v: Variant, ctx: PlaceContext, set: string, radius: number): [number, number] | null {
  const members = v.objects.filter((o) => o.set === set);
  const u = union(members.flatMap((m) => objectBoxes(ctx, m)));
  const inside = (dx: number, dy: number) => u.x0 + dx >= -1e-9 && u.y0 + dy >= -1e-9 && u.x1 + dx <= v.stand.width + 1e-9 && u.y1 + dy <= v.stand.depth + 1e-9;
  const free = (dx: number, dy: number) => inside(dx, dy) && !setBlocked(shiftSet(v, set, dx, dy), ctx, set);
  if (free(0, 0)) return [0, 0];
  for (let r = 0.05; r <= radius + 1e-9; r += 0.05) {
    for (let k = 0; k < 24; k++) {
      const t = (k / 24) * Math.PI * 2;
      const dx = Math.round(Math.cos(t) * r * 20) / 20;
      const dy = Math.round(Math.sin(t) * r * 20) / 20;
      if (free(dx, dy)) return [dx, dy];
    }
  }
  return null;
}

/** A set of pieces stored together where they fit nearest their given places, or null where the stand has no room
 *  for all of them (Møbel by use, Bjørn 14.11.2026). Each piece gets its own id and the set's id. */
export function addSet(v: Variant, ctx: PlaceContext, pieces: Omit<PlacedObject, 'id' | 'set'>[]): Variant | null {
  if (!pieces.length) return null;
  const ids = v.objects.map((o) => o.id);
  const set = nextId(v.objects.flatMap((o) => (o.set ? [o.set] : [])), 's');
  const added: PlacedObject[] = pieces.map((p) => {
    const id = nextId(ids, 'i');
    ids.push(id);
    return { ...p, id, set };
  });
  const placed = { ...v, objects: [...v.objects, ...added] };
  const s = setSpot(placed, ctx, set, Math.max(v.stand.width, v.stand.depth));
  return s ? shiftSet(placed, set, s[0], s[1]) : null;
}

/** A furniture set's pieces placed round (x, y), together where they fit nearest (addSet). */
export const placeSet = (v: Variant, ctx: PlaceContext, pieces: readonly SetPiece[], x: number, y: number): Variant | null =>
  addSet(v, ctx, pieces.map((p) => ({ product: p.artnr, x: r6(x + p.x), y: r6(y + p.y), rot: p.rot })));

/** A piece loosened from its set: it stays where it is and is a piece on its own; a set left with one piece is none. */
export function loosenObject(v: Variant, id: string): Variant {
  const o = v.objects.find((x) => x.id === id);
  if (!o?.set) return v;
  const rest = v.objects.filter((x) => x.set === o.set && x.id !== id);
  const drop = new Set([id, ...(rest.length < 2 ? rest.map((x) => x.id) : [])]);
  return { ...v, objects: v.objects.map((x) => (drop.has(x.id) ? withoutSet(x) : x)) };
}

/** How near a loose piece dropped by a set must be to join it, m (as counters link within 300 mm, K15). */
export const JOIN = 0.3;

/** The piece of a set that the loose furniture `id` stands within JOIN of, nearest first; none for a counter. */
export function nearSet(v: Variant, ctx: PlaceContext, id: string): PlacedObject | undefined {
  const o = v.objects.find((x) => x.id === id);
  if (!o || o.set || o.sections || ctx.isCounter(o.product)) return undefined;
  const mine = objectBoxes(ctx, o);
  const gap = (a: Omit<Box, 'kind'>, b: Omit<Box, 'kind'>) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
  let best: { o: PlacedObject; d: number } | undefined;
  for (const x of v.objects) {
    if (!x.set || x.id === id) continue;
    const d = Math.min(...objectBoxes(ctx, x).flatMap((b) => mine.map((m) => gap(m, b))));
    if (d <= JOIN + 1e-9 && (!best || d < best.d)) best = { o: x, d };
  }
  return best?.o;
}

/** A loose piece put into the set of `into` (dropped by one of its pieces, as counters link, K15). */
export function joinSet(v: Variant, id: string, into: string): Variant {
  const t = v.objects.find((x) => x.id === into);
  const o = v.objects.find((x) => x.id === id);
  if (!t || !o || o.set || t.sections || o.sections || t.id === o.id) return v;
  const set = t.set ?? nextId(v.objects.flatMap((x) => (x.set ? [x.set] : [])), 's');
  return { ...v, objects: v.objects.map((x) => (x.id === id || x.id === into ? { ...x, set } : x)) };
}

function withoutSet(o: PlacedObject): PlacedObject {
  const { set: _, ...rest } = o;
  return rest;
}

/** The whole set of `id` removed, or the piece alone when it is loose. */
export function removeSet(v: Variant, id: string): Variant {
  const o = v.objects.find((x) => x.id === id);
  return o?.set ? { ...v, objects: v.objects.filter((x) => x.set !== o.set) } : removeObject(v, id);
}

export function removeObject(v: Variant, id: string): Variant {
  return { ...v, objects: v.objects.filter((o) => o.id !== id) };
}

/** Remove the last `n` objects of a product (used by the − counter); `soldAs`: the product an object is sold as. */
export function removeObjects(v: Variant, product: string, n: number, soldAs = (o: PlacedObject) => o.product): Variant {
  const idx = v.objects.map((o, i) => (soldAs(o) === product ? i : -1)).filter((i) => i >= 0).slice(-n);
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
  if (o?.set) {
    if (!setBlocked(v, ctx, o.set)) return { v, ok: true };
    const s = setSpot(v, ctx, o.set, 1);
    if (s) return { v: shiftSet(v, o.set, s[0], s[1]), ok: true };
    return { v: shiftSet(v, o.set, r6(start.x - o.x), r6(start.y - o.y)), ok: false };
  }
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
  if (o?.set) return rotateSet(v, ctx, o.set);
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

/** A set turned a quarter turn round the middle of its pieces, each piece turned with it, then settled as after a drag.
 *  Null when it does not fit turned. */
function rotateSet(v: Variant, ctx: PlaceContext, set: string): Variant | null {
  const members = v.objects.filter((o) => o.set === set);
  const u = union(members.flatMap((m) => objectBoxes(ctx, m)));
  const [cx, cy] = [Math.round(((u.x0 + u.x1) / 2) * 20) / 20, Math.round(((u.y0 + u.y1) / 2) * 20) / 20];
  const turned = { ...v, objects: v.objects.map((o) => (o.set === set ? { ...o, x: r6(cx - (o.y - cy)), y: r6(cy + (o.x - cx)), rot: (o.rot + 90) % 360 } : o)) };
  const s = setSpot(turned, ctx, set, 1);
  return s ? shiftSet(turned, set, s[0], s[1]) : null;
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

/** The bucket of Disker og podier: every counter and podium it drew, in `ral` (K6). */
export function paintPodiums(v: Variant, ral: string): Variant {
  return { ...v, objects: v.objects.map((o) => (o.sections ? withRal(o, ral) : o)) };
}

function withRal(o: PlacedObject, ral: string): PlacedObject {
  const { ral: _, ...rest } = o;
  return ral === COUNTER_STOCK_RAL ? rest : { ...rest, ral };
}
