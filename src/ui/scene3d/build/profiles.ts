// Foga cross-sections: the outer outline in mm, measured from Bjørn's STL files (docs/foga-system.md, «Tverrsnitt»).
// Only the outline: the inner chambers never show. Each profile is extruded once to 1 m and shared; a part scales it.
import * as THREE from 'three'

export const OUTLINES = {
  '94': [[40,24.5],[40,30],[30,30],[30,40],[24.5,40],[24.5,37],[28.5,37],[28.5,30],[11.5,30],[11.5,37],[15.5,37],[15.5,40],[10,40],[10,30],[0,30],[0,24.5],[3,24.5],[3,28.5],[10,28.5],[10,11.5],[3,11.5],[3,15.5],[0,15.5],[0,10],[10,10],[10,0],[15.5,0],[15.5,3],[11.5,3],[11.5,10],[28.5,10],[28.5,3],[24.5,3],[24.5,0],[30,0],[30,10],[40,10],[40,15.5],[37,15.5],[37,11.5],[30,11.5],[30,28.5],[37,28.5],[37,24.5]],
  '91': [[18.5,10],[18.5,3],[14.5,3],[14.5,0],[20,0],[20,30],[0,30],[0,0],[5.5,0],[5.5,3],[1.5,3],[1.5,10]],
  '92': [[14.5,0],[20,0],[20,40],[14.5,40],[14.5,37],[18.5,37],[18.5,30],[1.5,30],[1.5,37],[5.5,37],[5.5,40],[0,40],[0,0],[5.5,0],[5.5,3],[1.5,3],[1.5,10],[18.5,10],[18.5,3],[14.5,3]],
  '43TX': [[40,5.5],[40,15.5],[37,15.5],[37,11.5],[35,11.5],[35,10],[38.5,10],[38.5,7],[30,7],[30,28.5],[37,28.5],[37,24.5],[40,24.5],[40,40],[24.5,40],[24.5,37],[28.5,37],[28.5,30],[11.5,30],[11.5,37],[15.5,37],[15.5,40],[0,40],[0,24.5],[3,24.5],[3,28.5],[10,28.5],[10,7],[1.5,7],[1.5,10],[5,10],[5,11.5],[3,11.5],[3,15.5],[0,15.5],[0,5.5],[14,5.5],[14,1.5],[0,1.5],[0,0],[40,0],[40,1.5],[26,1.5],[26,5.5]],
  '92LTX': [[53.9,32.5],[53.9,28.5],[46.9,28.5],[46.9,45.5],[53.9,45.5],[53.9,41.5],[56.9,41.5],[56.9,47],[19.4,47],[9.5,56.9],[8.1,55.5],[13.7,49.8],[18,45.6],[15.2,42.8],[9.5,48.4],[5.3,52.7],[4.2,51.6],[9.9,46],[14.1,41.7],[11.3,38.9],[5.7,44.6],[1.4,48.8],[0,47.4],[9.9,37.5],[9.9,0],[15.4,0],[15.4,3],[11.4,3],[11.4,10],[28.4,10],[28.4,3],[24.4,3],[24.4,0],[29.9,0],[29.9,10],[39.9,10],[39.9,11.5],[25.9,11.5],[25.9,15.5],[41.4,15.5],[41.4,31],[45.4,31],[45.4,17],[46.9,17],[46.9,27],[56.9,27],[56.9,32.5]],
} as const

export type ProfileName = keyof typeof OUTLINES
const cache = new Map<string, THREE.BufferGeometry>()
/** 1 m of profile along local x, centred; profile x → across (z), profile y → up. flipY turns the channel side over. */
export function unitProfile(name: ProfileName, flipY = false): THREE.BufferGeometry {
  const key = `${name}${flipY}`
  let g = cache.get(key)
  if (g) return g
  const pts = OUTLINES[name] as readonly (readonly number[])[]
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
  let v = pts.map(([x, y]) => new THREE.Vector2((x - cx) / 1000, ((flipY ? cy - y : y - cy)) / 1000))
  if (flipY) v = v.reverse()
  g = new THREE.ExtrudeGeometry(new THREE.Shape(v), { depth: 1, bevelEnabled: false })
  g.name = `foga-${name}`
  g.userData.shared = true
  g.translate(0, 0, -0.5)
  g.rotateY(Math.PI / 2)
  cache.set(key, g)
  return g
}

