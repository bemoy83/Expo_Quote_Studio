// Dimension chains in the plan, in millimetres (docs/arbeidstegning.md, «Mål»). What is measured comes from
// plan/dims.ts; the chains are drawn by plan/DimChain.tsx, shared with the wall drawing.
import type { Variant } from '../../../domain/types'
import type { PlanSelection } from '../selection'
import { sizePx, usePlanScale, type PlanScale } from '../planScale'
import { counterChains, counterDimSides, DIM_NEAR, DIM_TOTAL, planDims, sideLine, type InnerChain } from '../dims'
import { objectBoxes } from '../../../domain/objects'
import { wallOffsets } from '../../../domain/wallOffsets'
import { builtModules } from '../../../domain/walls'
import { stockOf } from '../../../domain/podiumStock'
import { Chain } from '../DimChain'
import { mainGroupOf } from '../../../catalog/groups'
import { isCounter, place, productOf, rules } from '../../env'
import { textileOffset, textileWidth, wallWidth } from '../planStyle'

/** All dimension chains for the current selection. */
export function DimLayer({ v, selection, counters, walls, off }: { v: Variant; selection: PlanSelection; counters?: boolean; /** The measures of the walls off the metre lines (V12), on the work order. */ walls?: boolean; off?: (group: string) => boolean }) {
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
      {walls && !off?.('vegg') && <WallOffsets sc={sc} v={v} />}
    </g>
  )
}

/** Byggeregel V12: a wall off the metre lines measured out from the nearest wall or stand edge, only what is not a whole
 *  metre, on the work order, since the montør reads it there (Bjørn 14.11.2026). Each chain just off the line it
 *  measures, toward the stand's middle. */
function WallOffsets({ sc, v }: { sc: PlanScale; v: Variant }) {
  const centre = [v.stand.width / 2, v.stand.depth / 2]
  // Just off the line, so a measure along a wall is not drawn on it
  const clear = sizePx(sc, DIM_NEAR)
  return wallOffsets(v.stand, v.walls, builtModules(v)).map((o) => {
    // Along x when the two ends share their y
    const k = Math.abs(o.from[1] - o.to[1]) < 1e-6 ? 1 : 0
    const at = o.from[k]
    const dir: 1 | -1 = centre[k] >= at ? 1 : -1
    const ts = [o.from[1 - k], o.to[1 - k]].sort((a, b) => a - b)
    return <Chain key={`${o.from}|${o.to}`} sc={sc} axis={k === 1 ? 'x' : 'y'} at={at + dir * clear} ts={ts} dir={dir} keep />
  })
}

/** A counter's whole outer width and depth (K8), each on the side toward the stand's middle: the chosen one in the
 *  plan, and on the work order (`all`) every one built on site, since the montør reads them there (Bjørn 12.11.2026);
 *  a standard counter none (K22). */
function CounterDims({ sc, v, selection, all, off }: { sc: PlanScale; v: Variant; selection: PlanSelection; all?: boolean; off?: (group: string) => boolean }) {
  // On a work order filtered to other groups, the dimmed counters get no measures
  const shown = v.objects.filter((o) => isCounter(o.product) && (all ? !!o.sections && !stockOf(o.sections) && !off?.(mainGroupOf(productOf(o.product)?.group)) : o.id === selection.objectId))
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
