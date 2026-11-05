// Dimensions on the wall drawing (docs/arbeidstegning.md, «Veggrisset»): the heading with where each end points, the
// module chain and total under the wall, the wall heights to the left, and for textile and print a placement row over
// the wall, a height row to the right and hairline leaders up to their product type. Chains are drawn as in the plan
// (plan/DimChain.tsx); sizes are screen px through the drawing's scale. What is measured: elevationMeasure.ts.
import type { Wall } from '../../../domain/types'
import type { FaceSide } from '../../../domain/faces'
import { rules } from '../../env'
import { INK_MUTED } from '../../colors'
import { Chain } from '../DimChain'
import { EM, sizePx, textPx, type PlanScale } from '../planScale'
import { DIM_NEAR as NEAR, DIM_TOTAL as TOTAL } from '../dims'
import { LEADER_FONT, LEADER_LINE, row, type ElevationItem, type Leader } from './elevationMeasure'
import { elevationHeading } from './face'

/** Heading size, screen px. */
const HEAD_FONT = 11.5

export function ElevationDims({ w, s, name, L, H, items, leaders, top, width, sc }: { w: Wall; s: FaceSide; name: string; L: number; H: number; items: ElevationItem[]; leaders: Leader[]; top: number; width: number; sc: PlanScale }) {
  const px = (n: number) => sizePx(sc, n)
  const head = elevationHeading(w, s, name)
  const modules = Array.from({ length: Math.round(L) + 1 }, (_, i) => i)
  const wall = rules.wall.height
  const decor = items.length > 0
  const along = row([0, L], items.flatMap((i) => [i.x0, i.x1]))
  const heights = row([0, H], items.flatMap((i) => [H - i.top, H - i.bottom]))
  const rowY = -px(NEAR)
  const textY = (l: Leader) => rowY - px(NEAR + 14) - l.level * px(LEADER_LINE)
  const mono = { font: `500 ${px(LEADER_FONT)}px var(--font-numeric)`, fill: INK_MUTED }
  // The heading as wide as the drawing allows: the ends alone on a narrow wall (the drawer's title names the wall)
  const ends = `← ${head.left}\u00a0\u00a0\u00a0${head.right} →`
  const full = px(textPx(`${head.title} · `, HEAD_FONT, EM.head) + textPx(ends, LEADER_FONT)) < width - px(12)
  return (
    <g pointerEvents="none">
      <text x={L / 2} y={top + px(14)} textAnchor="middle" style={{ font: `500 ${px(HEAD_FONT)}px var(--font-ui)`, fill: INK_MUTED }}>
        {full && `${head.title} · `}
        <tspan style={mono}>{ends}</tspan>
      </text>

      {/* Under: one module a metre, and the whole wall */}
      {modules.length > 2 && <Chain sc={sc} axis="x" at={H + px(NEAR)} ts={modules} dir={1} />}
      <Chain sc={sc} axis="x" at={H + px(TOTAL)} ts={[0, L]} dir={1} />
      {/* Left: the wall, and with its feet */}
      <Chain sc={sc} axis="y" at={-px(NEAR)} ts={[0, wall]} dir={-1} suffix="vegg" />
      <Chain sc={sc} axis="y" at={-px(TOTAL)} ts={[0, H]} dir={-1} suffix="med føtter" />

      {decor && (
        <>
          <Chain sc={sc} axis="x" at={rowY} ts={along} dir={-1} />
          <Chain sc={sc} axis="y" at={L + px(NEAR)} ts={heights} dir={1} />
          {leaders.map((l, i) => {
            const y = textY(l)
            return (
              <g key={i} stroke={INK_MUTED} strokeWidth={px(0.6)}>
                <circle cx={l.x} cy={l.y} r={px(1.6)} fill={INK_MUTED} stroke="none" />
                <path d={`M${l.x} ${l.y} V${y - px(3.5)} h${px(4)}`} fill="none" />
                <text x={l.x + px(6)} y={y} stroke="none" style={mono}>
                  {l.text}
                </text>
              </g>
            )
          })}
        </>
      )}
    </g>
  )
}

/**
 * Dimensions on the drawing of a free-standing textile wall, as on the wall drawing: the heading, where the feet stand
 * and the whole length under it, the frame's height to the left.
 */
export function FreeElevationDims({ title, W, H, feet, top, sc }: { title: string; W: number; H: number; feet: number[]; top: number; sc: PlanScale }) {
  const px = (n: number) => sizePx(sc, n)
  const along = row([0, W], feet)
  return (
    <g pointerEvents="none">
      <text x={W / 2} y={top + px(14)} textAnchor="middle" style={{ font: `500 ${px(HEAD_FONT)}px var(--font-ui)`, fill: INK_MUTED }}>
        {title}
      </text>
      {along.length > 2 && <Chain sc={sc} axis="x" at={H + px(NEAR)} ts={along} dir={1} />}
      <Chain sc={sc} axis="x" at={H + px(TOTAL)} ts={[0, W]} dir={1} />
      <Chain sc={sc} axis="y" at={-px(NEAR)} ts={[0, H]} dir={-1} suffix="ramme" />
    </g>
  )
}
