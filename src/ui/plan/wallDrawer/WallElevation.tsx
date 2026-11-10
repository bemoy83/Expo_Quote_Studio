// The drawing in the wall drawer: the chosen face of the wall seen straight on, with plates, doors, decals, rooms
// against it, textile frames and shelves (hylle 6311). Frames and decals are moved and resized here, shelves moved up,
// down and sideways, motifs and frames dropped from the motif library (Profilering), and while a paint tool is out each plate is a
// target for it.
import { useEffect, useMemo, useRef, useState, type DragEvent as RDragEvent, type PointerEvent as RPointerEvent } from 'react'
import { foilCenter } from '../../../domain/decor'
import { doorLevels, doorRal, doorWindows } from '../../../domain/doors'
import { felt, type FaceSide } from '../../../domain/faces'
import { cropWindow, plateCrop } from '../../../domain/print'
import { textileBox } from '../../../domain/textile/inFrame'
import { cornerLayout } from '../../../domain/shelves/corners'
import { shelfRow, shelfStacks } from '../../../domain/shelves/model'
import type { Foil, Opening, Shelf, TextileWall, Variant, Wall } from '../../../domain/types'
import { wallRal } from '../../../domain/panels'
import type { BuiltModule } from '../../../domain/walls'
import type { Motif } from '../../../persistence/file'
import { doorInset } from '../../../rules/rules'
import { ALU, BORDER_STRONG, INK, INK_FAINT, SUNKEN } from '../../colors'
import { applyDrop, decorDrag, dropSpot, endDecorDrag, type DropSpot, type FaceTarget } from '../../dnd'
import { plateColor, productOf, rules } from '../../env'
import { findMotif } from '../../motifs'
import { Handles, Print } from '../drawerParts'
import { TXT } from '../drawerText'
import { FaceRails, Opening as OpeningView, Posts, ShelfFront, TextileFace } from '../elevation'
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
import type { PaintTool } from './paint'
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
  selectDoor: (id: string, side?: FaceSide) => void
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
}

export function WallElevation(p: Props) {
  const { v, w, s, L, H, mods, tex, pieceOf, foils, shelves, rooms, T, F, O, motifs, label, painting, printing, tool, paintAt, doorModules, ratioOf, select, selectDoor } = p
  const svg = useRef<SVGSVGElement>(null)
  const [spot, setSpot] = useState<DropSpot | null>(null)
  /** True from a press on a plate until it is let go: the brush sweeps over the plates entered meanwhile. */
  const sweeping = useRef(false)
  /** Along-wall offset → x in the drawing. The face is drawn as seen standing in front of it. */
  const u = (t: number) => (s === 1 ? t : L - t)
  const spanX = (a: number, b: number) => Math.min(u(a), u(b))
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
    ? elevationItems(rules, [T], [], doorModules, u, pieceOf)
    : F
      ? elevationItems(rules, [], F.run ? foils.filter((x) => x.run === F.run) : [F], doorModules, u)
      : []
  // Print laid on the wall: where each plate field starts (the door modules have none of their own)
  const fields = painting && printing ? mods.map((_, i) => i).filter((i) => !doorModules.has(i)).map((i) => spanX(i, i + 1)) : undefined
  const name = w.room ? 'Romvegg' : label
  // Named with a leader: not what the drawer is open for (its title says it), but the textile frames, decals and prints
  // on the wall when the wall is chosen (a print over several plates as one)
  const labels = !T && !F && !O && !painting ? elevationItems(rules, tex, foils, doorModules, u, pieceOf) : []
  const fr = frame(size, L, H, items, { labels })
  const sc = planScale(1 / fr.u, {})

  /** Pointer handlers for a plate (or a door) in the drawing while a tool is out: click, or with the brush press and sweep. */
  const paintOn = (i: number, key: string, leaf = false) =>
    painting
      ? {
          style: { cursor: tool === 'wall' ? 'copy' : 'crosshair' },
          onPointerDown: (e: RPointerEvent) => {
            e.stopPropagation()
            // A finger enters the plate (with the button down) just before it presses it, so a sweep only counts once
            // the press has begun: else the brush printed the plate on enter and the press took the print off again.
            sweeping.current = true
            const end = () => {
              sweeping.current = false
              window.removeEventListener('pointerup', end)
              window.removeEventListener('pointercancel', end)
            }
            window.addEventListener('pointerup', end)
            window.addEventListener('pointercancel', end)
            // Touch (iPad) holds the pointer on the plate it went down on, so the next plates would never see it
            // enter. Letting go of it makes a sweep with a finger or pen work like one with the mouse.
            const t = e.currentTarget as Element
            if (t.hasPointerCapture(e.pointerId)) t.releasePointerCapture(e.pointerId)
            if (e.button === 0) paintAt(i, key, true, leaf)
          },
          onPointerEnter: (e: RPointerEvent) => {
            if (tool === 'plate' && sweeping.current && e.buttons === 1) paintAt(i, key, false, leaf)
          },
        }
      : {}
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
            const i = q && q.y >= 0 && q.y <= H ? Math.floor(s === 1 ? q.x : L - q.x) : -1
            const plate = i >= 0 && i < L && !!mods[i] && !mods[i]!.opening
            select(plate && p.felt !== i ? { felt: i } : {})
          }}
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
                  onPointerDown={(e) => {
                    // The door is chosen here, in the wall drawer; chosen, a click takes colour and graphics back (while a tool
                    // is out, the plate targets on top take the press)
                    e.stopPropagation()
                    if (O?.id === o.id) select({})
                    else selectDoor(o.id)
                  }}
                >
                  <OpeningView
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
                <rect x={spanX(f.a, f.b)} y={z(H)} width={f.w} height={H - rules.wall.feet} fill={plateColor(m?.plate ?? wallRal(v, w))} />
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
              const lv = doorLevels(rules)
              return (
                <g pointerEvents="none">
                  {doorModules.has(O.module) && (
                    <path d={`M${fx} ${z(lv.top)} L${hx} ${z((lv.top + lv.leaf) / 2)} L${fx} ${z(lv.leaf)}`} fill="none" stroke={INK_FAINT} strokeWidth={0.01} strokeDasharray=".04 .03" />
                  )}
                  <rect x={x - 0.012} y={z(H) - 0.012} width={1.024} height={H + 0.012} fill="none" stroke={INK} strokeWidth={0.016} />
                </g>
              )
            })()}
          <line x1={-0.12} y1={H} x2={L + 0.12} y2={H} stroke={BORDER_STRONG} strokeWidth={0.01} />

          {/* Foil decals */}
          {foils.map((f) => {
            if (f.full && doorModules.has(f.module)) return null
            const c = foilCenter(rules, f)
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
            const f = felt(rules, p.felt)
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
              if (!m) return null
              const f = felt(rules, i)
              if (m.opening) {
                // A door is part of the wall: the header is a plate, the leaf below it one more for the brush
                const lv = doorLevels(rules)
                return (
                  <g key={`hit${i}`}>
                    <rect x={spanX(i, i + 1)} y={z(H)} width={1} height={H - lv.header} fill="transparent" {...paintOn(i, m.key)} />
                    <rect x={spanX(i, i + 1)} y={z(lv.header)} width={1} height={lv.header} fill="transparent" {...(doorModules.has(i) ? paintOn(i, m.key, true) : {})} />
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

          <ElevationDims w={w} s={s} name={name} L={L} H={H} items={items} leaders={fr.leaders} top={fr.top} width={fr.width} right={fr.right} sc={sc} fields={fields} shelves={shelfChains(rules, shelfStacks({ ...v, shelves: brush.shelves ?? shelves }), u)} />
        </svg>
      </div>
    </div>
  )
}
