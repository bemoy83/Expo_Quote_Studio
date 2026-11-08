// Dimensions on the wall drawing (docs/arbeidstegning.md, «Veggrisset»): the heading with where each end points, the
// wall's physical total under it, and what the drawer is open for (Bjørn 6.11.2026):
// - the wall: its module chain (c/c) under it and its heights to the left;
// - the wall with print being laid on it: its lysmål instead, what shows of each plate;
// - a textile frame, decal or print (`items`): its placement row over the wall from each end, its height row to the
//   right and a hairline leader up to its product type; a frame also its brace chain under the wall (the distance
//   between its uprights) and its size in the leader (Bjørn 8.11.2026).
// Chains are drawn as in the plan (plan/DimChain.tsx); sizes are screen px through the drawing's scale. What is
// measured: elevationMeasure.ts.
import type { Wall } from '../../../domain/types'
import type { FaceSide } from '../../../domain/faces'
import { physicalEnds } from '../../../domain/walls'
import { rules } from '../../env'
import { INK_MUTED } from '../../colors'
import { Chain } from '../DimChain'
import { EM, sizePx, textPx, type PlanScale } from '../planScale'
import { DIM_NEAR as NEAR, DIM_TOTAL as TOTAL } from '../dims'
import { LEADER_FONT, LEADER_LINE, lysmal, row, type ElevationItem, type Leader } from './elevationMeasure'
import { elevationHeading } from './face'

/** Heading size, screen px. */
const HEAD_FONT = 11.5

export function ElevationDims({ w, s, name, L, H, items, leaders, top, width, right, sc, fields }: { w: Wall; s: FaceSide; name: string; L: number; H: number; items: ElevationItem[]; leaders: Leader[]; top: number; width: number; /** The drawing's right edge, x: a leader text that would run past it goes to the left of its line. */ right: number; sc: PlanScale; /** Print being laid on the wall: where each plate field starts, for its lysmål. */ fields?: number[] }) {
  const px = (n: number) => sizePx(sc, n)
  const head = elevationHeading(w, s, name)
  const modules = Array.from({ length: Math.round(L) + 1 }, (_, i) => i)
  const wall = rules.wall.height
  const mode = items.length > 0 ? 'item' : fields ? 'lys' : 'wall'
  // From the outside of the end posts, so the row over the wall adds up to the total (6 040 for a 6 000 c/c wall)
  const outer = physicalEnds(rules, L)
  const along = row(outer, items.flatMap((i) => [i.x0, i.x1]))
  const heights = row([0, H], items.flatMap((i) => [H - i.top, H - i.bottom]))
  // 960 × 2 420 a plate, standing 80 and 2 500 over the floor
  const lm = lysmal(rules, fields ?? [], H)
  const uprights = items.find((i) => i.uprights)?.uprights
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

      {/* Under: the module chain or the lysmål, and the whole wall */}
      {mode === 'wall' && modules.length > 2 && <Chain sc={sc} axis="x" at={H + px(NEAR)} ts={modules} dir={1} suffix="c/c" />}
      {mode === 'lys' && <Chain sc={sc} axis="x" at={H + px(NEAR)} ts={lm.along} dir={1} suffix="lys" />}
      {mode === 'item' && uprights && <Chain sc={sc} axis="x" at={H + px(NEAR)} ts={uprights} dir={1} suffix="stag" />}
      <Chain sc={sc} axis="x" at={H + px(mode === 'item' && !uprights ? NEAR : TOTAL)} ts={outer} dir={1} />
      {/* Left: the wall's heights, or the visible field's */}
      {mode === 'wall' && (
        <>
          <Chain sc={sc} axis="y" at={-px(NEAR)} ts={[0, wall]} dir={-1} suffix="vegg" />
          <Chain sc={sc} axis="y" at={-px(TOTAL)} ts={[0, H]} dir={-1} suffix="med føtter" />
        </>
      )}
      {mode === 'lys' && (
        <>
          <Chain sc={sc} axis="y" at={-px(NEAR)} ts={lm.heights} dir={-1} />
          <Chain sc={sc} axis="y" at={-px(TOTAL)} ts={[lm.heights[0], H]} dir={-1} suffix="fra gulv" />
        </>
      )}

      {mode === 'item' && (
        <>
          <Chain sc={sc} axis="x" at={rowY} ts={along} dir={-1} />
          <Chain sc={sc} axis="y" at={L + px(NEAR)} ts={heights} dir={1} />
          {leaders.map((l, i) => {
            const y = textY(l)
            // To the left of its line when it would run past the drawing's right edge
            const flip = l.x + px(6 + textPx(l.text, LEADER_FONT)) > right
            const d = flip ? -1 : 1
            return (
              <g key={i} stroke={INK_MUTED} strokeWidth={px(0.6)}>
                <circle cx={l.x} cy={l.y} r={px(1.6)} fill={INK_MUTED} stroke="none" />
                <path d={`M${l.x} ${l.y} V${y - px(3.5)} h${d * px(4)}`} fill="none" />
                <text x={l.x + d * px(6)} y={y} textAnchor={flip ? 'end' : 'start'} stroke="none" style={mono}>
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
 * Dimensions on the drawing of a free-standing textile wall, as on the wall drawing: the heading, the distance between
 * the frame's uprights over it (ends, braces), where the feet stand and the whole length under it, the frame's height to
 * the left.
 */
export function FreeElevationDims({ title, W, H, feet, braces, top, sc }: { title: string; W: number; H: number; feet: number[]; braces: number[]; top: number; sc: PlanScale }) {
  const px = (n: number) => sizePx(sc, n)
  const along = row([0, W], feet)
  const uprights = row([0, W], braces)
  return (
    <g pointerEvents="none">
      <text x={W / 2} y={top + px(14)} textAnchor="middle" style={{ font: `500 ${px(HEAD_FONT)}px var(--font-ui)`, fill: INK_MUTED }}>
        {title}
      </text>
      {uprights.length > 2 && <Chain sc={sc} axis="x" at={-px(NEAR)} ts={uprights} dir={-1} suffix="stag" />}
      {along.length > 2 && <Chain sc={sc} axis="x" at={H + px(NEAR)} ts={along} dir={1} />}
      <Chain sc={sc} axis="x" at={H + px(TOTAL)} ts={[0, W]} dir={1} />
      <Chain sc={sc} axis="y" at={-px(NEAR)} ts={[0, H]} dir={-1} suffix="ramme" />
    </g>
  )
}
