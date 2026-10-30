import type { Stand, TextileWall, Variant, Wall } from '../domain/types';
import type { InFrameParams } from '../rules/rules';
import { framePiece, fullHeight, printFileName, type FramePiece } from './fabric';

export interface ProductionPiece extends FramePiece {
  pos: string;
  textileId: string;
  wall: string;
  /** Offset along the wall, mm. */
  at: number;
  motif: string | null;
  fileName: string;
}

export interface Production {
  pieces: ProductionPiece[];
  /** Print area including bleed, m². */
  area: number;
  /** Aluminium profile including braces, m. */
  lm: number;
}

const mm = (m: number) => Math.round(m * 1000);

const SIDE_NAMES = { back: 'Bak', front: 'Front', left: 'Venstre', right: 'Høyre' } as const;

/** Bak / Venstre / Høyre / Front for perimeter walls, otherwise Innervegg. */
export function wallLabel(w: Wall, stand: Stand): string {
  const [x0, y0] = w.from;
  const [x1, y1] = w.to;
  if (y0 === y1 && y0 === 0) return SIDE_NAMES.back;
  if (y0 === y1 && y0 === stand.depth) return SIDE_NAMES.front;
  if (x0 === x1 && x0 === 0) return SIDE_NAMES.left;
  if (x0 === x1 && x0 === stand.width) return SIDE_NAMES.right;
  return 'Innervegg';
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
    pieces.push({
      ...p,
      pos,
      textileId: t.id,
      wall: wallLabel(w, v.stand),
      at: mm(t.from),
      motif: t.motif ?? null,
      fileName: printFileName(customer, pos, p),
    });
  });
  return {
    pieces,
    area: pieces.reduce((a, p) => a + p.area, 0),
    lm: pieces.reduce((a, p) => a + p.lm, 0),
  };
}
