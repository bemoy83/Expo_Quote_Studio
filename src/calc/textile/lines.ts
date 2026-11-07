// Textile walls on the quote: one product whatever it is mounted on (Bjørn 7.11.2026: the frame is the same, on a
// system wall with 520 or on foot plates). The frame (rental) and the textile (sale) are two kinds of line here and one
// line on the quote (`quote`): frames by size and mounting, then the textile by fill. What is built comes from
// calc/production.ts.
import { displayName } from '../../catalog/lookup';
import type { TextileFill } from '../../domain/types';
import { RECIPES } from '../../foga/recipes';
import type { FrameParts } from '../../foga/structure';
import { ITEM } from '../../pricing/data';
import type { Use } from '../../pricing/model';
import { count, type CalcContext } from '../context';
import type { CalcLine } from '../types';
import type { FrameMount } from './common';

const quote = { key: 'tekstil', name: 'Tekstilvegg' };
/**
 * Textile per m² of visible face, by fill. Printed and white: the textile incl. bleed; all: pressed in along the whole
 * perimeter. The customer's own textile is only mounted.
 */
function textileLines(c: CalcContext, faces: { W: number; H: number; pw: number; ph: number; fill: TextileFill }[], quote: CalcLine['quote']): CalcLine[] {
  return (['print', 'white', 'reuse'] as const).map((fill) => {
    const fs = faces.filter((f) => f.fill === fill);
    const uses: Use[] = [
      ...(fill === 'reuse' ? [] : [{ id: fill === 'print' ? ITEM.print : ITEM.white, qty: fs.reduce((a, f) => a + (f.pw * f.ph) / 1e6, 0) }]),
      { id: ITEM.textileEdge, qty: fs.reduce((a, f) => a + (2 * (f.W + f.H)) / 1000, 0) },
    ];
    const n = fs.length;
    return c.line(c.sys.textileFill[fill], fs.reduce((a, f) => a + (f.W * f.H) / 1e6, 0), { ...c.built, meta: count(n, 'duk', 'duker'), quote }, uses);
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
  W: number;
  H: number;
  mount: FrameMount;
  uses: Use[];
}

/** A frame's parts as price items: the frame profile per metre, the loose parts, braces per metre and per piece, a
 *  mounting per coupling and the handling of the frame. */
function frameUses(p: FrameParts): Use[] {
  return [
    { id: ITEM.frameProfileM, qty: p.cuts.reduce((a, [l, q]) => a + l * q, 0) / 1000 },
    ...p.loose.map(([code, qty]) => ({ id: LOOSE_ITEM[code] ?? code, qty })),
    { id: ITEM.braceM, qty: (p.braces.qty * p.braces.length) / 1000 },
    { id: ITEM.bracePiece, qty: p.braces.qty },
    { id: ITEM.frameCoupling, qty: p.couplings },
    { id: ITEM.frame, qty: 1 },
  ];
}

/**
 * Textile frames per piece by size B × H and mounting. The frame is the same either way (its parts,
 * calc/textile/common.ts); on foot plates two frames that meet share a 92LTX (half to each). Fast price: m² rate × B × H.
 */
export function frameLines(c: CalcContext): CalcLine[] {
  const { prod, sys, idx } = c;
  const builds: FrameBuild[] = [
    ...prod.pieces.map((p) => ({ W: p.W, H: p.H, mount: p.mount, uses: frameUses(p.parts) })),
    ...prod.free.map((f) => ({
      W: f.length,
      H: f.H,
      mount: f.mount,
      uses: [...frameUses(f.parts), { id: ITEM.cornerPostM, qty: (f.nCorners * prod.cornerPosts.H) / 2 / 1000 }],
    })),
  ];
  const groups = new Map<string, FrameBuild[]>();
  for (const f of builds) {
    const k = `${f.W}×${f.H}|${f.mount}`;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  const textile = idx.byArtnr.get(sys.textile);
  return [...groups.values()].map((fs) => {
    const { W, H, mount } = fs[0];
    const uses = new Map<string, number>();
    for (const u of fs.flatMap((f) => f.uses)) if (u.qty) uses.set(u.id, (uses.get(u.id) ?? 0) + u.qty);
    const fast = Math.round((textile?.variant.price ?? 0) * ((W * H) / 1e6));
    const name = `${textile ? displayName(textile) : sys.textile}, ${W} × ${H} mm, ${MOUNT_NAME[mount]}`;
    const line = c.line(sys.textile, fs.length, { ...c.built, quote: { ...quote, lead: true, size: `${W} × ${H} mm` } }, [...uses].map(([id, qty]) => ({ id, qty })), fast);
    return { ...line, name, unit: 'stk' as const };
  });
}

/** The textile on every frame: one face on a wall, both on foot plates. */
export function textileWallLines(c: CalcContext): CalcLine[] {
  return textileLines(c, [...c.prod.pieces, ...c.prod.free.flatMap((f) => f.faces)], { ...quote, lead: false });
}
