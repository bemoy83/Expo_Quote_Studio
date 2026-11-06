// Textile walls: InFrame in front of a wall face, and free-standing frames on foot plates. The frames are real 43TX
// (mitred in the corners, build/profiles.ts) with the textile stretched over both faces; free-standing runs that meet
// share a 92LTX corner post on its end caps.
import * as THREE from 'three'
import { alongRun } from '../../../calc/textile/free'
import { cornerEnds, runDirection } from '../../../domain/textile/free'
import type { Point } from '../../../domain/types'
import { pointAlong, wallLength } from '../../../domain/grid'
import { rules } from '../../env'
import { findMotif } from '../../motifs'
import { sideOf } from '../../../domain/faces'
import { textileBox, textileOffset } from '../../../domain/textile/inFrame'
import { printMaterial } from './motifs'
import { ALU, ALU_FINISH, FABRIC, SELECT, type BuildContext, type Tag } from './context'
import { CAP_92LTX, CAP_THICKNESS, CORNER_92LTX, OUTLINES, mitredProfile, unitProfile } from './profiles'

export function buildTextile(c: BuildContext) {
  const { v, res, opts, H, at, mat, add, along, sel } = c
  const depth = rules.textile.depth
  // Textile walls (InFrame): a 43TX frame with textile over both faces, standing in front of its wall face. The motif is
  // printed on the front.
  for (const t of v.textiles) {
    const w = v.walls.find((x) => x.id === t.wallId)
    if (!w) continue
    const L = wallLength(w)
    const from = Math.max(0, Math.min(L, t.from))
    const to = Math.max(from, Math.min(L, t.from + t.width))
    const s = sideOf(v, t)
    const off = s * (textileOffset(rules) + 0.005)
    const { bottom, height } = textileBox(t, rules)
    const h = Math.min(height, H - bottom)
    const glow = sel.textileId === t.id ? { emissive: SELECT, emissiveIntensity: 0.35 } : {}
    const fabric = mat('textile', FABRIC, { roughness: 1, ...glow })
    const alu = mat('textile', ALU, { ...ALU_FINISH, ...glow })
    const m = findMotif(opts.motifs, t.motif)
    const print = m ? printMaterial(m, (to - from) / h, opts.onLoad, glow) : fabric
    const fw = to - from - 0.02
    const g = frame(pointAlong(w, from), pointAlong(w, to), off)
    const tag: Tag = { layer: 'textile', pick: { wallId: w.id, textileId: t.id } }
    profiles(g, fw, h, bottom, { from: true, to: true }, -fw / 2, fw / 2, alu, tag)
    const [front, back] = s === 1 ? [print, fabric] : [fabric, print]
    textile(g, -fw / 2, fw, h, bottom, front, 1, tag)
    textile(g, -fw / 2, fw, h, bottom, back, -1, tag)
    // Upright braces (90) evenly spread inside the frame
    const n = res.production.pieces.find((p) => p.textileId === t.id)?.braces?.qty ?? 0
    for (let i = 1; i <= n; i++) brace(g, -fw / 2 + (fw * i) / (n + 1), h, bottom, alu, tag)
  }

  // Frittstående tekstilvegger: a frame with textile on both faces (face A toward side 1), on foot plates
  for (const f of res.production.free) {
    const t = v.freeTextiles.find((x) => x.id === f.textileId)
    if (!t) continue
    const glow = sel.freeTextileId === t.id ? { emissive: SELECT, emissiveIntensity: 0.35 } : {}
    const alu = mat('textile', ALU, { ...ALU_FINISH, ...glow })
    const L = f.length / 1000
    const h = f.H / 1000
    const face = (x: (typeof f.faces)[number]) => {
      const m = x.fill === 'print' ? findMotif(opts.motifs, x.motif ?? undefined) : undefined
      if (m) return printMaterial(m, L / h, opts.onLoad, glow)
      return mat('textile', x.fill === 'white' ? '#ffffff' : FABRIC, { roughness: 1, ...glow })
    }
    const foot = rules.wall.feet / 10
    const tag: Tag = { layer: 'textile', pick: { freeTextileId: t.id } }
    const g = frame(t.from, t.to, 0)
    // Rails run between the uprights at free ends, or stop at a corner post's leg
    const railFrom = -L / 2 + f.railStart / 1000
    const railTo = railFrom + f.railCuts.reduce((a, x) => a + x, 0) / 1000
    profiles(g, L, h, foot, { from: !f.corners.from, to: !f.corners.to }, railFrom, railTo, alu, tag)
    f.faces.forEach((x, i) => textile(g, -L / 2 + x.start / 1000, x.W / 1000, h, foot, face(x), i === 0 ? 1 : -1, tag))
    for (const at of f.supports) brace(g, -L / 2 + at / 1000, h, foot, alu, tag)
    for (const at of f.supports) {
      const [x, y] = alongRun(t, at)
      const [dx, dy] = runDirection(t)
      const half = f.foot.along / 2000
      along([x - dx * half, y - dy * half], [x + dx * half, y + dy * half], 2 * half, foot, f.foot.across / 1000, 0, mat('textile', ALU, ALU_FINISH), { layer: 'textile' })
    }
  }

  cornerPosts(c)

  /** A group along a → b, centred on it, `off` along the left normal: local x along the run, +z toward face A. */
  function frame(a: Point, b: Point, off: number) {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const L = Math.hypot(dx, dz) || 1
    const g = new THREE.Group()
    g.position.copy(at([(a[0] + b[0]) / 2 + (-dz / L) * off, (a[1] + b[1]) / 2 + (dx / L) * off]))
    g.rotation.y = Math.atan2(-dz, dx)
    c.root.add(g)
    return g
  }

  /** 43TX: top and bottom rail from x0 to x1, and an upright at each end that has one (mitred into the rails). */
  function profiles(g: THREE.Group, L: number, h: number, y0: number, up: { from: boolean; to: boolean }, x0: number, x1: number, m: THREE.Material, tag: Tag) {
    const piece = (len: number, mitre: { from: boolean; to: boolean }, x: number, y: number, rz: number, rx = 0) => {
      const mesh = new THREE.Mesh(mitredProfile('43TX', len, mitre), m)
      mesh.position.set(x, y, 0)
      mesh.rotation.set(rx, 0, rz)
      add(mesh, tag, g)
    }
    const d = depth / 2
    piece(x1 - x0, up, (x0 + x1) / 2, y0 + d, 0)
    piece(x1 - x0, up, (x0 + x1) / 2, y0 + h - d, 0, Math.PI)
    // Outer edge (local −y) turned outward: at the from end toward −x, at the to end toward +x
    if (up.from) piece(h, { from: true, to: true }, -L / 2 + d, y0 + h / 2, -Math.PI / 2)
    if (up.to) piece(h, { from: true, to: true }, L / 2 - d, y0 + h / 2, Math.PI / 2)
  }

  /** Upright brace (90) at x inside the frame, between the rails, in the middle of the frame depth. */
  function brace(g: THREE.Group, x: number, h: number, y0: number, m: THREE.Material, tag: Tag) {
    const mesh = new THREE.Mesh(unitProfile('90'), m)
    mesh.scale.x = h - 2 * depth
    mesh.rotation.z = Math.PI / 2
    mesh.position.set(x, y0 + h / 2, 0)
    add(mesh, tag, g)
  }

  /** Textile over one face (side 1: face A, +z), `w` long from x, just outside the frame. */
  function textile(g: THREE.Group, x: number, w: number, h: number, y0: number, m: THREE.Material, side: 1 | -1, tag: Tag) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
    mesh.position.set(x + w / 2, y0 + h / 2, side * (depth / 2 + 0.0005))
    if (side === -1) mesh.rotation.y = Math.PI
    add(mesh, tag, g)
  }
}

/** 92LTX where two free-standing runs meet, on an end cap with one on top (the post is cut 14 mm shorter). */
function cornerPosts(c: BuildContext) {
  const { v, res, at, mat, add, root } = c
  const corners = cornerEnds(v)
  const done = new Set<string>()
  const foot = rules.wall.feet / 10
  for (const f of res.production.free) {
    const t = v.freeTextiles.find((x) => x.id === f.textileId)
    const ends = corners.get(f.textileId)
    if (!t || !ends) continue
    const [dx, dy] = runDirection(t)
    const at0: [Point, Point, Point | undefined][] = [
      [t.from, [dx, dy], ends.from],
      [t.to, [-dx, -dy], ends.to],
    ]
    for (const [p, a0, b0] of at0) {
      const key = `${p[0]},${p[1]}`
      if (!b0 || done.has(key)) continue
      done.add(key)
      // The legs run along +x and −y of the outline; turn it so they follow the two runs, never mirrored
      const [a, b] = a0[0] * b0[1] - a0[1] * b0[0] < 0 ? [a0, b0] : [b0, a0]
      const plan = (q: readonly number[]): THREE.Vector2 => {
        const ox = (q[0] - CORNER_92LTX[0]) / 1000
        const oy = (q[1] - CORNER_92LTX[1]) / 1000
        // Shape (x, y) → world (x, −z) after turning it upright, and plan y is world z
        return new THREE.Vector2(a[0] * ox - b[0] * oy, -(a[1] * ox - b[1] * oy))
      }
      const glow = c.sel.freeTextileId === t.id ? { emissive: SELECT, emissiveIntensity: 0.35 } : {}
      const m = mat('textile', ALU, { ...ALU_FINISH, ...glow })
      const h = f.H / 1000
      const upright = (outline: readonly (readonly number[])[], y: number, len: number) => {
        let pts = outline.map(plan)
        if (THREE.ShapeUtils.isClockWise(pts)) pts = pts.reverse()
        const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: len, bevelEnabled: false })
        geo.rotateX(-Math.PI / 2)
        const mesh = new THREE.Mesh(geo, m)
        mesh.position.copy(at(p, y))
        add(mesh, { layer: 'textile', pick: { freeTextileId: t.id } }, root)
      }
      // Cap on the floor, the post on it, and a cap on top
      upright(CAP_92LTX, foot, CAP_THICKNESS)
      upright(OUTLINES['92LTX'], foot + CAP_THICKNESS, h - 2 * CAP_THICKNESS)
      upright(CAP_92LTX, foot + h - CAP_THICKNESS, CAP_THICKNESS)
    }
  }
}
