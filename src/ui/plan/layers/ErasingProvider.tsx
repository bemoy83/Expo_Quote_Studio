// Shares what Tøm is about to take with the plan's layers (erasing.ts), and the hatch they lay over it: the plan's one
// hatch, the same as an invalid target (HATCH in planStyle.ts).
import { useId, type ReactNode } from 'react'
import type { Erasing } from '../pointer/erase'
import { ErasingContext } from './erasing'
import { HatchPattern } from './Previews'

/** Each plan on the page has its own pattern id, so the mini plans never share one. */
export function ErasingProvider({ erasing, children }: { erasing: Erasing | null; children: ReactNode }) {
  const id = `erase${useId().replace(/:/g, '')}`
  const gone = (group: Erasing['group'], x: string) => !!erasing && erasing.group === group && erasing.id === x
  return (
    <ErasingContext.Provider value={{ gone, hatch: `url(#${id})` }}>
      {erasing && <HatchPattern id={id} />}
      {children}
    </ErasingContext.Provider>
  )
}
