// The outline of one floor product in the plan, for the muted floor layer (layers/FloorLayer.tsx).
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
