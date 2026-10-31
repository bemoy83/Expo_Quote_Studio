import type { LucideIcon } from 'lucide-react'
import { Armchair, Grid3x3, Image, Library, Lightbulb, Monitor, PanelsTopLeft, Paperclip, Ruler, Sprout, Store, Wrench } from 'lucide-react'
import { PRODUCT_GROUPS } from '../../catalog/groups'

export interface Menu {
  key: string
  name: string
  /** Abbreviation for the icon strip only; everywhere else the group has one name. */
  short?: string
  icon: LucideIcon
  group: 'build' | 'equip'
}

/** Look of each main group in the panel. Names and order come from the product grouping (catalog/groups.ts). */
const LOOK: Record<string, { icon: LucideIcon; short?: string; build?: true }> = {
  vegg: { icon: PanelsTopLeft, short: 'Vegger', build: true },
  gulv: { icon: Grid3x3, short: 'Gulv', build: true },
  mob: { icon: Armchair },
  disk: { icon: Store, short: 'Disker' },
  hyll: { icon: Library, short: 'Hyller' },
  lys: { icon: Lightbulb, short: 'Lys/strøm' },
  prof: { icon: Image },
  av: { icon: Monitor, short: 'AV' },
  plant: { icon: Sprout, short: 'Planter' },
  tilb: { icon: Paperclip },
  tjen: { icon: Wrench, short: 'Tjenester' },
}

/** Build steps first, then equipment menus: the Stand step, then one menu per main group. */
export const MENUS: Menu[] = [
  { key: 'stand', name: 'Stand', icon: Ruler, group: 'build' },
  ...PRODUCT_GROUPS.map((g): Menu => {
    const l = LOOK[g.id] ?? { icon: Paperclip }
    return { key: g.id, name: g.name, ...(l.short ? { short: l.short } : {}), icon: l.icon, group: l.build ? 'build' : 'equip' }
  }),
]
