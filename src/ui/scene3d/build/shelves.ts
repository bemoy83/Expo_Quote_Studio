// Shelves (hylle 6311, Byggeregler H1–H3): a white board in its wall module, its top at the shelf's height, lying into
// the inner corner of the posts on a bracket in each post's face channel. The brackets are 91F (one flange, in under
// the board, its body on the post's centre) or 91FF (a flange each way, between two boards at one height), drawn
// from Bjørn's STL outlines, 290 mm out from the post's face; the 600 coupling sits inside the post and is not drawn.
import * as THREE from 'three'
import { faceNormal, sideOf } from '../../../domain/faces'
import { pointAlong, pointKey, wallDirection } from '../../../domain/grid'
import { shelfRow, shelvesOf } from '../../../domain/shelves'
import type { Point } from '../../../domain/types'
import { RECIPES } from '../../../foga/recipes'
import { rules } from '../../env'
import { ALU, ALU_FINISH, selectGlow, type BuildContext, type Tag } from './context'
import { profile, unitProfile } from './profiles'

/** Melamine white. */
export const BOARD = '#f2f1ec'

/** Height of the bracket's top over the board's top, and of the flange the board lies on, m (from the STL: the body is
 *  30 high, the flange top 10,5 over its bottom, so an 18 mm board ends 1,5 under the bracket's top). */
const BODY = 0.03
const FLANGE_TOP = 0.0105

export function buildShelves(c: BuildContext) {
  const { v, mat, along, add, at, sel } = c
  const r = RECIPES.shelf
  const { thickness: t, width, depth } = rules.shelf.board
  const out = r.bracket / 1000
  const face = rules.wall.post / 2
  // The board's inner edge on the rails' face, into the posts' inner corner (Bjørn 8.11.2026)
  const inner = rules.wall.profile.thickness / 2
  const inset = (rules.wall.cc - width) / 2
  /** The boards meeting at each bracket: post, face and height → the directions along the wall their boards lie in. */
  const brackets = new Map<string, { p: Point; n: Point; y: number; dirs: number[]; wallId: string; dir: Point }>()
  // The chosen shelf glows with its row, or alone with shelfOnly (plan/selection.ts chosenShelves)
  const chosen = new Set(!sel.shelfId ? [] : sel.shelfOnly ? [sel.shelfId] : shelfRow(v, sel.shelfId).map((x) => x.id))
  for (const f of shelvesOf(v)) {
    const w = v.walls.find((x) => x.id === f.wallId)
    if (!w) continue
    const s = sideOf(v, f)
    const n = faceNormal(w, s)
    const on = chosen.has(f.id)
    const tag: Tag = { layer: 'objects', pick: { wallId: w.id, shelfId: f.id } }
    along(pointAlong(w, f.module + inset), pointAlong(w, f.module + 1 - inset), width, t, depth, f.y - t, mat('objects', BOARD, { roughness: 0.55, ...selectGlow(on) }), tag, s * (inner + depth / 2))
    // Its two brackets: at the module's start the board lies ahead along the wall (+1), at its end behind (−1)
    for (const [k, d] of [[f.module, 1], [f.module + 1, -1]] as const) {
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
}
