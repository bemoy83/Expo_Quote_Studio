// The work order's «Disker sett utenfra» (trinn 2, Byggeregler K16–K20): every side of a counter of Disker og podier
// that is more than plates, seen from outside as in its drawer but fixed, so the stand builder can build it: open
// light openings, sliding doors, shelves with their CC heights from the floor, and print and decals. Sides of plates
// only, and parts against a wall or another counter (plates, K16), are left out.
import { counterRal } from '../../domain/objects'
import type { Motif, Variant } from '../../domain/types'
import { plateColor } from '../env'
import { PodiumElevation } from '../plan/podiumDrawer/PodiumElevation'
import { podiumSidesToDraw } from './podiumSideList'

export function PodiumSides({ v, motifs = [] }: { v: Variant; motifs?: Motif[] }) {
  const sides = podiumSidesToDraw(v, motifs)
  if (!sides.length) return null
  return (
    <section className="wo-sec wo-shelves">
      <div className="eyebrow">Disker sett utenfra</div>
      {sides.map((s) => (
        <div key={s.key} className="wo-elev-box wo-podium">
          <PodiumElevation parts={s.el.parts} length={s.el.length} h={s.el.h} title={s.title} fill={plateColor(counterRal(s.o))} prints={s.decor.prints} decals={s.decor.decals} motifs={motifs} />
        </div>
      ))}
      <p className="foot">Høyder er CC fra gulvet: underkant skinne. Åpen: ingen plate. Skyvedør: to plater i sporet.</p>
    </section>
  )
}
