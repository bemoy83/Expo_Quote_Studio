// The settings column of the wall drawer: one panel for what is chosen, and the motif library (Profilering) under it. A
// textile frame (TextileSettings, the same as on foot plates), a decal or print, a door, a felt's colour, or nothing (the wall itself: colour and print with the paint
// bucket and brush). «Hyller og heng» and a chosen shelf are in fittings.tsx.
import { DoorOpen, Palette, Repeat2 } from 'lucide-react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { updateFoil } from '../../../domain/decor'
import { onDoorPart, printsOn } from '../../../domain/print'
import { doorRal, removeOpening } from '../../../domain/doors'
import type { FaceSide } from '../../../domain/faces'
import type { DoorSurface, Foil, Motif, Opening, Variant, Wall } from '../../../domain/types'
import type { BuiltModule } from '../../../domain/walls'
import { Button, Dim, FlatChoice, IconButton, Section } from '../../controls'
import { plateColor, productOf, rules } from '../../env'
import { DoorSettings } from '../DoorSettings'
import { ColourSection, DrawerHead, PrevNext, PRINT, Shelf } from '../drawerParts'
import { findMotif } from '../../motifs'
import { type PlanSelection } from '../selection'
import { faceName } from './face'
import { clearOf, type PaintTool } from '../paintTools'
import { motifAside } from '../drawerText'

type Edit = (fn: (v: Variant) => Variant, history?: boolean) => void

/** A chosen foil: a decal within its plate, or print over the whole plate. */
export function FoilPanel({ F, ratioOf, onEdit }: { F: Foil; ratioOf: (id?: string) => number; onEdit: Edit }) {
  return (
    <>
      <Section title="Dekning">
        <FlatChoice<boolean>
          label="Dekning"
          value={F.full}
          onChange={(full) => onEdit((x) => updateFoil(x, rules, F.id, { full }, ratioOf(F.motif)))}
          options={[
            { value: false, label: 'Dekal' },
            { value: true, label: 'Hel plate' },
          ]}
        />
      </Section>
      {!F.full && (
        <Section title="Mål">
          <div className="wd-dims">
            <Dim big label="Bredde" value={F.width} decimals={2} onChange={(n) => onEdit((x) => updateFoil(x, rules, F.id, { width: n }, ratioOf(F.motif)))} />
          </div>
        </Section>
      )}
    </>
  )
}

/**
 * The Profilering section under the colour (Bjørn 9.11.2026: the same word as in the rail and the tool dock): the motif
 * library, with what is laid on or beside the plates. With a felt chosen a motif prints the plate (and is the one its
 * «Print» and decal use), and it adds a decal; with the whole wall it is the print files to drag onto the wall, and a textile wall. A chosen decal picks
 * its motif here. A chosen textile frame has its motifs in its fabric section.
 */
export function WallShelf(props: {
  F?: Foil
  /** A felt is chosen: picking a motif prints it on the plate and sets the one its «Print» and «Dekal» use. */
  felt?: (id: string) => void
  printing: boolean
  pm: Motif | undefined
  motifs: Motif[]
  ratioOf: (id?: string) => number
  setMotif: (id: string) => void
  onEdit: Edit
  onUpload: (f: File) => void
  children?: ReactNode
}) {
  const { F, felt, printing, pm, motifs, ratioOf, setMotif, onEdit, onUpload, children } = props
  const [title, aside] = F
    ? ['Motiv', findMotif(motifs, F.motif)?.name ?? 'ikke valgt']
    : ['Profilering', felt || printing ? motifAside(pm) : 'dra til veggen']
  const value = F ? (F.motif ?? null) : printing || felt ? pm?.id : undefined
  const onPick = F
    ? (m: string) => onEdit((x) => updateFoil(x, rules, F.id, { motif: m }, ratioOf(m)))
    : (felt ?? (printing ? setMotif : undefined))
  return (
    <Shelf title={title} aside={aside} motifs={motifs} value={value} onPick={onPick} onUpload={onUpload}>
      {children}
    </Shelf>
  )
}

/** The wall itself: the paint bucket and the brush, and the palette (a colour or «Print»). */
export function ColourPanel(props: {
  painting: boolean
  tool: PaintTool
  setTool: Dispatch<SetStateAction<PaintTool>>
  pm: Motif | undefined
  paint: string
  ral: string
  setPaint: Dispatch<SetStateAction<string | null>>
  /** «Fjern farge og print» on the whole wall. */
  clear: { off: boolean; onClick: () => void }
}) {
  const { painting, tool, setTool, pm, paint, ral, setPaint, clear } = props
  const value = painting ? paint : ral
  return (
    <ColourSection
      title={painting && tool === 'brush' ? 'Plate' : 'Hele veggen'}
      value={value}
      motif={pm}
      tools={{ what: 'veggen', tool, onTool: (x) => setTool(tool === x ? null : x) }}
      clear={clear}
      onPick={(r) => {
        setPaint(r)
        // Picking a colour takes up the paint bucket when no tool is out
        if (!tool) setTool('bucket')
      }}
    />
  )
}

/** A chosen door or curtain: its settings, the mini plan to move it (`children`), and the way back to colour and graphics. */
export function DoorPanel(props: {
  v: Variant
  O: Opening
  w: Wall
  flip: FaceSide | undefined
  select: (x: Partial<PlanSelection>) => void
  selectDoor: (id: string, side?: FaceSide, surface?: DoorSurface) => void
  onEdit: Edit
  onClose: () => void
  children?: ReactNode
}) {
  const { v, O, w, flip, select, selectDoor, onEdit, onClose, children } = props
  const door = productOf(O.product)?.opening === 'door'
  return (
    <>
      <DoorSettings
        v={v}
        o={O}
        w={w}
        onEdit={onEdit}
        onRemove={() => {
          onEdit((x) => removeOpening(x, O.id))
          select({})
        }}
        onClose={onClose}
      >
        {flip !== undefined && <IconButton icon={Repeat2} label={`Vis ${faceName(w, flip).toLowerCase()}`} size={14} onClick={() => selectDoor(O.id, flip)} />}
      </DoorSettings>
      <hr className="set-rule" />
      <div className="wd-sec">{children}</div>
      {/* A door's colour and print: its leaf and header, each a surface (Bjørn 18.11.2026); a curtain's: the wall's
          palette, as a 1 × 1 room's side is only the door, so the drawing has nothing else to click (Bjørn 3.11.2026) */}
      <div className="wd-foot">
        <div className="wd-actions">
          <Button variant="ghost" icon={Palette} onClick={() => (door ? selectDoor(O.id, undefined, 'leaf') : select({}))}>
            Farge og profilering
          </Button>
        </div>
      </div>
    </>
  )
}

/**
 * A door's header or leaf chosen in the drawing (Bjørn 18.11.2026): each a surface of its own, as a felt. Its colour
 * and print (the palette on it at once, the last stroke wins; ‹ › to the other surface; bucket and brush let it go),
 * the motif library (a motif prints it at once), and the way back to the door's own settings.
 */
export function DoorSurfacePanel(props: {
  v: Variant
  O: Opening
  w: Wall
  s: FaceSide
  part: DoorSurface
  mods: (BuiltModule | undefined)[]
  motifs: Motif[]
  pm: Motif | undefined
  setTool: (t: PaintTool) => void
  setMotif: (id: string) => void
  /** A colour or «Print» (with a motif) on this surface: the wall's plate pick (wallDrawer/paint.ts `pickAt`). */
  pick: (r: string, motif?: string) => void
  select: (x: Partial<PlanSelection>) => void
  selectDoor: (id: string, side?: FaceSide, surface?: DoorSurface) => void
  onEdit: Edit
  onUpload: (f: File) => void
  onClose: () => void
}) {
  const { v, O, w, s, part, mods, motifs, pm, setTool, setMotif, pick, select, selectDoor, onEdit, onUpload, onClose } = props
  const m = O.module
  const printed = printsOn(v, w.id, s).find((f) => f.module === m && onDoorPart(f, part))
  const colour = part === 'leaf' ? doorRal(v, O) : (mods[m]?.plate ?? v.defaultPlate)
  const name = part === 'leaf' ? 'Dørblad' : 'Overstykke'
  const take = (t: PaintTool) => {
    setTool(t)
    select({})
  }
  const other: DoorSurface = part === 'leaf' ? 'header' : 'leaf'
  return (
    <>
      <DrawerHead dot={plateColor(colour)} title={`Dør · ${name.toLowerCase()}`} remove={{ label: 'Gjør om til vegg (Delete)', onClick: () => (onEdit((x) => removeOpening(x, O.id)), select({})) }} onClose={onClose} />
      <p className="wd-meta num">{part === 'leaf' ? 'Dørbladet i 292-rammen' : 'Platen over døren'} · {faceName(w, s).toLowerCase()}</p>
      <ColourSection
        title={name}
        value={printed ? PRINT : colour}
        motif={printed ? (findMotif(motifs, printed.motif) ?? pm) : pm}
        nav={<PrevNext what="flate" onPrev={() => selectDoor(O.id, s, other)} onNext={() => selectDoor(O.id, s, other)} />}
        tools={{ what: 'veggen', tool: null, onTool: take }}
        onPick={pick}
        clear={clearOf(v, { kind: 'door', openingId: O.id, side: s, part }, onEdit)}
      />
      <hr className="set-rule" />
      <Shelf
        title="Profilering"
        aside={motifAside(pm)}
        motifs={motifs}
        value={printed?.motif ?? pm?.id}
        onPick={(id) => {
          setMotif(id)
          pick(PRINT, id)
        }}
        onUpload={onUpload}
      />
      <div className="wd-foot">
        <div className="wd-actions">
          <Button variant="ghost" icon={DoorOpen} onClick={() => selectDoor(O.id, s)}>
            Dør og slag
          </Button>
        </div>
      </div>
    </>
  )
}

/**
 * A felt chosen in the drawing (Bjørn 9.11.2026): choose first, then act. Two pages, switched at the foot of the drawer
 * as a door is: «Farge og profilering», this panel (this plate's colour, both faces, or «Print» on this face; the
 * Profilering section under it adds a decal), and «Hyller og heng» (FeltFittings in fittings.tsx).
 * The paint bucket and brush are on the colour page too: picking one lets the felt go and colours the wall as before, so
 * the whole wall can be filled without leaving the drawer.
 */
export function FeltPanel(props: {
  v: Variant
  w: Wall
  s: FaceSide
  m: number
  /** The plate's upper felt over the middle rail, on a raised wall (Byggeregel V20). */
  upper?: boolean
  mods: (BuiltModule | undefined)[]
  motifs: Motif[]
  pm: Motif | undefined
  setTool: (t: PaintTool) => void
  /** A colour or «Print» on this plate, the print on this face off (the last stroke wins): wallDrawer/paint.ts `pickAt`. */
  pick: (r: string) => void
  select: (x: Partial<PlanSelection>) => void
  onEdit: Edit
}) {
  const { v, w, s, m, upper, mods, motifs, pm, setTool, pick, select, onEdit } = props
  const plate = upper ? mods[m]!.raise!.ral : mods[m]!.plate
  const printed = printsOn(v, w.id, s).find((f) => f.module === m && !!f.upper === !!upper)
  const arrows = <FeltArrows m={m} s={s} mods={mods} upper={upper} select={select} />
  /** The bucket or brush: the felt lets go and the wall is coloured as with nothing chosen. */
  const take = (t: PaintTool) => {
    setTool(t)
    select({})
  }
  return (
    <ColourSection
      title={upper ? `Øvre felt ${m + 1}` : `Felt ${m + 1}`}
      value={printed ? PRINT : plate}
      motif={printed ? (findMotif(motifs, printed.motif) ?? pm) : pm}
      nav={arrows}
      tools={{ what: 'veggen', tool: null, onTool: take }}
      onPick={pick}
      clear={clearOf(v, { kind: 'wall', wallId: w.id, side: s, module: m, ...(upper && { upper }) }, onEdit)}
    />
  )
}

/** ‹ › to the felt beside, as seen from in front of the face (the modules run the other way on face −1), as ‹ › go to
 *  the part beside in the counter drawer; arrows move a thing (a shelf). Doors are no felts. */
export function FeltArrows({ m, s, mods, upper, select }: { m: number; s: FaceSide; mods: (BuiltModule | undefined)[]; upper?: boolean; select: (x: Partial<PlanSelection>) => void }) {
  const dir = s === 1 ? 1 : -1
  // Upper felts (V20) go to the next raised one, over a door too
  const takes = (x: BuiltModule | undefined) => (upper ? !!x?.raise : !!x && !x.opening)
  const step = (d: number) => {
    for (let i = m + d; i >= 0 && i < mods.length; i += d) if (takes(mods[i])) return select({ felt: i, ...(upper && { upper }) })
  }
  return <PrevNext what="felt" onPrev={() => step(-dir)} onNext={() => step(dir)} />
}
