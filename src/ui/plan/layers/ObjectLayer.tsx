// Furniture in the plan. A counter (Byggeregel K1) is drawn in its plates' colour (K6) with one outline round it, solid
// where it is closed and dashed where it is open (the back, the inside of an L), and a line where two parts meet
// (CounterLines.tsx).
import { useId } from 'react'
import { mainGroupOf } from '../../../catalog/groups'
import { lockedParts, placedBuild } from '../../../domain/podiumLocks'
import { lightsOf, partKey, podiumParts } from '../../../domain/podiumFaces'
import { toPlan } from '../../../domain/counterShape'
import { RECIPES } from '../../../foga/recipes'
import { counterRal, footprintBox, objectBoxes, objectFootprint } from '../../../domain/objects'
import type { PlacedObject, Variant } from '../../../domain/types'
import { BLOCK, INK } from '../../colors'
import { idx, place, plateColor, productOf } from '../../env'
import { linePx, usePlanScale } from '../planScale'
import type { Layer, Tool } from '../../tools'
import type { PlanSelection } from '../selection'
import { counterOutline } from '../counterOutline'
import { COUNTER_EDGE, DIMMED, HALO, HALO_OPACITY, outlineHalo } from '../planStyle'
import { CounterLines } from './CounterLines'
import { GONE_FILL, useErasing } from './erasing'

/** Furniture by its footprint; one that collides is outlined in red. */
export function ObjectLayer(props: {
  v: Variant
  selection: PlanSelection
  tool: Tool
  /** Objects that collide with a wall or each other. */
  bad: Set<string>
  dim: (...layers: Layer[]) => number
  /** A main product group the panel has hidden. */
  off: (group: string) => boolean
}) {
  const { v, selection, tool, bad, dim, off } = props
  const { gone, hatch } = useErasing()
  const sc = usePlanScale()
  return (
    <g opacity={dim('objects')}>
      {v.objects.map((o) => {
        const f = objectFootprint(place, o)
        const counter = productOf(o.product)?.counter
        // A counter in its plates' colour (K6), other furniture in its own
        const col = counter ? plateColor(counterRal(o)) : (idx.byArtnr.get(o.product)?.variant.color ?? 'oklch(0.3 0.004 250)')
        if (!f) return null
        const isBad = bad.has(o.id)
        const sel = selection.objectId === o.id
        const stroke = isBad ? BLOCK : INK
        // A thin ink edge round the furniture's own colour (Bjørn 04.11.2026), red and heavier when colliding; chosen is
        // the plan's halo round it, as for walls, takdrager, textile and shelves (Bjørn 12.11.2026)
        const sw = isBad ? Math.max(0.06, linePx(sc, 2)) : linePx(sc, 0.75)
        const halo = { fill: 'none', stroke: HALO, strokeWidth: outlineHalo(sc) }
        const g = gone('object', o.id)
        const op = off(mainGroupOf(productOf(o.product)?.group)) ? DIMMED : undefined
        // A counter (K1, K7): one shape round all its pieces, closed sides solid, open sides dashed (CounterShape)
        if (counter)
          return (
            <g key={o.id}>
              <CounterShape v={v} o={o} fill={col} stroke={stroke} bad={isBad} sel={sel} gone={g ? hatch : null} opacity={op} />
              <CounterLines b={placedBuild(v, place, o, counter)} at={o} divide={linePx(sc, 0.75)} opacity={op} />
            </g>
          )
        const b = footprintBox(o, f)
        const shape = (fill: string, props: object) =>
          f.round ? (
            <circle cx={o.x} cy={o.y} r={f.w / 2} fill={fill} {...props} />
          ) : (
            <rect x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} rx={0.03} fill={fill} {...props} />
          )
        return (
          <g key={o.id}>
            {sel && shape('none', { ...halo, strokeOpacity: HALO_OPACITY })}
            {shape(col, { stroke, strokeWidth: sw, opacity: op, fillOpacity: g ? GONE_FILL : undefined, style: { cursor: tool === 'select' && f.round ? 'move' : undefined } })}
            {g && shape(hatch, {})}
          </g>
        )
      })}
    </g>
  )
}

/**
 * A counter seen from above (Byggeregler K7, K8): its plates' colour over all its pieces, one halo round them when
 * chosen, and one outline round the whole counter (counterOutline): solid along the closed sides, a faint hairline along
 * the open ones (Bjørn 13.11.2026). Both strokes lie inside the outer edge, so the counter is drawn no
 * wider than it is: each is twice as wide and clipped to the counter.
 */
function CounterShape({ v, o, fill, stroke, bad, sel, gone, opacity }: { v: Variant; o: PlacedObject; fill: string; stroke: string; bad: boolean; sel: boolean; gone: string | null; opacity?: number }) {
  const sc = usePlanScale()
  const clip = `counter${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const boxes = objectBoxes(place, o)
  const locked = lockedParts(v, place, o)
  const each = (props: object) => boxes.map((r, i) => <rect key={i} x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0} {...props} />)
  const closed = bad ? Math.max(0.03, linePx(sc, 2)) : linePx(sc, COUNTER_EDGE.closed)
  const open = linePx(sc, COUNTER_EDGE.open)
  return (
    <g opacity={opacity}>
      <defs>
        <clipPath id={clip}>{each({})}</clipPath>
      </defs>
      {sel && <g opacity={HALO_OPACITY}>{each({ fill: 'none', stroke: HALO, strokeWidth: outlineHalo(sc) })}</g>}
      {each({ fill, fillOpacity: gone ? GONE_FILL : undefined })}
      {gone && each({ fill: gone })}
      <g clipPath={`url(#${clip})`}>
        <DoorMarks o={o} locked={locked} stroke={stroke} />
        {counterOutline(place, o, locked).map((s, i) => (
          <line key={i} x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke={stroke} strokeWidth={2 * (s.open ? open : closed)} strokeOpacity={s.open ? COUNTER_EDGE.openOpacity : undefined} />
        ))}
      </g>
    </g>
  )
}

/** A sliding door in a side of Disker og podier seen from above (K17): its two leaves as two lines just inside the outer
 *  face, overlapping in the middle. */
function DoorMarks({ o, locked, stroke }: { o: PlacedObject; locked: readonly string[]; stroke: string }) {
  const sc = usePlanScale()
  if (!o.sections?.some((s) => s.sides)) return null
  const off = new Set(locked)
  const doors = podiumParts(o.sections).filter((p) => lightsOf(o.sections!, p).includes('door') && !off.has(partKey(p)))
  const { face, door } = RECIPES.counter
  return (
    <g stroke={stroke} strokeWidth={linePx(sc, 0.75)}>
      {doors.flatMap((p) => {
        const mid = (p.a + p.b) / 2
        const leaf = (a: number, b: number, inset: number) => {
          const at = p.at + p.out * (face - inset)
          const [u, w] = p.axis === 'x' ? [toPlan(o, [at, a]), toPlan(o, [at, b])] : [toPlan(o, [a, at]), toPlan(o, [b, at])]
          return <line key={`${partKey(p)}${inset}`} x1={u[0]} y1={u[1]} x2={w[0]} y2={w[1]} />
        }
        return [leaf(p.a + 20, mid + door.overlap * 3, 30), leaf(mid - door.overlap * 3, p.b - 20, 55)]
      })}
    </g>
  )
}
