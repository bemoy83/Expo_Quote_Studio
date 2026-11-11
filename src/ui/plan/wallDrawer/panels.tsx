// The settings column of the wall drawer: one panel for what is chosen, and the motif library (Profilering) under it. A
// textile frame, a decal or print, a door, a felt's colour, or nothing (the wall itself: colour and print with the paint
// bucket and brush). «Hyller og heng» and a chosen shelf are in fittings.tsx.
import { ArrowLeft, ArrowRight, PaintBucket, Paintbrush, Palette, Repeat2 } from 'lucide-react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { feltBlocked, updateFoil } from '../../../domain/decor'
import { setPanels } from '../../../domain/panels'
import { clearPrint, printPlate, printsOn } from '../../../domain/print'
import { removeOpening } from '../../../domain/doors'
import type { FaceSide } from '../../../domain/faces'
import { textileBox, updateTextile } from '../../../domain/textile/inFrame'
import type { Foil, Motif, Opening, TextileWall, Variant, Wall } from '../../../domain/types'
import type { BuiltModule } from '../../../domain/walls'
import { Button, Dim, FlatChoice, IconButton, Section } from '../../controls'
import { plateName, rules } from '../../env'
import { DoorSettings } from '../DoorSettings'
import { FabricSection, PlatePalette, PRINT, Shelf } from '../drawerParts'
import { findMotif } from '../../motifs'
import { type PlanSelection } from '../selection'
import { faceName } from './face'
import type { PaintTool } from './paint'

type Edit = (fn: (v: Variant) => Variant, history?: boolean) => void

/** A chosen textile frame: its size, then its fabric and motif in one section. */
export function TextilePanel({ T, motifs, onEdit, onUpload }: { T: TextileWall; motifs: Motif[]; onEdit: Edit; onUpload: (f: File) => void }) {
  return (
    <>
      <Section title="Mål">
        <div className="wd-dims">
        <Dim big label="Bredde" value={T.width} onChange={(n) => onEdit((x) => updateTextile(x, rules, T.id, { width: n }))} />
        <Dim big label="Høyde" value={textileBox(T, rules).height} decimals={2} onChange={(n) => onEdit((x) => updateTextile(x, rules, T.id, { height: n }))} />
        <Dim big label="Fra gulv" value={textileBox(T, rules).bottom} onChange={(n) => onEdit((x) => updateTextile(x, rules, T.id, { bottom: n }))} />
        </div>
      </Section>
      <FabricSection
        value={T.fill ?? 'print'}
        onChange={(f) => onEdit((x) => updateTextile(x, rules, T.id, { fill: f }))}
        motifs={motifs}
        motif={T.motif}
        onPick={(m) => onEdit((x) => updateTextile(x, rules, T.id, { motif: m }))}
        onUpload={onUpload}
      />
    </>
  )
}

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
        {F.full && (
          <p className="set-note">
            Dekker platen mellom stolpene, {rules.wall.plate.width} × {rules.wall.plate.height} mm
          </p>
        )}
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
  setPrintMotif: (id: string) => void
  onEdit: Edit
  onUpload: (f: File) => void
  children?: ReactNode
}) {
  const { F, felt, printing, pm, motifs, ratioOf, setPrintMotif, onEdit, onUpload, children } = props
  const [title, aside] = F
    ? ['Motiv', findMotif(motifs, F.motif)?.name ?? 'ikke valgt']
    : ['Profilering', felt || printing ? (pm ? `motiv ${pm.name}` : 'last opp et motiv') : 'dra til veggen']
  const value = F ? (F.motif ?? null) : printing || felt ? pm?.id : undefined
  const onPick = F
    ? (m: string) => onEdit((x) => updateFoil(x, rules, F.id, { motif: m }, ratioOf(m)))
    : (felt ?? (printing ? setPrintMotif : undefined))
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
  printing: boolean
  pm: Motif | undefined
  paint: string
  ral: string
  setPaint: Dispatch<SetStateAction<string | null>>
}) {
  const { painting, tool, setTool, printing, pm, paint, ral, setPaint } = props
  return (
    <Section
      title={painting && tool === 'plate' ? 'Plate' : 'Hele veggen'}
      aside={painting ? (printing ? `print ${pm?.name ?? ''}` : `${plateName(paint)} ${paint}`) : `${plateName(ral)} ${ral}`}
      tools={
        <>
        <IconButton icon={PaintBucket} label="Malerspann: klikk veggen for å farge hele siden" size={15} className="ink" pressed={tool === 'wall'} onClick={() => setTool(tool === 'wall' ? null : 'wall')} />
        <IconButton icon={Paintbrush} label="Malerkost: klikk én og én plate" size={15} className="ink" pressed={tool === 'plate'} onClick={() => setTool(tool === 'plate' ? null : 'plate')} />
        </>
      }
    >
      <PlatePalette
        value={painting ? paint : ral}
        print={{ motif: pm }}
        onPick={(r) => {
          setPaint(r)
          // Picking a colour takes up the paint bucket when no tool is out
          if (!tool) setTool('wall')
        }}
      />
    </Section>
  )
}

/** A chosen door or curtain: its settings, the mini plan to move it (`children`), and the way back to colour and graphics. */
export function DoorPanel(props: {
  v: Variant
  O: Opening
  w: Wall
  flip: FaceSide | undefined
  select: (x: Partial<PlanSelection>) => void
  selectDoor: (id: string, side?: FaceSide) => void
  onEdit: Edit
  onClose: () => void
  children?: ReactNode
}) {
  const { v, O, w, flip, select, selectDoor, onEdit, onClose, children } = props
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
      <div className="wd-sec">{children}</div>
      {/* The way back to the palette: colour and graphics for the door are the wall's, and a 1 × 1 room's side is
          only the door, so the drawing has nothing else to click (Bjørn 3.11.2026) */}
      <div className="wd-foot">
        <div className="wd-actions">
          <Button variant="ghost" icon={Palette} onClick={() => select({})}>
            Farge og profilering
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
  mods: (BuiltModule | undefined)[]
  motifs: Motif[]
  pm: Motif | undefined
  base: (key: string) => string
  twoFaces: boolean
  setTool: (t: PaintTool) => void
  select: (x: Partial<PlanSelection>) => void
  onEdit: Edit
  onToast: (t: string) => void
}) {
  const { v, w, s, m, mods, motifs, pm, base, twoFaces, setTool, select, onEdit, onToast } = props
  const key = mods[m]!.key
  const plate = mods[m]!.plate
  const printed = printsOn(v, w.id, s).find((f) => f.module === m)
  const arrows = <FeltArrows m={m} s={s} mods={mods} select={select} />

  const noPrint = feltBlocked(v, rules, w.id, m, s, true)
  /** A colour on this plate (the print on this face comes off: the last stroke wins), or the chosen motif over it. */
  const pick = (r: string) => {
    if (r !== PRINT) return onEdit((x) => clearPrint(setPanels(x, [key], r, base), w.id, s, [m]))
    if (!pm) return onToast('Last opp et motiv i Profilering først')
    if (noPrint) return onToast(noPrint)
    if (printed?.motif !== pm.id || printed.run) onEdit((x) => printPlate(x, rules, w.id, m, s, pm.id))
  }
  /** The bucket or brush: the felt lets go and the wall is coloured as with nothing chosen. */
  const take = (t: PaintTool) => {
    setTool(t)
    select({})
  }
  return (
    <Section
      title={`Felt ${m + 1}`}
      aside={printed ? `print ${findMotif(motifs, printed.motif)?.name ?? ''}`.trim() : `${plateName(plate)} ${plate}`}
      tools={
        <>
          {arrows}
          <IconButton icon={PaintBucket} label="Malerspann: klikk veggen for å farge hele siden" size={15} className="ink" onClick={() => take('wall')} />
          <IconButton icon={Paintbrush} label="Malerkost: klikk én og én plate" size={15} className="ink" onClick={() => take('plate')} />
        </>
      }
    >
      <PlatePalette value={printed ? PRINT : plate} print={{ motif: pm }} onPick={pick} />
      {noPrint ? <p className="set-note">{noPrint}</p> : twoFaces && !printed && <p className="set-note">Fargen gjelder platen på begge sider</p>}
    </Section>
  )
}

/** The arrows to the felt beside, as seen from in front of the face (the modules run the other way on face −1). Doors are no felts. */
export function FeltArrows({ m, s, mods, select }: { m: number; s: FaceSide; mods: (BuiltModule | undefined)[]; select: (x: Partial<PlanSelection>) => void }) {
  const dir = s === 1 ? 1 : -1
  const step = (d: number) => {
    for (let i = m + d; i >= 0 && i < mods.length; i += d) if (mods[i] && !mods[i]!.opening) return select({ felt: i })
  }
  return (
    <>
      <IconButton icon={ArrowLeft} label="Feltet til venstre" size={15} onClick={() => step(-dir)} />
      <IconButton icon={ArrowRight} label="Feltet til høyre" size={15} onClick={() => step(dir)} />
    </>
  )
}
