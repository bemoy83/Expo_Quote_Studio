// Textile walls on the quote: one product whatever it is mounted on (Bjørn 7.11.2026: the frame is the same, on a
// system wall with 520 or on foot plates). The frame (rental) and the textile (sale) are two kinds of line here and one
// line per frame size on the quote (`quote`), each with its own price: frames by size and mounting, then the textile
// by size and fill. What is built comes from calc/textile/production.ts.
import { needsLift } from '../../cost/model';
import { atHeight } from '../height';
import { displayName } from '../../catalog/lookup';
import type { TextileFill } from '../../domain/types';
import { RECIPES } from '../../foga/recipes';
import type { FrameParts } from '../../foga/structure';
import { ITEM } from '../../pricing/data';
import type { Use } from '../../pricing/model';
import { count, type CalcContext } from '../context';
import type { CalcLine } from '../types';
import { postHeight, type FrameMount } from './common';
import { cutPieces } from './standard';

/** One quote line per frame size: frame and textile of that size, with its own price (Bjørn 7.11.2026). A frame whose
 *  two visible faces differ (in a 92LTX corner on foot plates) names both sides under the one line (X16). */
const quoteOf = (size: Size, lead: boolean) => ({
  key: `tekstil:${size.name}`,
  name: `Tekstilvegg ${size.name}`,
  lead,
  ...(size.sides ? { sides: size.sides } : {}),
});
/** Byggeregel X16: a frame's size on the quote is its visible face, as seller and customer read it (the textile less
 *  bleed): one face on a wall, both on foot plates. Two faces of different widths are named side by side. */
interface Size {
  name: string;
  sides?: string[];
}
export function sizeOf(faces: readonly { W: number; H: number; face?: string }[]): Size {
  const ws = [...new Set(faces.map((f) => f.W))];
  const H = faces[0].H;
  if (ws.length === 1) return { name: `${ws[0]} × ${H} mm` };
  return { name: `${faces.map((f) => f.W).join('/')} × ${H} mm`, sides: faces.map((f) => `side ${(f.face ?? '').toUpperCase()} ${f.W} × ${H} mm`) };
}
type Face = { W: number; H: number; pw: number; ph: number; fill: TextileFill };
/**
 * Textile of one frame size per m² of visible face, by fill. Printed and white: the textile incl. bleed; all: pressed in along the whole
 * perimeter. The customer's own textile is only mounted.
 */
function textileLines(c: CalcContext, faces: Face[], size: Size): CalcLine[] {
  return (['print', 'white', 'reuse'] as const).map((fill) => {
    const fs = faces.filter((f) => f.fill === fill);
    const uses: Use[] = [
      ...(fill === 'reuse' ? [] : [{ id: fill === 'print' ? ITEM.print : ITEM.white, qty: fs.reduce((a, f) => a + (f.pw * f.ph) / 1e6, 0) }]),
      { id: ITEM.textileEdge, qty: fs.reduce((a, f) => a + (2 * (f.W + f.H)) / 1000, 0) },
    ];
    const meta = `${count(fs.length, 'duk', 'duker')} · ${size.name}`;
    return c.line(c.sys.textileFill[fill], fs.reduce((a, f) => a + (f.W * f.H) / 1e6, 0), { ...c.built, meta, quote: quoteOf(size, false) }, uses);
  });
}

const MOUNT_NAME: Record<FrameMount, string> = { vegg: 'på vegg', fotplater: 'på fotplater' };

/** The price item of each loose frame part, by Foga code. */
const LOOSE_ITEM: Readonly<Record<string, string>> = {
  [RECIPES.textileFrame.corner]: ITEM.corner,
  [RECIPES.textileFrame.splice.thread]: ITEM.splice,
  [RECIPES.textileFrame.splice.slide.code]: ITEM.spliceSlide,
  [RECIPES.textileFrame.wall.fixing.code]: ITEM.wallFixing,
  [RECIPES.textileFrame.feet.foot.code]: ITEM.foot(RECIPES.textileFrame.feet.foot.code),
  [RECIPES.textileFrame.feet.smallFoot.code]: ITEM.foot(RECIPES.textileFrame.feet.smallFoot.code),
};

/** One frame: what it is built of and the work, at full quantities. */
interface FrameBuild {
  size: Size;
  H: number;
  mount: FrameMount;
  textileId: string;
  uses: Use[];
}

/** A frame's parts as price items: the frame profile per metre (standard lengths rented, other lengths cut, X9), the loose parts, braces per metre and per piece, a
 *  mounting per coupling and the handling of the frame. */
export function frameUses(p: FrameParts): Use[] {
  // Byggeregel X9: standard lengths are rented as metres of 43TX, any other length is cut for the job (cost rule 2)
  // and a splice piece is always cut
  const cutAt = new Map(cutPieces(p));
  const cut = p.cuts.map(([l]) => [l, cutAt.get(l) ?? 0] as const);
  const std = p.cuts.map(([l, q], i) => [l, q - cut[i][1]] as const);
  const lm = (xs: readonly (readonly [number, number])[]) => xs.reduce((a, [l, q]) => a + l * q, 0) / 1000;
  return [
    { id: ITEM.frameProfileM, qty: lm(std) },
    { id: ITEM.frameCutM, qty: lm(cut) },
    { id: ITEM.frameCut, qty: cut.reduce((a, [, q]) => a + q, 0) },
    { id: ITEM.frameCutSetup, qty: cut.some(([, q]) => q > 0) ? 1 : 0 },
    ...p.loose.map(([code, qty]) => ({ id: LOOSE_ITEM[code] ?? code, qty })),
    { id: ITEM.braceM, qty: (p.braces.qty * p.braces.length) / 1000 },
    { id: ITEM.bracePiece, qty: p.braces.qty },
    { id: ITEM.frameCoupling, qty: p.couplings },
    { id: ITEM.frame, qty: 1 },
  ];
}

/**
 * Textile frames per piece by size B × H and mounting. The frame is the same either way (its parts,
 * calc/textile/common.ts); on foot plates two frames that meet share a 92LTX (half to each). Priced by the cost engine
 * only: a frame has no m² price (Bjørn 27.11.2026).
 */
/** A frame's half of each 92LTX it shares with the run on the other side of a corner, m. */
const postShare = (corners: number, H: number) => ({ id: ITEM.cornerPostM, qty: (corners * postHeight(H)) / 2 / 1000 });
const nCorners = (c: { from: boolean; to: boolean }) => (c.from ? 1 : 0) + (c.to ? 1 : 0);
/** How far up the wall a frame starts, mm. */
const bottomOf = (c: CalcContext, id: string) => Math.round((c.v.textiles.find((t) => t.id === id)?.bottom ?? 0) * 1000);

export function frameLines(c: CalcContext): CalcLine[] {
  const { prod, sys, idx } = c;
  const builds: FrameBuild[] = [
    ...prod.pieces.map((p) => ({ size: sizeOf([p]), H: p.H, mount: p.mount, textileId: p.textileId, uses: [...frameUses(p.parts), postShare(nCorners(p.corners), p.H)] })),
    ...prod.free.map((f) => ({
      size: sizeOf(f.faces),
      H: f.H,
      mount: f.mount,
      textileId: f.textileId,
      uses: [...frameUses(f.parts), postShare(f.nCorners, f.H)],
    })),
  ];
  const groups = new Map<string, FrameBuild[]>();
  for (const f of builds) {
    const k = `${f.size.name}|${f.mount}`;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  const textile = idx.byArtnr.get(sys.textile);
  return [...groups.values()].map((fs) => {
    const { size, H, mount } = fs[0];
    const uses = new Map<string, number>();
    for (const u of fs.flatMap((f) => f.uses)) if (u.qty) uses.set(u.id, (uses.get(u.id) ?? 0) + u.qty);
    const name = `${textile ? displayName(textile) : sys.textile}, ${size.name}, ${MOUNT_NAME[mount]}`;
    // A tall frame is put up from a lift over the height limit (cost rule 6, Byggeregel X14): its top from the floor
    const top = Math.max(...fs.map((f) => H + bottomOf(c, f.textileId)));
    const line = c.line(sys.textile, fs.length, { ...c.built, quote: quoteOf(size, true) }, atHeight(c, [...uses].map(([id, qty]) => ({ id, qty })), top));
    return { ...line, name, drawn: [...new Set(fs.map((f) => f.textileId))], ...(needsLift(top, c.pricing.height) ? { top } : {}) };
  });
}

/** The textile on every frame, per frame size like the frames: one face on a wall, both on foot plates. */
export function textileWallLines(c: CalcContext): CalcLine[] {
  const bySize = new Map<string, { size: Size; faces: Face[] }>();
  const add = (size: Size, faces: Face[]) => bySize.set(size.name, { size, faces: [...(bySize.get(size.name)?.faces ?? []), ...faces] });
  for (const p of c.prod.pieces) add(sizeOf([p]), [p]);
  for (const f of c.prod.free) add(sizeOf(f.faces), f.faces);
  return [...bySize.values()].flatMap(({ size, faces }) => textileLines(c, faces, size));
}

/** Byggeregel X16: the frames by visible size and mounting, in drawing order, for the quote's one sentence on textile
 *  walls. */
export function frameSizes(prod: Pick<CalcContext['prod'], 'pieces' | 'free'>): { size: Size; mount: FrameMount; qty: number }[] {
  const out = new Map<string, { size: Size; mount: FrameMount; qty: number }>();
  const add = (size: Size, mount: FrameMount) => {
    const k = `${size.name}|${mount}`;
    const x = out.get(k);
    if (x) x.qty++;
    else out.set(k, { size, mount, qty: 1 });
  };
  for (const p of prod.pieces) add(sizeOf([p]), p.mount);
  for (const f of prod.free) add(sizeOf(f.faces), f.mount);
  return [...out.values()];
}

/** How a frame is mounted, as the quote says it. */
export const mountName = (m: FrameMount) => MOUNT_NAME[m];
