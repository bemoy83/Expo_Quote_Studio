// The frame: posts (from the calc, so plan, 3D and quote agree), støtteplater under free walls, and takdragere.
import * as THREE from 'three'
import { RECIPES } from '../../../foga/recipes'
import { pointKey } from '../../../domain/grid'
import type { Point } from '../../../domain/types'
import { wallPoints } from '../../../domain/walls'
import { rules } from '../../env'
import { unitProfile } from './profiles'
import { ALU, ALU_FINISH, BEAM, FOOT_PLATE, type BuildContext } from './context'

export function buildFrame(c: BuildContext) {
  const { res, H, at, mat, add, along, mods } = c
  // Posts: wall posts and beam posts, from the calc so plan, 3D and quote agree
  const wallPts = wallPoints(mods)
  // A post over a foot plate is picked without its adjustable foot
  const onPlate = new Set(res.wallSupports.map((f) => pointKey(f.at)))
  for (const p of res.posts) {
    const onWall = wallPts.has(pointKey(p))
    const layer = onWall ? 'walls' : 'beams'
    const mesh = new THREE.Mesh(unitProfile('94'), mat(layer, ALU, ALU_FINISH))
    mesh.scale.x = H - c.feet
    mesh.rotation.z = Math.PI / 2
    mesh.position.copy(at(p, c.feet + (H - c.feet) / 2))
    add(mesh, { layer })
    if (onPlate.has(pointKey(p))) continue
    // Adjustable foot: an M10 screw up into the post's centre tube, on a round pad (the 700 insert is not drawn)
    const pad = new THREE.Mesh(footGeometry().pad, mat(layer, FOOT_PAD, { roughness: 0.9 }))
    pad.position.copy(at(p, FOOT.pad / 2))
    add(pad, { layer })
    const screw = new THREE.Mesh(footGeometry().screw, mat(layer, SCREW, { metalness: 0.6, roughness: 0.4 }))
    screw.scale.y = Math.max(0.001, c.feet - FOOT.pad)
    screw.position.copy(at(p, FOOT.pad + screw.scale.y / 2))
    add(screw, { layer })
  }

  // Støtteplater under walls that stand free, across the wall, on the floor
  const foot = RECIPES.wall.support.foot
  for (const { at: [x, y], orientation } of res.wallSupports) {
    const half = foot.across / 2000
    const [a, b]: [Point, Point] = orientation === 'h' ? [[x, y - half], [x, y + half]] : [[x - half, y], [x + half, y]]
    along(a, b, 2 * half, 0.012, foot.along / 1000, 0, mat('walls', FOOT_PLATE, ALU_FINISH), { layer: 'walls' })
  }

  // Beams (takdrager) in 292, top flush with the walls, cut between the posts (centres − 40)
  for (const s of res.beams.segments) {
    const [a, b] = [s.from, s.to]
    const mesh = new THREE.Mesh(unitProfile('292'), mat('beams', BEAM, ALU_FINISH))
    mesh.scale.x = Math.max(0.001, Math.hypot(b[0] - a[0], b[1] - a[1]) - rules.wall.post)
    mesh.position.copy(at([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], H - rules.beam.height / 2))
    mesh.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
    add(mesh, { layer: 'beams' })
  }
}

/** Adjustable foot under a wall or beam post (Bjørn 6.11.2026): M10 screw, round plastic pad Ø 40 × 6, m. */
const FOOT = { pad: 0.006, padRadius: 0.02, screwRadius: 0.005 }
const FOOT_PAD = '#2b2d30'
const SCREW = '#3a3c40'
let footGeo: { pad: THREE.BufferGeometry; screw: THREE.BufferGeometry } | null = null
/** Shared for the whole session, like the Foga profiles (the screw is 1 m and scaled to the foot height). */
function footGeometry() {
  if (!footGeo) {
    const pad = new THREE.CylinderGeometry(FOOT.padRadius, FOOT.padRadius, FOOT.pad, 24)
    const screw = new THREE.CylinderGeometry(FOOT.screwRadius, FOOT.screwRadius, 1, 12)
    pad.userData.shared = true
    screw.userData.shared = true
    footGeo = { pad, screw }
  }
  return footGeo
}
