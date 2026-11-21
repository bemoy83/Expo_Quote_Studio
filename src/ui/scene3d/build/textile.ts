// Textile walls: InFrame in front of a wall face, and free-standing frames on foot plates, each built from its run as
// the calc cuts it (one frame, X1). The frames are real 43TX (mitred in the corners, build/profiles.ts) with the textile
// on the face out from the wall, or both faces on foot plates; runs that meet share a 92LTX on its end caps (X7).
import * as THREE from 'three'
import { alongRun } from '../../../calc/textile/free'
import { cornerEnds, runDirection, runLength } from '../../../domain/textile/free'
import type { Point, TextileFill } from '../../../domain/types'
import { wallDirection } from '../../../domain/grid'
import { rules } from '../../env'
import { findMotif } from '../../motifs'
import { textileBox } from '../../../domain/textile/inFrame'
import { printMaterial } from './motifs'
import { noteMaterial } from './note'
import { textileNote } from '../../textileNote'
import { ALU, ALU_FINISH, selectGlow, type BuildContext, type Tag } from './context'
import { CAP_92LTX, CAP_THICKNESS, CORNER_92LTX, OUTLINES, mitredProfile, shared, unitProfile } from './profiles'
import { freeTextiles, mountedOn, outFace, wallTextiles } from '../../../domain/textile/mounts'

export function buildTextile(c: BuildContext) {
  const { v, res, opts, H, at, mat, add, along, sel } = c
  const depth = rules.textile.depth
  // Textile walls (InFrame): a 43TX frame with textile over both faces, standing in front of its wall face. The motif is
  // printed on the front.
  for (const p of res.production.pieces) {
    const t = v.textiles.find((x) => x.id === p.textileId)
    const on = mountedOn(v, p.textileId)
    const view = wallTextiles(v).find((x) => x.id === p.textileId)
    if (!t || !on || !view) continue
    // Where it stands: its run, against the posts' face (20–60 mm out from the wall line, X2), moved in an inner corner
    // where two frames would clash (X10)
    const [dx, dy] = wallDirection(on.wall)
    const shift = (p.shift ?? 0) / 1000
    const moved = (q: Point): Point => [q[0] + dx * shift, q[1] + dy * shift]
    const L = runLength(t)
    const { bottom, height } = textileBox(view, rules)
    const h = Math.min(height, H - bottom)
    const glow = selectGlow(sel.textileId === t.id)
    const alu = mat('textile', ALU, { ...ALU_FINISH, ...glow })
    const m = p.fill === 'print' ? findMotif(opts.motifs, p.motif ?? undefined) : undefined
    const W = p.W / 1000
    const print = m ? printMaterial(m, W / h, opts.onLoad, glow) : p.fill === 'white' ? white(glow) : bare(p.fill, W, h, glow)
    const g = frame(moved(t.from), moved(t.to), 0)
    const tag: Tag = { layer: 'textile', pick: { wallId: on.wall.id, textileId: t.id } }
    // Rails run between the uprights at free ends, or stop at a 92LTX's leg (X7)
    const railFrom = -L / 2 + p.railStart / 1000
    const railTo = railFrom + p.railCuts.reduce((a, x) => a + x, 0) / 1000
    profiles(g, L, h, bottom, { from: !p.corners.from, to: !p.corners.to }, railFrom, railTo, alu, tag)
    // One textile, on the face out from the wall
    textile(g, -L / 2 + p.faceStart / 1000, W, h, bottom, print, outFace(t, on.wall, on.side) === 'a' ? 1 : -1, tag)
    // Upright braces (90) where the calc puts them, as on foot plates: by a splice and at most 2 m apart
    for (const at of p.braceAt) brace(g, -L / 2 + at / 1000, h, bottom, alu, tag)
  }

  // Frittstående tekstilvegger: a frame with textile on both faces (face A toward side 1), on foot plates
  for (const f of res.production.free) {
    const t = freeTextiles(v).find((x) => x.id === f.textileId)
    if (!t) continue
    const glow = selectGlow(sel.freeTextileId === t.id)
    const alu = mat('textile', ALU, { ...ALU_FINISH, ...glow })
    const L = f.length / 1000
    const h = f.H / 1000
    const face = (x: (typeof f.faces)[number]) => {
      const m = x.fill === 'print' ? findMotif(opts.motifs, x.motif ?? undefined) : undefined
      if (m) return printMaterial(m, L / h, opts.onLoad, glow)
      return x.fill === 'white' ? white(glow) : bare(x.fill, x.W / 1000, h, glow)
    }
    const foot = rules.wall.feet / 10
    const tag: Tag = { layer: 'textile', pick: { freeTextileId: t.id } }
    const g = frame(alongRun(t, 0, f), alongRun(t, f.length, f), 0)
    // Rails run between the uprights at free ends, or stop at a corner post's leg
    const railFrom = -L / 2 + f.railStart / 1000
    const railTo = railFrom + f.railCuts.reduce((a, x) => a + x, 0) / 1000
    profiles(g, L, h, foot, { from: !f.corners.from, to: !f.corners.to }, railFrom, railTo, alu, tag)
    f.faces.forEach((x, i) => textile(g, -L / 2 + x.start / 1000, x.W / 1000, h, foot, face(x), i === 0 ? 1 : -1, tag))
    for (const at of f.braces) brace(g, -L / 2 + at / 1000, h, foot, alu, tag)
    for (const at of f.supports) {
      const [x, y] = alongRun(t, at, f)
      const [dx, dy] = runDirection(t)
      const half = f.foot.along / 2000
      along([x - dx * half, y - dy * half], [x + dx * half, y + dy * half], 2 * half, foot, f.foot.across / 1000, 0, mat('textile', ALU, ALU_FINISH), { layer: 'textile' })
    }
  }

  cornerPosts(c)

  function white(glow: THREE.MeshStandardMaterialParameters) {
    return mat('textile', '#ffffff', { roughness: 1, ...glow })
  }
  /** A print not chosen yet, or the customer's own textile: the frame stands bare (Bjørn 6.11.2026; a tinted sheet
   *  looks like clear plexi, which the system can hold too), with only the note on a see-through face `w` × `h` m
   *  (Bjørn 8.11.2026: no solid fill, it must not look like a motif is chosen). The face is there to click. */
  function bare(fill: TextileFill, w: number, h: number, glow: THREE.MeshStandardMaterialParameters) {
    const note = textileNote(fill, false)
    return note ? noteMaterial(note, w, h, glow) : mat('textile', '#ffffff', { visible: false, ...glow })
  }

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
    // A bare face casts no shadow
    if (!m.visible || m.transparent) mesh.castShadow = false
  }
}

/** 92LTX where two runs meet, on walls or on foot plates (X7), on an end cap with one on top (the post is cut 14 mm
 *  shorter), as tall as the frames it joins. */
function cornerPosts(c: BuildContext) {
  const { v, res, at, mat, add, root } = c
  const corners = cornerEnds(v)
  const done = new Set<string>()
  const foot = rules.wall.feet / 10
  // How each run's frame stands: its height and how far up it starts
  const stands = new Map<string, { h: number; y0: number; pick: Tag['pick'] }>()
  for (const p of res.production.pieces) {
    const view = wallTextiles(v).find((x) => x.id === p.textileId)
    if (view) stands.set(p.textileId, { h: p.H / 1000, y0: textileBox(view, rules).bottom, pick: { wallId: view.wallId, textileId: view.id } })
  }
  for (const f of res.production.free) stands.set(f.textileId, { h: f.H / 1000, y0: foot, pick: { freeTextileId: f.textileId } })
  for (const t of v.textiles) {
    const ends = corners.get(t.id)
    const st = stands.get(t.id)
    if (!ends || !st) continue
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
      const chosen = c.sel.freeTextileId === t.id || c.sel.textileId === t.id
      const m = mat('textile', ALU, { ...ALU_FINISH, ...selectGlow(chosen) })
      const upright = (part: 'post' | 'cap', y: number, len: number) => {
        const mesh = new THREE.Mesh(cornerGeometry(part, a, b), m)
        mesh.scale.y = len
        mesh.position.copy(at(p, y))
        add(mesh, { layer: 'textile', pick: st.pick }, root)
      }
      // Cap on the floor, the post on it, and a cap on top
      upright('cap', st.y0, CAP_THICKNESS)
      upright('post', st.y0 + CAP_THICKNESS, st.h - 2 * CAP_THICKNESS)
      upright('cap', st.y0 + st.h - CAP_THICKNESS, CAP_THICKNESS)
    }
  }
}

/** 1 m of 92LTX (or its end cap) standing up from y = 0, turned so its legs run along the plan directions a and b.
 *  Shared for the session: a corner only turns a few ways, so the outline is triangulated once per way. */
function cornerGeometry(part: 'post' | 'cap', a: readonly number[], b: readonly number[]) {
  return shared(`92LTX-${part}-${a.map((x) => x.toFixed(3))}-${b.map((x) => x.toFixed(3))}`, () => {
    const plan = (q: readonly number[]): THREE.Vector2 => {
      const ox = (q[0] - CORNER_92LTX[0]) / 1000
      const oy = (q[1] - CORNER_92LTX[1]) / 1000
      // Shape (x, y) → world (x, −z) after turning it upright, and plan y is world z
      return new THREE.Vector2(a[0] * ox - b[0] * oy, -(a[1] * ox - b[1] * oy))
    }
    let pts = (part === 'cap' ? CAP_92LTX : OUTLINES['92LTX']).map(plan)
    if (THREE.ShapeUtils.isClockWise(pts)) pts = pts.reverse()
    return new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 1, bevelEnabled: false }).rotateX(-Math.PI / 2)
  })
}
