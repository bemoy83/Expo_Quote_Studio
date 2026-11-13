// A side of a counter of Disker og podier seen from outside (trinn 2): its posts, rails and parts, each a plate in the
// counter's colour, open to the inside (Byggeregel K16) or a sliding door (K17), the chosen part toned; under it the parts' outer lengths and
// the whole, to the left its height (CC and outer). A click on a part chooses it, a click on the chosen part goes back to
// the whole side. On top of each section a grip «CC 750»: dragged up or down it sets the section's height on the
// 250 grid (Byggeregel K18), shown live and set on release.
import { useRef, useState, type PointerEvent } from 'react'
import { HEIGHTS } from '../../../domain/podiums'
import { RECIPES } from '../../../foga/recipes'
import { ALU, ALU_POST, BORDER_STRONG, INK, INK_MUTED, SUNKEN, SURFACE } from '../../colors'
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
  /** The section `section` (index in the counter) dragged to CC `h`. */
  onHeight?: (section: number, h: number) => void
}

interface Drag {
  section: number
  /** CC at the start and now, mm; where the pointer started, m in the drawing. */
  h0: number
  h: number
  y0: number
}

/** The nearest height on the grid (K18). */
const snap = (mm: number) => HEIGHTS.reduce((a, b) => (Math.abs(b - mm) < Math.abs(a - mm) ? b : a))

export function PodiumElevation({ parts: given, length, h: hTop, title, fill, chosen, onPick, onHeight }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const size = useElementSize(box, true)
  const [drag, setDrag] = useState<Drag | null>(null)
  // While a top is dragged its section is drawn at the new height, in a frame as high as the highest one (no rescaling)
  const parts = drag ? given.map((p) => (p.part.section === drag.section ? { ...p, h: drag.h } : p)) : given
  const h = drag ? Math.max(...parts.map((p) => p.h)) : hTop
  const L = length / 1000
  const H = ((drag ? HEIGHTS[HEIGHTS.length - 1] : h) + R.railHeight) / 1000
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
  // One grip per section on this side, over the middle of its parts
  const tops = [...new Set(parts.map((p) => p.part.section))].map((section) => {
    const ps = parts.filter((p) => p.part.section === section)
    return { section, h: ps[0].h, x: x((Math.min(...ps.map((p) => p.x0)) + Math.max(...ps.map((p) => p.x1))) / 2), y: top(ps[0]) }
  })
  const svgY = (e: PointerEvent) => {
    const m = svg.current?.getScreenCTM()
    return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()).y : 0
  }
  const grip = (t: (typeof tops)[number]) => {
    const w = px(44)
    const gh = px(16)
    return (
      <g
        key={`g${t.section}`}
        style={{ cursor: 'ns-resize', touchAction: 'none' }}
        aria-label={`Dra for høyden, CC ${t.h}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation()
          ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
          setDrag({ section: t.section, h0: t.h, h: t.h, y0: svgY(e) })
        }}
        onPointerMove={(e) => {
          if (!drag) return
          const next = snap(drag.h0 + (drag.y0 - svgY(e)) * 1000)
          if (next !== drag.h) setDrag({ ...drag, h: next })
        }}
        onPointerUp={() => {
          if (drag && drag.h !== drag.h0) onHeight?.(drag.section, drag.h)
          setDrag(null)
        }}
        onPointerCancel={() => setDrag(null)}
      >
        <rect x={t.x - w / 2} y={t.y - gh / 2} width={w} height={gh} rx={gh / 2} style={{ fill: drag?.section === t.section ? INK : SURFACE, filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.25))' }} />
        <text x={t.x} y={t.y} textAnchor="middle" dominantBaseline="central" className="num" style={{ font: `500 ${px(9.5)}px var(--font-ui)`, fill: drag?.section === t.section ? SURFACE : INK }} pointerEvents="none">
          {`CC ${t.h}`}
        </text>
      </g>
    )
  }
  return (
    <div className="wd-view">
      <div ref={box} className="wd-fit">
        <svg ref={svg} className="wd-svg" viewBox={view.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${title}, ${length} mm`}>
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
          {onHeight && tops.map(grip)}
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
