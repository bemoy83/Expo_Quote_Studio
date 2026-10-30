import { FlipHorizontal2, Trash2, X } from 'lucide-react'
import { eraseWalls, flipSwing, isPerimeterWall, setWallPlate } from '../../domain/edit'
import { wallLength, wallModules } from '../../domain/grid'
import type { Variant } from '../../domain/types'
import { wallLabel } from '../../calc/production'
import { Button, IconButton } from '../controls'
import { productOf, wallPlates } from '../env'
import { VariantChips } from '../panel/ProductRow'

/** Look-up for the selected wall: plate colour, length, openings. */
export function WallPopover({ v, wallId, onEdit, onClose }: { v: Variant; wallId: string; onEdit: (fn: (v: Variant) => Variant) => void; onClose: () => void }) {
  const w = v.walls.find((x) => x.id === wallId)
  if (!w) return null
  const plates = wallPlates()
  const ral = w.plate ?? v.defaultPlate
  const openings = v.openings.filter((o) => o.wallId === w.id)
  const doors = openings.filter((o) => productOf(o.product)?.opening === 'door')
  const L = wallLength(w)
  const label = wallLabel(w, v.stand)
  return (
    <div className="popover wall-pop" role="dialog" aria-label="Vegg">
      <h3>
        <span>
          {label === 'Innervegg' ? 'Innervegg' : `Standvegg · ${label.toLowerCase()}`}
        </span>
        <IconButton icon={X} label="Lukk" size={14} onClick={onClose} />
      </h3>
      <p className="num">
        {L} m · {wallModules(w).length - openings.length} {L - openings.length === 1 ? 'plate' : 'plater'}
        {openings.length ? ` · ${openings.length} ${openings.length === 1 ? 'åpning' : 'åpninger'}` : ''}
        {isPerimeterWall(v.stand, w) ? '' : ' · dra for å flytte'}
      </p>
      <div className="eyebrow">
        Veggplate · {plates.find((p) => p.ral === ral)?.name} · RAL {ral}
      </div>
      <VariantChips
        chips={plates.map((p) => ({ name: `${p.name} · RAL ${p.ral}`, color: p.color }))}
        selected={plates.findIndex((p) => p.ral === ral)}
        onSelect={(i) => onEdit((x) => setWallPlate(x, w.id, plates[i].ral!))}
      />
      <div className="pop-actions">
        {doors.map((d, i) => (
          <Button key={d.id} variant="ghost" icon={FlipHorizontal2} onClick={() => onEdit((x) => flipSwing(x, d.id))}>
            Snu dør{doors.length > 1 ? ` ${i + 1}` : ''}
          </Button>
        ))}
        <Button
          variant="ghost"
          icon={Trash2}
          onClick={() => {
            onEdit((x) => eraseWalls(x, wallModules(w).map((m) => m.key)))
            onClose()
          }}
        >
          Fjern veggen
        </Button>
      </div>
    </div>
  )
}
