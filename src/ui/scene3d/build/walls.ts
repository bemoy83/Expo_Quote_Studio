// Walls: plate and profiles per module; openings get a header (overstykke) and a door or curtain (doors.ts).
// Byggeregel D2 (docs/byggeregler.md).
import * as THREE from 'three'
import type { Point } from '../../../domain/types'
import { RECIPES } from '../../../foga/recipes'
import { plateColor, productOf, rules } from '../../env'
import { buildOpening, doorLevels } from './doors'
import { unitProfile } from './profiles'
import { ALU, ALU_FINISH, selectGlow, type BuildContext, type Tag } from './context'

export function buildWalls(c: BuildContext) {
  const { H, post, feet, prof, at, mat, add, along, mods, sel } = c
  // Walls: plate, top and bottom profile per module. Openings get a header and a door or curtain.
  for (const m of mods) {
    const tag: Tag = m.opening ? { layer: 'openings', pick: { wallId: m.wallId, openingId: m.opening.id } } : { layer: 'walls', pick: { wallId: m.wallId } }
    const wallTag: Tag = { layer: 'walls', pick: { wallId: m.wallId } }
    const selected = sel.wallId === m.wallId && !sel.textileId && !sel.foilId
    const plate = mat('walls', plateColor(m.plate), selectGlow(selected))
    const frame = mat('walls', ALU, ALU_FINISH)
    const len = rules.wall.cc - post
    rail(m.a, m.b, len, '92', H - prof.top / 2, frame, wallTag)
    if (!m.opening) {
      rail(m.a, m.b, len, '91', feet + prof.bottom / 2, frame, wallTag, true)
      along(m.a, m.b, len + 0.016, H - prof.top - feet - prof.bottom + 0.02, 0.003, feet + prof.bottom - 0.01, plate, wallTag)
      continue
    }
    // Header (overstykke): a small wall over the opening, 91 at the bottom, or 92 over a curtain for its glider. Its
    // plate belongs to the door: a click on it chooses the door.
    const hb = doorLevels().header
    const curtain = productOf(m.opening.product)?.opening !== 'door'
    const bottom = curtain ? (RECIPES.door.curtainBottomRail as '92') : '91'
    const bh = curtain ? prof.top : prof.bottom
    rail(m.a, m.b, len, bottom, hb + bh / 2, frame, wallTag, !curtain)
    along(m.a, m.b, len + 0.016, H - prof.top - hb - bh + 0.02, 0.003, hb + bh - 0.01, plate, tag)
    buildOpening(c, m, tag)
  }

  function rail(a: Point, b: Point, len: number, name: '92' | '91', y: number, m: THREE.Material, tag: Tag, flip = false) {
    const mesh = new THREE.Mesh(unitProfile(name, flip), m)
    mesh.scale.x = len
    mesh.position.copy(at([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], y))
    mesh.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
    add(mesh, tag)
  }
}
