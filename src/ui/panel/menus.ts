import type { LucideIcon } from 'lucide-react'
import { Armchair, Grid3x3, Image, Library, Lightbulb, Monitor, PanelsTopLeft, Paperclip, Ruler, Sprout, Store } from 'lucide-react'

export interface Menu {
  key: string
  name: string
  short?: string
  icon: LucideIcon
  group: 'build' | 'equip'
}

/** Build steps first, then equipment menus. `key` matches `Product.menu` in the catalog. */
export const MENUS: Menu[] = [
  { key: 'stand', name: 'Stand', icon: Ruler, group: 'build' },
  { key: 'vegg', name: 'Vegger og bakrom', short: 'Vegger', icon: PanelsTopLeft, group: 'build' },
  { key: 'gulv', name: 'Tepper og gulv', short: 'Gulv', icon: Grid3x3, group: 'build' },
  { key: 'mob', name: 'Møbler', icon: Armchair, group: 'equip' },
  { key: 'disk', name: 'Disker og podier', short: 'Disker', icon: Store, group: 'equip' },
  { key: 'hyll', name: 'Hyller og heng', short: 'Hyller', icon: Library, group: 'equip' },
  { key: 'lys', name: 'Strøm, lys og oppheng', short: 'Lys/strøm', icon: Lightbulb, group: 'equip' },
  { key: 'prof', name: 'Profilering', icon: Image, group: 'equip' },
  { key: 'av', name: 'Lyd og bilde', short: 'AV', icon: Monitor, group: 'equip' },
  { key: 'plant', name: 'Planter og fruktkurv', short: 'Planter', icon: Sprout, group: 'equip' },
  { key: 'tilb', name: 'Tilbehør', icon: Paperclip, group: 'equip' },
]
