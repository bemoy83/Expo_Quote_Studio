// What the pen's edit changes as a consequence (docs/forhandsvisning.md «Følger»): a free-standing textile wall that is
// stored as it was but built differently because of what the pen adds next to it, such as a frame that stops at a new
// inner wall (X11) and gets a smaller foot plate. The plan draws it as it will be, at full strength, rings where it
// changes and says what changes in the hint line; only what the pen itself stores is dimmed (nextArea.ts).
import { alongRun, type FreeFrame } from '../../calc/textile/free'
import { freeTextiles } from '../../domain/textile/mounts'
import type { FreeTextile, Point } from '../../domain/types'
import type { Box, PlanState } from './nextArea'

/** One consequence: the textile wall, its box in the plan, where it changes and what changes, in words. */
export interface Follow {
  id: string
  box: Box
  marks: Point[]
  text: string
}

/** Room around a free-standing textile wall: foot plates, corner posts and its label (as nextArea's FREE_PAD). */
const PAD = 0.55

const near = (p: Point, q: Point) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6
const sameJson = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y)

/** How a frame is built, as the plan draws it and the hint tells it. */
const built = (f: FreeFrame) => [f.length, f.start ?? 0, f.supports, f.foot, f.pos]

/** The free-standing textile walls stored as before whose frame the next variant builds differently. */
export function textileFollows(a: PlanState, b: PlanState): Follow[] {
  const before = new Map(freeTextiles(a.v).map((t) => [t.id, t]))
  const frameA = new Map(a.res.production.free.map((f) => [f.textileId, f]))
  const out: Follow[] = []
  for (const fb of b.res.production.free) {
    const t = freeTextiles(b.v).find((x) => x.id === fb.textileId)
    const ta = before.get(fb.textileId)
    const fa = frameA.get(fb.textileId)
    if (!t || !ta || !fa || !sameJson(t, ta) || sameJson(built(fa), built(fb))) continue
    out.push({ id: t.id, box: runBox(t), marks: marksOf(t, fa, fb), text: textOf(fa, fb) })
  }
  return out
}

function runBox(t: FreeTextile): Box {
  return {
    x0: Math.min(t.from[0], t.to[0]) - PAD,
    y0: Math.min(t.from[1], t.to[1]) - PAD,
    x1: Math.max(t.from[0], t.to[0]) + PAD,
    y1: Math.max(t.from[1], t.to[1]) + PAD,
  }
}

/** Where it changes: a frame end that moves, a foot plate that comes, goes or changes size. */
function marksOf(t: FreeTextile, fa: FreeFrame, fb: FreeFrame): Point[] {
  const marks: Point[] = []
  const add = (p: Point) => {
    if (!marks.some((q) => near(p, q))) marks.push(p)
  }
  const ends = (f: FreeFrame) => [alongRun(t, 0, f), alongRun(t, f.length, f)]
  const [a0, a1] = ends(fa)
  const [b0, b1] = ends(fb)
  if (!near(a0, b0)) add(b0)
  if (!near(a1, b1)) add(b1)
  const feet = (f: FreeFrame) => f.supports.map((at) => alongRun(t, at, f))
  const footSame = sameJson(fa.foot, fb.foot)
  const fa0 = feet(fa)
  const fb0 = feet(fb)
  for (const p of fb0) if (!footSame || !fa0.some((q) => near(p, q))) add(p)
  for (const p of fa0) if (!fb0.some((q) => near(p, q))) add(p)
  return marks
}

/** «Tekstilvegg F1 kortes 20 mm · fotplate 740 → 730». */
function textOf(fa: FreeFrame, fb: FreeFrame): string {
  const parts: string[] = []
  const d = fb.length - fa.length
  if (d < 0) parts.push(`kortes ${-d} mm`)
  if (d > 0) parts.push(`forlenges ${d} mm`)
  if (fa.supports.length !== fb.supports.length) parts.push(`fotplater ${fa.supports.length} → ${fb.supports.length}`)
  if (fa.foot.code !== fb.foot.code && (fa.supports.length || fb.supports.length)) parts.push(`fotplate ${fa.foot.code} → ${fb.foot.code}`)
  if (fa.pos !== fb.pos) parts.push(`blir ${fb.pos}`)
  if (!parts.length) parts.push('flyttes')
  return `Tekstilvegg ${fa.pos} ${parts.join(' · ')}`
}

/** The hint line: what the pen says, then what follows from it. */
export function followHint(hint: string | null, follows: readonly Follow[]): string | null {
  const said = follows.map((f) => f.text)
  return [hint, ...said].filter(Boolean).join(' · ') || null
}
