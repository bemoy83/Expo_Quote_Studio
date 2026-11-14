// Textile walls on system walls (InFrame): along one wall, on one face, never over an opening, never past a wall
// meeting that face, never over another textile on the same face. Width and offset in 0,1 m steps, at least
// `rules.textile.minWidth`. Where they may sit, and the edits that place them. fitDecor (domain/decor.ts) keeps them
// valid after other edits.
// Byggeregel X4 (docs/byggeregler.md).
import type { Rules } from '../../rules/rules';
import { wallHeight } from '../../rules/rules';
import { blockedModules, faceNormal, faces, sideOf, type FaceSide } from '../faces';
import { moduleEnd, wallDirection, wallLength } from '../grid';
import { nextId } from '../ids';
import type { TextileFill, TextileWall, Variant, Wall } from '../types';
import { builtModules } from '../walls';

const EPS = 1e-6;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const fullTextileHeight = (rules: Rules) => wallHeight(rules);

/** Distance from the wall centre line to the middle of a textile frame standing in front of a face. */
export const textileOffset = (rules: Rules) => rules.wall.post / 2 + rules.textile.depth / 2;

/** Height and bottom of a textile, metres. */
export function textileBox(t: TextileWall, rules: Rules): { bottom: number; height: number } {
  const bottom = t.bottom ?? 0;
  return { bottom, height: t.height ?? fullTextileHeight(rules) - bottom };
}

export type Span = [number, number];

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
  const { openings, foreign } = blockedModules(v, w);
  for (const i of new Set([...openings, ...foreign])) spans = subtract(spans, [i, moduleEnd(w, i)]);
  for (const t of junctions(v, w, s)) spans = cut(spans, t);
  for (const t of others) spans = subtract(spans, [t.from, t.from + t.width]);
  return spans.filter(([a, b]) => b - a >= rules.textile.minWidth - EPS);
}

export function textilesOn(v: Variant, wallId: string, s: FaceSide, skipId?: string): TextileWall[] {
  return v.textiles.filter((t) => t.wallId === wallId && t.id !== skipId && sideOf(v, t) === s);
}

/** The span that contains t, else the nearest one. */
export function spanFor(spans: Span[], t: number): Span | null {
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

/**
 * Add a textile on a face, filling the free span at offset `at` and following it. With `near` it takes the nearest free
 * span when `at` is not in one (drawer and pill buttons); a pointer only fills the span it is over. Null when there is none.
 */
export function addTextile(v: Variant, rules: Rules, wallId: string, s: FaceSide, at: number, near = false): { v: Variant; id: string } | null {
  const spans = freeSpans(v, rules, wallId, s);
  const sp = near ? spanFor(spans, at) : (spans.find((x) => at >= x[0] - 1e-6 && at <= x[1] + 1e-6) ?? null);
  if (!sp) return null;
  const id = nextId(v.textiles.map((t) => t.id), 't');
  const t: TextileWall = { id, wallId, side: s, from: r1(sp[0]), width: r1(sp[1] - sp[0]), fit: true };
  return { v: { ...v, textiles: [...v.textiles, t] }, id };
}

/**
 * Add a textile on a face over the stretch t0–t1 (drawn with the textile brush along the wall), clipped to the free span
 * it overlaps most. Where it covers that whole span it follows it ("Fyll veggen").
 */
export function addTextileSpan(v: Variant, rules: Rules, wallId: string, s: FaceSide, t0: number, t1: number): { v: Variant; id: string } | { error: string } {
  const lo = Math.min(t0, t1);
  const hi = Math.max(t0, t1);
  let best: Span | null = null;
  let ov = 0;
  for (const sp of freeSpans(v, rules, wallId, s)) {
    const o = Math.min(sp[1], hi) - Math.max(sp[0], lo);
    if (o > ov + EPS) [best, ov] = [sp, o];
  }
  if (!best) return { error: 'Ingen ledig veggflate her' };
  const from = r3(Math.max(lo, best[0]));
  const width = r3(Math.min(hi, best[1]) - from);
  if (width < rules.textile.minWidth - EPS) return { error: `Tekstilvegg på systemvegg må være minst ${String(rules.textile.minWidth).replace('.', ',')} m` };
  const fit = from <= best[0] + EPS && from + width >= best[1] - EPS;
  const id = nextId(v.textiles.map((t) => t.id), 't');
  const t: TextileWall = { id, wallId, side: s, from, width, ...(fit ? { fit: true } : {}) };
  return { v: { ...v, textiles: [...v.textiles, t] }, id };
}

export interface TextilePatch {
  from?: number;
  width?: number;
  height?: number;
  bottom?: number;
  motif?: string | null;
  side?: FaceSide;
  fill?: TextileFill;
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
  const { motif: _m, height: _h, bottom: _b, fill: _fl, ...rest } = t;
  const motif = patch.motif === undefined ? t.motif : patch.motif ?? undefined;
  // A motif is a print: setting one makes the textile printed again
  const fill = patch.motif ? 'print' : (patch.fill ?? t.fill ?? 'print');
  // Resizing or moving by hand ends "Fyll veggen"
  const { fit: _f, ...base } = rest;
  const keepFit = t.fit && placed[0] === t.from && placed[1] === t.width;
  const next: TextileWall = {
    ...base,
    ...(keepFit ? { fit: true } : {}),
    side: s,
    from: placed[0],
    width: placed[1],
    ...(bottom > EPS ? { bottom } : {}),
    ...(bottom > EPS || height < full - EPS ? { height } : {}),
    ...(motif ? { motif } : {}),
    ...(fill !== 'print' ? { fill } : {}),
  };
  return { ...v, textiles: v.textiles.map((x) => (x.id === id ? next : x)) };
}

/** Fill the free span the textile sits in, and keep filling it when walls or rooms change ("Fyll veggen"). */
export function fillTextile(v: Variant, rules: Rules, id: string): Variant {
  const t = v.textiles.find((x) => x.id === id);
  if (!t) return v;
  const s = sideOf(v, t);
  const sp = spanFor(freeSpans(v, rules, t.wallId, s, textilesOn(v, t.wallId, s, id)), t.from + t.width / 2);
  if (!sp) return v;
  const next = updateTextile(v, rules, id, { from: sp[0], width: sp[1] - sp[0] });
  return { ...next, textiles: next.textiles.map((x) => (x.id === id ? { ...x, fit: true } : x)) };
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
