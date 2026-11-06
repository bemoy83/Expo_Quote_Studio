// Walls: plate and profiles per module; openings get a header plate and a door (leaf, handle, swing) or a curtain.
import * as THREE from 'three'
import { doorHinge, doorRal, doorSwing } from '../../../domain/doors'
import { wallDirection } from '../../../domain/grid'
import type { Point } from '../../../domain/types'
import type { BuiltModule } from '../../../domain/walls'
import { doorInset } from '../../../rules/rules'
import { plateColor, productOf, rules } from '../../env'
import { unitProfile } from './profiles'
import { ALU, ALU_FINISH, CURTAIN, HANDLE, INK, selectGlow, type BuildContext, type Tag } from './context'

export function buildWalls(c: BuildContext) {
  const { v, H, post, feet, prof, at, mat, add, along, mods, sel } = c
  // Walls: plate, top and bottom profile per module. Openings get a header panel and a door or curtain.
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
    // The header plate belongs to the door: a click on it chooses the door
    along(m.a, m.b, len - 0.004, H - prof.top - rules.door.height, 0.012, rules.door.height, plate, tag)
    opening(m, tag)
  }

  function rail(a: Point, b: Point, len: number, name: '92' | '91', y: number, m: THREE.Material, tag: Tag, flip = false) {
    const mesh = new THREE.Mesh(unitProfile(name, flip), m)
    mesh.scale.x = len
    mesh.position.copy(at([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], y))
    mesh.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
    add(mesh, tag)
  }

  function opening(m: BuiltModule, tag: Tag) {
    const o = m.opening!
    const w = v.walls.find((x) => x.id === o.wallId)
    if (!w) return
    const door = productOf(o.product)?.opening === 'door'
    if (!door) {
      // Curtain: a folded sheet in the opening
      const geo = new THREE.PlaneGeometry(rules.wall.cc - post - 0.02, rules.door.height - 0.03, 24, 1)
      const pos = geo.attributes.position
      for (let k = 0; k < pos.count; k++) pos.setZ(k, Math.sin((pos.getX(k) + 0.5) * Math.PI * 12) * 0.025)
      geo.computeVertexNormals()
      const mesh = new THREE.Mesh(geo, mat('openings', CURTAIN, { side: THREE.DoubleSide, roughness: 1 }))
      const dx = m.b[0] - m.a[0]
      const dz = m.b[1] - m.a[1]
      mesh.position.copy(at([(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2], (rules.door.height - 0.03) / 2 + 0.02))
      mesh.rotation.y = Math.atan2(-dz, dx)
      add(mesh, tag)
      return
    }
    // Door: closed leaf in its colour with a handle, and the swing on the floor
    const chosen = sel.openingId === o.id
    along(m.a, m.b, rules.door.swing, rules.door.height - 0.01, 0.04, 0, mat('openings', plateColor(doorRal(v, o)), selectGlow(chosen)), tag)
    const [wx, wy] = wallDirection(w)
    const s = doorSwing(v.stand, w, o)
    const n: Point = [-wy * s, wx * s]
    // Leaf centred in the opening: hinge just in from its end of the module, handle near the free edge (as in the plan)
    const k = doorInset(rules)
    const hg = doorHinge(w, o)
    const [dx, dy] = hg.dir
    const a: Point = [hg.a[0] + dx * k, hg.a[1] + dy * k]
    const b: Point = [hg.b[0] - dx * k, hg.b[1] - dy * k]
    const hp: Point = [b[0] - dx * 0.08 + n[0] * 0.04, b[1] - dy * 0.08 + n[1] * 0.04]
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), mat('openings', HANDLE))
    handle.position.copy(at(hp, 1.05))
    handle.rotation.y = Math.atan2(-dy, dx)
    add(handle, tag)
    const r = rules.door.swing
    const pts: THREE.Vector3[] = []
    const a0 = Math.atan2(dy, dx)
    const a1 = Math.atan2(n[1], n[0])
    let da = a1 - a0
    if (da > Math.PI) da -= 2 * Math.PI
    if (da < -Math.PI) da += 2 * Math.PI
    for (let k = 0; k <= 24; k++) {
      const t = a0 + (da * k) / 24
      pts.push(at([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r], 0.008))
    }
    pts.push(at(a, 0.008))
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: INK, dashSize: 0.05, gapSize: 0.05 }))
    line.computeLineDistances()
    add(line, { layer: 'openings' })
  }
}
