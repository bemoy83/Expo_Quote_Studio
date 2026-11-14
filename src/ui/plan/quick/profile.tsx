// Profilering by product (Bjørn 14.11.2026): Pensel is Tekstil, Print and Dekal, each its own pen, named from the
// product list; Farge is the graphics they share: the newest motifs and upload, on the pen in hand; Tilpasset the
// drawing grid of Tekstil.
import { Image, Sticker, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { shortName } from '../../../catalog/lookup'
import { ImageInput } from '../../controls'
import { catalog, productOf, rules } from '../../env'
import { isProfilePen, motifOn, profileKind, profilePen, withMotif, type ProfileKind } from '../../profilePen'
import { gridSteps } from '../../tools'
import { GridPicker } from '../GridPicker'
import { MOTIFS } from './limits'
import { QBtn, Sep } from './parts'
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
      {p.motifs
        .filter((m, i) => i >= p.motifs.length - MOTIFS || motifOn(brush, m.id))
        .map((m) => (
          <button key={m.id} type="button" className="q-motif" aria-pressed={motifOn(brush, m.id)} title={`Motiv: ${m.name}`} onClick={() => onPick(withMotif(cur, m.id))}>
            <img src={m.src} alt={m.name} draggable={false} />
          </button>
        ))}
      <label className="q-btn" title="Last opp kundens eget motiv" aria-label="Last opp motiv">
        <Upload size={15} />
        <ImageInput onFile={p.onUpload} />
      </label>
      {/* Tilpasset: the drawing grid, only Tekstil has one */}
      {cur?.kind === 'textile' && (
        <>
          <Sep />
          <GridPicker value={p.gridStep} allowed={gridSteps(cur, rules)} onChange={p.onGridStep} />
        </>
      )}
      {more}
    </>
  )
}
