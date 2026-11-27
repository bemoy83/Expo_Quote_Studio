// A raised wall seen straight on (Byggeregler V18, V21, S9): each raised felt and part over its module, the 94 joined
// onto its posts (a post between two heights with the higher) and the ceiling wires on the posts that have one. Shared
// by the wall drawer and the work order, so both draw the same.
import { variantWires } from '../../calc/wallWires'
import { moduleCc, moduleStart, pointAlong, pointKey } from '../../domain/grid'
import type { Variant, Wall } from '../../domain/types'
import { postOffsets, splitParts, type BuiltModule, type WallPart } from '../../domain/walls'
import { plateColor, rules } from '../env'

export interface RaiseDrawing {
  felts: { at: number; cc: number; len: number; fill: string }[]
  posts: { x: number; len: number }[]
  wires: { x: number; len: number }[]
  /** How far the raise goes over the wall's top, m (0 when not raised). */
  above: number
  /** Room the drawing needs over the wall's top, m: the raise and the wire marks over it. */
  headroom: number
}

/** The posts of a sketch that hang from a ceiling wire (S9), by point. */
export const wiredPosts = (v: Variant): Set<string> => new Set(variantWires(v, rules).map((f) => pointKey(f.at)))

/** Room for the wire mark over the top, m (elevation.tsx draws its circle there). */
const WIRE_ROOM = 0.22

export function raiseDrawing(w: Wall, mods: readonly (BuiltModule | undefined)[], parts: readonly WallPart[], u: (t: number) => number, wired: ReadonlySet<string>): RaiseDrawing {
  const raised = mods.flatMap((m, i) => {
    const split = !m ? splitParts(parts, i) : []
    return split.length ? split.filter((q) => q.mod.raise).map((q) => ({ at: q.at, cc: q.cc, r: q.mod.raise! })) : m?.raise ? [{ at: moduleStart(w, i), cc: moduleCc(w, i), r: m.raise }] : []
  })
  const felts = raised.map((f) => ({ at: f.at, cc: f.cc, len: f.r.len / 1000, fill: plateColor(f.r.ral) }))
  const key = (x: number) => Math.round(x * 1000) / 1000
  const tops = new Map<number, number>()
  for (const f of felts) for (const t of [f.at, f.at + f.cc]) tops.set(key(u(t)), Math.max(tops.get(key(u(t))) ?? 0, f.len))
  const wires = wired.size
    ? postOffsets(w, parts)
        .filter((t) => wired.has(pointKey(pointAlong(w, t))))
        .map((t) => ({ x: u(t), len: tops.get(key(u(t))) ?? 0 }))
        .filter((m) => m.len > 0)
    : []
  const above = Math.max(0, ...felts.map((f) => f.len))
  return { felts, posts: [...tops].map(([x, len]) => ({ x, len })), wires, above, headroom: above + (wires.length ? WIRE_ROOM : 0) }
}
