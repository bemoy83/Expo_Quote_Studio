// «Farge og profilering» in the drawer for a counter of Disker og podier (Byggeregler K6, K20), laid out and used as the
// wall drawer's (Bjørn 18.11.2026): with nothing chosen the paint bucket (the side shown) and the brush (plate by plate)
// with the palette, a colour or «Print» last, then a click in the drawing; with a part or a light opening chosen, the
// palette on it at once, and the bucket and brush let it go. Then the decal chosen, and in the detail height the motif
// library with + Dekal. The rules are domain/paint.ts's: a colour on a part or an opening takes its print off, the
// bucket leaves the printed parts as they are. Print and decals go only on the parts that take them: not open all over.
import { Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { addPodiumDecal, printOf, setPodiumPrint, takesDecor, updatePodiumDecal, type PlacedDecal } from '../../../domain/podiumDecor'
import type { Motif, PlacedObject, Variant } from '../../../domain/types'
import { counterRal } from '../../../domain/objects'
import { paintCounterPlates } from '../../../domain/paint'
import { Button, IconButton, Section } from '../../controls'
import { mm } from '../../format'
import { findMotif } from '../../motifs'
import { ColourSection, PRINT, Shelf } from '../drawerParts'
import type { PlanSelection } from '../selection'
import type { CounterTool } from './paint'
import type { ElevationPart } from './podiumView'

interface Props {
  v: Variant
  o: PlacedObject
  /** The parts chosen: the whole side, or the part `part` (its light opening `light`). */
  parts: ElevationPart[]
  part?: number
  light?: number
  scope: string
  partNav?: ReactNode
  /** The decal chosen in the drawing. */
  decal?: PlacedDecal
  motifs: Motif[]
  /** The paint tool out, and what it lays on (unset: the colour of the side). */
  tool: CounterTool
  setTool: (t: CounterTool) => void
  /** What the tools lay on: the colour or PRINT picked, else what the side has. */
  pen: string
  setPaint: (r: string | null) => void
  /** The motif for print and decals, chosen in the library (unset: the print shown, else the first). */
  motifId: string | undefined
  setMotifId: (id: string) => void
  onUpload: (f: File) => void
  select: (x: Partial<PlanSelection>) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
}

export function PodiumDecor(props: Props) {
  const { v, o, parts, part, light, scope, partNav, decal, motifs, tool, setTool, pen, setPaint, motifId, setMotifId, onUpload, select, onEdit } = props
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
  const chosen = part !== undefined
  const painting = tool !== null && !chosen
  /** What the swatch shows: the pen while a tool is out, else what is chosen has (none when it differs). */
  const shown = painting ? pen : scopePrint ? PRINT : colour
  const pickSwatch = (r: string) => {
    // Nothing chosen: the swatch is the pen, and picking one takes up the bucket when no tool is out (as on a wall)
    if (!chosen) {
      setPaint(r)
      if (!tool) setTool('side')
      return
    }
    // On a part or an opening at once: the last stroke wins and the part's print comes off
    if (r === PRINT) return motif && printed[0] !== motif.id && print(decorParts.map((p) => p.key), motif.id)
    onEdit((x) => paintCounterPlates(x, o.id, parts.map((p) => p.key), r, light))
  }
  /** The bucket or brush: what is chosen lets go and the side is coloured as with nothing chosen. */
  const take = (t: CounterTool) => {
    if (chosen) {
      setPaint(scopePrint ? PRINT : (colour ?? null))
      select({})
      setTool(t)
    } else setTool(tool === t ? null : t)
  }
  const pickMotif = (id: string) => {
    setMotifId(id)
    if (decal) return onEdit((x) => updatePodiumDecal(x, o.id, decal.decal.id, { motif: id }))
    // As on a wall: a motif tapped prints a part chosen at once, like a colour in the palette; with nothing chosen it is
    // the motif «Print» lays on
    if (!chosen) return
    if (decorParts.length && printed[0] !== id) print(decorParts.map((p) => p.key), id)
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
      {/* K6, K20: colour and print on what is chosen, or the pen with nothing chosen: the title says what, the value what
          it has or lays on */}
      <ColourSection
        title={chosen ? scope : painting && tool === 'plate' ? 'Plate' : 'Hele siden'}
        value={shown}
        motif={motif}
        nav={partNav}
        tools={{ what: 'siden', bucket: painting && tool === 'side', brush: painting && tool === 'plate', onBucket: () => take('side'), onBrush: () => take('plate') }}
        onPick={pickSwatch}
      />
      <hr className="set-rule" />
      {/* Always there, so the motif library under it stands still; why print and decals do not go on what is chosen is
          in the hint */}
      {decal ? (
        <Section title="Dekal" aside={`${findMotif(motifs, decal.decal.motif)?.name ?? 'motiv'} · ${mm(decal.decal.w / 1000)} × ${mm(decal.decal.h / 1000)}`} tools={<IconButton icon={Trash2} label="Fjern dekalen" size={14} onClick={() => (onEdit((x) => updatePodiumDecal(x, o.id, decal.decal.id, null)), select({ podiumPart: part }))} />} />
      ) : (
        <Section title="Dekal" aside={decorParts.length ? 'ingen' : 'åpen'} />
      )}
      <Shelf title="Profilering" aside={motif ? `motiv ${motif.name}` : 'last opp et motiv'} motifs={motifs} value={motif?.id} onPick={pickMotif} onUpload={onUpload}>
        <Button variant="ghost" icon={Plus} disabled={!decorParts.length || !motif} onClick={addDecal}>
          Dekal
        </Button>
      </Shelf>
    </>
  )
}
