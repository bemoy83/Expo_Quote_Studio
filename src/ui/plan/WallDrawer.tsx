// Wall drawer (veggskuff): the selected wall seen straight on, one face at a time, under the plan or 3D view.
// Two sections (Bjørn 7.11.2026): settings on the left, with the motif library (Profilering) (or, with a door chosen, its mini plan) under
// them in the detail height, and the wall on the right. Textile frames and foil decals are placed,
// moved and resized in the drawing, shelves moved up, down and sideways; motifs are clicked onto what is selected or dragged from the shelf onto the wall.
// Without a selection it edits the wall itself: plate colour, remove wall. A door or curtain is chosen here too (from the
// drawing, the plan or 3D): its settings on the left and the mini plan to move it in the middle (Bjørn 3.11.2026).
// The parts are in wallDrawer/: the settings panels (panels.tsx), «Hyller og heng» and a chosen shelf (fittings.tsx), the drawing (WallElevation.tsx), dragging in it
// (drag.ts), the paint bucket and brush (paint.ts), the face's name and rooms (face.ts) and the drawer's words (text.ts).
// What to show for what is chosen is decided in focus.ts, and the tools kept between renders live in useWallTools.ts;
// this file puts it together.
import { AlignVerticalSpaceAround, DoorOpen, FlipHorizontal2, MoveHorizontal, Palette, Plus } from 'lucide-react'
import { production } from '../../calc/textile/production'
import { addFoil, foilBlocked, foilsOn, removeFoil, updateFoil } from '../../domain/decor'
import { eraseWalls } from '../../domain/edit'
import { wallRal } from '../../domain/panels'
import { clearDecor, clearFelt, printPlate, printsOn } from '../../domain/print'
import { moveShelves, removeShelves } from '../../domain/shelves/edit'
import { shelvesOn } from '../../domain/shelves/model'
import { wallLength, wallModules } from '../../domain/grid'
import type { Motif, Variant } from '../../domain/types'
import { builtModules, isStandWall, wallLabel } from '../../domain/walls'
import { wallHeight } from '../../rules/rules'
import { INK_FAINT, LAYER_COLOR } from '../colors'
import { Button, IconButton, Section } from '../controls'
import { productOf, rules } from '../env'
import { findMotif } from '../motifs'
import { DrawerHead} from './drawerParts'
import { DoorMap } from './DoorMap'
import { chosen, chosenShelves, isOnWall, type PlanSelection } from './selection'
import { addTextile, fillTextile, removeTextile, textilesOn, updateTextile } from '../../domain/textile/inFrame'
import { faces, type FaceSide } from '../../domain/faces'
import { faceName, roomsAgainst } from './wallDrawer/face'
import { wallPaint } from './wallDrawer/paint'
import { FeltFittings, ShelfPanel, WallFittings } from './wallDrawer/fittings'
import { focusOf, layoutOf } from './wallDrawer/focus'
import { useWallTools } from './wallDrawer/useWallTools'
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
  const t = useWallTools()
  const { tool, setTool, page } = t
  /** The wall and face shown, and what on it is chosen. A chosen door or curtain: the drawer shows its wall, which follows
   *  the door when the mini plan moves it. */
  const c = chosen(v, sel)
  if (!isOnWall(c)) return null
  const { wall: w, side: s } = c
  const O = c.kind === 'opening' ? c.opening : undefined
  const fs = faces(v, w)
  const L = wallLength(w)
  const H = wallHeight(rules)

  const tex = textilesOn(v, w.id, s)
  const foils = foilsOn(v, w.id, s)
  const T = c.kind === 'textile' ? c.textile : undefined
  const F = c.kind === 'foil' ? c.foil : undefined
  const shelves = shelvesOn(v, w.id, s)
  const S = c.kind === 'shelf' ? c.shelf : undefined
  const built = new Map(builtModules(v).map((m) => [m.key, m]))
  const mods = wallModules(w).map((m) => built.get(m.key))
  /** A felt chosen in the drawing (a plate, not a door), when nothing on the wall is. */
  const Fe = c.kind === 'wall' && c.felt !== undefined && mods[c.felt] && !mods[c.felt]!.opening ? c.felt : undefined
  /** What the drawer shows: one answer for the panel, the motif library and the buttons (focus.ts). */
  const focus = focusOf(c.kind, Fe)
  const ui = layoutOf(focus, page)
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
  const feltFoil = (m: number) => foilBlocked(v, rules, w.id, m, s) ?? (printsOn(v, w.id, s).some((f) => f.module === m) ? 'Feltet har print' : null)
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
    paintSel: t.paintSel,
    printSel: t.printSel,
    ral,
    free: ui.paint,
    base,
    onEdit: p.onEdit,
    onCheckpoint: p.onCheckpoint,
    onToast: p.onToast,
  })
  /** Modules of this wall holding a door (not a curtain): a leaf for the brush, a header and leaf for a print. */
  const doorModules = new Set(doors.map((d) => d.module))
  /** The brush is live on the whole wall's «Hyller og heng» with nothing chosen; choosing something puts it away. */
  const brushOn = t.brushLive(focus !== 'wall')
  /** Take the shelf brush: a chosen felt is let go, as the paint tools do. */
  const takeBrush = (on: boolean) => {
    t.setShelfBrush(on)
    if (on && Fe !== undefined) select({})
  }
  const hint0 = wallHint({ O, door: !!O && doorModules.has(O.module), painting, tool, printing, T, F, S, felt: focus === 'felt' ? page : undefined, extras: ui.panel === 'wall-extras', w })

  const hint = brushOn ? (t.brushHint ?? BRUSH_HINT) : hint0

  /**
   * With a felt chosen a motif in Profilering prints the plate at once, as a colour in the palette colours it (Bjørn
   * 11.11.2026), and becomes the one «Print» and «Dekal» use. A felt that cannot take print says why and is left as it is.
   */
  const feltShelf =
    Fe === undefined
      ? undefined
      : (id: string) => {
          t.setPrintMotif(id)
          const no = foilBlocked(v, rules, w.id, Fe, s, true)
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
      t.setPage('extras')
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
        {ui.panel === 'door' && O ? (
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

            {ui.panel === 'felt-extras' && Fe !== undefined && <FeltFittings v={v} w={w} s={s} m={Fe} mods={mods} onBrush={() => takeBrush(true)} select={select} onEdit={p.onEdit} onToast={p.onToast} />}

            {ui.panel === 'felt-decor' && Fe !== undefined && (
              <FeltPanel v={v} w={w} s={s} m={Fe} mods={mods} motifs={motifs} pm={pm} base={base} twoFaces={fs.length > 1} setTool={setTool} select={select} onEdit={p.onEdit} onToast={p.onToast} />
            )}

            {ui.panel === 'wall-extras' && <WallFittings v={v} w={w} s={s} brush={brushOn} onBrush={takeBrush} onEdit={p.onEdit} onToast={p.onToast} />}

            {ui.panel === 'wall-decor' && <ColourPanel painting={painting} tool={tool} setTool={setTool} printing={printing} pm={pm} paint={paint} ral={ral} setPaint={t.setPaint} />}
          </>
        )}
        {ui.library && (
          <WallShelf F={F} felt={feltShelf} printing={printing} pm={pm} motifs={motifs} ratioOf={ratioOf} setPrintMotif={t.setPrintMotif} onEdit={p.onEdit} onUpload={p.onUpload}>
            {ui.library.add === 'decal' && Fe !== undefined && (
              <Button variant="ghost" icon={Plus} onClick={addDecal} disabled={!!feltFoil(Fe)}>
                Dekal
              </Button>
            )}
            {ui.library.add === 'frame' && (
              <Button variant="ghost" icon={Plus} onClick={addFrame}>
                Tekstilvegg
              </Button>
            )}
          </WallShelf>
        )}
        {ui.foot && (
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
                    onClick={() => (ui.moves ? moveToSide(flip) : p.onSelect({ wallId: w.id, side: flip }))}
                  />
                )
              }
            />
            <div className="wd-actions">
              {ui.fill && T && (
                <Button variant="ghost" icon={MoveHorizontal} onClick={() => p.onEdit((x) => fillTextile(x, rules, T.id))}>
                  Fyll ledig vegg
                </Button>
              )}
              {/* A felt and the whole wall have two pages, switched here as a door's way back to the palette is (Bjørn
                  9.11.2026); a chosen shelf goes back to its felt's colour and profilering */}
              {ui.pageSwitch && (
                <Button variant="ghost" icon={page === 'extras' ? Palette : AlignVerticalSpaceAround} onClick={t.switchPage}>
                  {page === 'extras' ? 'Farge og profilering' : 'Hyller og heng'}
                </Button>
              )}
              {ui.backToFelt && S && (
                <Button
                  variant="ghost"
                  icon={Palette}
                  onClick={() => {
                    t.setPage('decor')
                    select({ felt: S.module })
                  }}
                >
                  Farge og profilering
                </Button>
              )}
              {ui.doors &&
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
        onBrushDone={() => t.setShelfBrush(false)}
        onBrushHint={t.setBrushHint}
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
