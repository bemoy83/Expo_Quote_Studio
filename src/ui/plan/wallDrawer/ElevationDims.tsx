// Dimensions on the wall drawing (docs/arbeidstegning.md, «Veggrisset»): the heading with where each end points and
// the wall's total under it, and what the drawer is open for (Bjørn 6.11.2026). The wall: its module chain and its
// heights to the left; while print is laid on it, its lysmål instead. A textile frame, decal or print (`items`): its placement row over the wall from each end, its
// height row to the right and a hairline leader up to its product type; no module chain or wall heights. Chains are drawn as in the plan
// (plan/DimChain.tsx); sizes are screen px through the drawing's scale. What is measured: elevationMeasure.ts.
import type { Wall } from '../../../domain/types'
import type { FaceSide } from '../../../domain/faces'
import { rules } from '../../env'
import { INK_MUTED } from '../../colors'
import { Chain } from '../DimChain'
import { EM, sizePx, textPx, type PlanScale } from '../planScale'
import { DIM_NEAR as NEAR, DIM_TOTAL as TOTAL } from '../dims'
import { LEADER_FONT, LEADER_LINE, lysmal, row, type ElevationItem, type Leader } from './elevationMeasure'
import { elevationHeading } from './face'

/** Heading size, screen px. */
const HEAD_FONT = 11.5

export function ElevationDims({ w, s, name, L, H, items, leaders, top, width, sc, fields }: { w: Wall; s: FaceSide; name: string; L: number; H: number; items: ElevationItem[]; leaders: Leader[]; top: number; width: number; sc: PlanScale; fields?: number[] }) {
  const px = (n: number) => sizePx(sc, n)
  const head = elevationHeading(w, s, name)
  const modules = Array.from({ length: Math.round(L) + 1 }, (_, i) => i)
  const wall = rules.wall.height
  const decor = items.length > 0
  // Physical ends (Bjørn 6.11.2026): the outside of the end posts, half a post past the centres the wall is drawn
  // between, so the row over the wall adds up to the total (6 040 for a 6 000 c/c wall)
  const half = rules.wall.post / 2
  const outer: [number, number] = [-half, L + half]
  const along = row(outer, items.flatMap((i) => [i.x0, i.x1]))
  const heights = row([0, H], items.flatMap((i) => [H - i.top, H - i.bottom]))
  // Lysmål (Bjørn 6.11.2026), while print is laid on the wall: what shows of each plate between the posts' lips and
  // the rails, 960 × 2 420, standing 80 and 2 500 over the floor
  const lys = !decor && fields !== undefined
  const lm = lysmal(rules, fields ?? [], H)
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

      {/* Under: one module a metre centre to centre of the posts (the wall chosen), and the whole wall, physical */}
      {lys && <Chain sc={sc} axis="x" at={H + px(NEAR)} ts={lm.along} dir={1} suffix="lys" />}
      {!decor && !lys && modules.length > 2 && <Chain sc={sc} axis="x" at={H + px(NEAR)} ts={modules} dir={1} suffix="c/c" />}
      <Chain sc={sc} axis="x" at={H + px(decor ? NEAR : TOTAL)} ts={outer} dir={1} />
      {/* Left: the wall, and with its feet (the wall chosen) */}
      {lys && <Chain sc={sc} axis="y" at={-px(NEAR)} ts={lm.heights} dir={-1} />}
      {lys && <Chain sc={sc} axis="y" at={-px(TOTAL)} ts={[lm.heights[0], H]} dir={-1} suffix="fra gulv" />}
      {!decor && !lys && <Chain sc={sc} axis="y" at={-px(NEAR)} ts={[0, wall]} dir={-1} suffix="vegg" />}
      {!decor && !lys && <Chain sc={sc} axis="y" at={-px(TOTAL)} ts={[0, H]} dir={-1} suffix="med føtter" />}

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
