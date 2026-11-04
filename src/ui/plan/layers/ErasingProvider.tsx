// Shares what Tøm is about to take with the plan's layers (erasing.ts), and the hatch pattern they lay over it.
import { useId, type ReactNode } from 'react'
import type { Erasing } from '../pointer/erase'
import { ErasingContext } from './erasing'

/** Each plan on the page has its own pattern id, so the mini plans never share one. */
export function ErasingProvider({ erasing, children }: { erasing: Erasing | null; children: ReactNode }) {
  const id = `erase${useId().replace(/:/g, '')}`
  const gone = (group: Erasing['group'], x: string) => !!erasing && erasing.group === group && erasing.id === x
  return (
    <ErasingContext.Provider value={{ gone, hatch: `url(#${id})` }}>
      {erasing && (
        <defs>
          <pattern id={id} patternUnits="userSpaceOnUse" width={0.08} height={0.08} patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={0.08} stroke="rgb(var(--ink) / .7)" strokeWidth={0.025} />
          </pattern>
        </defs>
      )}
      {children}
    </ErasingContext.Provider>
  )
}
