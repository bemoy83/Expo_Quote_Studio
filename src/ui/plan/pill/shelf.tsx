// The pill on a shelf or its row: Ned/Opp, Høyde with the quick picks, Hylle til, Kopier, Bare denne
// (docs/pille-og-skuff.md, Byggeregler H1–H12).
import { ArrowDown, ArrowUp, Copy, Layers, MoveVertical, Plus } from 'lucide-react'
import { offRow, shelvesIn } from '../../../domain/shelves/model'
import { Segmented } from '../../controls'
import { rules } from '../../env'
import { mm } from '../../format'
import { QBtn, Sep } from '../quick/parts'
import type { Chosen } from '../selection'
import { shelfActions } from '../shelfActions'
import type { Content, PillActions, SecondFace } from './parts'

export function shelfPill(p: PillActions, c: Extract<Chosen, { kind: 'shelf' }>, heights: SecondFace, remove: () => void): Content {
  const { v, selection: sel, onSelect } = p
  const { shelf: H, wall: w, side: s } = c
  // The row moves as one; «Bare denne» takes the one shelf out of it (Bjørn 9.11.2026)
  const a = shelfActions(v, sel, H, p.onEdit, p.onToast, (shelfId, shelfOnly) => onSelect({ wallId: w.id, side: s, shelfId, shelfOnly }))
  const { n, row, what } = a
  const go = a.move
  const stack = shelvesIn(v, H.wallId, H.module, s)
  const step = rules.shelf.step
  return {
    name: n > 1 ? 'Hyllerad' : 'Hylle',
    meta: [
      n > 1 ? `${n} hyller` : '',
      `${mm(H.y)} mm`,
      stack.length > 1 ? `${stack.indexOf(H) + 1} av ${stack.length}` : '',
      n === 1 && offRow(v, H.id) ? 'avviker fra raden' : '',
    ]
      .filter(Boolean)
      .join(' · '),
    body: heights.on ? (
      <>
        <Segmented<number>
          label="Høyde fra gulvet"
          value={H.y}
          onChange={(y) => {
            go({ y }, `${what} kan ikke stå på ${mm(y)} her`)
            heights.set(false)
          }}
          options={rules.shelf.heights.map((h) => ({ value: h, title: `${mm(h)} mm fra gulvet`, label: <span className="num">{mm(h)}</span> }))}
        />
        <Sep />
        <QBtn title="Tilbake til Ned og Opp" label="Tilbake" onClick={() => heights.set(false)}>
          Tilbake
        </QBtn>
      </>
    ) : (
      <>
        {/* Up and down explain themselves, so they go without text and the pill fits beside both side panels */}
        <QBtn title={`Senk ${mm(step)} mm`} label="Senk" onClick={() => go({ dy: -step }, `${what} kan ikke gå lavere her`)}>
          <ArrowDown size={15} />
        </QBtn>
        <QBtn title={`Hev ${mm(step)} mm`} label="Hev" onClick={() => go({ dy: step }, `${what} kan ikke gå høyere her`)}>
          <ArrowUp size={15} />
        </QBtn>
        <QBtn title="Faste høyder" label="Høyde" onClick={() => heights.set(true)}>
          <MoveVertical size={15} />
          Høyde
        </QBtn>
        <Sep />
        <QBtn title={n > 1 ? 'Legg til en rad til over (eller under)' : 'Legg til en hylle til i samme felt'} label={n > 1 ? 'Rad til' : 'Hylle til'} onClick={a.more}>
          <Plus size={15} />
          {n > 1 ? 'Rad til' : 'Hylle til'}
        </QBtn>
        <QBtn
          title={n > 1 ? 'Kopier raden til nærmeste ledige felt · på desktop også Alt + dra' : 'Kopier hyllen til nærmeste ledige felt · på desktop også Alt + dra'}
          label="Kopier"
          onClick={a.copy}
        >
          <Copy size={15} />
          Kopier
        </QBtn>
        {row > 1 && (
          <QBtn
            title={sel.shelfOnly ? 'Velg hele raden' : 'Velg bare denne hyllen'}
            label={sel.shelfOnly ? 'Hele raden' : 'Bare denne'}
            onClick={() => onSelect({ wallId: w.id, side: s, shelfId: H.id, shelfOnly: !sel.shelfOnly })}
          >
            <Layers size={15} />
            {sel.shelfOnly ? 'Hele raden' : 'Bare denne'}
          </QBtn>
        )}
      </>
    ),
    more: true,
    remove,
  }
}
