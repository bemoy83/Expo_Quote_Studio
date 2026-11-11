// Wall drawer (veggskuff): the selected wall seen straight on, one face at a time, under the plan or 3D view.
// Two sections (Bjørn 7.11.2026): settings on the left, with the motif library (Profilering) (or, with a door chosen, its mini plan) under
// them in the detail height, and the wall on the right. Textile frames and foil decals are placed,
// moved and resized in the drawing, shelves moved up, down and sideways; motifs are clicked onto what is selected or dragged from the shelf onto the wall.
// Without a selection it edits the wall itself: plate colour, remove wall. A door or curtain is chosen here too (from the
// drawing, the plan or 3D): its settings on the left and the mini plan to move it in the middle (Bjørn 3.11.2026).
// The parts are in wallDrawer/: the settings panels (panels.tsx), «Hyller og heng» and a chosen shelf (fittings.tsx), the drawing (WallElevation.tsx), dragging in it
// (drag.ts), the paint bucket and brush (paint.ts), the face's name and rooms (face.ts) and the drawer's words (text.ts).
// This file picks what to show.
import { AlignVerticalSpaceAround, DoorOpen, FlipHorizontal2, MoveHorizontal, Palette, Plus } from 'lucide-react'
import { useState } from 'react'
import { production, wallLabel } from '../../calc/production'
import { addFoil, feltBlocked, foilsOn, removeFoil, updateFoil } from '../../domain/decor'
import { eraseWalls } from '../../domain/edit'
import { wallRal } from '../../domain/panels'
import { clearDecor, clearFelt, printPlate, printsOn } from '../../domain/print'
import { moveShelves, removeShelves } from '../../domain/shelves/edit'
import { shelvesOn } from '../../domain/shelves/model'
import { doorFace, openingById } from '../../domain/doors'
import { wallLength, wallModules } from '../../domain/grid'
import type { Variant } from '../../domain/types'
import { builtModules, isStandWall } from '../../domain/walls'
import type { Motif } from '../../persistence/file'
import { wallHeight } from '../../rules/rules'
import { INK_FAINT, LAYER_COLOR } from '../colors'
import { Button, IconButton, Section } from '../controls'
import { productOf, rules } from '../env'
import { findMotif } from '../motifs'
import { DrawerHead} from './drawerParts'
import { DoorMap } from './DoorMap'
import { chosenShelves, type PlanSelection } from './selection'
import { addTextile, fillTextile, removeTextile, textilesOn, updateTextile } from '../../domain/textile/inFrame'
import { faces, type FaceSide } from '../../domain/faces'
import { faceName, roomsAgainst } from './wallDrawer/face'
import { wallPaint, type PaintTool } from './wallDrawer/paint'
import { FeltFittings, type FeltPage, ShelfPanel, WallFittings } from './wallDrawer/fittings'
import { ColourPanel, DoorPanel, FeltPanel, FoilPanel, TextilePanel, WallShelf } from './wallDrawer/panels'
import { BRUSH_HINT, wallHint, wallMeta, wallTitle } from './wallDrawer/text'
import { WallElevation } from './wallDrawer/WallElevation'

interface Props {
  v: Variant
  selection: PlanSelection
  motifs: Motif[]
  onUpload: (f: File) => void
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
  onClose: () => void
}

export function WallDrawer(p: Props) {
  const { v, selection: sel, motifs } = p
  /**
   * Colouring as in a paint program: pick the paint bucket (the whole face) or the brush (one plate at a time), pick a
   * colour or «Print», then click the wall. No tool: the drawing selects and moves as usual (Bjørn 2.11.2026).
   */
  const [tool, setTool] = useState<PaintTool>(null)
  /** What the tools lay on: a plate colour (RAL) or PRINT. Unset: the wall's own colour. */
  const [paintSel, setPaint] = useState<string | null>(null)
  /** The motif «Print» lays on, chosen in Profilering. Unset: the first in the library. */
  const [printSel, setPrintMotif] = useState<string | null>(null)
  /** The page shown for a felt or the whole wall: colour and profilering, or shelves and hooks. Kept from felt to felt. */
  const [page, setPage] = useState<FeltPage>('decor')
  /** The shelf brush (Hyller og heng): shelves are laid in the drawing where it is clicked (Bjørn 9.11.2026). */
  const [shelfBrush, setShelfBrush] = useState(false)
  /** The hint line while the shelf brush aims at a felt that takes none, or too high. */
  const [brushHint, setBrushHint] = useState<string | null>(null)
  /** Whether something on the wall was chosen at the last render: choosing something puts the brush away. */
  const [wasChosen, setWasChosen] = useState(false)
  /** A chosen door or curtain: the drawer shows its wall, which follows the door when the mini plan moves it. */
  const O = openingById(v, sel.openingId)
  const w = v.walls.find((x) => x.id === (O?.wallId ?? sel.wallId))
  if (!w) return null
  const fs = faces(v, w)
  const want = sel.side ?? (O && doorFace(v, w, O))
  const s: FaceSide = want && fs.includes(want) ? want : fs[0]
  const L = wallLength(w)
  const H = wallHeight(rules)

  const tex = textilesOn(v, w.id, s)
  const foils = foilsOn(v, w.id, s)
  const T = tex.find((t) => t.id === sel.textileId)
  const F = foils.find((f) => f.id === sel.foilId)
  const shelves = shelvesOn(v, w.id, s)
  const S = shelves.find((f) => f.id === sel.shelfId)
  const built = new Map(builtModules(v).map((m) => [m.key, m]))
  const mods = wallModules(w).map((m) => built.get(m.key))
  /** A felt chosen in the drawing (a plate, not a door), when nothing on the wall is. */
  const Fe = !T && !F && !S && !O && sel.felt !== undefined && mods[sel.felt] && !mods[sel.felt]!.opening ? sel.felt : undefined
  const rooms = roomsAgainst(v, w, s)
  const ratioOf = (id?: string) => findMotif(motifs, id)?.ratio ?? 0
  const label = wallLabel(w)
  const select = (x: Partial<PlanSelection>) => p.onSelect({ wallId: w.id, side: s, ...x })
  /** A door is chosen without its wall, so the plan and 3D mark the door and not the whole wall. */
  const selectDoor = (id: string, side: FaceSide = s) => p.onSelect({ openingId: id, side })

  /** With a frame or decal selected, the face control moves it to the other face of the wall. */
  const moveToSide = (side: FaceSide) => {
    const next = T ? updateTextile(v, rules, T.id, { side }) : F ? updateFoil(v, rules, F.id, { side }, ratioOf(F.motif)) : S ? moveShelves(v, rules, chosenShelves(v, sel), { side }) : v
    if (next === v) return p.onToast(T ? 'Ingen ledig veggflate på den siden' : F ? 'Feltet på den siden kan ikke ha folie' : 'Feltet på den siden kan ikke ta hylle')
    p.onEdit(() => next)
    select(T ? { side, textileId: T.id } : F ? { side, foilId: F.id } : { side, shelfId: S!.id, shelfOnly: sel.shelfOnly })
  }

  /** Why the chosen felt takes no decal: blocked (an opening, a textile frame over it) or printed over the whole plate. */
  const feltFoil = (m: number) => feltBlocked(v, rules, w.id, m, s) ?? (printsOn(v, w.id, s).some((f) => f.module === m) ? 'Feltet har print' : null)
  /** A decal in the middle of the chosen felt, with the motif chosen in Profilering; it is then chosen. */
  const addDecal = () => {
    if (Fe === undefined) return
    const r = addFoil(v, rules, w.id, Fe, s, pm?.id, ratioOf(pm?.id))
    if ('error' in r) return p.onToast(r.error)
    p.onEdit(() => r.v)
    select({ foilId: r.id })
  }

  const addFrame = () => {
    const r = addTextile(v, rules, w.id, s, L / 2, true)
    if (!r) return p.onToast('Ingen ledig veggflate på denne siden')
    p.onEdit(() => r.v)
    select({ textileId: r.id })
  }

  // The frames on walls as built: size, braces, rail splices and the move in an inner corner, for the text and the drawing
  const pieces = production(v, rules, '').pieces
  const pieceOf = (id: string) => pieces.find((x) => x.textileId === id)
  const piece = T ? pieceOf(T.id) : undefined
  const openings = v.openings.filter((o) => o.wallId === w.id)
  const doors = openings.filter((o) => productOf(o.product)?.opening === 'door')
  const ral = wallRal(v, w)
  const flip = fs.length > 1 ? fs.find((x) => x !== s) : undefined
  /** The colour a plate has without its own: that of the wall that owns it (a stand wall under a room side). */
  const base = (key: string) => {
    const owner = v.walls.find((x) => x.id === built.get(key)?.wallId)
    return owner ? wallRal(v, owner) : v.defaultPlate
  }
  const odd = mods.filter((m) => m && m.plate !== base(m.key)).length
  /**
   * The wall carries decor (foil on either face, or plates in their own colour). With the whole wall chosen the trash
   * then clears that first; on a plain wall it removes the wall as before (Bjørn 2.11.2026).
   */
  const decorated = odd > 0 || v.foils.some((f) => f.wallId === w.id)
  const { painting, paint, printing, pm, paintAt } = wallPaint({
    v,
    w,
    s,
    built,
    mods,
    motifs,
    tool,
    paintSel,
    printSel,
    ral,
    free: !T && !F && !O && !S && Fe === undefined,
    base,
    onEdit: p.onEdit,
    onCheckpoint: p.onCheckpoint,
    onToast: p.onToast,
  })
  /** Modules of this wall holding a door (not a curtain): a leaf for the brush, a header and leaf for a print. */
  const doorModules = new Set(doors.map((d) => d.module))
  /** The brush is live on the whole wall's «Hyller og heng» with nothing chosen; choosing something puts it away. */
  const chosen = !!(T || F || S || O) || Fe !== undefined
  const brushOn = shelfBrush && page === 'extras' && !chosen
  if (chosen !== wasChosen) {
    setWasChosen(chosen)
    if (chosen) setShelfBrush(false)
  }
  /** Take the shelf brush: a chosen felt is let go, as the paint tools do. */
  const takeBrush = (on: boolean) => {
    setShelfBrush(on)
    if (on && Fe !== undefined) select({})
  }
  const hint0 = wallHint({ O, door: !!O && doorModules.has(O.module), painting, tool, printing, T, F, S, felt: Fe !== undefined ? page : undefined, extras: !T && !F && !S && Fe === undefined && page === 'extras', w })


  const hint = brushOn ? (brushHint ?? BRUSH_HINT) : hint0

  /**
   * With a felt chosen a motif in Profilering prints the plate at once, as a colour in the palette colours it (Bjørn
   * 11.11.2026), and becomes the one «Print» and «Dekal» use. A felt that cannot take print says why and is left as it is.
   */
  const feltShelf =
    Fe === undefined
      ? undefined
      : (id: string) => {
          setPrintMotif(id)
          const no = feltBlocked(v, rules, w.id, Fe, s, true)
          if (no) return p.onToast(no)
          const on = printsOn(v, w.id, s).find((f) => f.module === Fe)
          if (on?.motif !== id || on.run) p.onEdit((x) => printPlate(x, rules, w.id, Fe, s, id))
        }

  /** The chosen felt has a colour of its own or a print on this face, which its trash takes off. */
  const feltDecor = Fe !== undefined && (mods[Fe]!.plate !== base(mods[Fe]!.key) || printsOn(v, w.id, s).some((f) => f.module === Fe))

  const remove = () => {
    if (T) p.onEdit((x) => removeTextile(x, T.id))
    else if (F) p.onEdit((x) => removeFoil(x, F.id))
    else if (S) {
      // Back to the felt's shelves and hooks, where the shelf was added
      p.onEdit((x) => removeShelves(x, chosenShelves(v, sel)))
      setPage('extras')
      return select({ felt: S.module })
    }
    else {
      p.onEdit((x) => eraseWalls(x, wallModules(w).map((m) => m.key)))
      return p.onClose()
    }
    select({})
  }

  const title = wallTitle(v, w, T, F, S)
  return (
    <section className="wall-drawer drawer2" aria-label="Vegg sett forfra">
      <div className="wd-insp">
        {O ? (
          <DoorPanel v={v} O={O} w={w} flip={flip} select={select} selectDoor={selectDoor} onEdit={p.onEdit} onClose={p.onClose}>
            <DoorMap v={v} openingId={O.id} onEdit={p.onEdit} />
          </DoorPanel>
        ) : (
          <>
            <DrawerHead
              dot={T ? LAYER_COLOR.textile : F || S ? INK_FAINT : LAYER_COLOR.walls}
              title={title}
              remove={
                T || F || S
                  ? { label: T ? 'Fjern tekstilvegg (Delete)' : F ? 'Fjern grafikk (Delete)' : 'Fjern hyllen (Delete)', onClick: remove }
                  : Fe !== undefined
                    ? feltDecor
                      ? { label: 'Fjern farge og print fra feltet (dekaler og hyller blir)', onClick: () => p.onEdit((x) => clearFelt(x, w.id, Fe, s)) }
                      : undefined
                  : decorated
                    ? { label: 'Fjern print, dekaler og platefarger fra hele veggen, begge sider', onClick: () => p.onEdit((x) => clearDecor(x, w.id)) }
                    : !isStandWall(w)
                      ? { label: w.room ? 'Åpne siden' : 'Fjern veggen', onClick: remove }
                      : undefined
              }
              onClose={p.onClose}
            />
            <p className="wd-meta num">
              {wallMeta(v, w, { L, T, F, S, piece, openings, odd, tex, rooms, shelves })}
            </p>

            {T && <TextilePanel T={T} motifs={motifs} onEdit={p.onEdit} onUpload={p.onUpload} />}

            {F && <FoilPanel F={F} ratioOf={ratioOf} onEdit={p.onEdit} />}

            {S && <ShelfPanel v={v} H={S} w={w} s={s} sel={sel} select={select} onEdit={p.onEdit} onToast={p.onToast} />}

            {Fe !== undefined && page === 'extras' && <FeltFittings v={v} w={w} s={s} m={Fe} mods={mods} onBrush={() => takeBrush(true)} select={select} onEdit={p.onEdit} onToast={p.onToast} />}

            {Fe !== undefined && page === 'decor' && (
              <FeltPanel v={v} w={w} s={s} m={Fe} mods={mods} motifs={motifs} pm={pm} base={base} twoFaces={fs.length > 1} setTool={setTool} select={select} onEdit={p.onEdit} onToast={p.onToast} />
            )}

            {!T && !F && !S && Fe === undefined && page === 'extras' && <WallFittings v={v} w={w} s={s} brush={brushOn} onBrush={takeBrush} onEdit={p.onEdit} onToast={p.onToast} />}

            {!T && !F && !S && Fe === undefined && page === 'decor' && <ColourPanel painting={painting} tool={tool} setTool={setTool} printing={printing} pm={pm} paint={paint} ral={ral} setPaint={setPaint} />}
          </>
        )}
        {!O && !T && !S && !(!F && page === 'extras') && (
          <WallShelf F={F} felt={feltShelf} printing={printing} pm={pm} motifs={motifs} ratioOf={ratioOf} setPrintMotif={setPrintMotif} onEdit={p.onEdit} onUpload={p.onUpload}>
            {Fe !== undefined ? (
              <Button variant="ghost" icon={Plus} onClick={addDecal} disabled={!!feltFoil(Fe)}>
                Dekal
              </Button>
            ) : (
              !F && (
                <Button variant="ghost" icon={Plus} onClick={addFrame}>
                  Tekstilvegg
                </Button>
              )
            )}
          </WallShelf>
        )}
        {!O && (
          <div className="wd-foot">
            <Section
              title="Side"
              aside={faceName(w, s).toLowerCase()}
              tools={
                flip !== undefined && (
                  <IconButton
                    icon={FlipHorizontal2}
                    label={T ? 'Flytt rammen til andre siden' : F ? 'Flytt folien til andre siden' : S ? 'Flytt hyllen til andre siden' : `Vis ${faceName(w, flip).toLowerCase()}`}
                    size={15}
                    onClick={() => (T || F || S ? moveToSide(flip) : p.onSelect({ wallId: w.id, side: flip }))}
                  />
                )
              }
            />
            <div className="wd-actions">
              {T && (
                <Button variant="ghost" icon={MoveHorizontal} onClick={() => p.onEdit((x) => fillTextile(x, rules, T.id))}>
                  Fyll ledig vegg
                </Button>
              )}
              {/* A felt and the whole wall have two pages, switched here as a door's way back to the palette is (Bjørn
                  9.11.2026); a chosen shelf goes back to its felt's colour and profilering */}
              {!T && !F && !S && (
                <Button
                  variant="ghost"
                  icon={page === 'extras' ? Palette : AlignVerticalSpaceAround}
                  onClick={() => {
                    setTool(null)
                    setShelfBrush(false)
                    setPage(page === 'extras' ? 'decor' : 'extras')
                  }}
                >
                  {page === 'extras' ? 'Farge og profilering' : 'Hyller og heng'}
                </Button>
              )}
              {S && (
                <Button
                  variant="ghost"
                  icon={Palette}
                  onClick={() => {
                    setPage('decor')
                    select({ felt: S.module })
                  }}
                >
                  Farge og profilering
                </Button>
              )}
              {!T &&
                !F &&
                !S &&
                Fe === undefined &&
                doors.map((d, i) => (
                  <Button key={d.id} variant="ghost" icon={DoorOpen} onClick={() => selectDoor(d.id)}>
                    Dør{doors.length > 1 ? ` ${i + 1}` : ''}
                  </Button>
                ))}
            </div>
          </div>
        )}
      </div>

      <WallElevation
        v={v}
        w={w}
        s={s}
        fs={fs}
        L={L}
        H={H}
        mods={mods}
        tex={tex}
        pieceOf={pieceOf}
        foils={foils}
        shelves={shelves}
        rooms={rooms}
        T={T}
        F={F}
        O={O}
        S={S}
        chosen={chosenShelves(v, sel)}
        shelfOnly={sel.shelfOnly}
        felt={Fe}
        motifs={motifs}
        label={label}
        painting={painting}
        printing={printing}
        tool={tool}
        paintAt={paintAt}
        shelfBrush={brushOn}
        onBrushDone={() => setShelfBrush(false)}
        onBrushHint={setBrushHint}
        doorModules={doorModules}
        ratioOf={ratioOf}
        select={select}
        selectDoor={selectDoor}
        onSelect={p.onSelect}
        onEdit={p.onEdit}
        onCheckpoint={p.onCheckpoint}
        onToast={p.onToast}
      />
      {/* With the shelf brush out the hint keeps two lines, so the drawing never moves under the pointer as it changes */}
      <div className={brushOn ? 'wd-hint steady' : 'wd-hint'}>{hint}</div>
    </section>
  )
}
