// Cell size of the drawing grid (domain/snapGrid), shared by the wall brush and the free-standing textile brush.
// Steps a brush cannot draw yet are shown but disabled: system walls get 25, 50 and 75 cm once their Foga parts exist.
import { GRID_LABEL, GRID_STEPS, type GridStep } from '../../domain/snapGrid'
import { Segmented } from '../controls'

export function GridPicker({ value, allowed, onChange }: { value: GridStep; allowed: readonly number[]; onChange: (s: GridStep) => void }) {
  return (
    <Segmented<GridStep>
      label="Rutenett"
      value={value}
      onChange={onChange}
      options={GRID_STEPS.map((s) => {
        const ok = allowed.includes(s)
        return { value: s, label: <span className="num">{GRID_LABEL[s]}</span>, disabled: !ok, title: ok ? `Tegn ${GRID_LABEL[s]} av gangen` : 'Ikke for denne penselen ennå' }
      })}
    />
  )
}
