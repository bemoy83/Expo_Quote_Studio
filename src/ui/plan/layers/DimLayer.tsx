// Dimension chains in the plan, in millimetres (docs/arbeidstegning.md, «Mål»). What is measured comes from
// plan/dims.ts; the chains are drawn by plan/DimChain.tsx, shared with the wall drawing.
import type { Variant } from '../../../domain/types'
import type { PlanSelection } from '../selection'
import { sizePx, usePlanScale, type PlanScale } from '../planScale'
import { counterChains, DIM_NEAR, DIM_TOTAL, planDims, sideLine, type InnerChain } from '../dims'
import { objectBoxes } from '../../../domain/objects'
import { Chain } from '../DimChain'
import { isCounter, place, rules } from '../../env'
import { textileOffset, textileWidth, wallWidth } from '../planStyle'

/** All dimension chains for the current selection. */
export function DimLayer({ v, selection }: { v: Variant; selection: PlanSelection }) {
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
      <CounterDims sc={sc} v={v} selection={selection} />
    </g>
  )
}

/** A chosen counter: its length under it and its depth left of it, each arm of an L on its own (K7). */
function CounterDims({ sc, v, selection }: { sc: PlanScale; v: Variant; selection: PlanSelection }) {
  const o = selection.objectId ? v.objects.find((x) => x.id === selection.objectId) : undefined
  const c = o && isCounter(o.product) ? counterChains(objectBoxes(place, o)) : null
  if (!c) return null
  const off = sizePx(sc, DIM_NEAR)
  return (
    <>
      <Chain sc={sc} axis="x" at={c.y1 + off} ts={c.x.map(r3)} dir={1} />
      <Chain sc={sc} axis="y" at={c.x0 - off} ts={c.y.map(r3)} dir={-1} />
    </>
  )
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

function Inner({ sc, c }: { sc: PlanScale; c: InnerChain }) {
  // A shelf's chain stands beyond its board: half a post out from the line, then the board's depth
  const half = c.clear === 'shelf' ? rules.wall.post / 2 + rules.shelf.board.depth : c.clear === 'wall' ? wallWidth(sc) / 2 : c.clear === 'mounted' ? textileOffset(sc) + textileWidth(sc) / 2 : textileWidth(sc) / 2
  return <Chain sc={sc} axis={c.axis} at={c.at + c.dir * (half + sizePx(sc, DIM_NEAR))} ts={c.ts} dir={c.dir} />
}
