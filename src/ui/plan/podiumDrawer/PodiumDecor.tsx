// «Farge og profilering» in the drawer for a counter of Disker og podier (trinn 2, Byggeregler K6, K20): colour and print
// on what is chosen, the side, a part or one light opening of it (Print last in the palette, the paint bucket for the
// side shown), the decal chosen, and in the detail height the motif library with + Dekal. The rules are the walls'
// (domain/paint.ts): a colour on a part or an opening takes its print off, over the side the printed parts stay.
// Print and decals go only on the parts that take them: not open all over.
import { PaintBucket, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { addPodiumDecal, printOf, setPodiumPrint, takesDecor, updatePodiumDecal, type PlacedDecal } from '../../../domain/podiumDecor'
import type { Motif, PlacedObject, Variant } from '../../../domain/types'
import { counterRal } from '../../../domain/objects'
import { paintCounterPlates, paintCounterSide } from '../../../domain/paint'
import { Button, IconButton, Section } from '../../controls'
import { plateName } from '../../env'
import { mm } from '../../format'
import { findMotif } from '../../motifs'
import { PlatePalette, PRINT, Shelf } from '../drawerParts'
import type { PlanSelection } from '../selection'
import type { ElevationPart } from './podiumView'

interface Props {
  v: Variant
  o: PlacedObject
  /** The parts of the side shown, and those chosen: the whole side, or the part `part` (its light opening `light`). */
  side: ElevationPart[]
  parts: ElevationPart[]
  part?: number
  light?: number
  scope: string
  partNav?: ReactNode
  /** The decal chosen in the drawing. */
  decal?: PlacedDecal
  motifs: Motif[]
  onUpload: (f: File) => void
  select: (x: Partial<PlanSelection>) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
}

export function PodiumDecor({ v, o, side, parts, part, light, scope, partNav, decal, motifs, onUpload, select, onEdit }: Props) {
  // The motif for print and decals, chosen in the library
  const [motifId, setMotifId] = useState<string | undefined>(undefined)
  const ral = counterRal(o)
  // K20: print and decals go on the parts that take them: not open all over
  const decorParts = parts.filter((p) => takesDecor(o.sections!, p.part))
  const printed = [...new Set(decorParts.map((p) => printOf(o.sections!, p.part) ?? null))]
  const scopePrint = printed.length === 1 ? printed[0] : null
  // K6: the colour of what is chosen, of its plates and sliding doors (not of what is open); none when they differ
  const colours = [...new Set(parts.flatMap((p) => p.lights.flatMap((k, i) => (k === 'open' || (light !== undefined && i !== light) ? [] : [p.rals[i] ?? ral]))))]
  const colour = colours.length === 1 ? colours[0] : undefined
  const motif = findMotif(motifs, motifId ?? scopePrint ?? decal?.decal.motif) ?? motifs[0]
  const print = (keys: string[], id: string | null) => onEdit((x) => setPodiumPrint(x, o.id, keys, id))
  const sideKeys = side.map((p) => p.key)
  const pickSwatch = (r: string) => {
    if (r === PRINT) return motif && print(decorParts.map((p) => p.key), motif.id)
    // On a part or an opening the last stroke wins and the part's print comes off; over the whole side the printed
    // parts stay, as print is a choice made on purpose (Bjørn 18.11.2026)
    onEdit((x) => (part === undefined ? paintCounterSide(x, o.id, sideKeys, r).v : paintCounterPlates(x, o.id, parts.map((p) => p.key), r, light)))
  }
  // The bucket lays what is chosen over the side shown (Bjørn 18.11.2026): the print on every part that takes it, or
  // the colour on every part, the printed ones left as they are
  const fillSide = () => {
    if (scopePrint && motif) print(side.filter((p) => takesDecor(o.sections!, p.part)).map((p) => p.key), motif.id)
    else if (colour) onEdit((x) => paintCounterSide(x, o.id, sideKeys, colour).v)
  }
  const pickMotif = (id: string) => {
    setMotifId(id)
    if (decal) return onEdit((x) => updatePodiumDecal(x, o.id, decal.decal.id, { motif: id }))
    // As on a wall: a motif tapped prints what is chosen at once, like a colour in the palette
    if (decorParts.length) print(decorParts.map((p) => p.key), id)
  }
  const addDecal = () => {
    const target = decorParts[0]
    if (!target || !motif) return
    const r = addPodiumDecal(v, o.id, target.key, motif.id, motif.ratio)
    if (!r.decal) return
    onEdit(() => r.v)
    select({ podiumPart: part, podiumDecal: r.decal })
  }

  return (
    <>
      {/* K6, K20: colour and print on what is chosen: the title says what, the value what it has */}
      <Section
        title={scope}
        aside={scopePrint ? `print · ${findMotif(motifs, scopePrint)?.name ?? 'motiv'}` : colour ? `${plateName(colour)} ${colour}` : 'blandet'}
        tools={
          <>
            {partNav}
            <IconButton icon={PaintBucket} label={scopePrint ? 'Fyll: print på hele siden' : 'Fyll: fargen på hele siden, deler med print står som før'} size={15} className="ink" disabled={!scopePrint && !colour} onClick={fillSide} />
          </>
        }
      >
        <PlatePalette value={scopePrint ? PRINT : (colour ?? '')} onPick={pickSwatch} print={{ motif }} />
      </Section>
      <hr className="set-rule" />
      {/* Always there, so the motif library under it stands still; why print and decals do not go on what is chosen is
          in the hint */}
      {decal ? (
        <Section title="Dekal" aside={`${findMotif(motifs, decal.decal.motif)?.name ?? 'motiv'} · ${mm(decal.decal.w / 1000)} × ${mm(decal.decal.h / 1000)}`} tools={<IconButton icon={Trash2} label="Fjern dekalen" size={14} onClick={() => (onEdit((x) => updatePodiumDecal(x, o.id, decal.decal.id, null)), select({ podiumPart: part }))} />} />
      ) : (
        <Section title="Dekal" aside={decorParts.length ? 'ingen' : 'åpen'} />
      )}
      <Shelf title="Profilering" aside={motif?.name} motifs={motifs} value={motif?.id} onPick={pickMotif} onUpload={onUpload}>
        <Button variant="ghost" icon={Plus} disabled={!decorParts.length || !motif} onClick={addDecal}>
          Dekal
        </Button>
      </Shelf>
    </>
  )
}
