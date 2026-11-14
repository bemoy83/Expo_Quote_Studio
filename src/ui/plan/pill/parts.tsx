// What every pill is built from (docs/pille-og-skuff.md): its content, the actions it gets, and the colour and motif rows
// the wall, door, frame and decal pills share.
import type { ReactNode } from 'react'
import type { CalcResult } from '../../../calc/calc'
import type { Motif, Variant } from '../../../domain/types'
import { Sw } from '../quick/parts'
import { ralSwatches } from '../swatches'
import type { PlanSelection } from '../selection'

export type Edit = (fn: (v: Variant) => Variant, history?: boolean) => void

export interface PillActions {
  v: Variant
  res: CalcResult
  selection: PlanSelection
  motifs: Motif[]
  onEdit: Edit
  onSelect: (s: PlanSelection) => void
  onOpenDrawer: (s: PlanSelection) => void
  onToast: (text: string) => void
}

/** What a pill shows: name and size, its grips, Detaljer (the drawer) and remove. */
export interface Content {
  name: string
  meta?: string
  body?: ReactNode
  more?: boolean
  remove?: () => void
  removeLabel?: string
}

/** The pill's second face: «Grafikk» on a wall (the motif list takes the colours' place), «Høyde» on a shelf (the quick
 *  picks take Ned/Opp's place). Back to the first when the selection changes. */
export interface SecondFace {
  on: boolean
  set: (on: boolean) => void
}

/** Motifs on the pill: the newest of the library (the customer's own come last), plus the chosen one. */
const MOTIFS = 5
/** The wall colours on the pill, the same row as on the Vegg and Disker quick picks (`ralSwatches`). */
export function Colours({ value, title, onPick }: { value: string; title: (name: string) => string; onPick: (ral: string) => void }) {
  return (
    <>
      {ralSwatches(value, title, (r) => r !== value && onPick(r)).map(({ key, ...x }) => (
        <Sw key={key} {...x} />
      ))}
    </>
  )
}

/** The newest motifs of the library, and the chosen one. `value` null = none chosen; undefined = nothing to show as chosen. */
export function Motifs({ motifs, value, onPick }: { motifs: Motif[]; value: string | null | undefined; onPick: (m: string | null) => void }) {
  return (
    <>
      {motifs
        .filter((m, i) => i >= motifs.length - MOTIFS || m.id === value)
        .map((m) => (
          <button key={m.id} type="button" className="q-motif" aria-pressed={m.id === value} title={`Motiv: ${m.name}`} onClick={() => m.id !== value && onPick(m.id)}>
            <img src={m.src} alt={m.name} draggable={false} />
          </button>
        ))}
    </>
  )
}
