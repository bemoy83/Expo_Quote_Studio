// A side of a counter of Disker og podier seen from outside (trinn 2): its posts, rails and parts, each a plate in the
// counter's colour, open to the inside (Byggeregel K16) or a sliding door (K17), the chosen part toned; under it the parts' outer lengths and
// the whole, to the left its height (CC and outer). A click on a part chooses it, a click on the chosen part goes back to
// the whole side.
import { useRef } from 'react'
import { RECIPES } from '../../../foga/recipes'
import { ALU, ALU_POST, BORDER_STRONG, INK, INK_MUTED, SUNKEN } from '../../colors'
import { useElementSize } from '../../useElementSize'
import { Chain } from '../DimChain'
import { DIM_NEAR as NEAR, DIM_TOTAL as TOTAL } from '../dims'
import { planScale, sizePx } from '../planScale'
import { frame } from '../wallDrawer/elevationMeasure'
import type { ElevationPart } from './podiumView'

const R = RECIPES.counter
const RAIL = R.railHeight / 1000
const POST = R.postSize / 1000
/** How far a door leaf goes past the middle, m (K17). */
const DOOR = R.door.overlap / 1000

interface Props {
  parts: ElevationPart[]
  /** Outer length and the highest CC, mm. */
  length: number
  h: number
  title: string
  fill: string
  /** The chosen part, left to right; none: the whole side. */
  chosen?: number
  onPick: (i: number | undefined) => void
}

export function PodiumElevation({ parts, length, h, title, fill, chosen, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const size = useElementSize(box, true)
  const L = length / 1000
  const H = (h + R.railHeight) / 1000
  const view = frame(size, L, H, [], { chainOver: true })
  const sc = planScale(1 / view.u, {})
  const px = (n: number) => sizePx(sc, n)
  const x = (mm: number) => mm / 1000
  // Floor at H, y down
  const top = (p: ElevationPart) => H - (p.h + R.railHeight) / 1000
  const nodes = [...new Set(parts.flatMap((p) => [p.n0, p.n1]))].sort((a, b) => a - b)
  const post = (n: number) => {
    const c = x(n)
    const x0 = Math.min(Math.max(c - POST / 2, 0), L - POST)
    // As high as the highest part it holds
    const hi = Math.max(...parts.filter((p) => Math.abs(p.n0 - n) < 1e-6 || Math.abs(p.n1 - n) < 1e-6).map((p) => p.h))
    return <rect key={`n${n}`} x={x0} y={H - (hi + R.railHeight) / 1000} width={POST} height={(hi + R.railHeight) / 1000} fill={ALU_POST} />
  }
  const chainTs = [0, ...nodes.slice(1, -1).map(x), L]
  return (
    <div className="wd-view">
      <div ref={box} className="wd-fit">
        <svg className="wd-svg" viewBox={view.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${title}, ${length} mm`}>
          {parts.map((p, i) => {
            const open = p.light === 'open' && !p.locked
            const y = top(p)
            const w = x(p.x1 - p.x0)
            return (
              <g key={p.key} style={{ cursor: 'pointer' }} onClick={() => onPick(chosen === i ? undefined : i)}>
                {/* The plate, or the inside seen through an open part (no plates between the sections, K16) */}
                <rect x={x(p.x0)} y={y} width={w} height={H - y} fill={open ? SUNKEN : fill} />
                {open && <rect x={x(p.x0)} y={y + RAIL} width={w} height={H - y - RAIL} fill={INK} fillOpacity={0.06} />}
                {/* Top rail, and the bottom rail where it is not open */}
                <rect x={x(p.x0)} y={y} width={w} height={RAIL} fill={ALU} />
                {!open && <rect x={x(p.x0)} y={H - RAIL} width={w} height={RAIL} fill={ALU} />}
                {/* K17: two leaves in the channel, overlapping in the middle */}
                {p.light === 'door' && !p.locked && (
                  <g fill="none" stroke={INK_MUTED} strokeWidth={px(0.75)}>
                    <rect x={x(p.x0) + px(3)} y={y + RAIL + px(3)} width={w / 2 + DOOR - px(3)} height={H - y - 2 * RAIL - px(6)} />
                    <rect x={x(p.x0) + w / 2 - DOOR} y={y + RAIL + px(6)} width={w / 2 + DOOR - px(3)} height={H - y - 2 * RAIL - px(12)} />
                  </g>
                )}
                {chosen === i && <rect x={x(p.x0)} y={y} width={w} height={H - y} fill={INK} fillOpacity={0.12} />}
                {open && (
                  <text x={x((p.x0 + p.x1) / 2)} y={(y + H) / 2} textAnchor="middle" dominantBaseline="middle" style={{ font: `500 ${px(10)}px var(--font-ui)`, fill: INK_MUTED }} pointerEvents="none">
                    åpen
                  </text>
                )}
              </g>
            )
          })}
          {nodes.map(post)}
          <line x1={-px(12)} y1={H} x2={L + px(12)} y2={H} stroke={BORDER_STRONG} strokeWidth={px(1)} />
          <g pointerEvents="none">
            <text x={L / 2} y={view.top + px(14)} textAnchor="middle" style={{ font: `500 ${px(11.5)}px var(--font-ui)`, fill: INK_MUTED }}>
              {title}
            </text>
            {chainTs.length > 2 && <Chain sc={sc} axis="x" at={H + px(NEAR)} ts={chainTs} dir={1} />}
            <Chain sc={sc} axis="x" at={H + px(chainTs.length > 2 ? TOTAL : NEAR)} ts={[0, L]} dir={1} />
            <Chain sc={sc} axis="y" at={-px(NEAR)} ts={[H - h / 1000, H]} dir={-1} suffix="CC" />
            <Chain sc={sc} axis="y" at={-px(TOTAL)} ts={[0, H]} dir={-1} suffix="utv." />
          </g>
        </svg>
      </div>
    </div>
  )
}
