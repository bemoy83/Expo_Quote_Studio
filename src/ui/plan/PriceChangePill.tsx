import { signed } from '../format'
import type { PriceChange } from './usePriceChange'

/** What the last stroke changed in the exhibitor's sum, inverted like a toast. It never stands still: the label rises
 *  as it fades in and slows to a drift, then the pill speeds up and fades out (.leaving). By the pointer when the change
 *  came from drawing in the plan (`at`, px inside the drawing surface), else in the dock over the quick picks. */
export function PriceChangePill({ change: { amount, at, leaving } }: { change: PriceChange }) {
  return (
    <div
      className={['price-pill', at && 'at', leaving && 'leaving'].filter(Boolean).join(' ')}
      style={at ? { left: at.x, top: at.y } : undefined}
      role="status"
      title="Endring i utstillers sum, eks. mva."
    >
      <span>{signed(amount)} kr</span>
    </div>
  )
}
