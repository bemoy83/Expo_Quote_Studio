// Textile walls (InFrame) and foil decor: where they may sit on a wall face, and the edits that place them.
// A wall has two faces. `side` follows the door swing convention: 1 = the wall's left normal (−dy, dx), −1 = the other.
// Perimeter walls only have the face toward the stand.
//
// Textile: along one wall, on one face, never over an opening, never past a wall meeting that face, never over
// another textile on the same face. Width and offset in 0,1 m steps, at least `rules.textile.minWidth`.
// Foil: inside one wall panel (felt) between two posts and between top and bottom profile, never on an opening and
// never behind a textile on the same face.
import type { Rules } from '../rules/rules';
import { wallHeight } from '../rules/rules';
import { pointAlong, wallDirection, wallLength, wallModules } from './grid';
import { defaultSwing, isPerimeterWall, nextId } from './edit';
import type { Foil, Point, TextileWall, Variant, Wall } from './types';
import { builtModules } from './walls';

export type FaceSide = 1 | -1;

const EPS = 1e-6;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** The face a textile or foil sits on. Old data without `side` uses the default (into the stand). */
export function sideOf(v: Variant, x: { wallId: string; side?: FaceSide }): FaceSide {
  if (x.side) return x.side;
  const w = v.walls.find((o) => o.id === x.wallId);
  return w ? defaultSwing(v.stand, w) : 1;
}

/** Faces that can carry decor: the inner face of a perimeter wall, both faces of an inner wall. */
export function faces(v: Variant, w: Wall): FaceSide[] {
  const d = defaultSwing(v.stand, w);
  return isPerimeterWall(v.stand, w) ? [d] : [d, d === 1 ? -1 : 1];
}

/** Unit normal pointing out of the face. */
export function faceNormal(w: Wall, s: FaceSide): Point {
  const [dx, dy] = wallDirection(w);
  return [-dy * s, dx * s];
}

/** Which face of the wall the point lies in front of. */
export function faceAt(v: Variant, w: Wall, p: { x: number; y: number }): FaceSide {
  const n = faceNormal(w, 1);
  const s: FaceSide = (p.x - w.from[0]) * n[0] + (p.y - w.from[1]) * n[1] >= 0 ? 1 : -1;
  return faces(v, w).includes(s) ? s : faces(v, w)[0];
}

/** Wall panel inside one module: along-wall span and height above the floor, metres. */
export function felt(rules: Rules, module: number) {
  const post = rules.wall.post;
  const w = rules.wall.plate.width / 1000;
  const h = rules.wall.plate.height / 1000;
  const y0 = rules.wall.feet + rules.wall.profile.bottom;
  return { a: module + post / 2, b: module + post / 2 + w, w, y0, y1: y0 + h, h, center: module + 0.5 };
}

export const fullTextileHeight = (rules: Rules) => wallHeight(rules);

/** Distance from the wall centre line to the middle of a textile frame standing in front of a face. */
export const textileOffset = (rules: Rules) => rules.wall.post / 2 + rules.textile.depth / 2;

/** Centre of a foil along the wall, metres from the wall start. */
export const foilCenter = (rules: Rules, f: Foil) => felt(rules, f.module).center + f.x;

/** Height and bottom of a textile, metres. */
export function textileBox(t: TextileWall, rules: Rules): { bottom: number; height: number } {
  const bottom = t.bottom ?? 0;
  return { bottom, height: t.height ?? fullTextileHeight(rules) - bottom };
}

type Span = [number, number];

function subtract(spans: Span[], [c0, c1]: Span): Span[] {
  return spans.flatMap(([a, b]) => {
    if (c1 <= a + EPS || c0 >= b - EPS) return [[a, b] as Span];
    const out: Span[] = [];
    if (c0 > a + EPS) out.push([a, c0]);
    if (c1 < b - EPS) out.push([c1, b]);
    return out;
  });
}

function cut(spans: Span[], t: number): Span[] {
  return spans.flatMap(([a, b]) => (t > a + EPS && t < b - EPS ? [[a, t], [t, b]] : [[a, b]]) as Span[]);
}

/** Module indices of the wall that are openings (also when the opening sits on an overlapping wall). */
export function openingModules(v: Variant, w: Wall): Set<number> {
  const built = new Map(builtModules(v).map((m) => [m.key, m]));
  const out = new Set<number>();
  wallModules(w).forEach((m, i) => {
    if (built.get(m.key)?.opening) out.add(i);
  });
  return out;
}

/** Offsets along w where another wall meets this face (a T-junction or a crossing). The frame must stop there. */
function junctions(v: Variant, w: Wall, s: FaceSide): number[] {
  const n = faceNormal(w, s);
  const [dx, dy] = wallDirection(w);
  const L = wallLength(w);
  const out: number[] = [];
  for (const m of builtModules(v)) {
    const mh = m.a[1] === m.b[1];
    const wh = dy === 0;
    if (mh === wh) continue;
    for (const [p, q] of [[m.a, m.b], [m.b, m.a]] as const) {
      const px = p[0] - w.from[0];
      const py = p[1] - w.from[1];
      if (Math.abs(px * dy - py * dx) > EPS) continue;
      const t = px * dx + py * dy;
      if (t <= EPS || t >= L - EPS) continue;
      if ((q[0] - p[0]) * n[0] + (q[1] - p[1]) * n[1] > EPS) out.push(t);
    }
  }
  return out;
}

/**
 * Free spans on one face of a wall for a textile: the wall minus openings, junctions and the given other textiles.
 * Only spans of at least the minimum textile width are returned.
 */
export function freeSpans(v: Variant, rules: Rules, wallId: string, s: FaceSide, others: TextileWall[] = textilesOn(v, wallId, s)): Span[] {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return [];
  let spans: Span[] = [[0, wallLength(w)]];
  for (const i of openingModules(v, w)) spans = subtract(spans, [i, i + 1]);
  for (const t of junctions(v, w, s)) spans = cut(spans, t);
  for (const t of others) spans = subtract(spans, [t.from, t.from + t.width]);
  return spans.filter(([a, b]) => b - a >= rules.textile.minWidth - EPS);
}

export function textilesOn(v: Variant, wallId: string, s: FaceSide, skipId?: string): TextileWall[] {
  return v.textiles.filter((t) => t.wallId === wallId && t.id !== skipId && sideOf(v, t) === s);
}

/** The span that contains t, else the nearest one. */
function spanFor(spans: Span[], t: number): Span | null {
  let best: Span | null = null;
  let bd = Infinity;
  for (const sp of spans) {
    const d = t < sp[0] ? sp[0] - t : t > sp[1] ? t - sp[1] : 0;
    if (d < bd) {
      bd = d;
      best = sp;
    }
  }
  return best;
}

/** Add a textile on a face, filling the free span at offset `at` (or the nearest free span). Null when the face is full. */
export function addTextile(v: Variant, rules: Rules, wallId: string, s: FaceSide, at: number): { v: Variant; id: string } | null {
  const sp = spanFor(freeSpans(v, rules, wallId, s), at);
  if (!sp) return null;
  const id = nextId(v.textiles.map((t) => t.id), 't');
  const t: TextileWall = { id, wallId, side: s, from: r1(sp[0]), width: r1(sp[1] - sp[0]) };
  return { v: { ...v, textiles: [...v.textiles, t] }, id };
}

export interface TextilePatch {
  from?: number;
  width?: number;
  height?: number;
  bottom?: number;
  motif?: string | null;
  side?: FaceSide;
}

/**
 * Change a textile. `mode` decides how a move past a limit is handled: 'move' keeps the width and stops at the edge,
 * 'size' keeps the start and clips the width. Height and bottom are kept inside the wall height.
 */
export function updateTextile(v: Variant, rules: Rules, id: string, patch: TextilePatch, mode: 'move' | 'size' = 'size'): Variant {
  const t = v.textiles.find((x) => x.id === id);
  if (!t) return v;
  const s = patch.side ?? sideOf(v, t);
  const w = v.walls.find((x) => x.id === t.wallId);
  if (!w || !faces(v, w).includes(s)) return v;
  const spans = freeSpans(v, rules, t.wallId, s, textilesOn(v, t.wallId, s, id));
  const from = patch.from ?? t.from;
  const width = patch.width ?? t.width;
  const placed = place(spans, from, width, rules.textile.minWidth, mode);
  if (!placed) return v;
  const full = fullTextileHeight(rules);
  const minH = rules.textile.minWidth;
  const cur = textileBox(t, rules);
  const bottom = r1(clamp(patch.bottom ?? cur.bottom, 0, full - minH));
  const height = r3(clamp(patch.height ?? cur.height, minH, full - bottom));
  const { motif: _m, height: _h, bottom: _b, ...rest } = t;
  const motif = patch.motif === undefined ? t.motif : patch.motif ?? undefined;
  const next: TextileWall = {
    ...rest,
    side: s,
    from: placed[0],
    width: placed[1],
    ...(bottom > EPS ? { bottom } : {}),
    ...(bottom > EPS || height < full - EPS ? { height } : {}),
    ...(motif ? { motif } : {}),
  };
  return { ...v, textiles: v.textiles.map((x) => (x.id === id ? next : x)) };
}

/** Fill the free span the textile sits in. */
export function fillTextile(v: Variant, rules: Rules, id: string): Variant {
  const t = v.textiles.find((x) => x.id === id);
  if (!t) return v;
  const s = sideOf(v, t);
  const sp = spanFor(freeSpans(v, rules, t.wallId, s, textilesOn(v, t.wallId, s, id)), t.from + t.width / 2);
  return sp ? updateTextile(v, rules, id, { from: sp[0], width: sp[1] - sp[0] }) : v;
}

function place(spans: Span[], from: number, width: number, min: number, mode: 'move' | 'size'): [number, number] | null {
  const sp = mode === 'size' ? spanFor(spans, from + EPS) : spanFor(spans, from + width / 2);
  if (!sp) return null;
  const [a, b] = sp;
  let w = r1(clamp(width, min, b - a));
  let f: number;
  if (mode === 'size' && from >= a - EPS && from <= b - min + EPS) {
    f = r1(Math.max(a, from));
    w = r1(clamp(w, min, b - f));
  } else f = r1(clamp(from, a, b - w));
  if (f + w > b + EPS) w = r1(b - f);
  return [f, w];
}

export function removeTextile(v: Variant, id: string): Variant {
  return { ...v, textiles: v.textiles.filter((t) => t.id !== id) };
}

/** The textile on this face that covers offset t, if any. */
export function textileAt(v: Variant, wallId: string, s: FaceSide, t: number): TextileWall | undefined {
  return textilesOn(v, wallId, s).find((x) => t >= x.from - EPS && t <= x.from + x.width + EPS);
}

/** Why a felt cannot take foil, or null when it can. */
export function feltBlocked(v: Variant, rules: Rules, wallId: string, module: number, s: FaceSide): string | null {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w || module < 0 || module >= Math.round(wallLength(w))) return 'Ingen vegg her';
  if (openingModules(v, w).has(module)) return 'Folie kan ikke ligge på en åpning';
  const f = felt(rules, module);
  if (textilesOn(v, wallId, s).some((t) => t.from < f.b - EPS && t.from + t.width > f.a + EPS)) return 'Feltet er dekket av en tekstilvegg';
  return null;
}

/** Felt indices of a face that can take foil. */
export function freeFelts(v: Variant, rules: Rules, wallId: string, s: FaceSide): number[] {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return [];
  return Array.from({ length: Math.round(wallLength(w)) }, (_, i) => i).filter((i) => !feltBlocked(v, rules, wallId, i, s));
}

export const foilsOn = (v: Variant, wallId: string, s: FaceSide) => v.foils.filter((f) => f.wallId === wallId && sideOf(v, f) === s);

/** A decal kept inside its felt: size limited by the felt with the motif's ratio, centre clamped. */
function fitFoil(f: Foil, rules: Rules, ratio: number): Foil {
  const fe = felt(rules, f.module);
  if (f.full) return { ...f, width: fe.w, height: fe.h, x: 0, y: r3((fe.y0 + fe.y1) / 2) };
  const r = ratio > 0 ? ratio : f.width && f.height ? f.width / f.height : 1;
  let w = clamp(f.width || fe.w * 0.8, 0.1, fe.w);
  if (w / r > fe.h) w = fe.h * r;
  const h = w / r;
  const x = clamp(f.x, -(fe.w - w) / 2, (fe.w - w) / 2);
  const y = clamp(f.y, fe.y0 + h / 2, fe.y1 - h / 2);
  return { ...f, width: r3(w), height: r3(h), x: r3(x), y: r3(y) };
}

/** Eye height for a new decal's centre, metres above the floor. */
const DECAL_Y = 1.5;

/**
 * Put a motif on a felt as foil. A full-felt foil already there gets the new motif.
 * Null (with the reason) when the felt cannot take foil.
 */
export function addFoil(
  v: Variant,
  rules: Rules,
  wallId: string,
  module: number,
  s: FaceSide,
  motif: string | undefined,
  ratio: number,
): { v: Variant; id: string } | { error: string } {
  const why = feltBlocked(v, rules, wallId, module, s);
  if (why) return { error: why };
  const full = foilsOn(v, wallId, s).find((f) => f.module === module && f.full);
  if (full) {
    const { motif: _m, ...rest } = full;
    return { v: { ...v, foils: v.foils.map((f) => (f.id === full.id ? { ...rest, ...(motif ? { motif } : {}) } : f)) }, id: full.id };
  }
  const id = nextId(v.foils.map((f) => f.id), 'f');
  const fe = felt(rules, module);
  const f = fitFoil({ id, wallId, module, side: s, full: false, width: fe.w * 0.8, height: 0, x: 0, y: DECAL_Y, ...(motif ? { motif } : {}) }, rules, ratio);
  return { v: { ...v, foils: [...v.foils, f] }, id };
}

export interface FoilPatch {
  module?: number;
  x?: number;
  y?: number;
  width?: number;
  full?: boolean;
  motif?: string | null;
  /** Move to the other face of the wall. */
  side?: FaceSide;
}

/** Change a foil. Moving to another felt or face is refused when it cannot take foil there. */
export function updateFoil(v: Variant, rules: Rules, id: string, patch: FoilPatch, ratio: number): Variant {
  const f = v.foils.find((x) => x.id === id);
  if (!f) return v;
  const module = patch.module ?? f.module;
  const side = patch.side ?? sideOf(v, f);
  const w = v.walls.find((x) => x.id === f.wallId);
  if (side !== sideOf(v, f) && (!w || !faces(v, w).includes(side))) return v;
  if ((module !== f.module || side !== sideOf(v, f)) && feltBlocked(v, rules, f.wallId, module, side)) return v;
  const { motif: _m, ...rest } = f;
  const motif = patch.motif === undefined ? f.motif : patch.motif ?? undefined;
  const wasFull = f.full;
  const full = patch.full ?? f.full;
  const base: Foil = {
    ...rest,
    side,
    module,
    full,
    width: patch.width ?? (wasFull && !full ? felt(rules, module).w * 0.8 : f.width),
    height: f.height,
    x: patch.x ?? (wasFull && !full ? 0 : f.x),
    y: patch.y ?? (wasFull && !full ? DECAL_Y : f.y),
    ...(motif ? { motif } : {}),
  };
  const next = fitFoil(base, rules, ratio);
  // A full-felt foil replaces the other foils on that felt.
  const drop = full ? new Set(foilsOn(v, f.wallId, side).filter((o) => o.module === module && o.id !== id).map((o) => o.id)) : new Set<string>();
  return { ...v, foils: v.foils.filter((o) => !drop.has(o.id)).map((o) => (o.id === id ? next : o)) };
}

export function removeFoil(v: Variant, id: string): Variant {
  return { ...v, foils: v.foils.filter((f) => f.id !== id) };
}

/** Foil at offset t along the wall on this face (the felt that holds t). */
export function foilAt(v: Variant, rules: Rules, wallId: string, s: FaceSide, t: number): Foil | undefined {
  return foilsOn(v, wallId, s).find((f) => {
    const fe = felt(rules, f.module);
    return t >= fe.a - EPS && t <= fe.b + EPS;
  });
}

/**
 * Keep textiles and foils valid after any edit: on an existing wall, on an allowed face, inside free spans and felts.
 * A textile pushed off its span is clipped to the free part it overlaps most, or moved to the nearest free span.
 * Returns the same variant when nothing changed.
 */
export function fitDecor(v: Variant, rules: Rules, ratio: (motif: string | undefined) => number = () => 0): Variant {
  if (!v.textiles.length && !v.foils.length) return v;
  let changed = false;
  const kept: TextileWall[] = [];
  const full = fullTextileHeight(rules);
  const min = rules.textile.minWidth;
  for (const t of v.textiles) {
    const w = v.walls.find((x) => x.id === t.wallId);
    if (!w) {
      changed = true;
      continue;
    }
    const allowed = faces(v, w);
    const s0 = sideOf(v, t);
    const s = allowed.includes(s0) ? s0 : allowed[0];
    const spans = freeSpans({ ...v, textiles: kept }, rules, t.wallId, s, kept.filter((k) => k.wallId === t.wallId && k.side === s));
    let from = t.from;
    let width = t.width;
    const inside = spans.some(([a, b]) => from >= a - EPS && from + width <= b + EPS);
    if (!inside) {
      let best: Span | null = null;
      let ov = 0;
      for (const [a, b] of spans) {
        const o = Math.min(b, from + width) - Math.max(a, from);
        if (o > ov) {
          ov = o;
          best = [a, b];
        }
      }
      if (best && ov >= min - EPS) {
        const f0 = Math.max(from, best[0]);
        width = r1(Math.min(from + width, best[1]) - f0);
        from = r1(f0);
      } else {
        const sp = spanFor(spans, from + width / 2);
        if (!sp) {
          changed = true;
          continue;
        }
        width = r1(Math.min(width, sp[1] - sp[0]));
        from = r1(clamp(from, sp[0], sp[1] - width));
      }
    }
    const { bottom, height } = textileBox(t, rules);
    const okH = bottom >= -EPS && height >= min - EPS && bottom + height <= full + EPS;
    let next: TextileWall = t;
    if (from !== t.from || width !== t.width || s !== s0 || t.side === undefined) next = { ...t, side: s, from, width };
    if (!okH) {
      const b = clamp(bottom, 0, full - min);
      next = { ...next, bottom: b, height: clamp(height, min, full - b) };
    }
    if (next !== t) changed = true;
    kept.push(next);
  }
  const withTex = changed ? { ...v, textiles: kept } : v;
  const foils: Foil[] = [];
  for (const f of v.foils) {
    const w = v.walls.find((x) => x.id === f.wallId);
    const s = w ? sideOf(v, f) : 1;
    if (!w || !faces(v, w).includes(s) || feltBlocked(withTex, rules, f.wallId, f.module, s)) {
      changed = true;
      continue;
    }
    const fit = fitFoil(f.side === undefined ? { ...f, side: s } : f, rules, ratio(f.motif) || (f.width && f.height ? f.width / f.height : 1));
    const same = fit.x === f.x && fit.y === f.y && fit.width === f.width && fit.height === f.height && fit.side === f.side;
    if (!same) changed = true;
    foils.push(same ? f : fit);
  }
  return changed ? { ...v, textiles: kept, foils } : v;
}

/** World points of a span along a wall, pushed out from the wall centre by `off` on face s. */
export function faceSegment(w: Wall, s: FaceSide, from: number, to: number, off: number): [Point, Point] {
  const n = faceNormal(w, s);
  const a = pointAlong(w, from);
  const b = pointAlong(w, to);
  return [
    [a[0] + n[0] * off, a[1] + n[1] * off],
    [b[0] + n[0] * off, b[1] + n[1] * off],
  ];
}

/**
 * Drag a textile along its face: `dt` metres along the wall, `dh` metres up, both from `start` (the textile when the
 * drag began). Width and height are kept; it stops at openings, junctions, other frames, the floor and the wall top.
 */
export function moveTextileBy(v: Variant, rules: Rules, start: TextileWall, dt: number, dh: number): Variant {
  const moved = updateTextile(v, rules, start.id, { from: start.from + dt }, 'move');
  const { bottom, height } = textileBox(start, rules);
  const top = Math.floor((fullTextileHeight(rules) - height + EPS) * 10) / 10;
  return updateTextile(moved, rules, start.id, { bottom: clamp(bottom + dh, 0, Math.max(0, top)) });
}

/**
 * Drag a foil on its face from `start`: `dt` along the wall, `dh` up. The centre moves to the felt under it when that
 * felt can take foil, else it stays in its own felt, clamped to the edge.
 */
export function moveFoilBy(v: Variant, rules: Rules, start: Foil, dt: number, dh: number, ratio: number): Variant {
  const w = v.walls.find((x) => x.id === start.wallId);
  if (!w) return v;
  const c = foilCenter(rules, start) + dt;
  const module = clamp(Math.floor(c), 0, Math.round(wallLength(w)) - 1);
  const y = start.y + dh;
  const next = updateFoil(v, rules, start.id, { module, x: c - (module + 0.5), y }, ratio);
  return next !== v || module === start.module ? next : updateFoil(v, rules, start.id, { x: c - (start.module + 0.5), y }, ratio);
}

/**
 * Drop a motif on a wall face at offset `t` (and height `y` when known, as in 3D). On a textile it becomes the print;
 * on a wall panel it becomes a foil decal, centred where it was dropped. Null id when nothing changed.
 */
export function dropMotif(
  v: Variant,
  rules: Rules,
  wallId: string,
  s: FaceSide,
  t: number,
  motif: string,
  ratio: number,
  y?: number,
): { v: Variant; textileId?: string; foilId?: string } | { error: string } {
  const tx = textileAt(v, wallId, s, t);
  if (tx) return { v: updateTextile(v, rules, tx.id, { motif }), textileId: tx.id };
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return { error: 'Ingen vegg her' };
  const module = clamp(Math.floor(t), 0, Math.round(wallLength(w)) - 1);
  const r = addFoil(v, rules, wallId, module, s, motif, ratio);
  if ('error' in r) return r;
  const f = r.v.foils.find((x) => x.id === r.id)!;
  if (y === undefined || f.full) return { v: r.v, foilId: r.id };
  return { v: updateFoil(r.v, rules, r.id, { x: t - felt(rules, module).center, y }, ratio), foilId: r.id };
}
