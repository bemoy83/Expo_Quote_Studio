// The drawing in the wall drawer: the chosen face of the wall seen straight on, with plates, doors, decals, rooms
// against it, textile frames and shelves (hylle 6311). Frames and decals are moved and resized here, shelves moved up,
// down and sideways, motifs and frames dropped from the motif library (Profilering), and while a paint tool is out each plate is a
// target for it.
import { railHeight } from '../../../foga/plates'
import { RECIPES } from '../../../foga/recipes'
import { useEffect, useMemo, useRef, useState, type DragEvent as RDragEvent } from 'react'
import { foilCenter, foilsOn } from '../../../domain/decor'
import { doorLevels, doorRal, doorWindows } from '../../../domain/doors'
import { felt, type FaceSide } from '../../../domain/faces'
import { moduleCc, moduleStart } from '../../../domain/grid'
import { raiseDrawing, wiredPosts } from '../raiseDrawing'
import { cropWindow, onDoorPart, plateCrop } from '../../../domain/print'
import { textileBox, textilesOn } from '../../../domain/textile/inFrame'
import { cornerLayout } from '../../../domain/shelves/corners'
import { shelfRow, shelfStacks } from '../../../domain/shelves/model'
import type { DoorSurface, Foil, Motif, Opening, Shelf, TextileWall, Variant, Wall } from '../../../domain/types'
import { wallRal } from '../../../domain/plateDecor'
import { postOffsets, splitParts, type BuiltModule, type WallPart } from '../../../domain/walls'
import { doorInset } from '../../../rules/rules'
import { BORDER_STRONG, INK, INK_FAINT, SUNKEN } from '../../colors'
import { applyDrop, decorDrag, dropSpot, endDecorDrag, type DropSpot, type FaceTarget } from '../../dnd'
import { plateColor, productOf, rules } from '../../env'
import { fmt } from '../../format'
import { findMotif } from '../../motifs'
import { Handles, Print } from '../drawerParts'
import { TXT } from '../drawerText'
import { FaceRails, Opening as OpeningView, Plate, Posts, Raise, ShelfFront, TextileFace } from '../elevation'
import { shelfFront } from '../shelfFront'
import { type PlanSelection } from '../selection'
import { RoomLabel } from '../RoomLabel'
import { roomLabelSize } from '../roomLabelSize'
import { useDecorDrag, useShelfDrag } from './drag'
import { faceName, type RoomRun } from './face'
import { ElevationDims } from './ElevationDims'
import { elevationItems, frame, shelfChains, textileDrawing, type FrameFacts } from './elevationMeasure'
import { planScale } from '../planScale'
import { useElementSize } from '../../useElementSize'
import { useSweep, type PaintTool } from '../paintTools'
import { BrushPreview } from './BrushPreview'
import { useShelfBrush } from './shelfBrush'

const EPS = 1e-6

interface Props {
  v: Variant
  w: Wall
  s: FaceSide
  /** Faces the wall has. */
  fs: FaceSide[]
  L: number
  H: number
  mods: (BuiltModule | undefined)[]
  /** The wall's plates as built, the parts of a split module each its own (V10). */
  parts: WallPart[]
  tex: TextileWall[]
  /** A frame's production facts (size, braces, splices, X10 move), by textile id. */
  pieceOf: (id: string) => FrameFacts | undefined
  foils: Foil[]
  /** Shelves on the face. */
  shelves: Shelf[]
  rooms: RoomRun[]
  T: TextileWall | undefined
  F: Foil | undefined
  O: Opening | undefined
  /** The chosen shelf, the shelves chosen with it (its row, or only it with `shelfOnly`). */
  S: Shelf | undefined
  chosen: string[]
  shelfOnly?: boolean
  /** The chosen felt (module), when the wall's felt and nothing on it is chosen. */
  felt?: number
  /** With `felt`: its upper felt is chosen (Byggeregel V20). */
  upper?: boolean
  motifs: Motif[]
  label: string
  painting: boolean
  /** The tools lay print: the drawing measures the plates' lysmål. */
  printing: boolean
  tool: PaintTool
  /** The chosen tool on plate `i`: `first` on press, then for each plate swept over (brush only). */
  paintAt: (i: number, key: string, first: boolean, leaf?: boolean) => void
  /** The shelf brush is out (Hyller og heng): the drawing lays shelves where it is clicked. */
  shelfBrush?: boolean
  /** Esc with the shelf brush out and nothing pressed. */
  onBrushDone?: () => void
  /** What the hint line says while the shelf brush aims (null: its own hint). */
  onBrushHint?: (text: string | null) => void
  /** Modules of this wall holding a door (not a curtain). */
  doorModules: Set<number>
  ratioOf: (id?: string) => number
  select: (x: Partial<PlanSelection>) => void
  selectDoor: (id: string, side?: FaceSide, surface?: DoorSurface) => void
  /** The surface of the chosen door chosen in the drawing (its header or its leaf). */
  doorSurface?: DoorSurface
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
}

export function WallElevation(p: Props) {
  const { v, w, s, L, H, mods, tex, pieceOf, foils, shelves, rooms, T, F, O, motifs, label, painting, printing, tool, paintAt, doorModules, ratioOf, select, selectDoor } = p
  const svg = useRef<SVGSVGElement>(null)
  const [spot, setSpot] = useState<DropSpot | null>(null)
  const sweep = useSweep()
  /** Along-wall offset → x in the drawing. The face is drawn as seen standing in front of it. */
  const u = (t: number) => (s === 1 ? t : L - t)
  const spanX = (a: number, b: number) => Math.min(u(a), u(b))
  /** Module i's length c/c: a shorter last module is drawn as long as it is (Byggeregel V1). */
  const ccOf = (i: number) => moduleCc(w, i)
  /** Where module i starts along the wall, m (moduleStart: off whole metres beside a door, D8). */
  const st = (i: number) => moduleStart(w, i)
  /** The parts of module i when another wall split it (V10), else none. */
  /** Post centres along the wall: every module's and part's start, and the end. */
  const postsAt = postOffsets(w, p.parts)
  const z = (h: number) => H - h
  // Corner shelves: their boards, brackets and the 01 rails on this face (Byggeregler H10–H12)
  const layout = useMemo(() => cornerLayout(v, rules), [v])
  const drag = useDecorDrag({ svg, w, s, L, select, ratioOf, onEdit: p.onEdit, onCheckpoint: p.onCheckpoint })
  const shelfDrag = useShelfDrag({ svg, s, select, onEdit: p.onEdit, onCheckpoint: p.onCheckpoint })
  const brush = useShelfBrush({ svg, v, w, s, L, H, on: !!p.shelfBrush, onEdit: p.onEdit, onDone: () => p.onBrushDone?.() })
  const { onBrushHint } = p
  useEffect(() => onBrushHint?.(brush.hint ?? null), [brush.hint, onBrushHint])
  /** Nothing in the drawing takes a press while a tool is out: the paint tools' plate targets or the shelf brush take it. */
  const tooled = painting || !!p.shelfBrush

  // The drawing's size on screen: the margins for the dimensions are screen px (ElevationDims). Measured on a box the
  // svg fills, never on the svg, whose size would follow the view box it gets from the measure (a loop in Safari).
  const box = useRef<HTMLDivElement>(null)
  const size = useElementSize(box, true)
  // Measured is what the drawer is open for (Bjørn 6.11.2026): a selected textile frame, or a selected decal or print
  // (a print over several plates as one), with its own dimensions; with the wall itself chosen, the wall's
  const items = T
    ? elevationItems(rules, [T], [], doorModules, u, pieceOf, v.walls)
    : F
      ? elevationItems(rules, [], F.run ? foils.filter((x) => x.run === F.run) : [F], doorModules, u, undefined, v.walls)
      : []
  // Print laid on the wall: where each plate field starts (the door modules have none of their own)
  const fieldMods = painting && printing ? mods.map((_, i) => i).filter((i) => !doorModules.has(i)) : undefined
  const fields = fieldMods?.map((i) => spanX(st(i), st(i) + ccOf(i)))
  const fieldCc = fieldMods?.map(ccOf)
  const name = w.room ? 'Romvegg' : label
  // Named with a leader: not what the drawer is open for (its title says it), but the textile frames, decals and prints
  // on the wall when the wall is chosen (a print over several plates as one)
  const labels = !T && !F && !O && !painting ? elevationItems(rules, tex, foils, doorModules, u, pieceOf, v.walls) : []
  // One scale for the wall (Bjørn 17.11.2026): room for every frame, decal and print on both faces, whatever is chosen
  const steady = p.fs.map((f) => elevationItems(rules, textilesOn(v, w.id, f), foilsOn(v, w.id, f), doorModules, (t) => (f === 1 ? t : L - t), pieceOf, v.walls))
  // A raised wall (Byggeregler V18, V21) and its ceiling wires (S9)
  const wired = useMemo(() => wiredPosts(v), [v])
  const raise = raiseDrawing(w, mods, p.parts, u, wired)
  const above = raise.above
  const fr = frame(size, L, H, items, { labels, steady, above: raise.headroom })
  const sc = planScale(1 / fr.u, {})

  /** Pointer handlers for a plate (or a door) in the drawing while a tool is out: click, or with the brush press and sweep. */
  const paintOn = (i: number, key: string, leaf = false) => (painting ? sweep(tool, (first) => paintAt(i, key, first, leaf)) : {})
  /** A print over a door: its part of the picture on the header plate and on the leaf plate. */
  const doorPrint = (f: Foil, x: number, leafX: number) => {
    const m = findMotif(motifs, f.motif)
    if (!m) return undefined
    const crop = plateCrop(f, m.ratio)
    const y0 = f.y - f.height / 2
    const y1 = f.y + f.height / 2
    // Only through the plates' lysåpning: the header between its rails, the leaf inside its 292 frame (D2, D5)
    const { header, leaf, frame } = doorWindows(rules)
    const box = { x0: -f.width / 2, x1: f.width / 2, y0, y1 }
    const part = (wi: { w: number; y0: number; y1: number }, left: number) => (
      <Print m={m} x={left} y={z(wi.y1)} width={wi.w} height={wi.y1 - wi.y0} crop={cropWindow(crop, box, { x0: -wi.w / 2, x1: wi.w / 2, y0: wi.y0, y1: wi.y1 })} />
    )
    return {
      header: part(header, x + rules.wall.post / 2),
      leaf: part(leaf, leafX + frame),
    }
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

  return (
    <div className="wd-view">
      <div ref={box} className="wd-fit">
        <svg
          ref={svg}
          className="wd-svg"
          viewBox={fr.viewBox}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={(e) => {
            // A press on a plate (not on what lies on it) chooses its felt, a second press the wall again (Bjørn 9.11.2026)
            const m = svg.current?.getScreenCTM()
            const q = m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null
            const i = q ? Math.floor(s === 1 ? q.x : L - q.x) : -1
            const mod = i >= 0 && i < L ? mods[i] : undefined
            // Over the middle rail of a raised plate: its upper felt (V20), over a door too
            if (q && q.y < 0) {
              const up = !!mod?.raise && q.y >= -mod.raise.len / 1000
              return select(up && !(p.upper && p.felt === i) ? { felt: i, upper: true } : {})
            }
            const plate = !!q && q.y <= H && !!mod && !mod.opening
            select(plate && (p.felt !== i || p.upper) ? { felt: i } : {})
          }}
          onDragOver={onDragOver}
          onDragLeave={() => setSpot(null)}
          onDrop={onDrop}
          role="img"
          aria-label={`${label}, ${faceName(w, s).toLowerCase()}, ${fmt(L, 2)} m`}
        >
          {/* Wall: plates, openings, profiles, posts, feet */}
          {mods.map((m, i) => {
            const x = spanX(st(i), st(i) + ccOf(i))
            if (m?.opening) {
              const o = m.opening
              const door = productOf(o.product)?.opening === 'door'
              const k = doorInset(rules)
              const hinge = u(o.hinge === -1 ? st(i) + 1 - k : st(i) + k)
              const free = u(o.hinge === -1 ? st(i) + k : st(i) + 1 - k)
              // Print on the door: one picture over header and leaf, or one on each surface (the brush)
              const fps = door ? foils.filter((f) => f.full && f.module === i) : []
              const parts = fps.map((f) => ({ f, at: doorPrint(f, x, Math.min(hinge, free)) }))
              const fp = fps.length > 0
              return (
                <g
                  key={i}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    // The door is chosen here, in the wall drawer; chosen, a click takes colour and graphics back (while a tool
                    // is out, the plate targets on top take the press)
                    e.stopPropagation()
                    // A door: the header or the leaf under the pointer, each a surface of its own (Bjørn 18.11.2026);
                    // clicked again, the wall's colour and graphics come back
                    const at = svg.current?.getScreenCTM()
                    const y = at ? H - new DOMPoint(e.clientX, e.clientY).matrixTransform(at.inverse()).y : 0
                    const surface: DoorSurface | undefined = door ? (y > doorLevels(rules).header ? 'header' : 'leaf') : undefined
                    if (O?.id === o.id && p.doorSurface === surface) select({})
                    else selectDoor(o.id, s, surface)
                  }}
                >
                  <OpeningView
                    x={x}
                    H={H}
                    plate={{ fill: plateColor(m.plate) }}
                    door={door ? { color: plateColor(doorRal(v, o)), hinge, free } : undefined}
                    print={
                      fp
                        ? {
                            header: parts.map(({ f, at }) => onDoorPart(f, 'header') && <g key={f.id}>{at?.header}</g>),
                            leaf: parts.map(({ f, at }) => onDoorPart(f, 'leaf') && <g key={f.id}>{at?.leaf}</g>),
                          }
                        : undefined
                    }
                  />
                  {!fp && (
                    <text x={x + 0.5} y={z(1.4)} textAnchor="middle" style={TXT}>
                      {door ? 'dør' : 'forheng'}
                    </text>
                  )}
                </g>
              )
            }
            // A module another wall split (V10): each part its own plate, in its own colour
            const split = !m ? splitParts(p.parts, i) : []
            if (split.length)
              return (
                <g key={i}>
                  {split.map((q) => (
                    <Plate key={q.mod.key} at={q.at} cc={q.cc} fill={plateColor(q.mod.plate)} x={spanX} H={H} />
                  ))}
                </g>
              )
            return <Plate key={i} at={st(i)} cc={ccOf(i)} fill={plateColor(m?.plate ?? wallRal(v, w))} x={spanX} H={H} />
          })}
          <Posts xs={postsAt.map(u)} H={H} />
          {raise.felts.length > 0 && <Raise felts={raise.felts} posts={raise.posts} wires={raise.wires} x={spanX} />}
          {/* The chosen door: marked, with its swing (the point of the triangle is the hinge side) */}
          {O &&
            O.wallId === w.id &&
            (() => {
              const x = spanX(st(O.module), st(O.module) + 1)
              const k = doorInset(rules)
              const hx = u(O.hinge === -1 ? st(O.module) + 1 - k : st(O.module) + k)
              const fx = u(O.hinge === -1 ? st(O.module) + k : st(O.module) + 1 - k)
              const lv = doorLevels(rules)
              return (
                <g pointerEvents="none">
                  {doorModules.has(O.module) && (
                    <path d={`M${fx} ${z(lv.top)} L${hx} ${z((lv.top + lv.leaf) / 2)} L${fx} ${z(lv.leaf)}`} fill="none" stroke={INK_FAINT} strokeWidth={0.01} strokeDasharray=".04 .03" />
                  )}
                  <rect x={x - 0.012} y={z(H) - 0.012} width={1.024} height={H + 0.012} fill="none" stroke={INK} strokeWidth={0.016} />
                  {/* The surface chosen, toned: the header between its rails, or the leaf */}
                  {p.doorSurface === 'header' && <rect x={x + rules.wall.post / 2} y={0} width={1 - rules.wall.post} height={z(lv.header)} fill={INK} fillOpacity={0.12} />}
                  {p.doorSurface === 'leaf' && doorModules.has(O.module) && <rect x={Math.min(hx, fx)} y={z(lv.top)} width={rules.door.swing} height={lv.top - lv.leaf} fill={INK} fillOpacity={0.12} />}
                </g>
              )
            })()}
          <line x1={-0.12} y1={H} x2={L + 0.12} y2={H} stroke={BORDER_STRONG} strokeWidth={0.01} />

          {/* Foil decals */}
          {foils.map((f) => {
            if (f.full && doorModules.has(f.module)) return null
            const c = foilCenter(v, rules, f)
            const x = spanX(c - f.width / 2, c + f.width / 2)
            const m = findMotif(motifs, f.motif)
            const on = F?.id === f.id
            return (
              <g key={f.id} onPointerDown={(e) => drag(e, 'fmove', f)} style={{ cursor: 'move' }} pointerEvents={tooled ? 'none' : undefined}>
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

          {/* The chosen felt: a tint over its plate, under the shelves */}
          {p.felt !== undefined && mods[p.felt] && (() => {
            const f = felt(rules, st(p.felt), ccOf(p.felt))
            const r = mods[p.felt]!.raise
            if (p.upper && r) {
              const top = railHeight(RECIPES.wall.raise.topRail) / 1000
              return <rect x={spanX(f.a, f.b)} y={-r.len / 1000 + top} width={f.w} height={r.len / 1000 - top} fill={INK} fillOpacity={0.1} pointerEvents="none" />
            }
            return <rect x={spanX(f.a, f.b)} y={z(H)} width={f.w} height={H - rules.wall.feet} fill={INK} fillOpacity={0.1} pointerEvents="none" />
          })()}

          {/* Shelves, over plates and print: dragged up and down, and sideways felt by felt */}
          <FaceRails wallId={w.id} s={s} layout={layout} x={u} H={H} u={fr.u} />
          {shelves.map((f) => {
            // The grip: 22 px above and below the board, but only half way to the shelf above or below in the felt
            const half = 22 * fr.u
            const t = rules.shelf.board.thickness
            const ys = shelves.filter((o) => o.module === f.module && o.id !== f.id).map((o) => o.y)
            const below = Math.max(...ys.filter((y) => y < f.y).map((y) => (y + f.y) / 2 - t / 2), f.y - t / 2 - half)
            const above = Math.min(...ys.filter((y) => y > f.y).map((y) => (y + f.y) / 2 - t / 2), f.y - t / 2 + half)
            return (
              <ShelfFront
                key={f.id}
                {...shelfFront(v, f, layout, spanX)}
                y={f.y}
                H={H}
                u={fr.u}
                on={p.chosen.includes(f.id)}
                grip={[below, above]}
                style={{ cursor: 'move' }}
                pointerEvents={tooled ? 'none' : undefined}
                onPointerDown={(e) =>
                  p.chosen.includes(f.id) ? shelfDrag(e, f, p.chosen, p.shelfOnly, v) : shelfDrag(e, f, shelfRow(v, f.id).map((x) => x.id), undefined, v)
                }
              />
            )
          })}

          {/* Where a room stands against this face: a sunken surface over plates and print, with the room's name, for context
              only (hatching is kept for snekret vegg and Tøm) */}
          {rooms.map((r) => (
            <g key={`${r.room.id}${r.a}`} pointerEvents="none">
              <rect x={spanX(r.a, r.b)} y={z(H)} width={r.b - r.a} height={H} fill={SUNKEN} fillOpacity={0.72} />
              <RoomLabel r={r.room} cx={spanX(r.a, r.b) + (r.b - r.a) / 2} cy={z(H) + 0.55} k={Math.min(1, (r.b - r.a - 0.1) / roomLabelSize(r.room).w)} />
            </g>
          ))}

          {/* Textile frames, as built: the physical frame with its braces and rail splices, where it stands (X10) */}
          {tex.map((t) => {
            const { bottom, height } = textileBox(t, rules)
            const d = textileDrawing(rules, t, pieceOf(t.id), u)
            const x = d.x0
            const tw = d.x1 - d.x0
            const y = z(bottom + height)
            const fill = t.fill ?? 'print'
            const m = fill === 'print' ? findMotif(motifs, t.motif) : undefined
            const on = T?.id === t.id
            return (
              <g key={t.id} onPointerDown={(e) => drag(e, 'tmove', t)} style={{ cursor: 'move' }} pointerEvents={tooled ? 'none' : undefined}>
                <TextileFace x={x} y={y} w={tw} h={height} m={m} fill={fill} u={fr.u} braces={d.braces} splices={d.splices} />
                {on && <rect x={x - 0.014} y={y - 0.014} width={tw + 0.028} height={height + 0.028} fill="none" stroke={INK} strokeWidth={0.016} />}
                {on && <Handles x={x} y={y} w={tw} h={height} onDown={(e, edge) => drag(e, { edge }, t)} />}
              </g>
            )
          })}

          {/* While a tool is out: one clear target per plate (a door: its whole module) over everything drawn, so a
              print, decal or textile on a plate never takes the tap. */}
          {painting &&
            mods.map((m, i) => {
              if (!m)
                return splitParts(p.parts, i).map((q) => {
                  const f = felt(rules, q.at, q.cc)
                  return <rect key={`hit${q.mod.key}`} x={spanX(f.a, f.b)} y={z(H)} width={f.w} height={H - rules.wall.feet} fill="transparent" {...paintOn(i, q.mod.key)} />
                })
              const f = felt(rules, st(i), ccOf(i))
              if (m.opening) {
                // A door is part of the wall: the header is a plate, the leaf below it one more for the brush
                const lv = doorLevels(rules)
                return (
                  <g key={`hit${i}`}>
                    <rect x={spanX(st(i), st(i) + 1)} y={z(H)} width={1} height={H - lv.header} fill="transparent" {...paintOn(i, m.key)} />
                    <rect x={spanX(st(i), st(i) + 1)} y={z(lv.header)} width={1} height={lv.header} fill="transparent" {...(doorModules.has(i) ? paintOn(i, m.key, true) : {})} />
                  </g>
                )
              }
              return <rect key={`hit${i}`} x={spanX(f.a, f.b)} y={z(H)} width={f.w} height={H - rules.wall.feet} fill="transparent" {...paintOn(i, m.key)} />
            })}

          {/* The shelf brush: what a click or drag lays, dimmed, and over the whole wall the target that takes the press */}
          {brush.stroke && <BrushPreview stroke={brush.stroke} sc={sc} H={H} u={fr.u} x={spanX} />}
          {p.shelfBrush && <rect x={0} y={0} width={L} height={H} fill="transparent" {...brush.handlers} />}

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

          <ElevationDims above={above} w={w} s={s} name={name} L={L} H={H} posts={postsAt} items={items} leaders={fr.leaders} top={fr.top} width={fr.width} right={fr.right} sc={sc} fields={fields} fieldCc={fieldCc} shelves={shelfChains(rules, shelfStacks({ ...v, shelves: brush.shelves ?? shelves }), u, st)} />
        </svg>
      </div>
    </div>
  )
}
