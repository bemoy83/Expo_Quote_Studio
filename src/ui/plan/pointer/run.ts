// The drawing tool of the pens that draw a straight run (Bjørn 14.11.2026: one drawing tool, one thing to learn): Vegg,
// Tekstil and Takdrager, as Disker og podier (domain/runDraw.ts, draw.ts); only what is stored differs. The pen shows
// what a click stores; a press and drag grows the module shown from there. With Shift (or «Fin») the preview stands
// still where it is, a press by an end takes hold of that end and moves it in 250 steps; Shift pressed or let go during
// a drag goes on from what is drawn. The plan shows what a release stores from the drag itself (plan/next.ts).
import { paintWalls } from '../../../domain/edit'
import { drawInnerBeam } from '../../../domain/innerBeams'
import { rebaseRun, runTo, shownModule, startRun } from '../../../domain/runDraw'
import type { Point } from '../../../domain/types'
import { pressMove, startPress } from './draw'
import { textileClick, textileRun, textileToast } from './textile'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

export type RunPress = Extract<Drag, { kind: 'run' }>

const pt = (q: P): Point => [q.x, q.y]

/** A press at q. `frozen`: where Shift froze the preview, which the press works on wherever it is; `fine`: Shift or Fin. */
export function startRunDrag(c: PointerCtx, q: P, fine: boolean, frozen: P | null): RunPress {
  const p = startPress(q, frozen)
  return { kind: 'run', ...p, run: startRun(c.v.stand, shownModule(c.v.stand, p.at), pt(q), fine) }
}

/** Shift pressed or let go since the last move (or Fin): goes on from what is drawn, at the pointer before this move. */
export function runShift(d: RunPress, fine: boolean) {
  if (d.run.fine !== fine) d.run = d.moved ? rebaseRun(d.run, pt(d.last), fine) : { ...d.run, fine }
}

/** What a release at q stores: the run drawn, or for a click the module shown. */
export const runOf = (d: RunPress, q: P): [Point, Point] => (d.moved ? runTo(d.run, pt(q)) : [d.run.shown.a, d.run.shown.b])

export const run: DragHandlers<'run'> = {
  move: (_c, d, q) => pressMove(d, q),
  up(c, d, q) {
    const [a, b] = runOf(d, q)
    const { v, brush } = c
    if (brush?.kind === 'textile') {
      const r = d.moved ? textileRun(v, a, b, d.p0, brush.motif) : textileClick(v, c.hits, d.at, brush.motif)
      if ('print' in r) return c.onEdit(r.print)
      if ('error' in r) return c.onToast(r.error)
      c.onEdit(() => r.v)
      return c.onToast(textileToast(r))
    }
    if (c.pens.beamTool) {
      const r = drawInnerBeam(v, a, b, c.standardRuns)
      if ('error' in r) return c.onToast(r.error)
      return c.onEdit(() => r.v)
    }
    if (brush?.kind === 'wall') c.onEdit((x) => paintWalls(x, a, b, brush.ral))
  },
}
