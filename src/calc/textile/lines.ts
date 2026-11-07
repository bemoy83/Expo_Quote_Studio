// Textile walls on the quote: one product whatever it is mounted on (Bjørn 7.11.2026: the frame is the same, on a
// system wall with 520 or on foot plates). The frame (rental) and the textile (sale) are two kinds of line here and one
// line on the quote (`quote`): frames by size and mounting, then the textile by fill. What is built comes from
// calc/production.ts.
import { displayName } from '../../catalog/lookup';
import type { TextileFill } from '../../domain/types';
import { RECIPES } from '../../foga/recipes';
import { ITEM } from '../../pricing/data';
import type { Use } from '../../pricing/model';
import { count, type CalcContext } from '../context';
import type { CalcLine } from '../types';

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

type Mount = 'vegg' | 'fotplater';
const MOUNT_NAME: Record<Mount, string> = { vegg: 'på vegg', fotplater: 'på fotplater' };

/** One frame: what it is built of and the work, at full quantities. */
interface FrameBuild {
  W: number;
  H: number;
  mount: Mount;
  uses: Use[];
}

/**
 * Textile frames per piece by size B × H and mounting. The frame is the same either way: 43TX, 617 in the corners,
 * braces, rail splices, mounting per coupling and handling. On a wall it is fixed with 520; on foot plates it stands on
 * 740 or 730, and where two meet they share a 92LTX (half to each). Fast price: m² rate × B × H.
 */
export function frameLines(c: CalcContext): CalcLine[] {
  const { prod, sys, idx } = c;
  const onWall: FrameBuild[] = prod.pieces.map((p) => {
    const braces = p.braces?.qty ?? 0;
    return {
      W: p.W,
      H: p.H,
      mount: 'vegg',
      uses: [
        { id: ITEM.frameProfileM, qty: (2 * p.W + 2 * p.H) / 1000 },
        { id: ITEM.corner, qty: 4 },
        { id: ITEM.splice, qty: p.splices },
        { id: ITEM.wallFixing, qty: RECIPES.frame.wallFixing.perFrame },
        { id: ITEM.braceM, qty: (braces * (p.braces?.length ?? 0)) / 1000 },
        { id: ITEM.bracePiece, qty: braces },
        // Put together like on foot plates: the 617 in each corner, the splice connectors and both ends of every brace
        { id: ITEM.frameCoupling, qty: 4 + p.splices + 2 * braces },
        { id: ITEM.frame, qty: 1 },
      ],
    };
  });
  const thread = RECIPES.freeFrame.splice.thread;
  const onFeet: FrameBuild[] = prod.free.map((f) => ({
    W: f.length,
    H: f.H,
    mount: 'fotplater',
    uses: [
      { id: ITEM.frameProfileM, qty: f.profileMm / 1000 },
      { id: ITEM.cornerPostM, qty: (f.nCorners * prod.cornerPosts.H) / 2 / 1000 },
      { id: ITEM.foot(f.foot.code), qty: f.supports.length },
      { id: ITEM.corner, qty: f.connectors.corner },
      { id: f.spliceCode === thread ? ITEM.splice : ITEM.spliceSlide, qty: f.connectors.splice },
      { id: ITEM.braceM, qty: (f.braces.length * f.braceLength) / 1000 },
      { id: ITEM.bracePiece, qty: f.braces.length },
      { id: ITEM.frameCoupling, qty: f.couplings },
      { id: ITEM.frame, qty: 1 },
    ],
  }));
  const groups = new Map<string, FrameBuild[]>();
  for (const f of [...onWall, ...onFeet]) {
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
    const line = c.line(sys.textile, fs.length, { ...c.built, quote: { ...quote, lead: true } }, [...uses].map(([id, qty]) => ({ id, qty })), fast);
    return { ...line, name, unit: 'stk' as const };
  });
}

/** The textile on every frame: one face on a wall, both on foot plates. */
export function textileWallLines(c: CalcContext): CalcLine[] {
  return textileLines(c, [...c.prod.pieces, ...c.prod.free.flatMap((f) => f.faces)], { ...quote, lead: false });
}
