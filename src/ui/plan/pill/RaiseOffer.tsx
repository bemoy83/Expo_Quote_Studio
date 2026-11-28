// Byggeregel X15: the pill on a tall textile offers to raise the wall under it, or a white textile toward a neighbour (N1)
import { useMemo } from 'react'
import { calc } from '../../../calc/calc'
import { neighbourNotes, noteFor } from '../../../domain/neighbour'
import { raiseFor, raiseUnder } from '../../../domain/raise'
import { updateTextile } from '../../../domain/textile/inFrame'
import { mountedOn, wallTextiles } from '../../../domain/textile/mounts'
import type { Variant } from '../../../domain/types'
import { DEFAULT_STAND_WALLS } from '../../../domain/variant'
import { raiseTop } from '../../../rules/rules'
import { catalog, pricing, rules } from '../../env'
import { mm, signed } from '../../format'
import { QBtn, Sep } from '../quick/parts'
import type { PillActions } from './parts'

/** Byggeregel X15: «Hev veggen til N» for a frame over its wall's top, and «Hvit duk» for one showing its textile to a
 *  neighbour (N1), each with what it does to the quote. */
export function RaiseOffer({ p, textileId }: { p: PillActions; textileId: string }) {
  const { v } = p
  const offers = useMemo(() => {
    const sum = (x: Variant) => calc(x, rules, catalog, DEFAULT_STAND_WALLS, pricing).sum
    const len = raiseFor(v, rules, textileId)
    const note = noteFor(neighbourNotes(v, rules), textileId)
    const t = wallTextiles(v).find((x) => x.id === textileId)
    const white = note && !note.neutral && t?.fill !== 'white' && mountedOn(v, textileId) ? updateTextile(v, rules, textileId, { fill: 'white' }) : null
    const raised = len ? raiseUnder(v, rules, textileId) : null
    const now = raised || white ? sum(v) : 0
    return [
      ...(raised && len ? [{ key: 'raise', label: `Hev veggen til ${mm(raiseTop(len, rules) / 1000)}`, title: 'Hever veggen så den tar rammen, og skjuler baksiden mot naboen', next: raised, diff: sum(raised) - now }] : []),
      ...(white && !raised ? [{ key: 'white', label: 'Hvit duk', title: 'Hvit duk er nøytral mot naboen', next: white, diff: sum(white) - now }] : []),
    ]
  }, [v, textileId])
  if (!offers.length) return null
  return (
    <>
      <Sep />
      {offers.map((o) => (
        <QBtn key={o.key} title={`${o.title} · ${signed(o.diff)} kr på tilbudet`} label={o.label} onClick={() => p.onEdit(() => o.next)}>
          <span className="q-std">
            <b>{o.label}</b>
            <small>{signed(o.diff)} kr</small>
          </span>
        </QBtn>
      ))}
    </>
  )
}
