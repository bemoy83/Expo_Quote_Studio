// The settings column of the wall drawer: one panel for what is chosen, and the motif library (Profilering) under it. A textile frame, a decal or print, a door, or
// a shelf, or nothing (the wall itself: colour and print with the paint bucket and brush).
import { AlignVerticalSpaceAround, ArrowLeft, ArrowRight, Copy, Layers, PaintBucket, Paintbrush, Palette, Plus, Repeat2 } from 'lucide-react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { feltBlocked, updateFoil } from '../../../domain/decor'
import { setPanels } from '../../../domain/panels'
import { clearPrint, printPlate, printsOn } from '../../../domain/print'
import { removeOpening } from '../../../domain/doors'
import type { FaceSide } from '../../../domain/faces'
import { textileBox, updateTextile } from '../../../domain/textile/inFrame'
import { wallLength } from '../../../domain/grid'
import { addShelfRowToFace, addShelfToFace, addShelfToFelt, highWarning, shelvesOn, offRow, shelfBlocked, shelvesIn, tooHigh } from '../../../domain/shelves'
import type { Foil, Opening, Shelf as Board, TextileWall, Variant, Wall } from '../../../domain/types'
import type { BuiltModule } from '../../../domain/walls'
import type { Motif } from '../../../persistence/file'
import { Button, Dim, FlatChoice, IconButton, Section } from '../../controls'
import { plateName, rules } from '../../env'
import { DoorSettings } from '../DoorSettings'
import { FabricSection, PlatePalette, PRINT, Shelf } from '../drawerParts'
import { mm } from '../../format'
import { findMotif } from '../../motifs'
import { type PlanSelection } from '../selection'
import { shelfActions } from '../shelfActions'
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
 * library, with what is laid on or beside the plates. With a felt chosen it sets the motif its «Print» and decal use and
 * adds a decal; with the whole wall it is the print files to drag onto the wall, and a textile wall. A chosen decal picks
 * its motif here. A chosen textile frame has its motifs in its fabric section.
 */
export function WallShelf(props: {
  F?: Foil
  /** A felt is chosen: picking a motif sets the one its «Print» and «Dekal» use. */
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
 * A chosen shelf, or its row (Bjørn 9.11.2026): height from the floor (top of the board) with the quick picks, the felt
 * it stands in, and the shelves stacked there with the clear height between them (Byggeregler H2, H4, H5). «Hylle til»
 * adds one more (a row gets a row), «Fordel jevnt» spreads a felt's shelves.
 */
export function ShelfPanel({ v, H, w, s, sel, select, onEdit, onToast }: { v: Variant; H: Board; w: Wall; s: FaceSide; sel: PlanSelection; select: (x: Partial<PlanSelection>) => void; onEdit: Edit; onToast: (t: string) => void }) {
  const a = shelfActions(v, sel, H, onEdit, onToast, (shelfId, shelfOnly) => select({ shelfId, shelfOnly }))
  const { n, row, what, dir, move } = a
  const stack = shelvesIn(v, H.wallId, H.module, s)
  const sh = rules.shelf
  const L = Math.round(wallLength(w))
  return (
    <>
      <Section title={n > 1 ? `Hyllerad · ${n} hyller` : 'Hylle'} aside={`${mm(H.y)} mm fra gulv`}>
        <div className="wd-dims">
          <Dim big unit="mm" label="Fra gulv" value={H.y} step={sh.step} min={sh.min} max={sh.max} onChange={(y) => move({ y }, `For nær en annen hylle (minst ${mm(sh.gap)} mm lysmål)`)} />
        </div>
        <FlatChoice<number>
          label="Faste høyder"
          value={H.y}
          onChange={(y) => move({ y }, `${what} kan ikke stå på ${mm(y)} her`)}
          options={sh.heights.map((h) => ({ value: h, label: <span className="num">{mm(h)}</span> }))}
        />
        <p className="set-note">
          Overkant · {mm(sh.min)}–{mm(sh.max)} mm · steg {mm(sh.step)} mm
          {tooHigh(rules, H.y) && <> · {highWarning(rules)}</>}
          {n === 1 && offRow(v, H.id) && <> · avviker fra raden</>}
        </p>
        {row > 1 && (
          <div className="wd-actions">
            <Button variant="ghost" icon={Layers} onClick={() => select({ shelfId: H.id, shelfOnly: !sel.shelfOnly })}>
              {sel.shelfOnly ? `Hele raden (${row})` : 'Bare denne hyllen'}
            </Button>
          </div>
        )}
      </Section>
      <Section
        title="Felt"
        aside={`${H.module + 1} av ${L}`}
        tools={
          <>
            <IconButton icon={ArrowLeft} label={`Flytt ${what.toLowerCase()} ett felt til venstre`} size={15} onClick={() => move({ dm: -dir }, 'Feltet til venstre kan ikke ta hylle')} />
            <IconButton icon={ArrowRight} label={`Flytt ${what.toLowerCase()} ett felt til høyre`} size={15} onClick={() => move({ dm: dir }, 'Feltet til høyre kan ikke ta hylle')} />
          </>
        }
      >
        <div className="wd-actions">
          <Button
            variant="ghost"
            icon={Plus}
            onClick={a.more}
          >
            {n > 1 ? 'Rad til' : 'Hylle til i feltet'}
          </Button>
          <Button
            variant="ghost"
            icon={Copy}
            onClick={a.copy}
          >
            Kopier
          </Button>
          {stack.length > 1 && (
            <Button
              variant="ghost"
              icon={Copy}
              onClick={a.copyFelt}
            >
              Kopier feltet
            </Button>
          )}
          {stack.length > 2 && (
            <Button
              variant="ghost"
              icon={AlignVerticalSpaceAround}
              onClick={a.spread}
            >
              Fordel jevnt
            </Button>
          )}
        </div>
      </Section>
    </>
  )
}

/** What a felt or the whole wall shows: colour and profilering, or what hangs on it (shelves, later hooks), like a door's own page. */
export type FeltPage = 'decor' | 'extras'

/**
 * A felt chosen in the drawing (Bjørn 9.11.2026): choose first, then act. Two pages, switched at the foot of the drawer
 * as a door is: «Farge og profilering» (this plate's colour, both faces, or «Print» on this face; the Profilering section
 * under it adds a decal) and «Hyller og heng» (what is fitted to the felt; one section per kind, so more kinds slot in).
 * The paint bucket and brush are on the colour page too: picking one lets the felt go and colours the wall as before, so
 * the whole wall can be filled without leaving the drawer.
 */
export function FeltPanel(props: {
  v: Variant
  w: Wall
  s: FaceSide
  m: number
  page: FeltPage
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
  const { v, w, s, m, page, mods, motifs, pm, base, twoFaces, setTool, select, onEdit, onToast } = props
  const key = mods[m]!.key
  const plate = mods[m]!.plate
  const printed = printsOn(v, w.id, s).find((f) => f.module === m)
  // Right as the face is seen from in front of it: the modules run the other way on face −1
  const dir = s === 1 ? 1 : -1
  /** The next plate felt that way (doors are no felts). */
  const step = (d: number) => {
    for (let i = m + d; i >= 0 && i < mods.length; i += d) if (mods[i] && !mods[i]!.opening) return select({ felt: i })
  }
  const arrows = (
    <>
      <IconButton icon={ArrowLeft} label="Feltet til venstre" size={15} onClick={() => step(-dir)} />
      <IconButton icon={ArrowRight} label="Feltet til høyre" size={15} onClick={() => step(dir)} />
    </>
  )

  if (page === 'extras') {
    const n = shelvesIn(v, w.id, m, s).length
    const why = shelfBlocked(v, w.id, m, s)
    const addBoard = () => {
      const r = addShelfToFelt(v, rules, w.id, m, s)
      if ('error' in r) return onToast(r.error)
      // Nothing gets chosen: shelves go on without a break and are tapped to change (Bjørn 9.11.2026)
      onEdit(() => r.v)
    }
    // One section per kind of fitting: shelves now, hooks and rails later
    return (
      <Section title={`Felt ${m + 1} · hyller`} aside={n ? `${n} i feltet` : 'ingen'} tools={arrows}>
        {why && <p className="set-note">{why}</p>}
        <div className="wd-actions">
          <Button variant="ghost" icon={Plus} onClick={addBoard} disabled={!!why}>
            Hylle til i feltet
          </Button>
        </div>
      </Section>
    )
  }

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

/**
 * The whole wall's «Hyller og heng» (Bjørn 9.11.2026): what is fitted on this face, one section per kind as on a felt.
 * «+ Hylle» and «+ Hyllerad» place themselves (addShelfToFace, addShelfRowToFace), so pressing on fills the wall; nothing
 * gets chosen, so shelves can be added without a break and then tapped to change.
 */
export function WallExtras({ v, w, s, onEdit, onToast }: { v: Variant; w: Wall; s: FaceSide; onEdit: Edit; onToast: (t: string) => void }) {
  const on = shelvesOn(v, w.id, s)
  const felts = new Set(on.map((x) => x.module)).size
  const one = () => {
    const r = addShelfToFace(v, rules, w.id, s)
    if ('error' in r) return onToast(r.error)
    onEdit(() => r.v)
  }
  const row = () => {
    const r = addShelfRowToFace(v, rules, w.id, s)
    if ('error' in r) return onToast(r.error)
    onEdit(() => r.v)
  }
  return (
    <Section title="Hele veggen · hyller" aside={on.length ? `${on.length} i ${felts} felt` : 'ingen'}>
      <div className="wd-actions">
        <Button variant="ghost" icon={Plus} onClick={one}>
          Hylle
        </Button>
        <Button variant="ghost" icon={Plus} onClick={row}>
          Hyllerad
        </Button>
      </div>
    </Section>
  )
}
