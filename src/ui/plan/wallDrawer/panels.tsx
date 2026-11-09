// The settings column of the wall drawer: one panel for what is chosen, and the graphics shelf under it. A textile frame, a decal or print, a door, or
// a shelf, or nothing (the wall itself: colour and print with the paint bucket and brush).
import { AlignVerticalSpaceAround, ArrowLeft, ArrowRight, Layers, PaintBucket, Paintbrush, Palette, Plus, Repeat2 } from 'lucide-react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { updateFoil } from '../../../domain/decor'
import { removeOpening } from '../../../domain/doors'
import type { FaceSide } from '../../../domain/faces'
import { textileBox, updateTextile } from '../../../domain/textile/inFrame'
import { wallLength } from '../../../domain/grid'
import { addShelvesAbove, clearBetween, highWarning, moveShelves, offRow, shelfRow, shelvesIn, shelvesOf, spreadShelves, tooHigh, type ShelvesMove } from '../../../domain/shelves'
import type { Foil, Opening, Shelf as Board, TextileWall, Variant, Wall } from '../../../domain/types'
import type { Motif } from '../../../persistence/file'
import { Button, Dim, FlatChoice, IconButton, Section } from '../../controls'
import { plateName, rules } from '../../env'
import { DoorSettings } from '../DoorSettings'
import { FabricSection, PlatePalette, Shelf } from '../drawerParts'
import { mm } from '../../format'
import { findMotif } from '../../motifs'
import { chosenShelves, type PlanSelection } from '../selection'
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
 * The graphics shelf under the settings: a motif for the chosen decal, the motif «Print» lays on, or (nothing chosen)
 * print files to drag onto the wall. A chosen textile frame has its motifs in its fabric section.
 */
export function WallShelf(props: {
  F?: Foil
  printing: boolean
  pm: Motif | undefined
  motifs: Motif[]
  ratioOf: (id?: string) => number
  setPrintMotif: (id: string) => void
  onEdit: Edit
  onUpload: (f: File) => void
}) {
  const { F, printing, pm, motifs, ratioOf, setPrintMotif, onEdit, onUpload } = props
  const [title, aside] = F ? ['Motiv', findMotif(motifs, F.motif)?.name ?? 'ikke valgt'] : printing ? ['Print', pm?.name ?? 'last opp et motiv'] : ['Grafikk', 'dra til veggen']
  const value = F ? (F.motif ?? null) : printing ? pm?.id : undefined
  const onPick = F
    ? (m: string) => onEdit((x) => updateFoil(x, rules, F.id, { motif: m }, ratioOf(m)))
    : printing
      ? setPrintMotif
      : undefined
  return <Shelf title={title} aside={aside} motifs={motifs} value={value} onPick={onPick} onUpload={onUpload} />
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
            Farge og grafikk
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
  const ids = chosenShelves(v, sel)
  const n = ids.length
  const row = shelfRow(v, H.id).length
  const stack = shelvesIn(v, H.wallId, H.module, s)
  const sh = rules.shelf
  const what = n > 1 ? 'Raden' : 'Hyllen'
  const move = (m: ShelvesMove, why: string) => {
    const next = moveShelves(v, rules, ids, m)
    if (next === v) return onToast(why)
    onEdit(() => next)
    const y = shelvesOf(next).find((x) => x.id === H.id)!.y
    if (tooHigh(rules, y)) onToast(highWarning(rules))
  }
  // Left and right as the face is seen from in front of it: the modules run the other way on face −1
  const dir = s === 1 ? 1 : -1
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
          Overkant hylle · {mm(sh.min)}–{mm(sh.max)} mm i steg på {mm(sh.step)} mm
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
        {stack.length > 1 && (
          <>
            <FlatChoice<string>
              label="Hyller i feltet"
              value={H.id}
              onChange={(id) => select({ shelfId: id, shelfOnly: undefined })}
              options={[...stack].reverse().map((f) => ({ value: f.id, label: <span className="num">{mm(f.y)}</span> }))}
            />
            <p className="set-note num">
              Lysmål {stack.slice(1).map((f, i) => mm(clearBetween(rules, stack[i].y, f.y))).reverse().join(' · ')} mm
            </p>
          </>
        )}
        <div className="wd-actions">
          <Button
            variant="ghost"
            icon={Plus}
            onClick={() => {
              const r = addShelvesAbove(v, rules, ids)
              if ('error' in r) return onToast(r.error)
              onEdit(() => r.v)
              select({ shelfId: r.ids[ids.indexOf(H.id)] ?? r.ids[0], shelfOnly: sel.shelfOnly })
            }}
          >
            {n > 1 ? 'Rad til' : 'Hylle til i feltet'}
          </Button>
          {stack.length > 2 && (
            <Button
              variant="ghost"
              icon={AlignVerticalSpaceAround}
              onClick={() => {
                const next = spreadShelves(v, rules, ids)
                if (!next) return onToast('Hyllene står allerede jevnt')
                onEdit(() => next)
              }}
            >
              Fordel jevnt
            </Button>
          )}
        </div>
      </Section>
    </>
  )
}
