// Foil decor on wall panels, and fitDecor, which keeps textiles and foils valid after any edit. Foil sits inside one
// wall panel (felt) between two posts and between top and bottom profile, never on an opening and never behind a
// textile on the same face. Faces and felts: domain/faces.ts; textile walls: domain/textile/inFrame.ts (this file
// imports from there, never the other way).
import type { Rules } from '../rules/rules';
import { blockedModules, faceNormal, faces, felt, sideOf, type FaceSide } from './faces';
import { pointAlong, wallLength } from './grid';
import { nextId } from './ids';
import { roomAt } from './rooms';
import { freeSpans, fullTextileHeight, spanFor, textileAt, textileBox, textilesOn, updateTextile, type Span } from './textile/inFrame';
import type { Foil, TextileWall, Variant, Wall } from './types';

const EPS = 1e-6;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Centre of a foil along the wall, metres from the wall start. */
export const foilCenter = (rules: Rules, f: Foil) => felt(rules, f.module).center + f.x;

/** Where a foil runs along its wall: the whole module when full, else its width about its centre. */
export function foilSpan(rules: Rules, f: Foil): [number, number] {
  if (f.full) return [f.module, f.module + 1];
  const c = foilCenter(rules, f);
  return [c - f.width / 2, c + f.width / 2];
}

/** Why a felt cannot take foil, or null when it can. */
export function feltBlocked(v: Variant, rules: Rules, wallId: string, module: number, s: FaceSide, full = false): string | null {
  const w = v.walls.find((x) => x.id === wallId);
  const blocked = w && blockedModules(v, w);
  if (!w || !blocked || module < 0 || module >= Math.round(wallLength(w)) || blocked.foreign.has(module)) return 'Ingen vegg her';
  // A print over the whole plate may cover a door (leaf and header); a decal never sits on an opening
  if (blocked.openings.has(module) && !(full && blocked.doors.has(module))) return 'Folie kan ikke ligge på en åpning';
  const f = felt(rules, module);
  if (textilesOn(v, wallId, s).some((t) => t.from < f.b - EPS && t.from + t.width > f.a + EPS)) return 'Feltet er dekket av en tekstilvegg';
  return null;
}

/** Felt indices of a face that can take foil (`full`: a print over the whole plate, which doors take too). */
export function freeFelts(v: Variant, rules: Rules, wallId: string, s: FaceSide, full = false): number[] {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return [];
  return Array.from({ length: Math.round(wallLength(w)) }, (_, i) => i).filter((i) => !feltBlocked(v, rules, wallId, i, s, full));
}

export const foilsOn = (v: Variant, wallId: string, s: FaceSide) => v.foils.filter((f) => f.wallId === wallId && sideOf(v, f) === s);

/** A decal kept inside its felt: size limited by the felt with the motif's ratio, centre clamped. A full foil covers the felt. */
export function fitFoil(f: Foil, rules: Rules, ratio: number): Foil {
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
  const onFull = foilsOn(v, wallId, s).some((f) => f.module === module && f.full);
  const why = feltBlocked(v, rules, wallId, module, s, onFull);
  if (why) return { error: why };
  const full = foilsOn(v, wallId, s).find((f) => f.module === module && f.full);
  if (full) {
    // A new motif on a plate of a stretched print makes it a whole motif on that plate
    const { motif: _m, run: _r, crop: _c, ...rest } = full;
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
  const full = patch.full ?? f.full;
  if ((module !== f.module || side !== sideOf(v, f) || full !== f.full) && feltBlocked(v, rules, f.wallId, module, side, full)) return v;
  const { motif: _m, run: _r, crop: _c, ...rest } = f;
  const motif = patch.motif === undefined ? f.motif : patch.motif ?? undefined;
  const wasFull = f.full;
  // A plate of a stretched print keeps its part of the picture only while it stays where it is
  const keepRun = f.run && full && module === f.module && side === sideOf(v, f) && motif === f.motif;
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
    ...(keepRun ? { run: f.run, ...(f.crop ? { crop: f.crop } : {}) } : {}),
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
  v.textiles.forEach((t, ti) => {
    const w = v.walls.find((x) => x.id === t.wallId);
    if (!w) {
      changed = true;
      return;
    }
    const allowed = faces(v, w);
    const s0 = sideOf(v, t);
    const s = allowed.includes(s0) ? s0 : allowed[0];
    // Other frames on this face, where they are now (earlier ones already refitted)
    const others = [...kept, ...v.textiles.slice(ti + 1)].filter((k) => k.wallId === t.wallId && sideOf(v, k) === s);
    const spans = freeSpans(v, rules, t.wallId, s, others);
    let from = t.from;
    let width = t.width;
    const inside = spans.some(([a, b]) => from >= a - EPS && from + width <= b + EPS);
    if (t.fit) {
      // "Fyll veggen": the whole free span it overlaps most (outside a room on a tie), growing and shrinking with it
      const sp = bestSpan(v, w, s, spans, from, width) ?? spanFor(spans, from + width / 2);
      if (!sp) {
        changed = true;
        return;
      }
      from = r1(sp[0]);
      width = r1(sp[1] - sp[0]);
    } else if (!inside) {
      const best = bestSpan(v, w, s, spans, from, width);
      const ov = best ? Math.min(best[1], from + width) - Math.max(best[0], from) : 0;
      if (best && ov >= min - EPS) {
        const f0 = Math.max(from, best[0]);
        width = r1(Math.min(from + width, best[1]) - f0);
        from = r1(f0);
      } else {
        const sp = spanFor(spans, from + width / 2);
        if (!sp) {
          changed = true;
          return;
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
  });
  const withTex = changed ? { ...v, textiles: kept } : v;
  const foils: Foil[] = [];
  for (const f of v.foils) {
    const w = v.walls.find((x) => x.id === f.wallId);
    const s = w ? sideOf(v, f) : 1;
    if (!w || !faces(v, w).includes(s) || feltBlocked(withTex, rules, f.wallId, f.module, s, f.full)) {
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

/** The span a frame overlaps most. On a tie it stays out of a room, so a frame pushed by a room keeps to its side. */
function bestSpan(v: Variant, w: Wall, s: FaceSide, spans: Span[], from: number, width: number): Span | null {
  let best: Span | null = null;
  let score = 0;
  for (const [a, b] of spans) {
    const o = Math.min(b, from + width) - Math.max(a, from);
    const sc = o - (inRoom(v, w, s, (a + b) / 2) ? 0.01 : 0);
    if (o > EPS && sc > score) {
      score = sc;
      best = [a, b];
    }
  }
  return best;
}

/** True when the face at offset t looks into a room. */
function inRoom(v: Variant, w: Wall, s: FaceSide, t: number): boolean {
  const [x, y] = pointAlong(w, t);
  const n = faceNormal(w, s);
  return !!roomAt(v, x + n[0] * 0.25, y + n[1] * 0.25);
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
