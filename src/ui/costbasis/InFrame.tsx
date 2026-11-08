// The textile frame's assumptions (InFrame), editable on Kostgrunnlag › Regler: they set the frame and print sizes and
// feed the calc, so they sit with the other build rules. Only what is changed from the app's default is saved
// (rules/rules.ts). Byggeregler X2, X3, X8 (docs/byggeregler.md).
import { fullHeight } from '../../calc/textile/common'
import type { InFrameParams } from '../../rules/rules'
import { CommitInput } from '../controls'
import { DEFAULT_IN_FRAME, rules, setInFrame } from '../env'
import { fmt } from '../format'

const FIELDS: { k: keyof InFrameParams; name: string; id: string; use: string; unit?: string }[] = [
  { k: 'side', name: 'Fradrag for vegg eller drager, begge sider', id: 'X2', use: 'Rammens bredde i spennet' },
  { k: 'air', name: 'Monteringsluft i bredden', id: 'X2', use: 'Rammens bredde i spennet' },
  { k: 'wallH', name: 'Systemvegg uten føtter', id: 'X2', use: 'Rammens høyde' },
  { k: 'feet', name: 'Justerbare føtter', id: 'X2', use: 'Rammens høyde' },
  { k: 'bleed', name: 'Bleed per side på trykkfilen', id: 'X3', use: 'Trykkfilens mål, m² trykk' },
  { k: 'scale', name: 'Filskala kunden leverer i', id: 'X3', use: 'Filmålet på tilbudet', unit: '%' },
  { k: 'prof', name: 'Rammeprofil, bredde', id: 'X8', use: 'Staglengde' },
  { k: 'stag', name: 'Største avstand mellom stag', id: 'X8', use: 'Antall stag i rammen' },
]

export function InFrameRules({ onToast }: { onToast: (t: string) => void }) {
  const s = rules.textile.inFrame
  const changed = FIELDS.some((f) => s[f.k] !== DEFAULT_IN_FRAME[f.k])
  return (
    <section className="tbl-sec">
      <div className="tbl-sec-head kg-head-action">
        <span>Tekstilramme</span>
        {changed && (
          <button
            type="button"
            className="link"
            onClick={() => {
              setInFrame({ ...DEFAULT_IN_FRAME })
              onToast('Tekstilrammen tilbakestilt')
            }}
          >
            Tilbakestill
          </button>
        )}
      </div>
      {FIELDS.map((f) => (
        <label key={f.k} className={'kg-grid kg-row tbl-row' + (s[f.k] !== DEFAULT_IN_FRAME[f.k] ? ' changed' : '')}>
          <span className="n">{f.name}</span>
          <span className="unit-field">
            <CommitInput
              className="num"
              inputMode="numeric"
              value={String(s[f.k])}
              aria-label={f.name}
              selectOnFocus
              onCommit={(text) => {
                const x = parseFloat(text.replace(',', '.'))
                if (!Number.isFinite(x) || x < 0 || x === s[f.k] || ((f.k === 'stag' || f.k === 'scale') && x === 0)) return false
                setInFrame({ ...s, [f.k]: x })
              }}
            />
            <span>{f.unit ?? 'mm'}</span>
          </span>
          <span className="kg-status">{f.id}</span>
          <span className="kg-src">{f.use}</span>
        </label>
      ))}
      <div className="formulas num">
        <div>bredde = spenn − fradrag − luft · høyde = systemvegg + føtter = {fmt(fullHeight(s), 0)}</div>
        <div>trykkfil = ramme + 2 × bleed · fil = trykkfil × {s.scale} % · stag = høyde − 2 × profil</div>
      </div>
    </section>
  )
}
