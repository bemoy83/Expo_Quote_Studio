// Wall drawer (veggskuff): the selected wall seen straight on, one face at a time, under the plan or 3D view.
// Two sections (Bjørn 7.11.2026): settings on the left, with the graphics shelf (or, with a door chosen, its mini plan) under
// them in the detail height, and the wall on the right. Textile frames and foil decals are placed,
// moved and resized in the drawing; motifs are clicked onto what is selected or dragged from the shelf onto the wall.
// Without a selection it edits the wall itself: plate colour, remove wall. A door or curtain is chosen here too (from the
// drawing, the plan or 3D): its settings on the left and the mini plan to move it in the middle (Bjørn 3.11.2026).
// The parts are in wallDrawer/: the settings panels (panels.tsx), the drawing (WallElevation.tsx), dragging in it
// (drag.ts), the paint bucket and brush (paint.ts), the face's name and rooms (face.ts) and the drawer's words (text.ts).
// This file picks what to show.
import { DoorOpen, FlipHorizontal2, MoveHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import { production, wallLabel } from '../../calc/production'
import { foilsOn, removeFoil, updateFoil } from '../../domain/decor'
import { eraseWalls } from '../../domain/edit'
import { wallRal } from '../../domain/panels'
import { clearDecor } from '../../domain/print'
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
import { type PlanSelection } from './selection'
import { addTextile, fillTextile, removeTextile, textilesOn, updateTextile } from '../../domain/textile/inFrame'
import { faces, type FaceSide } from '../../domain/faces'
import { faceName, roomsAgainst } from './wallDrawer/face'
import { wallPaint, type PaintTool } from './wallDrawer/paint'
import { ColourPanel, DoorPanel, FoilPanel, TextilePanel, WallShelf } from './wallDrawer/panels'
import { wallHint, wallMeta, wallTitle } from './wallDrawer/text'
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
  /** The motif «Print» lays on, chosen in the graphics shelf. Unset: the first in the library. */
  const [printSel, setPrintMotif] = useState<string | null>(null)
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
  const built = new Map(builtModules(v).map((m) => [m.key, m]))
  const mods = wallModules(w).map((m) => built.get(m.key))
  const rooms = roomsAgainst(v, w, s)
  const ratioOf = (id?: string) => findMotif(motifs, id)?.ratio ?? 0
  const label = wallLabel(w)
  const select = (x: Partial<PlanSelection>) => p.onSelect({ wallId: w.id, side: s, ...x })
  /** A door is chosen without its wall, so the plan and 3D mark the door and not the whole wall. */
  const selectDoor = (id: string, side: FaceSide = s) => p.onSelect({ openingId: id, side })

  /** With a frame or decal selected, the face control moves it to the other face of the wall. */
  const moveToSide = (side: FaceSide) => {
    const next = T ? updateTextile(v, rules, T.id, { side }) : F ? updateFoil(v, rules, F.id, { side }, ratioOf(F.motif)) : v
    if (next === v) return p.onToast(T ? 'Ingen ledig veggflate på den siden' : 'Feltet på den siden kan ikke ha folie')
    p.onEdit(() => next)
    select(T ? { side, textileId: T.id } : { side, foilId: F!.id })
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
    free: !T && !F && !O,
    base,
    onEdit: p.onEdit,
    onCheckpoint: p.onCheckpoint,
    onToast: p.onToast,
  })
  /** Modules of this wall holding a door (not a curtain): a leaf for the brush, a header and leaf for a print. */
  const doorModules = new Set(doors.map((d) => d.module))
  const hint = wallHint({ O, door: !!O && doorModules.has(O.module), painting, tool, printing, T, F, w })

  const remove = () => {
    if (T) p.onEdit((x) => removeTextile(x, T.id))
    else if (F) p.onEdit((x) => removeFoil(x, F.id))
    else {
      p.onEdit((x) => eraseWalls(x, wallModules(w).map((m) => m.key)))
      return p.onClose()
    }
    select({})
  }

  const title = wallTitle(v, w, T, F)
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
              dot={T ? LAYER_COLOR.textile : F ? INK_FAINT : LAYER_COLOR.walls}
              title={title}
              remove={
                T || F
                  ? { label: T ? 'Fjern tekstilvegg (Delete)' : 'Fjern grafikk (Delete)', onClick: remove }
                  : decorated
                    ? { label: 'Fjern print, dekaler og platefarger fra hele veggen, begge sider', onClick: () => p.onEdit((x) => clearDecor(x, w.id)) }
                    : !isStandWall(w)
                      ? { label: w.room ? 'Åpne siden' : 'Fjern veggen', onClick: remove }
                      : undefined
              }
              onClose={p.onClose}
            />
            <p className="wd-meta num">
              {wallMeta(v, w, { L, T, F, piece, openings, odd, tex, rooms })}
            </p>

            {T && <TextilePanel T={T} motifs={motifs} onEdit={p.onEdit} onUpload={p.onUpload} />}

            {F && <FoilPanel F={F} ratioOf={ratioOf} onEdit={p.onEdit} />}

            {!T && !F && <ColourPanel painting={painting} tool={tool} setTool={setTool} printing={printing} pm={pm} paint={paint} ral={ral} setPaint={setPaint} />}
          </>
        )}
        {!O && !T && <WallShelf F={F} printing={printing} pm={pm} motifs={motifs} ratioOf={ratioOf} setPrintMotif={setPrintMotif} onEdit={p.onEdit} onUpload={p.onUpload} />}
        {!O && (
          <div className="wd-foot">
            <Section
              title="Side"
              aside={faceName(w, s).toLowerCase()}
              tools={
                flip !== undefined && (
                  <IconButton
                    icon={FlipHorizontal2}
                    label={T ? 'Flytt rammen til andre siden' : F ? 'Flytt folien til andre siden' : `Vis ${faceName(w, flip).toLowerCase()}`}
                    size={15}
                    onClick={() => (T || F ? moveToSide(flip) : p.onSelect({ wallId: w.id, side: flip }))}
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
              {!T && !F && (
                <Button variant="ghost" icon={Plus} onClick={addFrame}>
                  Tekstilvegg
                </Button>
              )}
              {!T &&
                !F &&
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
        rooms={rooms}
        T={T}
        F={F}
        O={O}
        motifs={motifs}
        label={label}
        painting={painting}
        printing={printing}
        tool={tool}
        paintAt={paintAt}
        doorModules={doorModules}
        ratioOf={ratioOf}
        select={select}
        selectDoor={selectDoor}
        onSelect={p.onSelect}
        onEdit={p.onEdit}
        onCheckpoint={p.onCheckpoint}
        onToast={p.onToast}
      />
      <div className="wd-hint">{hint}</div>
    </section>
  )
}
