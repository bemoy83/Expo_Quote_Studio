// The band at the top of Standskisse: fold buttons for the panel and the calc, the variants, and the key figures with
// the guiding sum (and how the other variants differ from it).
import { Copy, type LucideIcon, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Trash2 } from 'lucide-react'
import type { CalcResult } from '../../calc/calc'
import type { Variant } from '../../domain/types'
import { Button, IconButton } from '../controls'
import { count, fmt, kr, signed } from '../format'
import { frameCount, TYPE_NAME } from '../names'
import { KeyFigures } from './KeyFigures'
import { VariantTabs } from './VariantTabs'

/** Panel and calc can be folded away for more drawing room. */
export interface Layout {
  panel: boolean
  calc: boolean
}

interface Props {
  variants: Variant[]
  current: number
  res: CalcResult
  /** The other variants' sums, shown as a difference from this one. */
  others: { name: string; sum: number }[]
  layout: Layout
  fold: (k: keyof Layout, open: boolean) => void
  onSelect: (index: number) => void
  onDuplicate: () => void
  onRemove: () => void
}

export function SketchBand({ variants, current, res, others, layout, fold, onSelect, onDuplicate, onRemove }: Props) {
  const v = variants[current]
  const k = res.keyFigures
  return (
    <div className="band" data-band="eple">
      <div className="band-head">
        <FoldButton open={layout.panel} icons={[PanelLeftClose, PanelLeftOpen]} labels={['Fold inn panelet', 'Vis panelet']} onToggle={(o) => fold('panel', o)} />
        <h1>Standskisse</h1>
        <span className="band-tag">Utkast</span>
        <span className="spacer" />
        <VariantTabs variants={variants} current={current} onSelect={onSelect} />
        <Button onBand icon={Copy} disabled={variants.length >= 4} onClick={onDuplicate}>
          Ny variant
        </Button>
        {variants.length > 1 && <IconButton icon={Trash2} label={`Slett variant ${v.name}`} onBand onClick={onRemove} />}
        <span className="band-sep" />
        <FoldButton open={layout.calc} icons={[PanelRightClose, PanelRightOpen]} labels={['Skjul kalkylen', 'Vis kalkylen']} onToggle={(o) => fold('calc', o)} />
      </div>
      <KeyFigures
        figures={[
          { label: 'Areal', value: fmt(k.area), unit: 'm²', sub: `${v.stand.width} × ${v.stand.depth} m` },
          { label: 'Åpne sider', value: String(k.openSides), sub: TYPE_NAME[v.stand.type] },
          {
            label: 'Vegg',
            value: fmt(k.wallLm, 2),
            unit: 'lm',
            sub: [wallSplit(k), k.openings ? count(k.openings, 'åpning', 'åpninger') : ''].filter(Boolean).join(' · ') || undefined,
          },
          { label: 'Takdrager', value: fmt(k.beamLm), unit: 'm', sub: beamSplit(k) },
          ...(k.textileM2 > 0 ? [{ label: 'Tekstilvegg', value: fmt(k.textileM2), unit: 'm²', sub: textileSub(res.production) }] : []),
          {
            label: 'Veiledende sum',
            value: kr(res.sum),
            unit: 'kr',
            sub: ['eks. mva.', ...others.map((o) => `${o.name} ${signed(o.sum - res.sum)}`)].join(' · '),
            short: 'eks. mva.',
            end: true,
          },
        ]}
      />
    </div>
  )
}

/** InFrame frames and free-standing walls. */
function textileSub(p: CalcResult['production']) {
  return [p.pieces.length ? frameCount(p.pieces.length) : '', p.free.length ? `${p.free.length} frittstående` : ''].filter(Boolean).join(' · ')
}

/** Stand walls apart from inner and room walls, and who pays them. */
function wallSplit(k: CalcResult['keyFigures']) {
  if (!k.standWallLm || k.standWallLm === k.wallLm) return k.organiserWallLm ? 'standvegg fra arrangør' : ''
  return `${fmt(k.standWallLm, 2)} standvegg${k.organiserWallLm ? ' fra arrangør' : ''} · ${fmt(k.wallLm - k.standWallLm, 2)} inner`
}

/** Beams the organiser invoices apart from the customer's own: drawn inner beams, and the standard beams when the
 *  exhibitor pays them. */
function beamSplit(k: CalcResult['keyFigures']) {
  const ours = k.beamLm - k.organiserBeamLm
  if (k.organiserBeamLm) return `${fmt(k.organiserBeamLm)} fra arrangør${ours > 1e-9 ? ` · ${fmt(ours)} tilvalg` : ''}`
  if (!k.innerBeamLm) return undefined
  const standard = k.beamLm - k.innerBeamLm
  return standard > 1e-9 ? `${fmt(standard)} standard · ${fmt(k.innerBeamLm)} tilvalg` : 'tilvalg'
}

/** Band toggle for the panel or the calc: muted fill while it is shown. Icons and labels are [shown, folded]. */
function FoldButton({ open, icons, labels, onToggle }: { open: boolean; icons: [LucideIcon, LucideIcon]; labels: [string, string]; onToggle: (open: boolean) => void }) {
  const i = open ? 0 : 1
  return <IconButton icon={icons[i]} label={labels[i]} onBand pressed={open} className="band-fold" onClick={() => onToggle(!open)} />
}
