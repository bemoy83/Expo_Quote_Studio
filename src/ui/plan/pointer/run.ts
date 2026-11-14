// The drawing tool of the pens that draw a straight run (Bjørn 14.11.2026: one drawing tool, one thing to learn): Vegg
// and Takdrager, as Disker og podier (domain/runDraw.ts). The pen shows the module a click stores; a press and drag
// grows it from there. With Shift (or «Fin» on Vegg) the preview stands still where it is, a press by an end takes hold
// of that end and moves it in 250 steps; Shift pressed or let go during a drag goes on from what is drawn. The plan
// shows what a release stores (plan/next.ts).
import { paintWalls } from '../../../domain/edit'
import { drawInnerBeam } from '../../../domain/innerBeams'
import { rebaseRun, runTo, shownModule, startRun } from '../../../domain/runDraw'
import type { Point } from '../../../domain/types'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

/** A press that moves this far (m) draws instead of clicking, as Disker og podier. */
export const RUN_DRAG = 0.05

const pt = (q: P): Point => [q.x, q.y]

/** A press at q. `frozen`: where Shift froze the preview, which the press works on wherever it is; `fine`: Shift or Fin. */
export function startRunDrag(c: PointerCtx, q: P, fine: boolean, frozen: P | null): Drag {
  const shown = shownModule(c.v.stand, frozen ?? q)
  c.setStroke([shown.a, shown.b])
  return { kind: 'run', p0: q, last: q, moved: false, run: startRun(c.v.stand, shown, pt(q), fine) }
}

/** Shift pressed or let go since the last move (or Fin): goes on from what is drawn, at the pointer before this move. */
export function runShift(d: Extract<Drag, { kind: 'run' }>, fine: boolean) {
  if (d.run.fine !== fine) d.run = d.moved ? rebaseRun(d.run, pt(d.last), fine) : { ...d.run, fine }
}

/** What a release stores: the run drawn, or for a click the module shown. */
const runOf = (d: Extract<Drag, { kind: 'run' }>, q: P): [Point, Point] => (d.moved ? runTo(d.run, pt(q)) : [d.run.shown.a, d.run.shown.b])

export const run: DragHandlers<'run'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > RUN_DRAG) d.moved = true
    d.last = q
    c.setStroke(runOf(d, q))
  },
  up(c, d, q) {
    const [a, b] = runOf(d, q)
    c.setStroke(null)
    const { v, brush } = c
    if (c.pens.beamTool) {
      const r = drawInnerBeam(v, a, b, c.standardRuns)
      if ('error' in r) return c.onToast(r.error)
      return c.onEdit(() => r.v)
    }
    if (brush?.kind === 'wall') c.onEdit((x) => paintWalls(x, a, b, brush.ral))
  },
}
