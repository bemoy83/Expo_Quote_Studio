// Wall drawer (veggskuff): the selected wall seen straight on, one face at a time, under the plan or 3D view.
// Three columns: settings · graphics shelf (or, with a door chosen, its mini plan) · the wall. Textile frames and foil decals are placed,
// moved and resized in the drawing; motifs are clicked onto what is selected or dragged from the shelf onto the wall.
// Without a selection it edits the wall itself: plate colour, remove wall. A door or curtain is chosen here too (from the
// drawing, the plan or 3D): its settings on the left and the mini plan to move it in the middle (Bjørn 3.11.2026).
// The parts are in wallDrawer/: the settings panels (panels.tsx), the drawing (WallElevation.tsx), dragging in it
// (drag.ts), the paint bucket and brush (paint.ts) and the face's name and rooms (face.ts). This file picks what to show.
import { DoorOpen, FlipHorizontal2, MoveHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import { production, wallLabel } from '../../calc/production'
import { foilsOn, removeFoil, updateFoil } from '../../domain/decor'
import { eraseWalls } from '../../domain/edit'
import { wallRal } from '../../domain/panels'
import { clearDecor } from '../../domain/print'
import { doorFace, openingById } from '../../domain/doors'
import { roomName, roomSize } from '../../domain/rooms'
import { wallLength, wallModules } from '../../domain/grid'
import type { Variant } from '../../domain/types'
import { builtModules, isStandWall } from '../../domain/walls'
import type { Motif } from '../../persistence/file'
import { wallHeight } from '../../rules/rules'
import { INK_FAINT, LAYER_COLOR } from '../colors'
import { Button, IconButton } from '../controls'
import { productOf, rules } from '../env'
import { count, fmt, mm } from '../format'
import { findMotif } from '../motifs'
import { DrawerHead, DrawerRow, Shelf } from './drawerParts'
import { DoorMap } from './DoorMap'
import { type PlanSelection } from './selection'
import { addTextile, fillTextile, removeTextile, textilesOn, updateTextile } from '../../domain/textile/inFrame'
import { faces, type FaceSide } from '../../domain/faces'
import { faceName, roomsAgainst } from './wallDrawer/face'
import { wallPaint, type PaintTool } from './wallDrawer/paint'
import { ColourPanel, DoorPanel, FoilPanel, TextilePanel } from './wallDrawer/panels'
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

  const piece = T ? production(v, rules, '').pieces.find((x) => x.textileId === T.id) : undefined
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
  const tail = 'dra tekstilvegg eller motiv til veggen, klikk det for å endre'
  const hint = O
    ? `Klikk en rute i miniplanen for å flytte ${doorModules.has(O.module) ? 'døren' : 'forhenget'} · «Farge og grafikk» eller Esc gir paletten · Delete gjør om til vegg`
    : painting
      ? tool === 'wall'
        ? printing
          ? 'Klikk veggen: motivet strekkes over platene på denne siden, ikke inne i bakrom · klikk én gang til: printen fjernes fra hele siden'
          : 'Klikk veggen for å farge alle platene · print på denne siden går bort, dekaler blir'
        : printing
          ? 'Klikk eller dra over platene: hele motivet på hver plate · klikk en plate som har motivet: printen fjernes fra den platen'
          : 'Klikk eller dra over platene for å farge dem · klikk en farget plate igjen for veggens farge'
      : T
        ? 'Dra rammen for å flytte · håndtakene endrer størrelsen · klikk et motiv for trykk · Delete fjerner'
        : F
          ? F.full
            ? 'Dra for å flytte til en annen plate · klikk et motiv for å bytte · Delete fjerner'
            : 'Dra for å flytte innenfor platen · hjørnene endrer størrelsen · klikk et motiv for å bytte · Delete fjerner'
          : isStandWall(w)
            ? `Standveggen står fast · ${tail}`
            : w.room
              ? `Dra veggen i planen for å endre rommet · ${tail}`
              : `Dra veggen i planen for å flytte den · ${tail}`

  const remove = () => {
    if (T) p.onEdit((x) => removeTextile(x, T.id))
    else if (F) p.onEdit((x) => removeFoil(x, F.id))
    else {
      p.onEdit((x) => eraseWalls(x, wallModules(w).map((m) => m.key)))
      return p.onClose()
    }
    select({})
  }

  const fill = T?.fill ?? 'print'
  const room = w.room && v.rooms.find((r) => r.id === w.room!.id)
  const title = T ? 'Tekstilvegg' : F ? (F.full ? 'Print på hel plate' : 'Foliedekal') : room ? `${roomName(room)} ${roomSize(room)} · vegg` : label === 'Innervegg' ? 'Innervegg' : `Standvegg · ${label.toLowerCase()}`
  return (
    <section className="wall-drawer drawer3" aria-label="Vegg sett forfra">
      <div className="wd-insp">
        {O ? (
          <DoorPanel v={v} O={O} w={w} flip={flip} select={select} selectDoor={selectDoor} onEdit={p.onEdit} onClose={p.onClose} />
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
              {T && piece
                ? `ramme ${mm(piece.W / 1000)} × ${mm(piece.H / 1000)} mm · ${fmt(piece.area)} m² ${piece.fill === 'reuse' ? 'kundens duk' : piece.fill === 'white' ? 'hvit duk' : 'trykk'}`
                : F
                  ? `Felt ${F.module + 1} · ${mm(F.width)} × ${mm(F.height)} mm${F.run ? ` · del av print over ${v.foils.filter((x) => x.run === F.run).length} plater` : ''}`
                  : [`${L} m`, count(wallModules(w).length - openings.length, 'plate', 'plater') + (odd ? ` (${odd} i egen farge)` : ''), openings.length && count(openings.length, 'åpning', 'åpninger'), tex.length && count(tex.length, 'tekstilvegg', 'tekstilvegger'), ...rooms.map((r) => `${r.b - r.a} m inn mot ${roomName(r.room).toLowerCase()}`)]
                      .filter(Boolean)
                      .join(' · ')}
            </p>

            {T && <TextilePanel T={T} fill={fill} onEdit={p.onEdit} />}

            {F && <FoilPanel F={F} ratioOf={ratioOf} onEdit={p.onEdit} />}

            {!T && !F && <ColourPanel painting={painting} tool={tool} setTool={setTool} printing={printing} pm={pm} paint={paint} ral={ral} setPaint={setPaint} />}
          </>
        )}
      {O ? (
        <div className="wd-sec">
          <DoorMap v={v} openingId={O.id} onEdit={p.onEdit} />
        </div>
      ) : (
      <Shelf
        label={
          T
            ? fill === 'print'
              ? `Trykk · ${findMotif(motifs, T.motif)?.name ?? 'uten motiv'}`
              : 'Motiv · velg for trykk'
            : F
              ? `Motiv · ${findMotif(motifs, F.motif)?.name ?? 'uten motiv'}`
              : printing
                ? `Print · ${pm?.name ?? 'last opp et motiv'}`
                : 'Grafikk · dra til veggen'
        }
        motifs={motifs}
        textile={!T && !F}
        required={!T && !F && printing}
        value={T ? (fill === 'print' ? (T.motif ?? null) : undefined) : F ? (F.motif ?? null) : printing ? pm?.id : undefined}
        onPick={
          T
            ? (m) => p.onEdit((x) => updateTextile(x, rules, T.id, { motif: m, ...(m ? { fill: 'print' } : {}) }))
            : F
              ? (m) => p.onEdit((x) => updateFoil(x, rules, F.id, { motif: m }, ratioOf(m ?? undefined)))
              : printing
                ? (m) => m && setPrintMotif(m)
                : undefined
        }
        onUpload={p.onUpload}
      />
      )}

        {!O && (
          <div className="wd-foot">
            <DrawerRow label={`Side · ${faceName(w, s).toLowerCase()}`}>
              {flip !== undefined && (
                <IconButton
                  icon={FlipHorizontal2}
                  label={T ? 'Flytt rammen til andre siden' : F ? 'Flytt folien til andre siden' : `Vis ${faceName(w, flip).toLowerCase()}`}
                  size={15}
                  onClick={() => (T || F ? moveToSide(flip) : p.onSelect({ wallId: w.id, side: flip }))}
                />
              )}
            </DrawerRow>
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
