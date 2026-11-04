// Tøm: what a click would take (pointer/erase.ts) is shown in its own layer, dimmed and hatched, so the thing itself
// is marked rather than a box drawn over it. Each layer asks `gone` for what it draws and lays `hatch` over it. The plan
// shares both through ErasingProvider.
import { createContext, useContext } from 'react'
import type { Erasing } from '../pointer/erase'

/** Opacity of a thing about to be erased. */
export const GONE = 0.35

export interface ErasingCtx {
  gone: (group: Erasing['group'], id: string) => boolean
  /** Paint for the hatch, as fill or stroke. */
  hatch: string
}

export const ErasingContext = createContext<ErasingCtx>({ gone: () => false, hatch: 'none' })

export const useErasing = () => useContext(ErasingContext)
