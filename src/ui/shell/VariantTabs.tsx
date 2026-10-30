import type { Variant } from '../../domain/types'
import { Segmented } from '../controls'

/** Variant picker on the page band: Variant A · Variant B … */
export function VariantTabs({ variants, current, onSelect }: { variants: Variant[]; current: number; onSelect: (i: number) => void }) {
  return <Segmented<number> onBand label="Varianter" value={current} onChange={onSelect} options={variants.map((x, i) => ({ value: i, label: `Variant ${x.name}` }))} />
}
