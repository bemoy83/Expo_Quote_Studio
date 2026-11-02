// Parts of the drawings in the drawers (wall, door, free-standing textile wall), the wall seen straight on.
// In metres, y down: the top of the wall is y = 0 and the floor y = H.
import type { SVGProps } from 'react'
import type { TextileFill } from '../../domain/types'
import type { Motif } from '../../persistence/file'
import { ALU, ALU_POST, BORDER_STRONG, FABRIC, FEET, INK_FAINT } from '../colors'
import { rules } from '../env'
import { DIM, TXT } from './drawerText'
import { Print } from './drawerParts'

/** System wall posts with their feet, at each x. */
export function Posts({ xs, H }: { xs: number[]; H: number }) {
  const { post, feet } = rules.wall
  return (
    <>
      {xs.map((x) => (
        <g key={x}>
          <rect x={x - post / 2} y={0} width={post} height={H - feet} fill={ALU_POST} />
          <rect x={x - 0.012} y={H - feet} width={0.024} height={feet} fill={FEET} />
        </g>
      ))}
    </>
  )
}

/**
 * A door or curtain in the module from x to x + 1: the header plate over it (in the wall's colour, `plate` passes on
 * to it), the top profile, and the leaf with its handle at the free edge, or the curtain dashed. `door` gives the leaf's
 * colour and where its hinge and free edges are in the drawing.
 */
export function Opening({ x, H, plate, door }: { x: number; H: number; plate: SVGProps<SVGRectElement>; door?: { color: string; hinge: number; free: number } }) {
  const { post, profile } = rules.wall
  const dh = rules.door.height
  return (
    <>
      <rect x={x + post / 2} y={0} width={1 - post} height={H - dh} {...plate} />
      <rect x={x} y={0} width={1} height={profile.top} fill={ALU} />
      {door ? (
        <>
          <rect x={Math.min(door.hinge, door.free)} y={H - dh} width={rules.door.swing} height={dh} fill={door.color} stroke={BORDER_STRONG} strokeWidth={0.01} />
          <rect x={door.free + (door.free > door.hinge ? -0.13 : 0.03)} y={H - 1.06} width={0.1} height={0.02} rx={0.01} fill={INK_FAINT} />
        </>
      ) : (
        <rect x={x + 0.04} y={H - dh} width={0.92} height={dh} fill="none" stroke={BORDER_STRONG} strokeWidth={0.012} strokeDasharray=".05 .04" />
      )}
    </>
  )
}

/** A textile in its aluminium frame: the print cropped inside the frame, or a note when it has no motif. */
export function TextileFace({ x, y, w, h, m, fill, empty }: { x: number; y: number; w: number; h: number; m?: Motif; fill: TextileFill; empty: string }) {
  const fr = 0.04
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={fill === 'white' ? '#fff' : FABRIC} />
      {m && <Print m={m} x={x + fr} y={y + fr} width={Math.max(0, w - 2 * fr)} height={Math.max(0, h - 2 * fr)} />}
      <rect x={x + fr / 2} y={y + fr / 2} width={w - fr} height={h - fr} fill="none" stroke={ALU} strokeWidth={fr} />
      {!m && (
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle" style={TXT}>
          {empty}
        </text>
      )}
    </>
  )
}

/** Height up the left side and width under the drawing, with a tick at each metre when `ticks`. */
export function Dims({ W, H, height, width, ticks }: { W: number; H: number; height: string; width: string; ticks?: boolean }) {
  return (
    <g pointerEvents="none">
      <line x1={-0.2} y1={0} x2={-0.2} y2={H} stroke={BORDER_STRONG} strokeWidth={0.008} />
      <text transform={`translate(${-0.26} ${H / 2}) rotate(-90)`} textAnchor="middle" style={DIM}>
        {height}
      </text>
      <line x1={0} y1={H + 0.14} x2={W} y2={H + 0.14} stroke={BORDER_STRONG} strokeWidth={0.008} />
      {ticks && Array.from({ length: Math.floor(W) + 1 }, (_, i) => <line key={i} x1={i} y1={H + 0.1} x2={i} y2={H + 0.18} stroke={BORDER_STRONG} strokeWidth={0.008} />)}
      <text x={W / 2} y={H + 0.29} textAnchor="middle" style={DIM}>
        {width}
      </text>
    </g>
  )
}
