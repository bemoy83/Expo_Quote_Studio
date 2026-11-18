// The wall pen on a wall that stands (docs/pille-og-skuff.md, «Veggverktøyet farger vegg som finnes»): a click on a
// plate colours it in the pen's RAL, a drag along the wall colours the plates it passes, stored on release (Esc
// cancels). A drag that turns off across the wall draws a new wall from there, as before; so does a press on an
// empty edge or near a grid node (where a new wall starts at a T).
import { moduleAt, offsetAlong, wallModules } from '../../../domain/grid'
import { faceAt } from '../../../domain/faces'
import { paintPlatesAlong } from '../../../domain/paint'
import type { Variant } from '../../../domain/types'
import type { BuiltModule } from '../../../domain/walls'
import { distToSegment } from '../geometry'
import { run, startRunDrag } from './run'
import type { DragHandlers, Drag, P } from './types'

/** How near the plate's line a press must be, and how far from a grid node, m. */
const ON_PLATE = 0.14
const OFF_NODE = 0.2

/** The plate a wall-pen press lands on, or null when it should draw a wall (empty edge, near a node, a door). */
export function plateAt(mods: BuiltModule[], q: P): BuiltModule | null {
  let best: BuiltModule | null = null
  let bd = ON_PLATE
  for (const m of mods) {
    const d = distToSegment(q, m.a, m.b)
    if (d < bd) {
      bd = d
      best = m
    }
  }
  if (!best || best.opening) return null
  const nearNode = [best.a, best.b].some((n) => Math.hypot(q.x - n[0], q.y - n[1]) < OFF_NODE)
  return nearNode ? null : best
}

/** The plates from module `i0` of a wall to where the pointer is along it, on that wall only, doors left out. */
export function platesAlong(v: Variant, mods: BuiltModule[], wallId: string, i0: number, q: P): string[] {
  const w = v.walls.find((x) => x.id === wallId)
  if (!w) return []
  const n = wallModules(w).length
  const i1 = Math.max(0, Math.min(n - 1, moduleAt(w, offsetAlong(w, q))))
  // Parts of a module another wall split (V10) are plates of their own, all passed
  const [lo, hi] = [Math.min(i0, i1), Math.max(i0, i1)]
  const keys = new Set(wallModules(w).slice(lo, hi + 1).map((m) => m.key))
  return mods.filter((m) => !m.opening && (keys.has(m.key) || (m.whole !== undefined && keys.has(m.whole)))).map((m) => m.key)
}

/**
 * The wall pen on plates of wall `wallId`, pressed at `p0`: each plate in `ral` (none of its own where that is its
 * wall's colour), and the print on the face pressed comes off them, as the drawer's brush (the last stroke wins).
 */
export function paintPlates(v: Variant, wallId: string, p0: P, keys: readonly string[], ral: string): Variant {
  const w = v.walls.find((x) => x.id === wallId)
  return w ? paintPlatesAlong(v, w.id, faceAt(v, w, p0), keys, ral) : v
}

/** `fine`: Shift or «Fin», for the wall a drag across draws. */
export function startPlates(m: BuiltModule, q: P, fine = false): Drag {
  return { kind: 'plates', wallId: m.wallId, i0: m.index, p0: q, moved: false, fine }
}

export const plates: DragHandlers<'plates'> = {
  move(c, d, q) {
    if (d.as) return run.move?.(c, d.as, q)
    if (d.moved || Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.35) return
    d.moved = true
    // Across the wall: a new wall from the press, as the pen always drew
    const w = c.v.walls.find((x) => x.id === d.wallId)
    const across = w && (w.from[1] === w.to[1] ? Math.abs(q.y - d.p0.y) > Math.abs(q.x - d.p0.x) : Math.abs(q.x - d.p0.x) > Math.abs(q.y - d.p0.y))
    if (across) {
      d.as = startRunDrag(c, d.p0, !!d.fine)
      run.move?.(c, d.as, q)
    }
  },
  up(c, d, q) {
    if (d.as) return run.up?.(c, d.as, q)
    const { brush } = c
    if (brush?.kind !== 'wall') return
    const keys = platesAlong(c.v, c.mods, d.wallId, d.i0, d.moved ? q : d.p0)
    if (keys.length) c.onEdit((x) => paintPlates(x, d.wallId, d.p0, keys, brush.ral))
  },
}
