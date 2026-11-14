// Profilering: the textile wall pen, the newest motifs, the drawing grid while the textile pen is in hand, and upload.
import { Upload } from 'lucide-react'
import { ImageInput } from '../../controls'
import { rules } from '../../env'
import { gridSteps, type Brush } from '../../tools'
import { GridPicker } from '../GridPicker'
import { MOTIFS } from './limits'
import { QBtn, Sep } from './parts'
import type { QuickCtx } from './types'

export function ProfilePicks({ p, head, more, is }: QuickCtx) {
  const { brush, onPick } = p
    return (
      <>
        {head}
        <QBtn on={brush?.kind === 'textile'} title="Tekstilvegg · på systemvegg eller frittstående" onClick={() => onPick({ kind: 'textile' })}>
          <i className="tex-thumb q-tex" />
          Tekstil
        </QBtn>
        <Sep />
        {p.motifs
          .filter((m, i) => i >= p.motifs.length - MOTIFS || (brush?.kind === 'motif' && brush.motif === m.id))
          .map((m) => {
            const b: Brush = { kind: 'motif', motif: m.id }
            return (
              <button key={m.id} type="button" className="q-motif" aria-pressed={is(b)} title={`Motiv: ${m.name}`} onClick={() => onPick(b)}>
                <img src={m.src} alt={m.name} draggable={false} />
              </button>
            )
          })}
        {brush?.kind === 'textile' && (
          <>
            <Sep />
            <GridPicker value={p.gridStep} allowed={gridSteps(brush, rules)} onChange={p.onGridStep} />
          </>
        )}
        <Sep />
        <label className="q-btn" title="Last opp kundens eget motiv" aria-label="Last opp motiv">
          <Upload size={15} />
          <ImageInput onFile={p.onUpload} />
        </label>
        {more}
      </>
    )
}
