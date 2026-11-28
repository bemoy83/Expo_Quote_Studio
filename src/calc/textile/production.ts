import type { Foil, Point, Textile, TextileFill, TextileWall, Variant, Wall } from '../../domain/types';
import { wallLabel } from '../../domain/walls';
import { wallDirection } from '../../domain/grid';
import { RECIPES } from '../../foga/recipes';
import { railHeight } from '../../foga/plates';
import { raiseTop, wallHeight, type InFrameParams, type Rules } from '../../rules/rules';
import { freeTrims, placeFrames } from './placement';
import { onWallMount, wallPiece, type FramePiece } from './inFrame';
import { alongRun, cornerPosts, freeFrames, runFrame, supportPoints, textilePos, type FreeFrame, type HeldEnds } from './free';
import { cornerEnds, runDirection } from '../../domain/textile/free';
import { fullHeight, partsLm, postPieces, printFileName } from './common';
import { freeTextiles, mountedOn, onLine, outFace, wallTextiles } from '../../domain/textile/mounts';

export interface ProductionPiece extends FramePiece {
  pos: string;
  textileId: string;
  wall: string;
  /** Offset along the wall, mm. */
  at: number;
  /** Moved along the wall in an inner corner so it does not overlap another frame, mm, from → to positive
   *  (byggeregel X10). Only when moved. */
  shift?: number;
  /** Ends at a 92LTX corner post, the run's from end being the span's low end (X7). */
  corners: { from: boolean; to: boolean };
  /** Where the rails start, mm from the run's from end (past the corner post's leg). */
  railStart: number;
  /** Where the run's from end is, mm along the wall from its start: braces, rails and textile are measured from it. */
  runAt: number;
  fill: TextileFill;
  motif: string | null;
  /** Print file name, for a printed textile only. */
  fileName: string | null;
  /** Ceiling wires holding a frame that reaches over its wall's top (Byggeregel X14), by the foot plate rule. */
  wires?: number;
  /** Where the wires are, mm along the frame from its start (as the braces). */
  wireAt?: number[];
  /** The same, mm along its wall from the wall's start: for the plan and the elevation. */
  wireAlong?: number[];
  /** The frame's top from the floor, mm. */
  top: number;
}

export interface Production {
  /** Frames on system walls. */
  pieces: ProductionPiece[];
  /** Frittstående tekstilvegger, each with textile on both faces. */
  free: FreeFrame[];
  /** Their length in all, m. */
  freeLm: number;
  /** Every ceiling wire holding a textile frame (Byggeregel X14, X18): on frames over their wall's top or, on foot
   *  plates, over the standard wall top, and one at each 92LTX corner between them. Where it is in the plan, how high
   *  it hangs from (mm) and the way the frame runs there, for the V across it. */
  textileWires: { at: Point; top: number; dir: Point; textileId: string }[];
  /** 92LTX corner posts, each shared by the two runs meeting there (on walls or foot plates), by length `H` (mm). */
  cornerPosts: { qty: number; H: number }[];
  /** Textile to produce (printed and white, not the customer's own), including bleed, m². */
  area: number;
  /** Aluminium profile including braces and corner posts, all frames, m. */
  lm: number;
}

const mm = (m: number) => Math.round(m * 1000);

/** The point `along` mm from wall w's start on the centre line of a frame on face `side`. */
const wallPoint = (w: Wall, side: 1 | -1, along: number): Point => onLine(w, side, along / 1000);

/** How far along wall w point p lies, m from its start. */
function alongWall(w: Wall, p: readonly [number, number]): number {
  const [dx, dy] = wallDirection(w);
  return (p[0] - w.from[0]) * dx + (p[1] - w.from[1]) * dy;
}

/** Height in mm for the frame: the textile's own height when it has one other than full height (lower, or taller over
 *  the wall's top, Byggeregel X14), else undefined for full height. */
export function textileHeightMm(t: TextileWall, s: InFrameParams): number | undefined {
  if (t.height === undefined) return undefined;
  const h = mm(t.height);
  return h !== fullHeight(s) ? h : undefined;
}

export function production(v: Variant, rules: Rules, customer: string): Production {
  const s = rules.textile.inFrame;
  const r = RECIPES.textileFrame;
  const pieces: ProductionPiece[] = [];
  const wiresAt: Production['textileWires'] = [];
  const cornerAt = new Map<string, Production['textileWires'][number]>();
  /** Byggeregel X14: a 92LTX corner of a frame hung in wire gets its own, once for the frames meeting there. */
  const cornerWire = (run: Textile, c: { from: boolean; to: boolean }, top: number) => {
    const dir = runDirection(run);
    for (const p of [...(c.from ? [run.from] : []), ...(c.to ? [run.to] : [])]) {
      const k = `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
      if (!cornerAt.has(k)) cornerAt.set(k, { at: p, top, dir, textileId: run.id });
    }
  };
  const placed = placeFrames(v, rules);
  const shiftOf = new Map(placed.map((f) => [f.t.id, f.shift]));
  const corners = cornerEnds(v);
  const runs = new Map(v.textiles.map((t) => [t.id, t]));
  // One frame calc for every run (X1): on a wall it has one face with textile and 520 to the posts
  for (const t of wallTextiles(v)) {
    const m = mountedOn(v, t.id);
    const run = runs.get(t.id);
    if (!m || !run) continue;
    const pos = textilePos(v, t.id);
    const H = textileHeightMm(t, s) ?? fullHeight(s);
    const x = runFrame(run, onWallMount(r, outFace(run, m.wall, m.side), pos, H), r, s, customer, corners.get(t.id));
    const f = x.faces[0];
    // Byggeregel X14: over the wall's top the posts do not hold it, a wire from the ceiling does, spread by the foot
    // plate rule along the frame (as S3, S9); a 92LTX corner counts as a wire point and has its own wire (Bjørn
    // 28.11.2026), counted once for the two frames (`cornerWires`)
    const top = mm(t.bottom ?? 0) + H;
    const over = top > (m.wall.raise ? raiseTop(m.wall.raise, rules) : mm(wallHeight(rules)));
    const wireAt = over ? supportPoints(x.length, r.feet.support, x.corners) : [];
    const wires = wireAt.length;
    if (over) cornerWire(run, x.corners, top);
    // Along the wall: the run's start, the shift in an inner corner (X10), then along the run one way or the other
    const [wx, wy] = wallDirection(m.wall);
    const sign = (run.to[0] - run.from[0]) * wx + (run.to[1] - run.from[1]) * wy >= 0 ? 1 : -1;
    const start = mm(alongWall(m.wall, run.from)) + (shiftOf.get(t.id) ? mm(shiftOf.get(t.id)!) : 0);
    // In the elevation the corner's wire too, at the frame's end
    const ends = [...(over && x.corners.from ? [0] : []), ...(over && x.corners.to ? [x.length] : [])];
    const wireAlong = [...wireAt, ...ends].sort((a, b) => a - b).map((a) => start + sign * a);
    for (const a of wireAt) wiresAt.push({ at: wallPoint(m.wall, m.side, start + sign * a), top, dir: [wx * sign, wy * sign], textileId: t.id });
    pieces.push({
      ...wallPiece(x, mm(t.width)),
      pos,
      textileId: t.id,
      wall: wallLabel(m.wall),
      at: mm(t.from),
      ...(shiftOf.get(t.id) ? { shift: mm(shiftOf.get(t.id)!) } : {}),
      corners: x.corners,
      railStart: x.railStart,
      runAt: mm(alongWall(m.wall, run.from)),
      fill: f.fill,
      motif: f.motif,
      fileName: f.fileName,
      top,
      ...(wires || ends.length ? { wires, wireAt, wireAlong } : {}),
    });
  }
  // Free-standing runs stop at a frame on the wall they end at (byggeregel X11)
  const trims = freeTrims(v, rules, placed);
  const free = freeFrames(v, r, s, customer, trims, heldEnds(v, trims)).map((f) => {
    // Byggeregel X14, X18: on foot plates over the standard wall top it always hangs in wire, by the foot plate rule
    // along the frame, its 92LTX corners with their own (Bjørn 28.11.2026: as on a wall, one product)
    if (f.top <= mm(wallHeight(rules))) return f;
    const run = runs.get(f.textileId)!;
    const wireAt = supportPoints(f.length, r.feet.support, f.corners);
    cornerWire(run, f.corners, f.top);
    for (const a of wireAt) wiresAt.push({ at: alongRun(run, a, f), top: f.top, dir: runDirection(run), textileId: f.textileId });
    return { ...f, wires: wireAt.length, wireAt };
  });
  // The 92LTX stands on an end cap and has one on top, so it is cut shorter than the frames it joins
  const heights = new Map<number, number>();
  for (const p of cornerPosts(v)) for (const H of postPieces(p.H)) heights.set(H, (heights.get(H) ?? 0) + 1);
  const posts = [...heights].map(([H, qty]) => ({ qty, H }));
  return {
    pieces,
    free,
    freeLm: free.reduce((a, f) => a + f.length, 0) / 1000,
    textileWires: [...wiresAt, ...cornerAt.values()],
    cornerPosts: posts,
    area:
      pieces.filter((p) => p.fill !== 'reuse').reduce((a, p) => a + p.area, 0) +
      free.flatMap((f) => f.faces).filter((x) => x.fill !== 'reuse').reduce((a, x) => a + x.printArea, 0),
    lm:
      pieces.reduce((a, p) => a + p.lm, 0) +
      free.reduce((a, f) => a + partsLm(f.parts), 0) +
      posts.reduce((a, p) => a + p.qty * p.H, 0) / 1000,
  };
}

/** Every textile to fit, InFrame frames and both faces of each free-standing wall: picking list and work order. */
export interface TextileRow {
  pos: string;
  /** Where it goes: the wall, or the free-standing wall and face. */
  where: string;
  W: number;
  H: number;
  pw: number;
  ph: number;
  /** File size at scale, mm, one decimal: textiles only. */
  fw?: number;
  fh?: number;
  fill: TextileFill;
  fileName: string | null;
  /** Foil over a whole wall plate: no frame, the print is the plate's size. */
  foil?: boolean;
}

/**
 * Prints over whole wall plates (foil), one file per plate. A motif stretched over several plates says which part of
 * it each plate is, left to right as seen from the face: «plate 3 av 6».
 */
export function foilRows(v: Variant, plate: { width: number; height: number }, customer: string): TextileRow[] {
  const walls = new Map(v.walls.map((w) => [w.id, w]));
  const full = v.foils.filter((f) => f.full && walls.has(f.wallId));
  const runs = new Map<string, Foil[]>();
  for (const f of full) if (f.run) runs.set(f.run, [...(runs.get(f.run) ?? []), f]);
  for (const r of runs.values()) r.sort((a, b) => (a.crop?.[0] ?? 0) - (b.crop?.[0] ?? 0));
  const doors = new Set(v.openings.map((o) => `${o.wallId}|${o.module}`));
  return full.map((f, i) => {
    const pos = `F${i + 1}`;
    const run = f.run ? runs.get(f.run) : undefined;
    const part = run && run.length > 1 ? ` · ${run.indexOf(f) + 1} av ${run.length}` : '';
    const door = doors.has(`${f.wallId}|${f.module}`) ? (f.door === 'header' ? ', overstykke' : f.door === 'leaf' ? ', dørblad' : ', dør') : '';
    // On an upper felt (V20) its plate: the 94 less the 292, plus what the plate goes into the rails
    const w = walls.get(f.wallId)!;
    const up = f.upper && w.raise ? w.raise - railHeight(RECIPES.wall.raise.topRail) + (RECIPES.wall.plate.h - plate.height) : 0;
    const size = { W: plate.width, H: up || plate.height };
    return { pos, where: `${wallLabel(w)}, ${up ? 'øvre felt' : 'plate'} ${f.module + 1}${up ? '' : door}${part}`, ...size, pw: size.W, ph: size.H, fill: 'print' as const, fileName: printFileName(customer, pos, size), foil: true };
  });
}

/** The rows with a print file the customer delivers (printed textiles), for the quote. */
export const printFiles = (P: Production): TextileRow[] => textileRows(P).filter((r) => r.fileName);

export const FILL_NAME: Record<TextileFill, string> = { print: 'Trykt tekstil', white: 'Hvit tekstil', reuse: 'Kundens tekstil' };

/** In position order, T1, T2 …, on a wall and on foot plates alike (X16). */
export function textileRows(P: Production): TextileRow[] {
  const n = (pos: string) => parseInt(pos.slice(1), 10);
  return [
    ...P.pieces.map((p) => ({ pos: p.pos, where: p.wall, W: p.W, H: p.H, pw: p.pw, ph: p.ph, fw: p.fw, fh: p.fh, fill: p.fill, fileName: p.fileName })),
    ...P.free.flatMap((f) => f.faces.map((x) => ({ pos: x.pos, where: `${f.pos} frittstående, side ${x.face.toUpperCase()}`, W: x.W, H: x.H, pw: x.pw, ph: x.ph, fw: x.fw, fh: x.fh, fill: x.fill, fileName: x.fileName }))),
  ].sort((a, b) => n(a.pos) - n(b.pos));
}

/** A point on a wall line, ends included. */
function onWallLine(w: Wall, p: readonly [number, number]): boolean {
  const [ax, ay] = w.from;
  const [bx, by] = w.to;
  const len = Math.hypot(bx - ax, by - ay);
  if (!len) return false;
  const cross = ((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax)) / len;
  const along = ((bx - ax) * (p[0] - ax) + (by - ay) * (p[1] - ay)) / len;
  return Math.abs(cross) < 1e-6 && along > -1e-6 && along < len + 1e-6;
}

/** Ends of free-standing runs that stand against a wall or a frame on it: a splice there has no room to be threaded. */
function heldEnds(v: Variant, trims: ReadonlyMap<string, { from: number; to: number }>): HeldEnds {
  const out = new Map<string, { from: boolean; to: boolean }>();
  for (const t of freeTextiles(v)) {
    const trim = trims.get(t.id);
    const at = (p: readonly [number, number], cut = 0) => cut > 0 || v.walls.some((w) => onWallLine(w, p));
    out.set(t.id, { from: at(t.from, trim?.from), to: at(t.to, trim?.to) });
  }
  return out;
}

/** Byggeregel X18: what the calc built for textile wall `id`, read the same way whatever it stands on: its position,
 *  height, rails and the visible faces (one on a wall, two on foot plates). */
export interface BuiltFrame {
  pos: string;
  textileId: string;
  mount: 'vegg' | 'fotplater';
  H: number;
  /** The frame's top from the floor, mm. */
  top: number;
  nCorners: number;
  railCuts: number[];
  /** Run length, mm (the rails of a frame without corners). */
  length: number;
  /** Where the frame starts, mm from the drawn run's from end, when it stops short at a frame on a wall (X11). */
  start?: number;
  faces: { pos: string; W: number }[];
  wires: number;
}

export function builtFrame(P: Production, id: string): BuiltFrame | undefined {
  const p = P.pieces.find((x) => x.textileId === id);
  if (p) {
    const n = (p.corners.from ? 1 : 0) + (p.corners.to ? 1 : 0);
    return { pos: p.pos, textileId: id, mount: 'vegg', H: p.H, top: p.top, nCorners: n, railCuts: p.railCuts, length: p.railCuts.reduce((a, x) => a + x, 0), faces: [{ pos: p.pos, W: p.W }], wires: p.wires ?? 0 };
  }
  const f = P.free.find((x) => x.textileId === id);
  if (!f) return undefined;
  return {
    pos: f.pos,
    textileId: id,
    mount: 'fotplater',
    H: f.H,
    top: f.top,
    nCorners: f.nCorners,
    railCuts: f.railCuts,
    length: f.length,
    ...(f.start ? { start: f.start } : {}),
    faces: f.faces.map((x) => ({ pos: x.pos, W: x.W })),
    wires: f.wires ?? 0,
  };
}
