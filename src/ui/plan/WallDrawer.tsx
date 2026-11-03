// Wall drawer (veggskuff): the selected wall seen straight on, one face at a time, under the plan or 3D view.
// Three columns: settings · graphics shelf (or, with a door chosen, its mini plan) · the wall. Textile frames and foil decals are placed,
// moved and resized in the drawing; motifs are clicked onto what is selected or dragged from the shelf onto the wall.
// Without a selection it edits the wall itself: plate colour, remove wall. A door or curtain is chosen here too (from the
// drawing, the plan or 3D): its settings on the left and the mini plan to move it in the middle (Bjørn 3.11.2026).
import { FlipHorizontal2, MoveHorizontal, PaintBucket, Paintbrush, Plus, Repeat2 } from 'lucide-react'
import { useRef, useState, type DragEvent as RDragEvent, type PointerEvent as RPointerEvent } from 'react'
import { production, wallLabel } from '../../calc/production'
import {
  addTextile,
  faceNormal,
  faces,
  feltBlocked,
  felt,
  fillTextile,
  foilCenter,
  foilsOn,
  freeSpans,
  moveFoilBy,
  moveTextileBy,
  removeFoil,
  removeTextile,
  textileBox,
  textilesOn,
  updateFoil,
  updateTextile,
  type FaceSide,
} from '../../domain/decor'
import { eraseWalls, setWallPlate } from '../../domain/edit'
import { setPanels, wallRal } from '../../domain/panels'
import { clearPrint, cropBand, fillPlates, plateCrop, printPlate, printsOn, printWall, clearDecor } from '../../domain/print'
import { doorFace, doorRal, openingById, removeOpening } from '../../domain/doors'
import { OUTSIDE, roomAt, roomName, roomSize } from '../../domain/rooms'
import { wallLength, wallModules } from '../../domain/grid'
import type { Foil, Room, TextileWall, Variant, Wall } from '../../domain/types'
import { builtModules, isStandWall } from '../../domain/walls'
import type { Motif } from '../../persistence/file'
import { doorInset, wallHeight } from '../../rules/rules'
import { ALU, BORDER_STRONG, INK, INK_FAINT, LAYER_COLOR, SUNKEN } from '../colors'
import { Button, Dim, IconButton, Segmented } from '../controls'
import { plateColor, plateName, productOf, rules } from '../env'
import { count, fmt, mm } from '../format'
import { findMotif } from '../motifs'
import { TXT, elevationBox } from './drawerText'
import { RoomLabel } from './RoomLabel'
import { roomLabelSize } from './roomLabelSize'
import { DrawerHead, DrawerRow, FillPicker, Handles, PlatePalette, PRINT, Print, Shelf, type Edge } from './drawerParts'
import { Dims, Opening, Posts, TextileFace } from './elevation'
import { applyDrop, decorDrag, dropSpot, endDecorDrag, type DropSpot, type FaceTarget } from '../dnd'
import { DoorMap } from './DoorMap'
import { DoorSettings } from './DoorSettings'
import type { PlanSelection } from './PlanView'

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

const EPS = 1e-6

/** What a drag in the drawing changes: move a frame or decal, or the edge or corner of one. */
type DragKind = 'tmove' | 'fmove' | { edge: Edge }

/** A room standing against a stretch of a wall face, from module `a` to module `b` (exclusive). */
interface RoomRun {
  room: Room
  a: number
  b: number
}

/**
 * Rooms whose floor lies right in front of this face of the wall, as runs of modules: the wall is (part of) that room's
 * wall seen from inside. The wall's own room is left out (that is the whole face).
 */
function roomsAgainst(v: Variant, w: Wall, s: FaceSide): RoomRun[] {
  const [nx, ny] = faceNormal(w, s)
  const runs: RoomRun[] = []
  wallModules(w).forEach((m, i) => {
    const r = roomAt(v, (m.a[0] + m.b[0]) / 2 + nx / 2, (m.a[1] + m.b[1]) / 2 + ny / 2)
    if (!r || r.id === w.room?.id) return
    const last = runs[runs.length - 1]
    if (last && last.room.id === r.id && last.b === i) last.b = i + 1
    else runs.push({ room: r, a: i, b: i + 1 })
  })
  return runs
}

/** Face names by where the face looks. */
function faceName(w: Wall, s: FaceSide): string {
  if (w.room) return s === OUTSIDE ? 'Utsiden' : 'Innsiden'
  const [nx, ny] = faceNormal(w, s)
  if (ny > 0) return 'Mot front'
  if (ny < 0) return 'Mot bak'
  return nx > 0 ? 'Mot høyre' : 'Mot venstre'
}

export function WallDrawer(p: Props) {
  const { v, selection: sel, motifs } = p
  const svg = useRef<SVGSVGElement>(null)
  const [spot, setSpot] = useState<DropSpot | null>(null)
  /**
   * Colouring as in a paint program: pick the paint bucket (the whole face) or the brush (one plate at a time), pick a
   * colour or «Print», then click the wall. No tool: the drawing selects and moves as usual (Bjørn 2.11.2026).
   */
  const [tool, setTool] = useState<'wall' | 'plate' | null>(null)
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
  const dir = s === 1 ? 1 : -1
  /** Along-wall offset → x in the drawing. The face is drawn as seen standing in front of it. */
  const u = (t: number) => (s === 1 ? t : L - t)
  const spanX = (a: number, b: number) => Math.min(u(a), u(b))
  const z = (h: number) => H - h

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

  // ---- Dragging in the drawing: move, width, height of a frame; move and size of a decal
  const drag = (e: RPointerEvent, kind: DragKind, item: TextileWall | Foil) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const scale = svg.current?.getScreenCTM()?.a ?? 1
    const x0 = e.clientX
    const y0 = e.clientY
    let moved = false
    if ('from' in item) select({ textileId: item.id })
    else select({ foilId: item.id })
    const onMove = (ev: PointerEvent) => {
      const du = (ev.clientX - x0) / scale
      const dz = -(ev.clientY - y0) / scale
      if (!moved) {
        if (Math.hypot(du, dz) * scale < 3) return
        moved = true
        p.onCheckpoint()
      }
      p.onEdit((x) => applyDrag(x, kind, item, du, dz), false)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const applyDrag = (x: Variant, kind: DragKind, item: TextileWall | Foil, du: number, dz: number): Variant => {
    if ('from' in item) {
      if (kind === 'tmove') return moveTextileBy(x, rules, item, du * dir, dz)
      return kind === 'fmove' ? x : resizeTextile(x, item, kind.edge, du, dz)
    }
    const r = ratioOf(item.motif)
    if (kind === 'fmove') return moveFoilBy(x, rules, item, du * dir, dz, r)
    // A decal keeps its motif's shape and its centre: a corner on the right grows it dragged right, on the left dragged left
    if (kind === 'tmove') return x
    return updateFoil(x, rules, item.id, { width: item.width + 2 * (kind.edge.includes('l') ? -du : du) }, r)
  }

  /** Drag one edge or corner of a frame; the opposite edges stay put. Kept within the free stretch of wall it stands on. */
  const resizeTextile = (x: Variant, t: TextileWall, edge: Edge, du: number, dz: number): Variant => {
    let a = t.from
    let b = t.from + t.width
    // The right edge in the drawing is the wall's end on one face and its start on the other
    if (edge.includes('r')) {
      if (dir === 1) b += du
      else a -= du
    }
    if (edge.includes('l')) {
      if (dir === 1) a += du
      else b -= du
    }
    const sp = freeSpans(x, rules, w.id, s, textilesOn(x, w.id, s, t.id)).find(([p0, p1]) => t.from >= p0 - EPS && t.from + t.width <= p1 + EPS)
    const min = rules.textile.minWidth
    if (a !== t.from) a = Math.min(b - min, Math.max(sp?.[0] ?? 0, a))
    if (b !== t.from + t.width) b = Math.max(a + min, Math.min(sp?.[1] ?? L, b))
    const box = textileBox(t, rules)
    let bottom = box.bottom
    let top = box.bottom + box.height
    if (edge.includes('t')) top += dz
    if (edge.includes('b')) bottom = Math.max(0, Math.min(top - min, bottom + dz))
    return updateTextile(x, rules, t.id, { from: a, width: b - a, bottom, height: top - bottom })
  }

  /** With a frame or decal selected, the face control moves it to the other face of the wall. */
  const moveToSide = (side: FaceSide) => {
    const next = T ? updateTextile(v, rules, T.id, { side }) : F ? updateFoil(v, rules, F.id, { side }, ratioOf(F.motif)) : v
    if (next === v) return p.onToast(T ? 'Ingen ledig veggflate på den siden' : 'Feltet på den siden kan ikke ha folie')
    p.onEdit(() => next)
    select(T ? { side, textileId: T.id } : { side, foilId: F!.id })
  }

  const addFrame = () => {
    const r = addTextile(v, rules, w.id, s, L / 2)
    if (!r) return p.onToast('Ingen ledig veggflate på denne siden')
    p.onEdit(() => r.v)
    select({ textileId: r.id })
  }

  const piece = T ? production(v, rules.textile.inFrame, '').pieces.find((x) => x.textileId === T.id) : undefined
  const openings = v.openings.filter((o) => o.wallId === w.id)
  const ral = wallRal(v, w)
  const flip = fs.length > 1 ? fs.find((x) => x !== s) : undefined
  const painting = tool !== null && !T && !F && !O
  const paint = paintSel ?? ral
  const pm = findMotif(motifs, printSel ?? undefined) ?? motifs[0]
  const printing = paint === PRINT
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
  const printedAt = (x: Variant, i: number) => printsOn(x, w.id, s).find((f) => f.module === i)
  /**
   * Brush on a plate: its colour, or the wall's again when it already has the brush's colour. A print on this face of
   * the plate comes off (the colour shows again); decals stay.
   */
  const paintPlate = (i: number, key: string, first: boolean) => {
    const cur = built.get(key)?.plate
    const printed = !!printedAt(v, i)
    const to = first && cur === paint && !printed ? base(key) : paint
    if (!first && cur === to && !printed) return
    if (first) p.onCheckpoint()
    p.onEdit((x) => clearPrint(setPanels(x, [key], to, base), w.id, s, [i]), false)
  }
  /** The chosen tool on plate `i` (module key `key`): `first` on press, then for each plate swept over (brush only). */
  const paintAt = (i: number, key: string, first: boolean) => {
    if (printing && !pm) {
      if (first) p.onToast('Last opp et motiv i grafikken først')
      return
    }
    if (tool === 'wall') {
      if (!first) return
      if (printing) {
        if (!fillPlates(v, rules, w, s).length) return p.onToast('Ingen plate på denne siden kan ha print')
        return p.onEdit((x) => printWall(x, rules, w.id, s, pm!.id, pm!.ratio))
      }
      return p.onEdit((x) => clearPrint(setWallPlate(x, w.id, paint), w.id, s))
    }
    if (!printing) return paintPlate(i, key, first)
    const why = feltBlocked(v, rules, w.id, i, s, true)
    if (why) {
      if (first) p.onToast(why)
      return
    }
    // Sweeping on over a plate that already has the motif leaves it; a click on it takes the motif off
    if (!first && printedAt(v, i)?.motif === pm!.id) return
    if (first) p.onCheckpoint()
    p.onEdit((x) => printPlate(x, rules, w.id, i, s, pm!.id), false)
  }
  /** Pointer handlers for a plate (or a door) in the drawing while a tool is out: click, or with the brush press and sweep. */
  const paintOn = (i: number, key: string) =>
    painting
      ? {
          style: { cursor: tool === 'wall' ? 'copy' : 'crosshair' },
          onPointerDown: (e: RPointerEvent) => {
            e.stopPropagation()
            if (e.button === 0) paintAt(i, key, true)
          },
          onPointerEnter: (e: RPointerEvent) => {
            if (tool === 'plate' && e.buttons === 1) paintAt(i, key, false)
          },
        }
      : {}
  const doorModules = new Set(mods.flatMap((m, i) => (m?.opening && productOf(m.opening.product)?.opening === 'door' ? [i] : [])))
  /** A print over a door: its part of the picture on the header plate, and on the leaf down to the floor. */
  const doorPrint = (f: Foil, x: number, leafX: number) => {
    const m = findMotif(motifs, f.motif)
    if (!m) return undefined
    const crop = plateCrop(f, m.ratio)
    const y0 = f.y - f.height / 2
    const y1 = f.y + f.height / 2
    const dh = rules.door.height
    return {
      header: <Print m={m} x={x + rules.wall.post / 2} y={z(y1)} width={f.width} height={y1 - dh} crop={cropBand(crop, y0, y1, dh, y1)} />,
      leaf: <Print m={m} x={leafX} y={z(dh)} width={rules.door.swing} height={dh} crop={cropBand(crop, y0, y1, 0, dh)} />,
    }
  }
  const tail = 'dra tekstilvegg eller motiv til veggen, klikk det for å endre'
  const hint = O
    ? `Klikk en rute i miniplanen for å flytte ${productOf(O.product)?.opening === 'door' ? 'døren' : 'forhenget'} · klikk veggen for å gå tilbake til den · Delete gjør om til vegg`
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

  // ---- Dropping a textile frame or motif from the shelf (or the panel) onto the drawing
  const target = (e: RDragEvent): FaceTarget | null => {
    const m = svg.current?.getScreenCTM()
    if (!m) return null
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const t = s === 1 ? q.x : L - q.x
    if (t < 0 || t > L) return null
    return { wallId: w.id, s, t: Math.min(t, L - EPS), y: H - q.y }
  }
  const onDragOver = (e: RDragEvent) => {
    const d = decorDrag(e)
    if (!d) return
    e.preventDefault()
    const h = target(e)
    const sp = h && dropSpot(v, d, h)
    e.dataTransfer.dropEffect = sp && !sp.error ? 'copy' : 'none'
    setSpot(sp ?? null)
  }
  const onDrop = (e: RDragEvent) => {
    const d = decorDrag(e)
    setSpot(null)
    endDecorDrag()
    if (!d) return
    e.preventDefault()
    const h = target(e)
    if (!h) return
    const r = applyDrop(v, d, h, (id) => ratioOf(id))
    if ('error' in r) return p.onToast(r.error)
    p.onEdit(() => r.v)
    p.onSelect(r.select)
    if (r.toast) p.onToast(r.toast)
  }

  const fill = T?.fill ?? 'print'
  const room = w.room && v.rooms.find((r) => r.id === w.room!.id)
  const title = T ? 'Tekstilvegg' : F ? (F.full ? 'Print på hel plate' : 'Foliedekal') : room ? `${roomName(room)} ${roomSize(room)} · vegg` : label === 'Innervegg' ? 'Innervegg' : `Standvegg · ${label.toLowerCase()}`
  const PAD = 0.18
  return (
    <section className="wall-drawer drawer3" aria-label="Vegg sett forfra">
      <div className="wd-insp">
        {O ? (
          <DoorSettings
            v={v}
            o={O}
            w={w}
            onEdit={p.onEdit}
            onRemove={() => {
              p.onEdit((x) => removeOpening(x, O.id))
              select({})
            }}
            onClose={p.onClose}
          >
            {/* The face switch sits in the header: the door's settings fill the column */}
            {flip !== undefined && <IconButton icon={Repeat2} label={`Vis ${faceName(w, flip).toLowerCase()}`} size={14} onClick={() => selectDoor(O.id, flip)} />}
          </DoorSettings>
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

          {T && (
            <>
              <div className="wd-dims">
                <Dim label="Bredde" value={T.width} onChange={(n) => p.onEdit((x) => updateTextile(x, rules, T.id, { width: n }))} />
                <Dim label="Høyde" value={textileBox(T, rules).height} decimals={2} onChange={(n) => p.onEdit((x) => updateTextile(x, rules, T.id, { height: n }))} />
                <Dim label="Fra gulv" value={textileBox(T, rules).bottom} onChange={(n) => p.onEdit((x) => updateTextile(x, rules, T.id, { bottom: n }))} />
              </div>
              <FillPicker value={fill} onChange={(f) => p.onEdit((x) => updateTextile(x, rules, T.id, { fill: f }))} />
            </>
          )}

          {F && (
            <>
              <div className="eyebrow">Dekning</div>
              <Segmented<boolean>
                inWell
                label="Dekning"
                value={F.full}
                onChange={(full) => p.onEdit((x) => updateFoil(x, rules, F.id, { full }, ratioOf(F.motif)))}
                options={[
                  { value: false, label: 'Dekal' },
                  { value: true, label: 'Hel plate' },
                ]}
              />
              {F.full ? (
                <p className="wd-meta">
                  Dekker platen mellom stolpene, {rules.wall.plate.width} × {rules.wall.plate.height} mm
                </p>
              ) : (
                <div className="wd-dims">
                  <Dim label="Bredde" value={F.width} decimals={2} onChange={(n) => p.onEdit((x) => updateFoil(x, rules, F.id, { width: n }, ratioOf(F.motif)))} />
                </div>
              )}
            </>
          )}

          {!T && !F && (
            <>
              <DrawerRow
                label={
                  painting
                    ? `${tool === 'wall' ? 'Hele veggen' : 'Plate'} · ${printing ? `print ${pm?.name ?? ''}` : `${plateName(paint)} ${paint}`}`
                    : `Hele veggen · ${plateName(ral)} ${ral}`
                }
              >
                <IconButton icon={PaintBucket} label="Malerspann: klikk veggen for å farge hele siden" size={15} className="ink" pressed={tool === 'wall'} onClick={() => setTool(tool === 'wall' ? null : 'wall')} />
                <IconButton icon={Paintbrush} label="Malerkost: klikk én og én plate" size={15} className="ink" pressed={tool === 'plate'} onClick={() => setTool(tool === 'plate' ? null : 'plate')} />
              </DrawerRow>
              <PlatePalette
                value={painting ? paint : ral}
                print={{ motif: pm }}
                onPick={(r) => {
                  setPaint(r)
                  // Picking a colour takes up the paint bucket when no tool is out
                  if (!tool) setTool('wall')
                }}
              />
            </>
          )}
          </>
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
          </div>
        </div>
        )}
      </div>

      {O ? (
        <div className="wd-mid">
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

      <div className="wd-view">
        <svg
          ref={svg}
          className="wd-svg"
          viewBox={elevationBox(L, H, PAD)}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={() => select({})}
          onDragOver={onDragOver}
          onDragLeave={() => setSpot(null)}
          onDrop={onDrop}
          role="img"
          aria-label={`${label}, ${faceName(w, s).toLowerCase()}, ${L} m`}
        >
          {/* Wall: plates, openings, profiles, posts, feet */}
          {mods.map((m, i) => {
            const x = spanX(i, i + 1)
            if (m?.opening) {
              const o = m.opening
              const door = productOf(o.product)?.opening === 'door'
              const k = doorInset(rules)
              const hinge = u(o.hinge === -1 ? i + 1 - k : i + k)
              const free = u(o.hinge === -1 ? i + k : i + 1 - k)
              const fp = door ? foils.find((f) => f.full && f.module === i) : undefined
              return (
                <g
                  key={i}
                  style={{ cursor: 'pointer' }}
                  {...(painting
                    ? paintOn(i, m.key)
                    : {
                        onPointerDown: (e: RPointerEvent) => {
                          // The door is chosen here, in the wall drawer
                          e.stopPropagation()
                          selectDoor(o.id)
                        },
                      })}
                >
                  <Opening
                    x={x}
                    H={H}
                    plate={{ fill: plateColor(m.plate) }}
                    door={door ? { color: plateColor(doorRal(v, o)), hinge, free } : undefined}
                    print={fp && doorPrint(fp, x, Math.min(hinge, free))}
                  />
                  {!fp && (
                    <text x={x + 0.5} y={z(1.4)} textAnchor="middle" style={TXT}>
                      {door ? 'dør' : 'forheng'}
                    </text>
                  )}
                </g>
              )
            }
            const f = felt(rules, i)
            return (
              <g key={i}>
                <rect x={spanX(f.a, f.b)} y={z(H)} width={f.w} height={H - rules.wall.feet} fill={plateColor(m?.plate ?? wallRal(v, w))} {...(m ? paintOn(i, m.key) : {})} />
                <rect x={x} y={z(H)} width={1} height={rules.wall.profile.top} fill={ALU} />
                <rect x={x} y={z(f.y0)} width={1} height={rules.wall.profile.bottom} fill={ALU} />
              </g>
            )
          })}
          <Posts xs={Array.from({ length: L + 1 }, (_, i) => u(i))} H={H} />
          {/* The chosen door: marked, with its swing (the point of the triangle is the hinge side) */}
          {O &&
            O.wallId === w.id &&
            (() => {
              const x = spanX(O.module, O.module + 1)
              const k = doorInset(rules)
              const hx = u(O.hinge === -1 ? O.module + 1 - k : O.module + k)
              const fx = u(O.hinge === -1 ? O.module + k : O.module + 1 - k)
              const dh = rules.door.height
              return (
                <g pointerEvents="none">
                  {productOf(O.product)?.opening === 'door' && (
                    <path d={`M${fx} ${z(dh)} L${hx} ${z(dh / 2)} L${fx} ${z(0)}`} fill="none" stroke={INK_FAINT} strokeWidth={0.01} strokeDasharray=".04 .03" />
                  )}
                  <rect x={x - 0.012} y={z(H) - 0.012} width={1.024} height={H + 0.012} fill="none" stroke={INK} strokeWidth={0.016} />
                </g>
              )
            })()}
          <line x1={-PAD} y1={H} x2={L + PAD} y2={H} stroke={BORDER_STRONG} strokeWidth={0.01} />

          {/* Foil decals */}
          {foils.map((f) => {
            if (f.full && doorModules.has(f.module)) return null
            const c = foilCenter(rules, f)
            const x = spanX(c - f.width / 2, c + f.width / 2)
            const m = findMotif(motifs, f.motif)
            const on = F?.id === f.id
            return (
              <g key={f.id} onPointerDown={(e) => drag(e, 'fmove', f)} style={{ cursor: 'move' }} pointerEvents={painting ? 'none' : undefined}>
                {m && f.full ? (
                  <Print m={m} x={x} y={z(f.y + f.height / 2)} width={f.width} height={f.height} crop={f.crop} />
                ) : m ? (
                  <image href={m.src} x={x} y={z(f.y + f.height / 2)} width={f.width} height={f.height} preserveAspectRatio="none" />
                ) : (
                  <rect x={x} y={z(f.y + f.height / 2)} width={f.width} height={f.height} fill={SUNKEN} />
                )}
                {on && <rect x={x - 0.012} y={z(f.y + f.height / 2) - 0.012} width={f.width + 0.024} height={f.height + 0.024} fill="none" stroke={INK} strokeWidth={0.014} />}
                {on && !f.full && <Handles corners x={x} y={z(f.y + f.height / 2)} w={f.width} h={f.height} onDown={(e, edge) => drag(e, { edge }, f)} />}
              </g>
            )
          })}

          {/* Where a room stands against this face: hatched over plates and print, with the room's name, for context only */}
          <defs>
            <pattern id="wd-room-hatch" patternUnits="userSpaceOnUse" width={0.12} height={0.12} patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={0.12} stroke={INK_FAINT} strokeWidth={0.02} strokeOpacity={0.55} />
            </pattern>
          </defs>
          {rooms.map((r) => (
            <g key={`${r.room.id}${r.a}`} pointerEvents="none">
              <rect x={spanX(r.a, r.b)} y={z(H)} width={r.b - r.a} height={H} fill="url(#wd-room-hatch)" />
              <RoomLabel r={r.room} cx={spanX(r.a, r.b) + (r.b - r.a) / 2} cy={z(H) + 0.55} k={Math.min(1, (r.b - r.a - 0.1) / roomLabelSize(r.room).w)} />
            </g>
          ))}

          {/* Textile frames */}
          {tex.map((t) => {
            const { bottom, height } = textileBox(t, rules)
            const x = spanX(t.from, t.from + t.width)
            const y = z(bottom + height)
            const m = findMotif(motifs, t.motif)
            const on = T?.id === t.id
            return (
              <g key={t.id} onPointerDown={(e) => drag(e, 'tmove', t)} style={{ cursor: 'move' }} pointerEvents={painting ? 'none' : undefined}>
                <TextileFace x={x} y={y} w={t.width} h={height} m={m} fill={t.fill ?? 'print'} empty="Uten motiv" />
                {on && <rect x={x - 0.014} y={y - 0.014} width={t.width + 0.028} height={height + 0.028} fill="none" stroke={INK} strokeWidth={0.016} />}
                {on && <Handles x={x} y={y} w={t.width} h={height} onDown={(e, edge) => drag(e, { edge }, t)} />}
              </g>
            )
          })}

          {/* Where a drop from the shelf would land */}
          {spot && (
            <rect
              x={spanX(spot.from, spot.to)}
              y={z(spot.y1)}
              width={spot.to - spot.from}
              height={spot.y1 - spot.y0}
              fill={spot.error ? 'none' : INK}
              fillOpacity={0.12}
              stroke={spot.error ? INK_FAINT : INK}
              strokeWidth={0.014}
              strokeDasharray={spot.error ? '.05 .04' : undefined}
              pointerEvents="none"
            />
          )}

          <Dims W={L} H={H} ticks height={`${mm(H)} mm`} width={`${L} m · ${fs.length > 1 ? faceName(w, s).toLowerCase() : 'innsiden'}`} />
        </svg>
      </div>
      <div className="wd-hint">{hint}</div>
    </section>
  )
}
