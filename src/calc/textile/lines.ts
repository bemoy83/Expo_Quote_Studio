// Textile walls on the quote: the frame (rental) and the textile (sale) are two lines here and one on the quote
// (`quote`). InFrame on system walls first (frames by size, then textile), then free-standing (frame per metre, then
// textile on both sides). What is built comes from calc/production.ts.
import { displayName } from '../../catalog/lookup';
import type { TextileFill } from '../../domain/types';
import { RECIPES } from '../../foga/recipes';
import { ITEM } from '../../pricing/data';
import type { Use } from '../../pricing/model';
import { count, type CalcContext } from '../context';
import type { CalcLine } from '../types';

const inFrameQuote = { key: 'tekstil-vegg', name: 'Tekstilvegg på systemvegg' };
const freeQuote = { key: 'tekstil-fri', name: 'Tekstilvegg frittstående' };

/**
 * Textile per m² of visible face, by fill. Printed and white: the textile incl. bleed; all: pressed in along the whole
 * perimeter. The customer's own textile is only mounted.
 */
function textileLines(c: CalcContext, faces: { W: number; H: number; pw: number; ph: number; fill: TextileFill }[], meta: string, quote: CalcLine['quote']): CalcLine[] {
  return (['print', 'white', 'reuse'] as const).map((fill) => {
    const fs = faces.filter((f) => f.fill === fill);
    const uses: Use[] = [
      ...(fill === 'reuse' ? [] : [{ id: fill === 'print' ? ITEM.print : ITEM.white, qty: fs.reduce((a, f) => a + (f.pw * f.ph) / 1e6, 0) }]),
      { id: ITEM.textileEdge, qty: fs.reduce((a, f) => a + (2 * (f.W + f.H)) / 1000, 0) },
    ];
    const n = fs.length;
    return c.line(c.sys.textileFill[fill], fs.reduce((a, f) => a + (f.W * f.H) / 1e6, 0), { ...c.built, meta: `${meta} · ${n} ${n === 1 ? 'duk' : 'duker'}`, quote }, uses);
  });
}

/**
 * InFrame frame per piece by size B × H: the loose frame parts (43TX at 2W + 2H, 617, 520), braces, mounting per
 * coupling and handling. Fast
 * price: m² rate × B × H.
 */
export function inFrameFrameLines(c: CalcContext): CalcLine[] {
  const { prod, sys, idx } = c;
  const bySize = new Map<string, typeof prod.pieces>();
  for (const p of prod.pieces) bySize.set(`${p.W}×${p.H}`, [...(bySize.get(`${p.W}×${p.H}`) ?? []), p]);
  const textile = idx.byArtnr.get(sys.textile);
  return [...bySize].map(([size, pieces]) => {
    const [W, H] = size.split('×').map(Number);
    const n = pieces.length;
    const uses: Use[] = [
      { id: ITEM.frameProfileM, qty: (n * (2 * W + 2 * H)) / 1000 },
      { id: ITEM.corner, qty: 4 * n },
      { id: ITEM.wallFixing, qty: RECIPES.frame.wallFixing.perFrame * n },
      { id: ITEM.braceM, qty: pieces.reduce((a, p) => a + ((p.braces?.qty ?? 0) * (p.braces?.length ?? 0)) / 1000, 0) },
      { id: ITEM.bracePiece, qty: pieces.reduce((a, p) => a + (p.braces?.qty ?? 0), 0) },
      // Put together on site like the free-standing frame: a 617 in each corner and both ends of every brace
      { id: ITEM.frameCoupling, qty: pieces.reduce((a, p) => a + 4 + 2 * (p.braces?.qty ?? 0), 0) },
      { id: ITEM.frame, qty: n },
    ];
    const fast = Math.round((textile?.variant.price ?? 0) * ((W * H) / 1e6));
    const name = `${textile ? displayName(textile) : sys.textile}, ${W} × ${H} mm`;
    return { ...c.line(sys.textile, n, { ...c.built, quote: { ...inFrameQuote, lead: true } }, uses, fast), name, unit: 'stk' as const };
  });
}

export function inFrameTextileLines(c: CalcContext): CalcLine[] {
  return textileLines(c, c.prod.pieces, 'på systemvegg', { ...inFrameQuote, lead: false });
}

/**
 * Frittstående per metre: 43TX rails and free-end uprights, 92LTX corner posts, a foot plate at every support, the
 * upright braces, 617 corner and 609 or 604 splice connectors, mounting per coupling and handling per frame.
 */
export function freeFrameLines(c: CalcContext): CalcLine[] {
  const { prod } = c;
  const free = prod.free;
  const braces = free.reduce((a, f) => a + f.braces.length, 0);
  const splices = (code: string) => free.filter((f) => f.spliceCode === code).reduce((a, f) => a + f.connectors.splice, 0);
  const freeUses: Use[] = [
    { id: ITEM.frameProfileM, qty: free.reduce((a, f) => a + f.profileMm, 0) / 1000 },
    { id: ITEM.cornerPostM, qty: (prod.cornerPosts.qty * prod.cornerPosts.H) / 1000 },
    ...[...new Set(free.map((f) => f.foot.code))].map((code) => ({ id: ITEM.foot(code), qty: free.filter((f) => f.foot.code === code).reduce((a, f) => a + f.supports.length, 0) })),
    { id: ITEM.corner, qty: free.reduce((a, f) => a + f.connectors.corner, 0) },
    { id: ITEM.splice, qty: splices(RECIPES.freeFrame.splice.thread) },
    { id: ITEM.spliceSlide, qty: splices(RECIPES.freeFrame.splice.slide.code) },
    { id: ITEM.braceM, qty: free.reduce((a, f) => a + f.braces.length * f.braceLength, 0) / 1000 },
    { id: ITEM.bracePiece, qty: braces },
    { id: ITEM.frameCoupling, qty: free.reduce((a, f) => a + f.couplings, 0) },
    { id: ITEM.frame, qty: free.length },
  ];
  const freeMeta = [count(free.length, 'vegg', 'vegger'), `h ${free[0]?.H ?? 0} mm`, ...(prod.cornerPosts.qty ? [count(prod.cornerPosts.qty, 'hjørne', 'hjørner')] : [])];
  return [c.line(c.sys.freeTextile, prod.freeLm, { ...c.built, meta: freeMeta.join(' · '), quote: { ...freeQuote, lead: true } }, freeUses)];
}

export function freeTextileLines(c: CalcContext): CalcLine[] {
  return textileLines(c, c.prod.free.flatMap((f) => f.faces), 'frittstående, begge sider', { ...freeQuote, lead: false });
}
