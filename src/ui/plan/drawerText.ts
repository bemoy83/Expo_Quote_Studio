// The drawers' words shared by more than one drawer, and the text style of their drawings (in metres of the drawing).
import type { Motif } from '../../domain/types'
import { INK_MUTED } from '../colors'

export const TXT = { font: '500 0.11px var(--font-ui)', fill: INK_MUTED, pointerEvents: 'none' as const }

/**
 * The hint line across the bottom of a drawer: its parts joined by « · », the empty ones left out. A reason or what a
 * choice means goes first, so the settings column never needs a line of its own and stands still (Bjørn 17.11.2026).
 */
export const hintLine = (...parts: (string | null | undefined | false)[]): string => parts.filter(Boolean).join(' · ')

/** What «Kundens» duk means, in the hint of the wall drawer and of a free-standing textile wall. */
export const REUSE_NOTE = 'Kunden har duken fra før, i samme størrelse: bare montering'

/** What Profilering says beside its title: the motif print and decals lay, or that there is none yet. */
export const motifAside = (m: Motif | undefined) => (m ? `motiv ${m.name}` : 'last opp et motiv')
