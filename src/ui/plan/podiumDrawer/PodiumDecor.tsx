// «Farge og profilering» in the drawer for a counter of Disker og podier (trinn 2, Byggeregler K6, K20): the counter's
// colour, print on the side or the part chosen (Print last in the palette, the paint bucket for the whole counter), the
// decal chosen, and in the detail height the motif library with + Dekal. Print and decals go only on the parts that
// take them: not open all over, not against a wall or another counter.
import { PaintBucket, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { addPodiumDecal, printOf, setPodiumPrint, takesDecor, updatePodiumDecal, type PlacedDecal } from '../../../domain/podiumDecor'
import type { Motif, PlacedObject, Variant } from '../../../domain/types'
import { counterRal, setCounterRal } from '../../../domain/objects'
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
  /** The parts chosen: the whole side, or the part `part`. */
  parts: ElevationPart[]
  part?: number
  scope: string
  partNav?: ReactNode
  /** The decal chosen in the drawing. */
  decal?: PlacedDecal
  motifs: Motif[]
  onUpload: (f: File) => void
  select: (x: Partial<PlanSelection>) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
}

export function PodiumDecor({ v, o, parts, part, scope, partNav, decal, motifs, onUpload, select, onEdit }: Props) {
  // The motif for print and decals, chosen in the library
  const [motifId, setMotifId] = useState<string | undefined>(undefined)
  const ral = counterRal(o)
  // K20: print and decals go on the parts that take them: not open all over, not against a wall or another counter
  const decorParts = parts.filter((p) => !p.locked && takesDecor(o.sections!, p.part))
  const printed = [...new Set(decorParts.map((p) => printOf(o.sections!, p.part) ?? null))]
  const scopePrint = printed.length === 1 ? printed[0] : null
  const motif = findMotif(motifs, motifId ?? scopePrint ?? decal?.decal.motif) ?? motifs[0]
  const print = (keys: string[] | 'all', id: string | null) => onEdit((x) => setPodiumPrint(x, o.id, keys, id))
  const pickSwatch = (r: string) => {
    if (r === PRINT) return motif && print(decorParts.map((p) => p.key), motif.id)
    // K6: the colour is the whole counter's; the last stroke wins, so it takes the print off what is chosen
    onEdit((x) => setPodiumPrint(setCounterRal(x, o.id, r), o.id, decorParts.map((p) => p.key), null))
  }
  const fillAll = () => (scopePrint && motif ? print('all', motif.id) : onEdit((x) => setPodiumPrint(x, o.id, 'all', null)))
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
      <Section
        title={scope}
        aside={scopePrint ? `print · ${findMotif(motifs, scopePrint)?.name ?? 'motiv'}` : `${plateName(ral)} ${ral}`}
        tools={
          <>
            {partNav}
            <IconButton icon={PaintBucket} label={scopePrint ? 'Fyll: print på hele disken' : 'Fyll: fargen på hele disken, uten print'} size={15} className="ink" onClick={fillAll} />
          </>
        }
      >
        <PlatePalette value={scopePrint ? PRINT : ral} onPick={pickSwatch} print={{ motif }} />
        {!decorParts.length && <p className="set-note">{parts.some((p) => p.locked) ? 'Mot vegg eller disk: ingen print eller dekal' : 'Åpen del: ingen print eller dekal'}</p>}
        <p className="set-note">Fargen gjelder hele disken (K6). Print dekker platene og dørene i {part === undefined ? 'siden' : 'delen'}.</p>
      </Section>
      {decal && (
        <Section title="Dekal" aside={`${findMotif(motifs, decal.decal.motif)?.name ?? 'motiv'} · ${mm(decal.decal.w / 1000)} × ${mm(decal.decal.h / 1000)}`} tools={<IconButton icon={Trash2} label="Fjern dekalen" size={14} onClick={() => (onEdit((x) => updatePodiumDecal(x, o.id, decal.decal.id, null)), select({ podiumPart: part }))} />} />
      )}
      <Shelf title="Profilering" aside={motif?.name} motifs={motifs} value={motif?.id} onPick={pickMotif} onUpload={onUpload}>
        <Button variant="ghost" icon={Plus} disabled={!decorParts.length || !motif} onClick={addDecal}>
          Dekal
        </Button>
      </Shelf>
    </>
  )
}
