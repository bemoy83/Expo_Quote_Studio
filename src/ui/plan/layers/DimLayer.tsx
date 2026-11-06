// Dimension chains in the plan, in millimetres (docs/arbeidstegning.md, «Mål»). What is measured comes from
// plan/dims.ts; the chains are drawn by plan/DimChain.tsx, shared with the wall drawing.
import type { Variant } from '../../../domain/types'
import type { PlanSelection } from '../selection'
import { sizePx, usePlanScale, type PlanScale } from '../planScale'
import { DIM_NEAR, DIM_TOTAL, planDims, sideLine, type InnerChain } from '../dims'
import { Chain } from '../DimChain'
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
    </g>
  )
}

function Inner({ sc, c }: { sc: PlanScale; c: InnerChain }) {
  const half = c.clear === 'wall' ? wallWidth(sc) / 2 : c.clear === 'mounted' ? textileOffset(sc) + textileWidth(sc) / 2 : textileWidth(sc) / 2
  return <Chain sc={sc} axis={c.axis} at={c.at + c.dir * (half + sizePx(sc, DIM_NEAR))} ts={c.ts} dir={c.dir} />
}
