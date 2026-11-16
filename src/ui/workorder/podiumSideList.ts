// Which sides of the counters of Disker og podier the work order draws (PodiumSides.tsx): those that are more than
// plates (Byggeregler K16–K20).
import type { Motif, Variant } from '../../domain/types'
import { counterName } from '../env'
import { findMotif } from '../motifs'
import { drawerSides, sideDecor, sideElevation } from '../plan/podiumDrawer/podiumView'

/** The sides worth a drawing: a light opening open or a door, a shelf behind, or print or a decal on it. */
export function podiumSidesToDraw(v: Variant, motifs: readonly Motif[] = []) {
  const ratio = (id: string) => findMotif(motifs, id)?.ratio ?? 0
  const counters = v.objects.filter((o) => o.sections?.length)
  return counters.flatMap((o, n) => {
    const name = `${counterName(o)} ${n + 1}`
    return drawerSides(o).flatMap((S) => {
      const el = sideElevation(o, S.side)
      const decor = sideDecor(o, S.side, ratio)
      const more = el.parts.some((p) => p.shelves.length || p.lights.some((k) => k)) || decor.prints.length || decor.decals.length
      return more ? [{ key: `${o.id}:${S.key}`, title: `${name} · ${S.name}`, o, el, decor }] : []
    })
  })
}

