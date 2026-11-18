// What every pill is built from (docs/pille-og-skuff.md): its content, the actions it gets, and the colour and motif rows
// the wall, door, frame and decal pills share.
import type { ReactNode } from 'react'
import type { CalcResult } from '../../../calc/calc'
import type { Motif, Variant } from '../../../domain/types'
import { MotifRow, Sw } from '../quick/parts'
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

/** The motifs on a pill (MotifRow). `value` null = none chosen; undefined = nothing to show as chosen. */
export function Motifs({ motifs, value, onPick }: { motifs: Motif[]; value: string | null | undefined; onPick: (m: string | null) => void }) {
  return <MotifRow motifs={motifs} on={(id) => id === value} onPick={onPick} />
}
