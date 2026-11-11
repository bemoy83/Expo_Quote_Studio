// What the wall drawer shows (docs/pille-og-skuff.md): one answer from what is chosen on the wall and the page open, so
// WallDrawer.tsx switches on it instead of asking «no frame, no decal, no shelf, page …» in every corner. Pure, with tests.
import type { OnWall } from '../selection'

/** What a felt or the whole wall shows: colour and profilering, or what is fitted to it (shelves, later heng), like a door's
 *  own page. Kept from felt to felt. */
export type FeltPage = 'decor' | 'extras'

/** What the drawer is about: a door, frame, decal or shelf chosen on the wall, a felt of it, or the wall itself. */
export type Focus = 'door' | 'textile' | 'foil' | 'shelf' | 'felt' | 'wall'

/** The settings panel on the left. A felt and the whole wall have two pages, colour and shelves. */
export type Panel = 'door' | 'textile' | 'foil' | 'shelf' | 'felt-decor' | 'felt-extras' | 'wall-decor' | 'wall-extras'

export interface Layout {
  panel: Panel
  /** The motif library (Profilering) under the panel, and the button beside it: a decal on the chosen felt, a textile
   *  wall on the whole wall, none with a decal chosen. Null: no library (door, frame, shelf, a shelves page). */
  library: null | { add: 'decal' | 'frame' | null }
  /** The foot (face and its buttons); a door has its mini plan instead. */
  foot: boolean
  /** The face button moves what is chosen to the other face, else shows the other face. */
  moves: boolean
  /** «Hyller og heng» ↔ «Farge og profilering» for a felt and the whole wall. */
  pageSwitch: boolean
  /** A chosen shelf goes back to its felt's colour and profilering. */
  backToFelt: boolean
  /** One button per door in the wall, on the whole wall only. */
  doors: boolean
  /** «Fyll ledig vegg» for a chosen frame. */
  fill: boolean
  /** The paint bucket and brush are live: nothing on the wall is chosen. */
  paint: boolean
}

/** What the drawer is about: the felt counts only when it takes one (`felt` checked by the drawer: a plate, not a door). */
export function focusOf(kind: OnWall['kind'], felt: number | undefined): Focus {
  if (kind === 'opening') return 'door'
  if (kind === 'wall') return felt !== undefined ? 'felt' : 'wall'
  return kind
}

export function layoutOf(focus: Focus, page: FeltPage): Layout {
  const paged = focus === 'felt' || focus === 'wall'
  const panel: Panel = paged ? `${focus}-${page}` : focus
  return {
    panel,
    library: focus === 'foil' ? { add: null } : paged && page === 'decor' ? { add: focus === 'felt' ? 'decal' : 'frame' } : null,
    foot: focus !== 'door',
    moves: focus === 'textile' || focus === 'foil' || focus === 'shelf',
    pageSwitch: paged,
    backToFelt: focus === 'shelf',
    doors: focus === 'wall',
    fill: focus === 'textile',
    paint: focus === 'wall',
  }
}
