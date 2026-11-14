// Which sides of the counters of Disker og podier the work order draws (PodiumSides.tsx): those that are more than
// plates (Byggeregler K16–K20).
import { lockedParts } from '../../domain/podiumLocks'
import type { Motif, Variant } from '../../domain/types'
import { counterName, place } from '../env'
import { findMotif } from '../motifs'
import { drawerSides, sideDecor, sideElevation } from '../plan/podiumDrawer/podiumView'

/** The sides worth a drawing: a light opening open or a door, a shelf behind, or print or a decal on it. */
export function podiumSidesToDraw(v: Variant, motifs: readonly Motif[] = []) {
  const ratio = (id: string) => findMotif(motifs, id)?.ratio ?? 0
  const counters = v.objects.filter((o) => o.sections?.length)
  return counters.flatMap((o, n) => {
    const locked = new Set(lockedParts(v, place, o))
    const name = `${counterName(o)} ${n + 1}`
    return drawerSides(o).flatMap((S) => {
      const el = sideElevation(o, S.side, locked)
      const decor = sideDecor(o, S.side, locked, ratio)
      const more = el.parts.some((p) => p.shelves.length || (!p.locked && p.lights.some((k) => k))) || decor.prints.length || decor.decals.length
      return more ? [{ key: `${o.id}:${S.key}`, title: `${name} · ${S.name}`, o, el, decor }] : []
    })
  })
}

