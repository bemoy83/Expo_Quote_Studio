// What every pill is built from (docs/pille-og-skuff.md): its content, the actions it gets, and the colour and motif rows
// the wall, door, frame and decal pills share.
import { Move, RotateCw, Unlink } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CalcResult } from '../../../calc/calc'
import { groupOf, groupSize, type Part } from '../../../domain/joints'
import type { Motif, Variant } from '../../../domain/types'
import { FinBtn, MotifRow, QBtn, Sep, Sw } from '../quick/parts'
import { turnPart } from '../turn'
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

/**
 * Flytt, Roter and Løsne, the same on an inner wall and a free-standing textile wall (Bjørn 21.11.2026): «Fin» makes a
 * wall's drag move it in 250 off the metre lines (Byggeregel V7; a textile wall moves in 250 anyway, M2), Roter turns it
 * 90° with what it is joined to (M6), Løsne lets it go alone (M5).
 */
export function MoveTools({ p, part }: { p: PillActions; part: Part }) {
  return (
    <>
      <Sep />
      {part.kind === 'wall' && (
        <FinBtn title={{ on: 'Dra flytter veggen i 250 · trykk for hele meter igjen', off: 'Flytt veggen i 250, utenfor metrelinjene · på desktop også Shift + dra' }}>
          <Move size={15} />
        </FinBtn>
      )}
      <QBtn title="Roter 90° om midten (R)" label="Roter" onClick={() => turnPart(p, part, !!p.selection.loose)}>
        <RotateCw size={15} />
      </QBtn>
      <LooseBtn p={p} part={part} />
    </>
  )
}

/** «Løsne» (Byggeregel M5) on an inner wall joined to something, and on every free-standing textile wall: a setting
 *  while it stays chosen, its drags then move it alone, out of the group and past the magnet (as Alt + dra on desktop).
 *  None on a wall that stands alone. */
export function LooseBtn({ p, part }: { p: PillActions; part: Part }) {
  const g = groupOf(p.v, part)
  // A textile wall always has it: it also lets the drag past the magnet that would mount it on a wall (M4)
  if (part.kind !== 'textile' && groupSize(g) < 2 && !g.anchored) return null
  const on = !!p.selection.loose
  return (
    <>
      <Sep />
      <QBtn
        on={on}
        setting
        title={on ? 'Dra flytter bare denne, forbi magneten · trykk for å flytte med det den er koblet til' : 'Løsne: dra flytter bare denne, ut av det den er koblet til og forbi magneten · på desktop også Alt + dra'}
        label="Løsne"
        onClick={() => p.onSelect({ ...p.selection, loose: !on })}
      >
        <Unlink size={15} />
        Løsne
      </QBtn>
    </>
  )
}
