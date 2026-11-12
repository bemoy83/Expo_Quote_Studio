// Dimension chains in the plan, in millimetres (docs/arbeidstegning.md, «Mål»). What is measured comes from
// plan/dims.ts; the chains are drawn by plan/DimChain.tsx, shared with the wall drawing.
import type { Variant } from '../../../domain/types'
import type { PlanSelection } from '../selection'
import { sizePx, usePlanScale, type PlanScale } from '../planScale'
import { counterChains, counterDimSides, DIM_NEAR, DIM_TOTAL, planDims, sideLine, type InnerChain } from '../dims'
import { objectBoxes } from '../../../domain/objects'
import { Chain } from '../DimChain'
import { mainGroupOf } from '../../../catalog/groups'
import { isCounter, place, productOf, rules } from '../../env'
import { textileOffset, textileWidth, wallWidth } from '../planStyle'

/** All dimension chains for the current selection. */
export function DimLayer({ v, selection, counters, off }: { v: Variant; selection: PlanSelection; counters?: boolean; off?: (group: string) => boolean }) {
  const sc = usePlanScale()
  const dims = planDims(v, selection, sc.detail === 'compact')
  return (
    <g pointerEvents="none">
      {dims.sides.map(({ side, near, total }) => {
        const line = sideLine(v, side)
        const at = (px: number) => line.at + line.out * sizePx(sc, px)
        return (
          <g key={side}>
            {near.length > 2 && <Chain sc={sc} axis={line.axis} at={at(DIM_NEAR)} ts={near} dir={line.out} />}
            <Chain sc={sc} axis={line.axis} at={at(DIM_TOTAL)} ts={total} dir={line.out} />
          </g>
        )
      })}
      {dims.inner && <Inner sc={sc} c={dims.inner} />}
      <CounterDims sc={sc} v={v} selection={selection} all={counters} off={off} />
    </g>
  )
}

/** A counter's whole outer width and depth (K7), each on the side toward the stand's middle: the chosen one in the plan, and on the work order
 *  (`all`) every drawn one, since the montør builds those on site (Bjørn 12.11.2026). */
function CounterDims({ sc, v, selection, all, off }: { sc: PlanScale; v: Variant; selection: PlanSelection; all?: boolean; off?: (group: string) => boolean }) {
  // On a work order filtered to other groups, the dimmed counters get no measures
  const shown = v.objects.filter((o) => isCounter(o.product) && (all ? !!o.pieces && !off?.(mainGroupOf(productOf(o.product)?.group)) : o.id === selection.objectId))
  const gap = sizePx(sc, DIM_NEAR)
  return shown.map((o) => {
    const c = counterChains(objectBoxes(place, o))
    if (!c) return null
    const { dx, dy } = counterDimSides(v, c)
    return (
      c && (
        <g key={o.id}>
          <Chain sc={sc} axis="x" at={dy > 0 ? c.y[1] + gap : c.y[0] - gap} ts={c.x.map(r3)} dir={dy} keep={all} />
          <Chain sc={sc} axis="y" at={dx > 0 ? c.x[1] + gap : c.x[0] - gap} ts={c.y.map(r3)} dir={dx} keep={all} />
        </g>
      )
    )
  })
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

function Inner({ sc, c }: { sc: PlanScale; c: InnerChain }) {
  // A shelf's chain stands beyond its board: half a post out from the line, then the board's depth
  const half = c.clear === 'shelf' ? rules.wall.post / 2 + rules.shelf.board.depth : c.clear === 'wall' ? wallWidth(sc) / 2 : c.clear === 'mounted' ? textileOffset(sc) + textileWidth(sc) / 2 : textileWidth(sc) / 2
  return <Chain sc={sc} axis={c.axis} at={c.at + c.dir * (half + sizePx(sc, DIM_NEAR))} ts={c.ts} dir={c.dir} />
}
