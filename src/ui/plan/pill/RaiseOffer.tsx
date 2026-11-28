// Byggeregel X15: the pill on a tall textile offers to raise the wall under it (the offer itself in ../raiseOffer.ts,
// shared with the drawer)
import { signed } from '../../format'
import { QBtn, Sep } from '../quick/parts'
import { useRaiseOffer } from '../raiseOffer'
import type { PillActions } from './parts'

/** «Hev veggen til N» for a frame over its wall's top, with what it does to the quote. */
export function RaiseOffer({ p, textileId }: { p: PillActions; textileId: string }) {
  const o = useRaiseOffer(p.v, textileId)
  if (!o) return null
  return (
    <>
      <Sep />
      <QBtn title={`${o.title} · ${signed(o.diff)} kr på tilbudet`} label={o.label} onClick={() => p.onEdit(() => o.next)}>
        <span className="q-std">
          <b>{o.label}</b>
          <small>{signed(o.diff)} kr</small>
        </span>
      </QBtn>
    </>
  )
}
