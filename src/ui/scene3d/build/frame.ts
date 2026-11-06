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
    // Adjustable foot (M10 × 65): a tapered rubber pad with a hex on top, the screw up into the post's centre tube
    // (the 700 insert is not drawn)
    const g = footGeometry()
    const rubber = mat(layer, FOOT_PAD, { roughness: 0.9 })
    const pad = new THREE.Mesh(g.pad, rubber)
    pad.position.copy(at(p, FOOT.pad / 2))
    add(pad, { layer })
    const hex = new THREE.Mesh(g.hex, rubber)
    hex.position.copy(at(p, FOOT.pad + FOOT.hex / 2))
    add(hex, { layer })
    const screw = new THREE.Mesh(g.screw, mat(layer, SCREW, { metalness: 0.15, roughness: 0.35 }))
    screw.scale.y = Math.max(0.001, c.feet - FOOT.pad - FOOT.hex)
    screw.position.copy(at(p, FOOT.pad + FOOT.hex + screw.scale.y / 2))
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

/** Adjustable foot under a wall or beam post (Bjørn 6.11.2026, photo): M10 × 65 screw, a black rubber pad Ø 40
 *  tapering to Ø 28 and 6 mm high, and a hex 17 mm across flats on top of it, m. */
const FOOT = { pad: 0.006, padBottom: 0.02, padTop: 0.014, hex: 0.006, hexRadius: 0.0098, screwRadius: 0.005 }
const FOOT_PAD = '#1f2023'
const SCREW = '#d4d7db'
let footGeo: { pad: THREE.BufferGeometry; hex: THREE.BufferGeometry; screw: THREE.BufferGeometry } | null = null
/** Shared for the whole session, like the Foga profiles (the screw is 1 m and scaled to what shows). */
function footGeometry() {
  if (!footGeo) {
    const pad = new THREE.CylinderGeometry(FOOT.padTop, FOOT.padBottom, FOOT.pad, 24)
    const hex = new THREE.CylinderGeometry(FOOT.hexRadius, FOOT.hexRadius, FOOT.hex, 6)
    const screw = new THREE.CylinderGeometry(FOOT.screwRadius, FOOT.screwRadius, 1, 12)
    for (const g of [pad, hex, screw]) g.userData.shared = true
    footGeo = { pad, hex, screw }
  }
  return footGeo
}
