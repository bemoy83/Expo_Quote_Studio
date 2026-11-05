// The outline of one floor product (muted floor) and the joints between tiles and lanes (full floor) in the plan
// (layers/FloorLayer.tsx).
import { CELL } from '../../domain/grid'
import type { FloorTile } from '../../domain/types'

/** The outline of all floor of one product: every cell edge with another product (or none) on the other side. */
export function outlinePath(tiles: FloorTile[], product: string): string {
  const owner = new Map<string, string>()
  for (const t of tiles) for (let i = t.i; i < t.i + t.w; i++) for (let j = t.j; j < t.j + t.h; j++) owner.set(`${i},${j}`, t.product)
  const mine = (i: number, j: number) => owner.get(`${i},${j}`) === product
  const d: string[] = []
  for (const [key, p] of owner) {
    if (p !== product) continue
    const [i, j] = key.split(',').map(Number)
    const x0 = i * CELL
    const y0 = j * CELL
    const x1 = x0 + CELL
    const y1 = y0 + CELL
    if (!mine(i, j - 1)) d.push(`M${x0} ${y0}H${x1}`)
    if (!mine(i, j + 1)) d.push(`M${x0} ${y1}H${x1}`)
    if (!mine(i - 1, j)) d.push(`M${x0} ${y0}V${y1}`)
    if (!mine(i + 1, j)) d.push(`M${x1} ${y0}V${y1}`)
  }
  return d.join('')
}

/**
 * The joints of the tiles `of` (one product): every cell edge where the tile meets another tile, not where it meets bare
 * floor or the stand edge. An edge between two tiles of the product is drawn once (right and bottom side of a tile); an
 * edge against another product or a seamless floor is always drawn, so it shows whichever side is drawn last.
 */
export function jointPath(tiles: readonly FloorTile[], of: readonly FloorTile[], jointed: (t: FloorTile) => boolean): string {
  const owner = new Map<string, FloorTile>()
  for (const t of tiles) for (let i = t.i; i < t.i + t.w; i++) for (let j = t.j; j < t.j + t.h; j++) owner.set(`${i},${j}`, t)
  const d: string[] = []
  for (const t of of) {
    /** Draw the edge toward cell (i, j): a joint when another tile lies there. */
    const edge = (i: number, j: number, mine: boolean) => {
      const n = owner.get(`${i},${j}`)
      if (!n || n === t) return false
      return mine || n.product !== t.product || !jointed(n)
    }
    for (let i = t.i; i < t.i + t.w; i++) {
      const x0 = i * CELL
      if (edge(i, t.j - 1, false)) d.push(`M${x0} ${t.j * CELL}h${CELL}`)
      if (edge(i, t.j + t.h, true)) d.push(`M${x0} ${(t.j + t.h) * CELL}h${CELL}`)
    }
    for (let j = t.j; j < t.j + t.h; j++) {
      const y0 = j * CELL
      if (edge(t.i - 1, j, false)) d.push(`M${t.i * CELL} ${y0}v${CELL}`)
      if (edge(t.i + t.w, j, true)) d.push(`M${(t.i + t.w) * CELL} ${y0}v${CELL}`)
    }
  }
  return d.join('')
}
