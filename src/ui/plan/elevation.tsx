// Parts of the drawings in the drawers (wall, door, free-standing textile wall), the wall seen straight on.
// In metres, y down: the top of the wall is y = 0 and the floor y = H.
import { useId, type ReactNode, type SVGProps } from 'react'
import { doorLevels, doorWindows } from '../../domain/doors'
import type { TextileFill } from '../../domain/types'
import { RECIPES } from '../../foga/recipes'
import type { Motif } from '../../persistence/file'
import { ALU, ALU_POST, BORDER_STRONG, FABRIC, FEET, INK, INK_MUTED, SURFACE } from '../colors'
import { NOTE_ICON, NOTE_PILL, noteAngle, textileNote, type TextileNote } from '../textileNote'
import { EM, textPx } from './planScale'
import { rules } from '../env'
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

/**
 * A textile in its aluminium frame (43TX, 40 mm): the print cropped inside the frame, or the note when its picture is
 * not settled (no motif yet, or the customer's own textile). `braces`: x of the upright braces behind the textile,
 * dashed; `splices`: x where the rails are spliced, marked across them. `u`: metres per screen pixel, for the note.
 */
export function TextileFace({ x, y, w, h, m, fill, u, braces = [], splices = [] }: { x: number; y: number; w: number; h: number; m?: Motif; fill: TextileFill; u: number; braces?: number[]; splices?: number[] }) {
  const fr = 0.04
  const note = textileNote(fill, !!m)
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={fill === 'white' ? '#fff' : FABRIC} />
      {m && <Print m={m} x={x + fr} y={y + fr} width={Math.max(0, w - 2 * fr)} height={Math.max(0, h - 2 * fr)} />}
      {note && <NoteMark x={x + fr} y={y + fr} w={w - 2 * fr} h={h - 2 * fr} note={note} u={u} />}
      {braces.map((bx) => (
        <line key={`b${bx}`} x1={bx} y1={y + fr} x2={bx} y2={y + h - fr} stroke={ALU_POST} strokeOpacity={0.75} strokeWidth={0.02} strokeDasharray={`${6 * u} ${4 * u}`} />
      ))}
      <rect x={x + fr / 2} y={y + fr / 2} width={w - fr} height={h - fr} fill="none" stroke={ALU} strokeWidth={fr} />
      {splices.map((sx) => (
        <g key={`s${sx}`} stroke={INK} strokeWidth={1.2 * u}>
          <line x1={sx} y1={y - 2 * u} x2={sx} y2={y + fr + 2 * u} />
          <line x1={sx} y1={y + h - fr - 2 * u} x2={sx} y2={y + h + 2 * u} />
        </g>
      ))}
    </>
  )
}

/** The pill's height, screen px. */
const NOTE_H = 19

/** The note on a textile: a faint cross from corner to corner, and the pill along the rising diagonal (textileNote.ts). */
function NoteMark({ x, y, w, h, note, u }: { x: number; y: number; w: number; h: number; note: TextileNote; u: number }) {
  const clip = useId()
  if (w <= 0 || h <= 0) return null
  const ph = NOTE_H * u
  const k = { pad: NOTE_PILL.pad * ph, icon: NOTE_PILL.icon * ph, gap: NOTE_PILL.gap * ph, font: NOTE_PILL.font * ph }
  const pw = 2 * k.pad + k.icon + k.gap + textPx(note.text, NOTE_PILL.font * NOTE_H, EM.ui) * u
  const cross = { stroke: INK_MUTED, strokeOpacity: 0.3, strokeWidth: u }
  return (
    <g pointerEvents="none">
      <clipPath id={clip}>
        <rect x={x} y={y} width={w} height={h} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <line x1={x} y1={y} x2={x + w} y2={y + h} {...cross} />
        <line x1={x} y1={y + h} x2={x + w} y2={y} {...cross} />
        <g transform={`translate(${x + w / 2} ${y + h / 2}) rotate(${noteAngle(w, h)})`}>
          <rect x={-pw / 2} y={-ph / 2} width={pw} height={ph} rx={ph / 2} fill={SURFACE} fillOpacity={0.9} />
          <g transform={`translate(${-pw / 2 + k.pad} ${-k.icon / 2}) scale(${k.icon / 24})`} fill="none" stroke={INK_MUTED} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {NOTE_ICON[note.icon].map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <text x={-pw / 2 + k.pad + k.icon + k.gap} y={0} dominantBaseline="central" style={{ font: `500 ${k.font}px var(--font-ui)`, fill: INK_MUTED }}>
            {note.text}
          </text>
        </g>
      </g>
    </g>
  )
}
