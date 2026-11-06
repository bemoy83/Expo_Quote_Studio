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
  for (const p of res.posts) {
    const onWall = wallPts.has(pointKey(p))
    const mesh = new THREE.Mesh(unitProfile('94'), mat(onWall ? 'walls' : 'beams', ALU, ALU_FINISH))
    mesh.scale.x = H - c.feet
    mesh.rotation.z = Math.PI / 2
    mesh.position.copy(at(p, c.feet + (H - c.feet) / 2))
    add(mesh, { layer: onWall ? 'walls' : 'beams' })
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
