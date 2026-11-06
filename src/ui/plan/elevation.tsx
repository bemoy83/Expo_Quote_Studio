// Parts of the drawings in the drawers (wall, door, free-standing textile wall), the wall seen straight on.
// In metres, y down: the top of the wall is y = 0 and the floor y = H.
import type { ReactNode, SVGProps } from 'react'
import { doorLevels, doorWindows } from '../../domain/doors'
import type { TextileFill } from '../../domain/types'
import { RECIPES } from '../../foga/recipes'
import type { Motif } from '../../persistence/file'
import { ALU, ALU_POST, BORDER_STRONG, FABRIC, FEET } from '../colors'
import { rules } from '../env'
import { TXT } from './drawerText'
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
 * A door or curtain in the module from x to x + 1 (Byggeregler D2, D5), at the heights of D2: the header over it (a small wall,
 * plate in the wall's colour, `plate` passes on to it, between the top profile and a bottom rail: 91 over a door, 92 over
 * a curtain for its glider), and the leaf as built (D5): a 292 frame with the plate in the leaf's colour and the lock
 * on the free stile, or the curtain dashed. `door` gives the leaf's colour and where its hinge and free edges are in the
 * drawing. `print`: foil over the door, drawn on the header and on the leaf.
 */
export function Opening({ x, H, plate, door, print }: { x: number; H: number; plate: SVGProps<SVGRectElement>; door?: { color: string; hinge: number; free: number }; print?: { header: ReactNode; leaf: ReactNode } }) {
  const { post, profile } = rules.wall
  const lv = doorLevels(rules)
  const { leaf: win, frame } = doorWindows(rules)
  const z = (h: number) => H - h
  const bottom = door ? profile.bottom : profile.top
  const left = door && Math.min(door.hinge, door.free)
  const leafH = lv.top - lv.leaf
  return (
    <>
      <rect x={x + post / 2} y={0} width={1 - post} height={z(lv.header)} {...plate} />
      {print?.header}
      <rect x={x} y={0} width={1} height={profile.top} fill={ALU} />
      <rect x={x} y={z(lv.header + bottom)} width={1} height={bottom} fill={ALU} />
      {door && left !== undefined ? (
        <>
          <rect x={left} y={z(lv.top)} width={rules.door.swing} height={leafH} fill={ALU} />
          <rect x={left + frame} y={z(win.y1)} width={win.w} height={win.y1 - win.y0} fill={door.color} />
          {print?.leaf}
          <circle cx={door.free + (door.free > door.hinge ? -1 : 1) * frame / 2} cy={z(RECIPES.door.lock.height / 1000)} r={0.028} fill={LOCK} />
        </>
      ) : (
        <rect x={x + 0.04} y={z(lv.header)} width={0.92} height={lv.header - 0.02} fill="none" stroke={BORDER_STRONG} strokeWidth={0.012} strokeDasharray=".05 .04" />
      )}
    </>
  )
}

/** Lock 410's black rosette. */
const LOCK = '#1d1e20'

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
