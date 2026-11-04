// Rooms in the plan: name and floor area fitted into the room, and the grips on the selected room's sides.
import type { Room, Variant } from '../../../domain/types'
import { RoomLabel } from '../RoomLabel'
import { roomLabelSize } from '../roomLabelSize'
import { CANVAS, INK } from '../../colors'
import { insetOutline, isHorizontal, labelRect, outlineSides } from '../../../domain/outline'
import type { PlanSelection } from '../selection'
import { PLAN_WALL } from '../planStyle'
import { GONE, useErasing } from './erasing'

/** Room names and sizes over the floor and furniture, the selected room outlined. */
export function RoomLayer({ v, selection }: { v: Variant; selection: PlanSelection }) {
  // Tøm: a room about to go has its label dimmed here, its walls hatched in the wall layer
  const { gone } = useErasing()
  return (
    <g pointerEvents="none">
      {v.rooms.map((r) => (
        <g key={r.id} opacity={gone('room', r.id) ? GONE : undefined}>
          <RoomMark r={r} selected={selection.roomId === r.id} />
        </g>
      ))}
    </g>
  )
}

/** Room name and floor area on its floor; a dashed outline when selected. */
function RoomMark({ r, selected }: { r: Room; selected: boolean }) {
  const fit = fitRoomLabel(r)
  return (
    <g>
      {selected && (
        <polygon
          points={insetOutline(r.outline, 0.12).map((p) => p.join(',')).join(' ')}
          fill={INK}
          fillOpacity={0.04}
          stroke={INK}
          strokeWidth={0.025}
          strokeDasharray=".1 .06"
          strokeLinejoin="round"
        />
      )}
      {fit && <RoomLabel r={r} cx={fit.cx} cy={fit.cy} k={fit.k} two={fit.two} turn={fit.turn} box={false} />}
    </g>
  )
}

/** Clearance kept between a room label and the room's wall lines, m. */
const LABEL_GAP = PLAN_WALL / 2 + 0.06
/** Smallest scale a room label is drawn at; below it the size line is dropped, then the label. */
const LABEL_MIN = 0.6

/**
 * Fits the label box into the room's largest free rectangle, clear of its walls: full size when it fits, else
 * scaled down, turned along a narrow room when that leaves it larger, and without the size line as a last resort.
 */
function fitRoomLabel(r: Room) {
  const box = labelRect(r.outline)
  const aw = box.w - 2 * LABEL_GAP
  const ad = box.d - 2 * LABEL_GAP
  /** The label box at scale 1 and the scale it fits at, with the size line (`two`) or without. */
  const measure = (two: boolean) => {
    const { w, h } = roomLabelSize(r, two)
    const flat = Math.min(1, aw / w, ad / h)
    const turned = Math.min(1, ad / w, aw / h)
    const turn = turned > flat + 0.05
    return { w, h, two, turn, k: turn ? turned : flat }
  }
  const two = measure(true)
  const one = two.k >= LABEL_MIN ? two : measure(false)
  if (one.k < LABEL_MIN * 0.75) return null
  return { ...one, cx: box.x + box.w / 2, cy: box.y + box.d / 2 }
}

/** Grips at the middle of each side of the selected room: drag a side to resize. */
export function RoomHandles({ r }: { r: Room }) {
  return (
    <g>
      {outlineSides(r.outline).map(([a, b], i) => {
        const mx = (a[0] + b[0]) / 2
        const my = (a[1] + b[1]) / 2
        const hz = isHorizontal([a, b])
        return <rect key={i} x={mx - (hz ? 0.2 : 0.06)} y={my - (hz ? 0.06 : 0.2)} width={hz ? 0.4 : 0.12} height={hz ? 0.12 : 0.4} rx={0.05} fill={CANVAS} stroke={INK} strokeWidth={0.03} />
      })}
    </g>
  )
}
