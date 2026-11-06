// Velg: what a click would select, marked faintly under the pointer (on touch while the press is held), so a wall can
// be told from the textile walls on its faces before the click (Bjørn 6.11.2026). A shade of ink over the thing
// itself, at its own width, so the wall's mark never covers the textile beside it; nothing for what is already selected.
import { faceSegment, sideOf } from '../../../domain/faces'
import { laneAt } from '../../../domain/floor/edit'
import { fillTilesOf } from '../../../domain/floor/rollFill'
import { CELL } from '../../../domain/grid'
import { footprintBox } from '../../../domain/objects'
import type { BuiltModule } from '../../../domain/walls'
import type { ReactNode } from 'react'
import type { Point, Variant } from '../../../domain/types'
import { INK } from '../../colors'
import { productOf, rules } from '../../env'
import { usePlanScale } from '../planScale'
import { beamBody, textileOffset, textileWidth, wallWidth } from '../planStyle'
import { selectionKey, type PlanSelection } from '../selection'

/** How strong the mark is: a shade of ink over the thing's own width, it only says «this one». */
const PICK_OPACITY = 0.28

export function PickLayer({ v, mods, picked, selection }: { v: Variant; mods: BuiltModule[]; picked: PlanSelection | null; selection: PlanSelection }) {
  const sc = usePlanScale()
  if (!picked) return null
  const key = selectionKey(picked)
  if (!key || key === selectionKey(selection)) return null
  const band = (a: Point, b: Point, width: number) => (
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK} strokeOpacity={PICK_OPACITY} strokeWidth={width} />
  )
  const cells = (ts: { i: number; j: number; w: number; h: number }[]) =>
    ts.map((t) => <rect key={`${t.i},${t.j}`} x={t.i * CELL} y={t.j * CELL} width={t.w * CELL} height={t.h * CELL} fill={INK} fillOpacity={PICK_OPACITY / 2} />)
  const shape = (): ReactNode => {
    // A door or curtain: its module of the wall
    const om = picked.openingId ? mods.find((m) => m.opening?.id === picked.openingId) : undefined
    if (om) return band(om.a, om.b, wallWidth(sc))
    const ib = picked.beamId ? (v.innerBeams ?? []).find((b) => b.id === picked.beamId) : undefined
    if (ib) return band(ib.from, ib.to, beamBody(sc, rules.beam.thickness))
    // Engangsteppe: the whole fill, or the lane on its own
    if (picked.fill) return cells(fillTilesOf(v, picked.fill))
    const lane = picked.lane ? laneAt(v, picked.lane.i, picked.lane.j) : undefined
    if (lane) return cells([lane])
    const t = picked.textileId ? v.textiles.find((x) => x.id === picked.textileId) : undefined
    const tw = t && v.walls.find((w) => w.id === t.wallId)
    if (t && tw) {
      const [a, b] = faceSegment(tw, sideOf(v, t), t.from, t.from + t.width, textileOffset(sc))
      return band(a, b, textileWidth(sc))
    }
    const ft = picked.freeTextileId ? v.freeTextiles.find((x) => x.id === picked.freeTextileId) : undefined
    if (ft) return band(ft.from, ft.to, textileWidth(sc))
    const o = picked.objectId ? v.objects.find((x) => x.id === picked.objectId) : undefined
    const f = o && productOf(o.product)?.footprint
    if (o && f) {
      const r = footprintBox(o, f)
      return <rect x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0} fill={INK} fillOpacity={PICK_OPACITY} />
    }
    const room = picked.roomId ? v.rooms.find((r) => r.id === picked.roomId) : undefined
    if (room) return <polygon points={room.outline.map((p) => p.join(',')).join(' ')} fill={INK} fillOpacity={PICK_OPACITY / 2} />
    const w = picked.wallId ? v.walls.find((x) => x.id === picked.wallId) : undefined
    if (w) return band(w.from, w.to, wallWidth(sc))
    return null
  }
  return <g pointerEvents="none">{shape()}</g>
}
