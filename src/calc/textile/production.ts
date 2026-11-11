import type { Foil, TextileFill, TextileWall, Variant, Wall } from '../../domain/types';
import { wallLabel } from '../../domain/walls';
import { RECIPES } from '../../foga/recipes';
import type { InFrameParams, Rules } from '../../rules/rules';
import { freeTrims, placeFrames } from './placement';
import { framePiece, type FramePiece } from './inFrame';
import { cornerPosts, freeFrames, type FreeFrame, type HeldEnds } from './free';
import { fullHeight, partsLm, printFileName } from './common';

export interface ProductionPiece extends FramePiece {
  pos: string;
  textileId: string;
  wall: string;
  /** Offset along the wall, mm. */
  at: number;
  /** Moved along the wall in an inner corner so it does not overlap another frame, mm, from → to positive
   *  (byggeregel X10). Only when moved. */
  shift?: number;
  fill: TextileFill;
  motif: string | null;
  /** Print file name, for a printed textile only. */
  fileName: string | null;
}

export interface Production {
  /** Frames on system walls. */
  pieces: ProductionPiece[];
  /** Frittstående tekstilvegger, each with textile on both faces. */
  free: FreeFrame[];
  /** Their length in all, m. */
  freeLm: number;
  /** 92LTX corner posts, each shared by two free-standing runs, `H` long (mm). */
  cornerPosts: { qty: number; H: number };
  /** Textile to produce (printed and white, not the customer's own), including bleed, m². */
  area: number;
  /** Aluminium profile including braces and corner posts, all frames, m. */
  lm: number;
}

const mm = (m: number) => Math.round(m * 1000);

/** Height in mm for the frame: the textile's own height when lower than the full wall, else full height. */
export function textileHeightMm(t: TextileWall, s: InFrameParams): number | undefined {
  if (t.height === undefined) return undefined;
  const h = mm(t.height);
  return h < fullHeight(s) ? h : undefined;
}

export function production(v: Variant, rules: Rules, customer: string): Production {
  const s = rules.textile.inFrame;
  const walls = new Map(v.walls.map((w) => [w.id, w]));
  const pieces: ProductionPiece[] = [];
  const placed = placeFrames(v, rules);
  const shiftOf = new Map(placed.map((f) => [f.t.id, f.shift]));
  v.textiles.forEach((t) => {
    const w = walls.get(t.wallId);
    if (!w) return;
    const pos = `T${pieces.length + 1}`;
    const p = framePiece(mm(t.width), s, textileHeightMm(t, s));
    const fill = t.fill ?? 'print';
    pieces.push({
      ...p,
      pos,
      textileId: t.id,
      wall: wallLabel(w),
      at: mm(t.from),
      ...(shiftOf.get(t.id) ? { shift: mm(shiftOf.get(t.id)!) } : {}),
      fill,
      motif: fill === 'print' ? (t.motif ?? null) : null,
      fileName: fill === 'print' ? printFileName(customer, pos, p) : null,
    });
  });
  // Free-standing runs stop at a frame on the wall they end at (byggeregel X11)
  const trims = freeTrims(v, rules, placed);
  const free = freeFrames(v, RECIPES.textileFrame, s, customer, trims, heldEnds(v, trims));
  // The 92LTX stands on an end cap and has one on top, so it is cut shorter than the frame
  const posts = { qty: cornerPosts(v).length, H: fullHeight(s) - 2 * RECIPES.textileFrame.feet.cornerPostCap };
  return {
    pieces,
    free,
    freeLm: free.reduce((a, f) => a + f.length, 0) / 1000,
    cornerPosts: posts,
    area:
      pieces.filter((p) => p.fill !== 'reuse').reduce((a, p) => a + p.area, 0) +
      free.flatMap((f) => f.faces).filter((x) => x.fill !== 'reuse').reduce((a, x) => a + x.printArea, 0),
    lm:
      pieces.reduce((a, p) => a + p.lm, 0) +
      free.reduce((a, f) => a + partsLm(f.parts), 0) +
      (posts.qty * posts.H) / 1000,
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
    const door = doors.has(`${f.wallId}|${f.module}`) ? ', dør' : '';
    const size = { W: plate.width, H: plate.height };
    return { pos, where: `${wallLabel(walls.get(f.wallId)!)}, plate ${f.module + 1}${door}${part}`, ...size, pw: size.W, ph: size.H, fill: 'print' as const, fileName: printFileName(customer, pos, size), foil: true };
  });
}

/** The rows with a print file the customer delivers (printed textiles), for the quote. */
export const printFiles = (P: Production): TextileRow[] => textileRows(P).filter((r) => r.fileName);

export const FILL_NAME: Record<TextileFill, string> = { print: 'Trykt tekstil', white: 'Hvit tekstil', reuse: 'Kundens tekstil' };

export function textileRows(P: Production): TextileRow[] {
  return [
    ...P.pieces.map((p) => ({ pos: p.pos, where: p.wall, W: p.W, H: p.H, pw: p.pw, ph: p.ph, fw: p.fw, fh: p.fh, fill: p.fill, fileName: p.fileName })),
    ...P.free.flatMap((f) => f.faces.map((x) => ({ pos: x.pos, where: `Frittstående ${f.pos}, side ${x.face.toUpperCase()}`, W: x.W, H: x.H, pw: x.pw, ph: x.ph, fw: x.fw, fh: x.fh, fill: x.fill, fileName: x.fileName }))),
  ];
}

/** A point on a wall line, ends included. */
function onWall(w: Wall, p: readonly [number, number]): boolean {
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
  for (const t of v.freeTextiles) {
    const trim = trims.get(t.id);
    const at = (p: readonly [number, number], cut = 0) => cut > 0 || v.walls.some((w) => onWall(w, p));
    out.set(t.id, { from: at(t.from, trim?.from), to: at(t.to, trim?.to) });
  }
  return out;
}
