// What InFrame and free-standing textile share: the full frame height and the print file name (also used by the
// Produksjon page).
import type { InFrameParams } from '../../rules/rules';
import type { FramePiece } from './inFrame';

export const fullHeight = (s: InFrameParams) => s.wallH + s.feet;

/** `Kunde_T1_970x2540mm.pdf`. Strips everything but letters and digits from the customer name. */
export function printFileName(customer: string, pos: string, p: Pick<FramePiece, 'W' | 'H'>): string {
  const name = (customer || 'Firma').replace(/[^A-Za-z0-9æøåÆØÅ]+/g, '');
  return `${name}_${pos}_${p.W}x${p.H}mm.pdf`;
}
