import type { TextileFill, TextileWall, Variant, Wall } from '../domain/types';
import { standWallSide } from '../domain/walls';
import { RECIPES } from '../foga/recipes';
import type { InFrameParams } from '../rules/rules';
import { framePiece, fullHeight, printFileName, type FramePiece } from './fabric';
import { cornerPosts, freeFrames, type FreeFrame } from './freeFrames';

export interface ProductionPiece extends FramePiece {
  pos: string;
  textileId: string;
  wall: string;
  /** Offset along the wall, mm. */
  at: number;
  fill: TextileFill;
  motif: string | null;
  /** Print file name, for a printed textile only. */
  fileName: string | null;
}

export interface Production {
  /** InFrame frames on system walls. */
  pieces: ProductionPiece[];
  /** Frittstående tekstilvegger, each with textile on both faces. */
  free: FreeFrame[];
  /** 92LTX corner posts, each shared by two free-standing runs. */
  cornerPosts: number;
  /** Textile to produce (printed and white, not the customer's own), including bleed, m². */
  area: number;
  /** Aluminium profile including braces and corner posts, all frames, m. */
  lm: number;
}

const mm = (m: number) => Math.round(m * 1000);

const SIDE_NAMES = { back: 'Bak', front: 'Front', left: 'Venstre', right: 'Høyre' } as const;

/** Bak / Venstre / Høyre / Front for the stand walls, otherwise Innervegg: an inner wall on the edge is still one. */
export function wallLabel(w: Wall): string {
  const side = standWallSide(w);
  return side ? SIDE_NAMES[side] : 'Innervegg';
}

/** Height in mm for the frame: the textile's own height when lower than the full wall, else full height. */
export function textileHeightMm(t: TextileWall, s: InFrameParams): number | undefined {
  if (t.height === undefined) return undefined;
  const h = mm(t.height);
  return h < fullHeight(s) ? h : undefined;
}

export function production(v: Variant, s: InFrameParams, customer: string): Production {
  const walls = new Map(v.walls.map((w) => [w.id, w]));
  const pieces: ProductionPiece[] = [];
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
      fill,
      motif: fill === 'print' ? (t.motif ?? null) : null,
      fileName: fill === 'print' ? printFileName(customer, pos, p) : null,
    });
  });
  const free = freeFrames(v, RECIPES.freeFrame, s, customer);
  return {
    pieces,
    free,
    cornerPosts: cornerPosts(v).length,
    area:
      pieces.filter((p) => p.fill !== 'reuse').reduce((a, p) => a + p.area, 0) +
      free.flatMap((f) => f.faces).filter((x) => x.fill !== 'reuse').reduce((a, x) => a + x.printArea, 0),
    lm:
      pieces.reduce((a, p) => a + p.lm, 0) +
      free.reduce((a, f) => a + (2 * f.railCuts.reduce((x, c) => x + c, 0) + f.uprights * f.H + f.supports.length * f.braceLength) / 1000, 0) +
      (free.length ? (cornerPosts(v).length * free[0].H) / 1000 : 0),
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
  fill: TextileFill;
  fileName: string | null;
}

export const FILL_NAME: Record<TextileFill, string> = { print: 'Trykt tekstil', white: 'Hvit tekstil', reuse: 'Kundens tekstil' };

export function textileRows(P: Production): TextileRow[] {
  return [
    ...P.pieces.map((p) => ({ pos: p.pos, where: p.wall, W: p.W, H: p.H, pw: p.pw, ph: p.ph, fill: p.fill, fileName: p.fileName })),
    ...P.free.flatMap((f) => f.faces.map((x) => ({ pos: x.pos, where: `Frittstående ${f.pos}, side ${x.face.toUpperCase()}`, W: x.W, H: x.H, pw: x.pw, ph: x.ph, fill: x.fill, fileName: x.fileName }))),
  ];
}
