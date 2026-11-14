// What each drawing tool remembers behind its Pensel buttons (Bjørn 14.11.2026): the item last in hand per function
// (Disker og podier), the opening and its colours (Vegg), the colour per floor type (Gulv), the single piece (Møbel) and
// the graphics (Profilering). One function, so a new pen (heng on Hyller) adds one line here. Pure.
import { productWith } from '../catalog/lookup'
import type { Product } from '../catalog/types'
import { furniturePicksOf } from './furniturePen'
import { funcOf } from './podiumPen'
import { isProfilePen } from './profilePen'
import type { Brush, PenPicks, PenTool } from './tools'
import { wallPicksOf } from './wallPen'

export type ToolPicks = Partial<Record<PenTool, PenPicks>>

/** The picks after `b` was put in hand. */
export function rememberPick(picks: ToolPicks, b: Brush, products: readonly Product[]): ToolPicks {
  if (b.kind === 'podium') {
    const func = funcOf(b)
    return func ? { ...picks, podium: { ...picks.podium, [func]: b.stock } } : picks
  }
  if (b.kind === 'opening') return { ...picks, wall: wallPicksOf(b) }
  if (b.kind === 'floor') {
    const type = productWith(products, b.product)?.id
    return type ? { ...picks, floor: { ...picks.floor, [type]: b.product } } : picks
  }
  if (isProfilePen(b)) return b.motif ? { ...picks, profile: { motif: b.motif } } : picks
  const single = furniturePicksOf(b, products)
  return single ? { ...picks, object: single } : picks
}
