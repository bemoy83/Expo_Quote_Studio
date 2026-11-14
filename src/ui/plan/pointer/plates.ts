// The wall pen on a wall that stands (docs/pille-og-skuff.md, «Veggverktøyet farger vegg som finnes»): a click on a
// plate colours it in the pen's RAL, a drag along the wall colours the plates it passes, stored on release (Esc
// cancels). A drag that turns off across the wall draws a new wall from there, as before; so does a press on an
// empty edge or near a grid node (where a new wall starts at a T).
import { offsetAlong, wallModules } from '../../../domain/grid'
import { setPanels, wallRal } from '../../../domain/panels'
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
  const i1 = Math.max(0, Math.min(n - 1, Math.floor(offsetAlong(w, q))))
  const built = new Map(mods.map((m) => [m.key, m]))
  const keys: string[] = []
  for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) {
    const m = built.get(wallModules(w)[i].key)
    if (m && !m.opening) keys.push(m.key)
  }
  return keys
}

/** Plates coloured `ral`; a plate in its wall's own colour has none of its own. */
export function paintPlates(v: Variant, mods: BuiltModule[], keys: string[], ral: string): Variant {
  const owner = new Map(mods.map((m) => [m.key, v.walls.find((w) => w.id === m.wallId)]))
  return setPanels(v, keys, ral, (k) => {
    const w = owner.get(k)
    return w ? wallRal(v, w) : v.defaultPlate
  })
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
      d.as = startRunDrag(c, d.p0, !!d.fine, null) as Extract<Drag, { kind: 'run' }>
      run.move?.(c, d.as, q)
    }
  },
  up(c, d, q) {
    if (d.as) return run.up?.(c, d.as, q)
    const { brush } = c
    if (brush?.kind !== 'wall') return
    const keys = platesAlong(c.v, c.mods, d.wallId, d.i0, d.moved ? q : d.p0)
    if (keys.length) c.onEdit((x) => paintPlates(x, c.mods, keys, brush.ral))
  },
}
