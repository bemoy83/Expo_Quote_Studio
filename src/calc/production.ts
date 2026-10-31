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
  /** Textile area including bleed, all frames and faces, m². */
  area: number;
  /** Aluminium profile including braces, InFrame frames, m. */
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
    area: pieces.reduce((a, p) => a + p.area, 0) + free.reduce((a, f) => a + f.faces[0].printArea + f.faces[1].printArea, 0),
    lm: pieces.reduce((a, p) => a + p.lm, 0),
  };
}
