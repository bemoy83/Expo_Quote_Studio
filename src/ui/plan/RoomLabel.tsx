// The room's label: name over floor area. In the plan it stands straight on the floor (docs/arbeidstegning.md); in the
// wall drawer (on the part of a wall a room stands against) in a pale box. Sizes in metres of the drawing.
import { roomName, roomSize } from '../../domain/rooms'
import type { Room } from '../../domain/types'
import { CANVAS, INK, INK_FAINT } from '../colors'
import { roomLabelSize } from './roomLabelSize'

const NAME = { font: '500 0.22px var(--font-ui)', fill: INK }
const SIZE = { font: '500 0.19px var(--font-numeric)', fill: INK_FAINT }

/** The label centred on (cx, cy), scaled by `k`, turned a quarter to run along a narrow room when `turn`, in a box
 *  unless `box` is false. */
export function RoomLabel({ r, cx, cy, k = 1, two = true, turn = false, box = true }: { r: Room; cx: number; cy: number; k?: number; two?: boolean; turn?: boolean; box?: boolean }) {
  const { w, h } = roomLabelSize(r, two)
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${turn ? -90 : 0}) scale(${k})`} pointerEvents="none">
      {box && <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.06} fill={CANVAS} fillOpacity={0.85} />}
      <text y={two ? -0.06 : 0.08} textAnchor="middle" style={NAME}>
        {roomName(r)}
      </text>
      {two && (
        <text y={0.22} textAnchor="middle" style={SIZE}>
          {roomSize(r)}
        </text>
      )}
    </g>
  )
}
