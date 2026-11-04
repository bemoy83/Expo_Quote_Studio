// Tøm: what a click would take (pointer/erase.ts) is shown in its own layer, dimmed and hatched, so the thing itself
// is marked rather than a box drawn over it. Each layer asks `gone` for what it draws and lays `hatch` over it. The plan
// shares both through ErasingProvider.
import { createContext, useContext } from 'react'
import type { Erasing } from '../pointer/erase'

/** Opacity of a line about to be erased (wall, door, beam, textile). */
export const GONE = 0.35
/** Fill opacity of a shape about to be erased (furniture, floor): see-through, its outline kept, so it does not read
 * as a grey solid. */
export const GONE_FILL = 0.12

export interface ErasingCtx {
  gone: (group: Erasing['group'], id: string) => boolean
  /** Paint for the hatch, as fill or stroke. */
  hatch: string
}

export const ErasingContext = createContext<ErasingCtx>({ gone: () => false, hatch: 'none' })

export const useErasing = () => useContext(ErasingContext)
