// Shelves (hylle 6311, Byggeregler H1–H3): a white board in its wall module, its top at the shelf's height, lying into
// the inner corner of the posts on a bracket in each post's face channel. The brackets are 91F (one flange, in under
// the board, its body on the post's centre) or 91FF (a flange each way, between two boards at one height), drawn
// from Bjørn's STL outlines, 290 mm out from the post's face; the 600 coupling sits inside the post and is not drawn.
// In an inner corner (Byggeregler H10–H12) the board is cut to fit and its corner end rests on a short 91 or a 91FF
// standing out from a 01 rail hung on the other wall, from the wall's top down by the rail's standard length.
import * as THREE from 'three'
import { cornerLayout, railT, shelfSpan } from '../../../domain/shelves/corners'
import { faceNormal, sideOf } from '../../../domain/faces'
import { pointAlong, pointKey, wallDirection } from '../../../domain/grid'
import { shelvesOf } from '../../../domain/shelves/model'
import { chosenShelves } from '../../plan/selection'
import type { Point } from '../../../domain/types'
import { RECIPES } from '../../../foga/recipes'
import { wallHeight } from '../../../rules/rules'
import { rules } from '../../env'
import { ALU, ALU_FINISH, selectGlow, type BuildContext, type Tag } from './context'
import { profile, unitProfile } from './profiles'

/** Melamine white. */
export const BOARD = '#f2f1ec'

/** Height of the bracket's top over the board's top, and of the flange the board lies on, m (from the STL: the body is
 *  30 high, the flange top 10,5 over its bottom, so an 18 mm board ends 1,5 under the bracket's top). */
const BODY = 0.03
const FLANGE_TOP = 0.0105
/** Height of the unseen grip around a board, m: the least clear height between two shelves (rules.shelf.gap). */
const GRIP = 0.1

export function buildShelves(c: BuildContext) {
  const { v, mat, along, add, at, sel } = c
  const r = RECIPES.shelf
  const { thickness: t, depth } = rules.shelf.board
  const out = r.bracket / 1000
  const face = rules.wall.post / 2
  // The board's inner edge on the rails' face, into the posts' inner corner (Bjørn 8.11.2026)
  const inner = rules.wall.profile.thickness / 2
  /** The boards meeting at each bracket: post, face and height → the directions along the wall their boards lie in. */
  const brackets = new Map<string, { p: Point; n: Point; y: number; dirs: number[]; wallId: string; dir: Point }>()
  // The chosen shelf glows with its row, or alone with shelfOnly
  const chosen = new Set(chosenShelves(v, sel))
  const layout = cornerLayout(v, rules)
  for (const f of shelvesOf(v)) {
    const w = v.walls.find((x) => x.id === f.wallId)
    if (!w) continue
    const s = sideOf(v, f)
    const n = faceNormal(w, s)
    const on = chosen.has(f.id)
    const tag: Tag = { layer: 'objects', pick: { wallId: w.id, shelfId: f.id } }
    const span = shelfSpan(v, rules, f, layout)
    const [a, b] = [pointAlong(w, span.a), pointAlong(w, span.b)]
    const len = span.b - span.a
    // A narrow corner board keeps its front edge where every board has it (H12)
    const mid = inner + depth - span.depth / 2
    along(a, b, len, t, span.depth, f.y - t, mat('objects', BOARD, { roughness: 0.55, ...selectGlow(on) }), tag, s * mid)
    // An unseen grip around the thin board, so a finger or the mouse finds it (Bjørn 9.11.2026): GRIP tall, still clear
    // of the shelf above or below (H5 keeps 100 mm between them)
    const grip = along(a, b, len, GRIP, span.depth, f.y - t / 2 - GRIP / 2, mat('objects', BOARD), tag, s * mid)
    grip.geometry.name = 'shelf-grip'
    grip.visible = false
    grip.castShadow = false
    grip.receiveShadow = false
    // Its two brackets: at the module's start the board lies ahead along the wall (+1), at its end behind (−1)
    for (const [k, d, i] of [[f.module, 1, 0], [f.module + 1, -1, 1]] as const) {
      // Not at the corner post: there the board rests on its rail's bracket (below)
      if (span.corner?.corner.felt.end === i) continue
      const p = pointAlong(w, k)
      const key = `${pointKey(p)}|${Math.round(n[0])},${Math.round(n[1])}|${Math.round(f.y * 1000)}`
      const b = brackets.get(key) ?? { p, n, y: f.y, dirs: [], wallId: w.id, dir: wallDirection(w) }
      b.dirs.push(d)
      brackets.set(key, b)
    }
  }
  for (const b of brackets.values()) {
    const twin = b.dirs.length > 1
    const mesh = new THREE.Mesh(unitProfile(profile(twin ? r.twin : r.end)), mat('objects', ALU, ALU_FINISH))
    mesh.scale.x = out
    // Local x along the face normal; the profile's x (across, local z) along the wall
    mesh.rotation.y = Math.atan2(-b.n[1], b.n[0])
    // Local −z lies along (n.y, −n.x): turn the 91F over when its flange would face away from the board
    const flangeWay: Point = [b.n[1], -b.n[0]]
    // The flange in under the board (Bjørn 8.11.2026). The outline's flange lies on local +z, so the test is turned
    const board: Point = [b.dir[0] * b.dirs[0], b.dir[1] * b.dirs[0]]
    const want: Point = [-board[0], -board[1]]
    const toward = flangeWay[0] * want[0] + flangeWay[1] * want[1] > 0 ? 1 : -1
    if (!twin && toward < 0) mesh.scale.z = -1
    // A 91F's body is 7,5 mm off its outline's middle, away from the flange: moved toward the board, the body sits on
    // the post's centre
    const shift = twin ? 0 : 0.0075
    const mid: Point = [b.p[0] + b.n[0] * (face + out / 2) + board[0] * shift, b.p[1] + b.n[1] * (face + out / 2) + board[1] * shift]
    mesh.position.copy(at(mid, b.y - t - FLANGE_TOP + BODY / 2))
    add(mesh, { layer: 'objects', pick: { wallId: b.wallId } })
  }
  // Corner rails (H12): 01 on the rails' face, channel out, from the wall's top down by its length, the krok not drawn
  const rail = RECIPES.shelf.corner
  const top = wallHeight(rules)
  const back = face - rules.wall.profile.thickness / 2
  for (const r of layout.rails) {
    const w = v.walls.find((x) => x.id === r.felt.wallId)
    if (!w) continue
    const t0 = railT(r)
    const [rw, rt] = [0.02, 0.0115]
    const len = r.length / 1000
    along(pointAlong(w, t0 - rw / 2), pointAlong(w, t0 + rw / 2), rw, len, rt, top - len, mat('objects', ALU, ALU_FINISH), { layer: 'objects', pick: { wallId: w.id } }, r.felt.s * (back + rt / 2))
    // The brackets in it: under each shelf it carries, a short 91 (alone) or a 91FF (meeting), out from the rail's face
    const n = faceNormal(w, r.felt.s)
    for (const id of r.carries) {
      const f = shelvesOf(v).find((x) => x.id === id)
      if (!f) continue
      const meet = r.kind === 'meet'
      const out = (meet ? RECIPES.shelf.bracket : rail.short) / 1000
      const mesh = new THREE.Mesh(unitProfile(profile(meet ? RECIPES.shelf.twin : rail.bracket)), mat('objects', ALU, ALU_FINISH))
      mesh.scale.x = out
      mesh.rotation.y = Math.atan2(-n[1], n[0])
      const p = pointAlong(w, t0)
      const from = back + rt
      const at0: Point = [p[0] + n[0] * (from + out / 2), p[1] + n[1] * (from + out / 2)]
      // Alone the board lies on the 91's top; a twin carries it on a flange
      mesh.position.copy(at(at0, meet ? f.y - t - FLANGE_TOP + BODY / 2 : f.y - t - BODY / 2))
      add(mesh, { layer: 'objects', pick: { wallId: w.id } })
    }
  }
}
