// The drawing tool of the pens that draw a straight run (Bjørn 14.11.2026: one drawing tool, one thing to learn): Vegg,
// Tekstil and Takdrager, as Disker og podier (domain/runDraw.ts, draw.ts); only what is stored differs. The pen shows
// what a click stores; a press and drag grows the module shown from there. With Shift (or «Fin») the pen shows 250 and
// draws in 250 steps; Shift pressed or let go during a drag goes on from what is drawn. The plan shows what a release
// stores from the drag itself (plan/next.ts).
import { paintWalls } from '../../../domain/edit'
import { drawInnerBeam } from '../../../domain/innerBeams'
import { BEAM_UNIT, RUN_UNIT, TEXTILE_UNIT, rebaseRun, runTo, shownModule, startRun } from '../../../domain/runDraw'
import { rules } from '../../env'
import type { Point } from '../../../domain/types'
import { pressMove, startPress } from './draw'
import { textileClick, textileRun, textileToast } from './textile'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

export type RunPress = Extract<Drag, { kind: 'run' }>

const pt = (q: P): Point => [q.x, q.y]

/** How a pen draws with Shift or Fin, the finest step its product is built in (Bjørn 28.11.2026): `unit` the step, m,
 *  `grid` where the module it shows lies, m, `min` the shortest run, steps. 500 for Takdrager (whole and half metres,
 *  Byggeregel T8); 10 mm for Tekstil, from its shortest frame on the 250 grid (X9, X17); else 250. */
export const runStep = (pens: { beamTool: boolean; textileTool?: boolean }): { unit: number; grid: number; min: number } =>
  pens.beamTool ? { unit: BEAM_UNIT, grid: BEAM_UNIT, min: 1 } : pens.textileTool ? { unit: TEXTILE_UNIT, grid: RUN_UNIT, min: Math.round(rules.textile.minLength / TEXTILE_UNIT) } : { unit: RUN_UNIT, grid: RUN_UNIT, min: 1 }

/** A press at q. `fine`: Shift or Fin. */
export function startRunDrag(c: PointerCtx, q: P, fine: boolean): RunPress {
  const { unit, grid, min } = runStep(c.pens)
  return { kind: 'run', ...startPress(q), run: startRun(c.v.stand, shownModule(c.v.stand, q, fine, grid), pt(q), fine, unit, min) }
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
      // Without Fin a free-standing frame is the standard length for its metres (X9)
      const standard = !d.run.fine
      const r = d.moved ? textileRun(v, a, b, d.p0, brush.motif, standard) : textileClick(v, c.hits, d.at, brush.motif, d.run.shown, standard)
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
    if (brush?.kind !== 'wall') return
    // A room the stroke closes is chosen by App's onEdit, with its grips (R8)
    c.onEdit(() => paintWalls(v, a, b, brush.ral))
  },
}
