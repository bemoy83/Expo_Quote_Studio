// The pens of Profilering by product (Bjørn 14.11.2026): Tekstil, Print and Dekal are very different products, each its
// own pen; the only thing they share is the graphics (the motif), which is Farge on the pill. A motif picked goes on
// the pen in hand, never another pen. Pure, so the pill, the tool state and the tests read the same rules.
import type { Brush } from './tools'

export type ProfilePen = Extract<Brush, { kind: 'textile' | 'motif' }>
export type MotifPen = Extract<Brush, { kind: 'motif' }>

export const isProfilePen = (b: Brush | null | undefined): b is ProfilePen => b?.kind === 'textile' || b?.kind === 'motif'

/** Which pen: the textile wall, a whole felt printed (foil 960 × 2420) or a decal on a felt. */
export type ProfileKind = 'textile' | 'print' | 'decal'

export const profileKind = (b: ProfilePen): ProfileKind => (b.kind === 'textile' ? 'textile' : (b.pen ?? 'decal'))

/** The motif on the pen in hand; a textile may have none (drawn without, given one later). */
export const penMotif = (b: ProfilePen): string | undefined => b.motif

/** The pen a Pensel button puts in hand, keeping the graphics: the motif in hand, else the one last picked. Print and
 *  Dekal need a motif: without one there is nothing to put in hand. */
export function profilePen(kind: ProfileKind, cur: ProfilePen | null, last: string | undefined): ProfilePen | null {
  const motif = (cur && penMotif(cur)) ?? last
  if (kind === 'textile') return motif ? { kind: 'textile', motif } : { kind: 'textile' }
  return motif ? { kind: 'motif', motif, pen: kind } : null
}

/** A motif picked (pill, panel, upload): on the pen in hand, else on the tool's last pen, else on Tekstil. */
export function withMotif(cur: ProfilePen | null | undefined, motif: string): ProfilePen {
  if (!cur || cur.kind === 'textile') return { kind: 'textile', motif }
  return { kind: 'motif', motif, pen: cur.pen ?? 'decal' }
}

/** This motif is on the pen in hand. */
export const motifOn = (b: Brush | null, motif: string) => isProfilePen(b) && b.motif === motif
