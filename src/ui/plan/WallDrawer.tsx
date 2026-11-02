// Wall drawer (veggskuff): the selected wall seen straight on, one face at a time, under the plan or 3D view.
// Three columns like the door drawer: settings · graphics shelf · the wall. Textile frames and foil decals are placed,
// moved and resized in the drawing; motifs are clicked onto what is selected or dragged from the shelf onto the wall.
// Without a selection it edits the wall itself: plate colour, remove wall; a door on it opens the door drawer.
import { DoorOpen, FlipHorizontal2, MoveHorizontal, PaintBucket, Paintbrush, Plus, Trash2, X } from 'lucide-react'
import { useRef, useState, type DragEvent as RDragEvent, type PointerEvent as RPointerEvent } from 'react'
import { production, wallLabel } from '../../calc/production'
import {
  addTextile,
  faceNormal,
  faces,
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
import { doorRal } from '../../domain/doors'
import { OUTSIDE, roomAt, roomName, roomSize } from '../../domain/rooms'
import { wallLength, wallModules } from '../../domain/grid'
import type { Foil, Room, TextileWall, Variant, Wall } from '../../domain/types'
import { builtModules, isStandWall } from '../../domain/walls'
import type { Motif } from '../../persistence/file'
import { doorInset, wallHeight } from '../../rules/rules'
import { ALU, ALU_POST, BORDER_STRONG, FABRIC, FEET, INK, INK_FAINT, LAYER_COLOR, SUNKEN } from '../colors'
import { Button, IconButton, Segmented } from '../controls'
import { plateColor, plateName, productOf, rules, wallPlates } from '../env'
import { count, fmt, mm } from '../format'
import { findMotif } from '../motifs'
import { DIM, TXT } from './drawerText'
import { RoomLabel } from './RoomLabel'
import { roomLabelSize } from './roomLabelSize'
import { FillPicker, Handles, Print, Shelf, SmallDim, type Edge } from './drawerParts'
import { applyDrop, decorDrag, dropSpot, endDecorDrag, type DropSpot, type FaceTarget } from '../dnd'
import { VariantChips } from '../panel/ProductRow'
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
  /** Colouring: the paint bucket colours the whole wall, the brush one plate at a time in `brush`'s colour. */
  const [tool, setTool] = useState<'wall' | 'plate'>('wall')
  const [brush, setBrush] = useState<string | null>(null)
  const w = v.walls.find((x) => x.id === sel.wallId)
  if (!w) return null
  const fs = faces(v, w)
  const s: FaceSide = sel.side && fs.includes(sel.side) ? sel.side : fs[0]
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
  const doors = openings.filter((o) => productOf(o.product)?.opening === 'door')
  const plates = wallPlates()
  const ral = w.plate ?? v.defaultPlate
  const flip = fs.length > 1 ? fs.find((x) => x !== s) : undefined
  const painting = tool === 'plate' && !T && !F
  const paint = brush ?? ral
  /** The colour a plate has without its own: that of the wall that owns it (a stand wall under a room side). */
  const base = (key: string) => {
    const owner = v.walls.find((x) => x.id === built.get(key)?.wallId)
    return owner ? wallRal(v, owner) : v.defaultPlate
  }
  const odd = mods.filter((m) => m && m.plate !== base(m.key)).length
  /** Brush on a plate: its colour, or the wall's again when it already has the brush's colour. */
  const paintPlate = (key: string, first: boolean) => {
    const cur = built.get(key)?.plate
    const to = first && cur === paint ? base(key) : paint
    if (!first && cur === to) return
    if (first) p.onCheckpoint()
    p.onEdit((x) => setPanels(x, [key], to, base), false)
  }
  /** Pointer handlers for a plate in the drawing while the brush is out: click, or press and sweep across plates. */
  const brushOn = (key: string) =>
    painting
      ? {
          style: { cursor: 'crosshair' },
          onPointerDown: (e: RPointerEvent) => {
            e.stopPropagation()
            if (e.button === 0) paintPlate(key, true)
          },
          onPointerEnter: (e: RPointerEvent) => {
            if (e.buttons === 1) paintPlate(key, false)
          },
        }
      : {}
  const tail = 'dra tekstilvegg eller motiv til veggen, klikk det for å endre'
  const hint = painting
    ? 'Klikk eller dra over platene for å farge dem · klikk en farget plate igjen for veggens farge'
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
        <div className="wd-head">
          <i className="dot" style={{ background: T ? LAYER_COLOR.textile : F ? INK_FAINT : LAYER_COLOR.walls }} />
          <h3>{title}</h3>
          {(T || F || !isStandWall(w)) && (
            <IconButton icon={Trash2} label={T ? 'Fjern tekstilvegg (Delete)' : F ? 'Fjern grafikk (Delete)' : w.room ? 'Åpne siden' : 'Fjern veggen'} size={14} onClick={remove} />
          )}
          <IconButton icon={X} label="Lukk" size={14} onClick={p.onClose} />
        </div>
        <p className="wd-meta num">
          {T && piece
            ? `ramme ${mm(piece.W / 1000)} × ${mm(piece.H / 1000)} mm · ${fmt(piece.area)} m² ${piece.fill === 'reuse' ? 'kundens duk' : piece.fill === 'white' ? 'hvit duk' : 'trykk'}`
            : F
              ? `Felt ${F.module + 1} · ${mm(F.width)} × ${mm(F.height)} mm`
              : [`${L} m`, count(wallModules(w).length - openings.length, 'plate', 'plater') + (odd ? ` (${odd} i egen farge)` : ''), openings.length && count(openings.length, 'åpning', 'åpninger'), tex.length && count(tex.length, 'tekstilvegg', 'tekstilvegger'), ...rooms.map((r) => `${r.b - r.a} m inn mot ${roomName(r.room).toLowerCase()}`)]
                  .filter(Boolean)
                  .join(' · ')}
        </p>

        {T && (
          <>
            <div className="wd-dims">
              <SmallDim label="Bredde" value={T.width} onChange={(n) => p.onEdit((x) => updateTextile(x, rules, T.id, { width: n }))} />
              <SmallDim label="Høyde" value={textileBox(T, rules).height} decimals={2} onChange={(n) => p.onEdit((x) => updateTextile(x, rules, T.id, { height: n }))} />
              <SmallDim label="Fra gulv" value={textileBox(T, rules).bottom} onChange={(n) => p.onEdit((x) => updateTextile(x, rules, T.id, { bottom: n }))} />
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
                <SmallDim label="Bredde" value={F.width} decimals={2} onChange={(n) => p.onEdit((x) => updateFoil(x, rules, F.id, { width: n }, ratioOf(F.motif)))} />
              </div>
            )}
          </>
        )}

        {!T && !F && (
          <>
            <div className="dd-swing">
              <span className="eyebrow">
                {painting ? `Plate · ${plateName(paint)} ${paint}` : `Hele veggen · ${plateName(ral)} ${ral}`}
              </span>
              <IconButton icon={PaintBucket} label="Farg hele veggen" size={15} className="ink" pressed={!painting} onClick={() => setTool('wall')} />
              <IconButton icon={Paintbrush} label="Farg én og én plate" size={15} className="ink" pressed={painting} onClick={() => setTool('plate')} />
            </div>
            <VariantChips
              chips={plates.map((x) => ({ name: `${x.name} · RAL ${x.ral}`, color: x.color }))}
              selected={plates.findIndex((x) => x.ral === (painting ? paint : ral))}
              onSelect={(i) => (painting ? setBrush(plates[i].ral!) : p.onEdit((x) => setWallPlate(x, w.id, plates[i].ral!)))}
            />
          </>
        )}
        <div className="wd-foot">
          <div className="dd-swing">
            <span className="eyebrow">Side · {faceName(w, s).toLowerCase()}</span>
            {flip !== undefined && (
              <IconButton
                icon={FlipHorizontal2}
                label={T ? 'Flytt rammen til andre siden' : F ? 'Flytt folien til andre siden' : `Vis ${faceName(w, flip).toLowerCase()}`}
                size={15}
                onClick={() => (T || F ? moveToSide(flip) : p.onSelect({ wallId: w.id, side: flip }))}
              />
            )}
          </div>
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
                <Button key={d.id} variant="ghost" icon={DoorOpen} onClick={() => p.onSelect({ openingId: d.id })}>
                  Dør{doors.length > 1 ? ` ${i + 1}` : ''}
                </Button>
              ))}
          </div>
        </div>
      </div>

      <Shelf
        label={
          T
            ? fill === 'print'
              ? `Trykk · ${findMotif(motifs, T.motif)?.name ?? 'uten motiv'}`
              : 'Motiv · velg for trykk'
            : F
              ? `Motiv · ${findMotif(motifs, F.motif)?.name ?? 'uten motiv'}`
              : 'Grafikk · dra til veggen'
        }
        motifs={motifs}
        textile={!T && !F}
        value={T ? (fill === 'print' ? (T.motif ?? null) : undefined) : F ? (F.motif ?? null) : undefined}
        onPick={
          T
            ? (m) => p.onEdit((x) => updateTextile(x, rules, T.id, { motif: m, ...(m ? { fill: 'print' } : {}) }))
            : F
              ? (m) => p.onEdit((x) => updateFoil(x, rules, F.id, { motif: m }, ratioOf(m ?? undefined)))
              : undefined
        }
        onUpload={p.onUpload}
      />

      <div className="wd-view">
        <svg
          ref={svg}
          className="wd-svg"
          viewBox={`${-PAD - 0.25} ${-PAD} ${L + 2 * PAD + 0.25} ${H + PAD + 0.32}`}
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
              const door = productOf(m.opening.product)?.opening === 'door'
              const { swing, height: dh } = rules.door
              const k = doorInset(rules)
              const o = m.opening
              const hinge = o.hinge === -1 ? i + 1 - k : i + k
              const free = o.hinge === -1 ? i + k : i + 1 - k
              return (
                <g
                  key={i}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    // The door has a drawer of its own
                    e.stopPropagation()
                    p.onSelect({ openingId: o.id })
                  }}
                >
                  {/* Header panel over the opening, as in 3D */}
                  <rect x={x + rules.wall.post / 2} y={z(H)} width={1 - rules.wall.post} height={H - dh} fill={plateColor(m.plate ?? w.plate ?? v.defaultPlate)} {...brushOn(m.key)} />
                  <rect x={x} y={z(H)} width={1} height={rules.wall.profile.top} fill={ALU} />
                  {door ? (
                    <>
                      {/* Leaf centred in the opening in its colour, handle at the free edge (hinge end as in the plan) */}
                      <rect x={spanX(i + k, i + 1 - k)} y={z(dh)} width={swing} height={dh} fill={plateColor(doorRal(v, o))} stroke={BORDER_STRONG} strokeWidth={0.012} />
                      <rect x={u(free + (hinge < free ? -0.08 : 0.08)) - 0.05} y={z(1.06)} width={0.1} height={0.02} rx={0.01} fill={INK_FAINT} />
                    </>
                  ) : (
                    <rect x={x + 0.04} y={z(dh)} width={0.92} height={dh} fill="none" stroke={BORDER_STRONG} strokeWidth={0.012} strokeDasharray=".05 .04" />
                  )}
                  <text x={x + 0.5} y={z(1.4)} textAnchor="middle" style={TXT}>
                    {door ? 'dør' : 'forheng'}
                  </text>
                </g>
              )
            }
            const f = felt(rules, i)
            return (
              <g key={i}>
                <rect x={spanX(f.a, f.b)} y={z(H)} width={f.w} height={H - rules.wall.feet} fill={plateColor(m?.plate ?? w.plate ?? v.defaultPlate)} {...(m ? brushOn(m.key) : {})} />
                <rect x={x} y={z(H)} width={1} height={rules.wall.profile.top} fill={ALU} />
                <rect x={x} y={z(f.y0)} width={1} height={rules.wall.profile.bottom} fill={ALU} />
              </g>
            )
          })}
          {Array.from({ length: L + 1 }, (_, i) => (
            <g key={`p${i}`}>
              <rect x={u(i) - rules.wall.post / 2} y={z(H)} width={rules.wall.post} height={H - rules.wall.feet} fill={ALU_POST} />
              <rect x={u(i) - 0.012} y={z(rules.wall.feet)} width={0.024} height={rules.wall.feet} fill={FEET} />
            </g>
          ))}
          <line x1={-PAD} y1={H} x2={L + PAD} y2={H} stroke={BORDER_STRONG} strokeWidth={0.01} />

          {/* Where a room stands against this face: hatched, with the room's name, for context only */}
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

          {/* Foil decals */}
          {foils.map((f) => {
            const c = foilCenter(rules, f)
            const x = spanX(c - f.width / 2, c + f.width / 2)
            const m = findMotif(motifs, f.motif)
            const on = F?.id === f.id
            return (
              <g key={f.id} onPointerDown={(e) => drag(e, 'fmove', f)} style={{ cursor: 'move' }}>
                {m && f.full ? (
                  <Print m={m} x={x} y={z(f.y + f.height / 2)} width={f.width} height={f.height} />
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

          {/* Textile frames */}
          {tex.map((t) => {
            const { bottom, height } = textileBox(t, rules)
            const x = spanX(t.from, t.from + t.width)
            const y = z(bottom + height)
            const m = findMotif(motifs, t.motif)
            const on = T?.id === t.id
            const fr = 0.04
            return (
              <g key={t.id} onPointerDown={(e) => drag(e, 'tmove', t)} style={{ cursor: 'move' }}>
                <rect x={x} y={y} width={t.width} height={height} fill={FABRIC} />
                {m && (
                  <Print m={m} x={x + fr} y={y + fr} width={Math.max(0, t.width - 2 * fr)} height={Math.max(0, height - 2 * fr)} />
                )}
                <rect x={x + fr / 2} y={y + fr / 2} width={t.width - fr} height={height - fr} fill="none" stroke={ALU} strokeWidth={fr} />
                {!m && (
                  <text x={x + t.width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" style={TXT}>
                    Uten motiv
                  </text>
                )}
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

          {/* Dimensions */}
          <line x1={-0.2} y1={0} x2={-0.2} y2={H} stroke={BORDER_STRONG} strokeWidth={0.008} />
          <text transform={`translate(${-0.26} ${H / 2}) rotate(-90)`} textAnchor="middle" style={DIM}>
            {mm(H)} mm
          </text>
          <line x1={0} y1={H + 0.14} x2={L} y2={H + 0.14} stroke={BORDER_STRONG} strokeWidth={0.008} />
          {Array.from({ length: L + 1 }, (_, i) => (
            <line key={`t${i}`} x1={i} y1={H + 0.1} x2={i} y2={H + 0.18} stroke={BORDER_STRONG} strokeWidth={0.008} />
          ))}
          <text x={L / 2} y={H + 0.29} textAnchor="middle" style={DIM}>
            {L} m · {fs.length > 1 ? faceName(w, s).toLowerCase() : 'innsiden'}
          </text>
        </svg>
      </div>
      <div className="wd-hint">{hint}</div>
    </section>
  )
}
