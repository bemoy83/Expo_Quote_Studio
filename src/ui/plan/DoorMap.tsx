// Mini plan in the door drawer (from design_handoff_bakrom_dor, BkMap): the whole stand from above, small, where a click
// on the cell just outside a wall module puts the chosen door there. Only a view otherwise: nothing here drags. A door
// in a room can go to any module of the room's own sides; a door in an inner wall to any module of that wall. Stand walls
// and modules holding another opening have no target. Hover shows the door where it would land.
import { useState } from 'react'
import { doorSpots, moveOpening, sideName, type DoorSpot } from '../../domain/doors'
import { openSides, sideEnds } from '../../domain/grid'
import { bounds } from '../../domain/outline'
import { roomSize } from '../../domain/rooms'
import type { Point, Side, Variant } from '../../domain/types'
import { builtModules, isStandWall } from '../../domain/walls'
import { BORDER, INK, INK_FAINT, LAYER_COLOR, SUNKEN, SURFACE } from '../colors'

interface Props {
  v: Variant
  openingId: string
  onEdit: (fn: (v: Variant) => Variant) => void
}

/** Pixels per metre: the handoff's rule, so 2 × 2 up to 12 × 10 fits about 210 × 140. */
const cellOf = (W: number, D: number) => Math.max(16, Math.min(30, Math.floor(Math.min(210 / W, 140 / D))))

const SIDE_DIR: Record<Side, Point> = { back: [0, -1], front: [0, 1], left: [-1, 0], right: [1, 0] }

export function DoorMap({ v, openingId, onEdit }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const { width: W, depth: D } = v.stand
  const c = cellOf(W, D)
  const P = Math.max(12, Math.round(c * 0.6))
  const px = (m: number) => m * c
  const mods = builtModules(v)
  const spots = doorSpots(v, openingId)
  const room = v.rooms.find((r) => spots.some((s) => s.wallId.startsWith(`${r.id}.`)))
  const current = spots.find((s) => s.current)
  const pending = spots.find((s) => s.key === hover)
  const bar = (a: Point, b: Point, stroke: string, width: number, opacity = 1, key?: string) => (
    <line key={key} x1={px(a[0])} y1={px(a[1])} x2={px(b[0])} y2={px(b[1])} stroke={stroke} strokeWidth={width} strokeOpacity={opacity} strokeLinecap="butt" />
  )

  /** The 1 × 1 cell just outside the module; outside the stand it is a strip P wide in the margin. */
  const target = (s: DoorSpot) => {
    const x0 = Math.min(s.a[0], s.b[0])
    const y0 = Math.min(s.a[1], s.b[1])
    const hz = s.a[1] === s.b[1]
    const cx = hz ? x0 : s.out[0] > 0 ? x0 : x0 - 1
    const cy = hz ? (s.out[1] > 0 ? y0 : y0 - 1) : y0
    const clip = (lo: number, n: number) => (lo < 0 ? [-P, P] : lo >= n ? [px(n), P] : [px(lo), c])
    const [x, w] = hz ? [px(cx), c] : clip(cx, W)
    const [y, h] = hz ? clip(cy, D) : [px(cy), c]
    return { x, y, w, h }
  }

  return (
    <div className="door-map">
      <div className="door-map-head">
        <span>Plassering</span>
        <span className="door-map-where num">{current ? `${room ? `${sideName(current.out)} · ` : ''}modul ${current.nth}` : ''}</span>
      </div>
      <svg width={W * c + 2 * P} height={D * c + 2 * P} viewBox={`${-P} ${-P} ${W * c + 2 * P} ${D * c + 2 * P}`} role="group" aria-label="Miniplan, flytt døren">
        <rect x={0} y={0} width={W * c} height={D * c} fill={SURFACE} />
        {Array.from({ length: W - 1 }, (_, i) => bar([i + 1, 0], [i + 1, D], BORDER, 1, 1, `gx${i}`))}
        {Array.from({ length: D - 1 }, (_, j) => bar([0, j + 1], [W, j + 1], BORDER, 1, 1, `gy${j}`))}
        {/* Rooms: the door's room in full, the others fainter, with their area when there is room for it */}
        {v.rooms.map((r) => {
          const b = bounds(r.outline)
          const pts = r.outline.map(([x, y]) => `${px(x)},${px(y)}`).join(' ')
          return (
            <g key={r.id} style={{ transition: 'opacity 120ms' }} opacity={r === room ? 1 : 0.55}>
              <polygon points={pts} fill={SUNKEN} />
              {b.w * c >= 40 && (
                <text x={px(b.x + b.w / 2)} y={px(b.y + b.d / 2)} textAnchor="middle" dominantBaseline="central" className="door-map-size num">
                  {roomSize(r)}
                </text>
              )}
            </g>
          )
        })}
        {/* Walls: stand walls thick, the rest thin; openings as gaps with the door in ink */}
        {mods.map((m) => {
          const w = v.walls.find((x) => x.id === m.wallId)
          const stand = !!w && isStandWall(w)
          if (m.opening?.id === openingId) return null
          if (m.opening) return bar(m.a, m.b, INK_FAINT, 3, 1, m.key)
          return bar(m.a, m.b, stand ? LAYER_COLOR.walls : LAYER_COLOR.openings, stand ? 3 : 2, 1, m.key)
        })}
        {current && bar(current.a, current.b, INK, 4, 1, 'door')}
        {pending && !pending.current && bar(pending.a, pending.b, INK, 4, 0.45, 'pending')}
        {/* Aisle on every open side */}
        {openSides(v.stand).map((side) => {
          const [a, b] = sideEnds(v.stand, side)
          const [nx, ny] = SIDE_DIR[side]
          const x = px((a[0] + b[0]) / 2) + (nx * P) / 2
          const y = px((a[1] + b[1]) / 2) + (ny * P) / 2
          // Front and back read across; on a side «gang» runs up the margin with the arrow under it, pointing out
          if (!nx) {
            return (
              <text key={side} x={x} y={y} textAnchor="middle" dominantBaseline="central" className="door-map-aisle">
                {side === 'front' ? 'gang ↓' : 'gang ↑'}
              </text>
            )
          }
          return (
            <g key={side}>
              <text x={x} y={y - 6} textAnchor="middle" dominantBaseline="central" className="door-map-aisle" transform={`rotate(90 ${x} ${y - 6})`}>
                gang
              </text>
              <text x={x} y={y + 18} textAnchor="middle" dominantBaseline="central" className="door-map-aisle">
                {side === 'left' ? '←' : '→'}
              </text>
            </g>
          )
        })}
        {/* Targets: the cell outside each module the door may go to */}
        {spots
          .filter((s) => !s.current)
          .map((s) => {
            const t = target(s)
            return (
              <rect
                key={s.key}
                role="button"
                tabIndex={0}
                aria-label={`Sett døren ${room ? `${sideName(s.out)}, ` : ''}modul ${s.nth}`}
                className="door-map-hit"
                x={t.x}
                y={t.y}
                width={t.w}
                height={t.h}
                rx={3}
                fill={hover === s.key ? 'rgb(var(--ink) / .07)' : 'transparent'}
                onPointerEnter={() => setHover(s.key)}
                onPointerLeave={() => setHover((h) => (h === s.key ? null : h))}
                onFocus={() => setHover(s.key)}
                onBlur={() => setHover((h) => (h === s.key ? null : h))}
                onClick={() => {
                  setHover(null)
                  onEdit((x) => moveOpening(x, openingId, s.key))
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return
                  e.preventDefault()
                  onEdit((x) => moveOpening(x, openingId, s.key))
                }}
              >
                <title>Sett døren her</title>
              </rect>
            )
          })}
      </svg>
      <p className="door-map-note">
        {spots.length > 1 ? 'Klikk ruten utenfor en vegg for å flytte døren dit.' : 'Ingen annen plass på denne veggen.'} Flytt og endre størrelse på {room ? 'rommet' : 'veggen'} i planen.
      </p>
    </div>
  )
}
