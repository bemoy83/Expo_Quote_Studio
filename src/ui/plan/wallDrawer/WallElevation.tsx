// The drawing in the wall drawer: the chosen face of the wall seen straight on, with plates, doors, decals, rooms
// against it and textile frames. Frames and decals are moved and resized here, motifs and frames dropped from the shelf,
// and while a paint tool is out each plate is a target for it.
import { useEffect, useRef, useState, type DragEvent as RDragEvent, type PointerEvent as RPointerEvent } from 'react'
import { foilCenter } from '../../../domain/decor'
import { doorRal } from '../../../domain/doors'
import { felt, type FaceSide } from '../../../domain/faces'
import { cropBand, plateCrop } from '../../../domain/print'
import { textileBox } from '../../../domain/textile/inFrame'
import type { Foil, Opening, TextileWall, Variant, Wall } from '../../../domain/types'
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
import { Opening as OpeningView, Posts, TextileFace } from '../elevation'
import { type PlanSelection } from '../selection'
import { RoomLabel } from '../RoomLabel'
import { roomLabelSize } from '../roomLabelSize'
import { useDecorDrag } from './drag'
import { faceName, type RoomRun } from './face'
import { ElevationDims } from './ElevationDims'
import { frame, mergePrints, type ElevationItem } from './elevationDims'
import { planScale } from '../planScale'
import type { PaintTool } from './paint'

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
  foils: Foil[]
  rooms: RoomRun[]
  T: TextileWall | undefined
  F: Foil | undefined
  O: Opening | undefined
  motifs: Motif[]
  label: string
  painting: boolean
  tool: PaintTool
  /** The chosen tool on plate `i`: `first` on press, then for each plate swept over (brush only). */
  paintAt: (i: number, key: string, first: boolean, leaf?: boolean) => void
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
  const { v, w, s, L, H, mods, tex, foils, rooms, T, F, O, motifs, label, painting, tool, paintAt, doorModules, ratioOf, select, selectDoor } = p
  const svg = useRef<SVGSVGElement>(null)
  const [spot, setSpot] = useState<DropSpot | null>(null)
  /** True from a press on a plate until it is let go: the brush sweeps over the plates entered meanwhile. */
  const sweeping = useRef(false)
  /** Along-wall offset → x in the drawing. The face is drawn as seen standing in front of it. */
  const u = (t: number) => (s === 1 ? t : L - t)
  const spanX = (a: number, b: number) => Math.min(u(a), u(b))
  const z = (h: number) => H - h
  const drag = useDecorDrag({ svg, w, s, L, select, ratioOf, onEdit: p.onEdit, onCheckpoint: p.onCheckpoint })

  // The svg's size on screen: the margins for the dimensions are screen px (ElevationDims)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = svg.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize((o) => (o && o.w === r.width && o.h === r.height ? o : { w: r.width, h: r.height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Textile and print on this face, for the placement and height rows and the leaders
  const items: ElevationItem[] = mergePrints([
    ...tex.map((t) => {
      const { bottom, height } = textileBox(t, rules)
      const x0 = spanX(t.from, t.from + t.width)
      return { text: 'Tekstil', x0, x1: x0 + t.width, bottom, top: bottom + height }
    }),
    ...foils
      .filter((f) => !(f.full && doorModules.has(f.module)))
      .map((f) => {
        const c = foilCenter(rules, f)
        const x0 = spanX(c - f.width / 2, c + f.width / 2)
        return { text: f.full ? 'Print' : 'Dekal', x0, x1: x0 + f.width, bottom: f.y - f.height / 2, top: f.y + f.height / 2 }
      }),
  ])
  const name = w.room ? 'Romvegg' : label
  const fr = frame(size, L, H, items)
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
      <svg
        ref={svg}
        className="wd-svg"
        viewBox={fr.viewBox}
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
            const dh = rules.door.height
            return (
              <g pointerEvents="none">
                {doorModules.has(O.module) && (
                  <path d={`M${fx} ${z(dh)} L${hx} ${z(dh / 2)} L${fx} ${z(0)}`} fill="none" stroke={INK_FAINT} strokeWidth={0.01} strokeDasharray=".04 .03" />
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

        {/* Where a room stands against this face: a sunken surface over plates and print, with the room's name, for context
            only (hatching is kept for snekret vegg and Tøm) */}
        {rooms.map((r) => (
          <g key={`${r.room.id}${r.a}`} pointerEvents="none">
            <rect x={spanX(r.a, r.b)} y={z(H)} width={r.b - r.a} height={H} fill={SUNKEN} fillOpacity={0.72} />
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

        {/* While a tool is out: one clear target per plate (a door: its whole module) over everything drawn, so a
            print, decal or textile on a plate never takes the tap. */}
        {painting &&
          mods.map((m, i) => {
            if (!m) return null
            const f = felt(rules, i)
            if (m.opening) {
              // A door is part of the wall: the header is a plate, the leaf below it one more for the brush
              const dh = rules.door.height
              return (
                <g key={`hit${i}`}>
                  <rect x={spanX(i, i + 1)} y={z(H)} width={1} height={H - dh} fill="transparent" {...paintOn(i, m.key)} />
                  <rect x={spanX(i, i + 1)} y={z(dh)} width={1} height={dh} fill="transparent" {...(doorModules.has(i) ? paintOn(i, m.key, true) : {})} />
                </g>
              )
            }
            return <rect key={`hit${i}`} x={spanX(f.a, f.b)} y={z(H)} width={f.w} height={H - rules.wall.feet} fill="transparent" {...paintOn(i, m.key)} />
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

        <ElevationDims w={w} s={s} name={name} L={L} H={H} items={items} leaders={fr.leaders} top={fr.top} width={fr.width} sc={sc} />
      </svg>
    </div>
  )
}
