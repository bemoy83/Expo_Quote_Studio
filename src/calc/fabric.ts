// InFrame (SEG) production sizes. Ported rule for rule from the approved mockup (stand/fabric.js), which is authoritative.
// All sizes in mm.
//   Frame width  W = span − side deduction − air            (cc 1000 → 1000 − 20 − 10 = 970)
//   Frame height H = system wall + feet = 2540, or the textile wall's own height when lower
//   Print file   = frame + 2 × bleed;  file at `scale` %
//   Cross braces when W passes the max brace distance; brace length = H − 2 × profile
//   Profile lm   = 2W + 2H + braces
import type { InFrameParams } from '../rules/rules';

export interface FramePiece {
  /** Span along the wall, mm. */
  span: number;
  /** Frame size, mm. */
  W: number;
  H: number;
  /** Print size including bleed, mm. */
  pw: number;
  ph: number;
  /** File size at scale, mm, one decimal. */
  fw: number;
  fh: number;
  /** Bleed at file scale, mm. */
  fb: number;
  /** Print area including bleed, m². */
  area: number;
  profiles: { name: string; qty: number; length: number }[];
  braces: { qty: number; length: number } | null;
  /** Aluminium profile including braces, m. */
  lm: number;
}

export const fullHeight = (s: InFrameParams) => s.wallH + s.feet;

export function framePiece(spanMm: number, s: InFrameParams, heightMm?: number): FramePiece {
  const W = spanMm - s.side - s.air;
  const H = heightMm ?? fullHeight(s);
  const pw = W + 2 * s.bleed;
  const ph = H + 2 * s.bleed;
  const n = Math.max(0, Math.ceil(W / s.stag - 1e-9) - 1);
  const k = s.scale / 100;
  const r1 = (v: number) => Math.round(v * k * 10) / 10;
  const braces = n ? { qty: n, length: Math.max(0, H - 2 * s.prof) } : null;
  return {
    span: spanMm,
    W,
    H,
    pw,
    ph,
    fw: r1(pw),
    fh: r1(ph),
    fb: r1(s.bleed),
    area: (pw * ph) / 1e6,
    profiles: [
      { name: 'Topp/bunn', qty: 2, length: W },
      { name: 'Side', qty: 2, length: H },
    ],
    braces,
    lm: (2 * W + 2 * H + (braces ? braces.qty * braces.length : 0)) / 1000,
  };
}

/** `Kunde_T1_970x2540mm.pdf`. Strips everything but letters and digits from the customer name. */
export function printFileName(customer: string, pos: string, p: Pick<FramePiece, 'W' | 'H'>): string {
  const name = (customer || 'Firma').replace(/[^A-Za-z0-9æøåÆØÅ]+/g, '');
  return `${name}_${pos}_${p.W}x${p.H}mm.pdf`;
}
