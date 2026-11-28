// Profilering by product (Bjørn 14.11.2026): Pensel is Tekstil, Print and Dekal, each its own pen, named from the
// product list; Farge is the graphics they share: the newest motifs and upload, on the pen in hand; Tilpasset «Fin» for
// Tekstil (10 mm from 250, as Shift: the finest a frame is cut in, Byggeregel X9).
import { Image, Sticker, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { shortName } from '../../../catalog/lookup'
import { ImageInput } from '../../controls'
import { catalog, productOf } from '../../env'
import { isProfilePen, motifOn, profileKind, profilePen, withMotif, type ProfileKind } from '../../profilePen'
import { FinBtn, MotifRow, QBtn, Sep } from './parts'
import type { QuickCtx } from './types'

const PENS: { kind: ProfileKind; artnr: () => string; title: string }[] = [
  { kind: 'textile', artnr: () => catalog.system.textile, title: 'tekstilvegg på systemvegg eller frittstående · motivet trykkes på den' },
  { kind: 'print', artnr: () => catalog.system.foilFull, title: 'hele veggfeltet i folie · klikk et veggfelt' },
  { kind: 'decal', artnr: () => catalog.system.foil, title: 'dekal i folie på et veggfelt · klikk et veggfelt' },
]

const ICON: Record<ProfileKind, ReactNode> = {
  textile: <i className="tex-thumb q-tex" />,
  print: <Image size={15} />,
  decal: <Sticker size={15} />,
}

export function ProfilePicks({ p, head, more }: QuickCtx) {
  const { brush, onPick } = p
  const cur = isProfilePen(brush) ? brush : null
  const kind = cur ? profileKind(cur) : undefined
  // The graphics last in hand, else the newest in the library
  const last = p.picks.profile?.motif ?? p.motifs.at(-1)?.id
  return (
    <>
      {head}
      {PENS.map((x) => {
        const name = shortName(productOf(x.artnr()) ?? { name: x.kind })
        const pen = profilePen(x.kind, cur, last)
        return (
          <QBtn key={x.kind} on={kind === x.kind} disabled={!pen} title={`${name} · ${x.title}`} label={name} onClick={() => pen && onPick(pen)}>
            {ICON[x.kind]}
            {name}
          </QBtn>
        )
      })}
      {/* Farge: the graphics, on the pen in hand */}
      <Sep />
      <MotifRow motifs={p.motifs} on={(id) => motifOn(brush, id)} onPick={(id) => onPick(withMotif(cur, id))} />
      <label className="q-btn" title="Last opp kundens eget motiv" aria-label="Last opp motiv">
        <Upload size={15} />
        <ImageInput onFile={p.onUpload} />
      </label>
      {/* Tilpasset: «Fin» for Tekstil (10 mm, as Shift: the finest step it is built in, X9); Print and Dekal are clicked on a felt */}
      <Sep />
      <FinBtn
        off={cur?.kind === 'textile' ? undefined : 'Fin · gjelder bare Tekstil'}
        title={{ on: 'Fin · fri lengde i 10 mm, blir kapp · trykk for standardlengder igjen', off: 'Fin · tegn tekstilvegg i fri lengde, 10 mm fra en 250-node, blir kapp · på desktop også Shift' }}
      />
      {more}
    </>
  )
}
