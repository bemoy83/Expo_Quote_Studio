// What the pill on a textile wall does that its settings do not (Byggeregler X13, M5, M6), in the drawer's foot as
// well, so the drawer has what the pill has (docs/pille-og-skuff.md): on a wall «Løsne» from it and its 92LTX corners;
// on foot plates Roter and «Løsne» from its group. The standard lengths (X9) stay in the pill, the drawer has Lengde.
import { Link, RotateCw, Unlink } from 'lucide-react'
import { joinCorner, letGoCorner, wallCorners } from '../../domain/textile/cornerJoin'
import { loosenMounted, onFeetHeight } from '../../domain/textile/mount'
import { mountedOn } from '../../domain/textile/mounts'
import { wallDirection, wallLength } from '../../domain/grid'
import type { Variant } from '../../domain/types'
import { Button } from '../controls'
import { rules } from '../env'
import type { PlanSelection } from './selection'
import { turnPart } from './turn'

export function TextileActions(p: {
  v: Variant
  id: string
  selection: PlanSelection
  onEdit: (fn: (v: Variant) => Variant) => void
  onSelect: (s: PlanSelection) => void
  onToast: (text: string) => void
}) {
  const { v, id } = p
  const m = mountedOn(v, id)
  if (m) {
    const corners = wallCorners(v).filter((k) => k.ids.includes(id))
    // Two corners: named by the side of the drawing they are on, the face seen straight on (x as in WallElevation)
    const [dx, dy] = wallDirection(m.wall)
    const x = (at: readonly [number, number]) => {
      const t = (at[0] - m.wall.from[0]) * dx + (at[1] - m.wall.from[1]) * dy
      return m.side === 1 ? t : wallLength(m.wall) - t
    }
    const mid = corners.reduce((a, k) => a + x(k.at), 0) / (corners.length || 1)
    const where = (at: readonly [number, number]) => (corners.length < 2 ? '' : x(at) < mid ? ' til venstre' : ' til høyre')
    const loosen = () => {
      const r = loosenMounted(v, rules, id)
      if ('error' in r) return p.onToast(r.error)
      p.onEdit(() => r.v)
      p.onSelect({ textileId: r.id })
      if (!r.heightKept) p.onToast(onFeetHeight())
    }
    return (
      <>
        {corners.map((k) => (
            <Button
              key={`${k.at[0]},${k.at[1]}`}
              variant="ghost"
              icon={k.joined ? Unlink : Link}
              title={k.joined ? 'Løs opp hjørnet · rammen på den korteste veggen flyttes inntil den andre, uten 92LTX' : 'Koble hjørnet · rammene møtes i en 92LTX'}
              onClick={() => p.onEdit((x) => (k.joined ? letGoCorner(x, k.at) : joinCorner(x, k.at)))}
            >
              {(k.joined ? 'Løs opp hjørnet' : 'Koble hjørnet') + where(k.at)}
            </Button>
          ))}
        <Button variant="ghost" icon={Unlink} title="Løsne fra veggen · står fritt på fotplater foran veggen" onClick={loosen}>
          Løsne
        </Button>
      </>
    )
  }
  const loose = !!p.selection.loose
  return (
    <>
      <Button variant="ghost" icon={RotateCw} title="Roter 90° om midten (R)" onClick={() => turnPart(p, { kind: 'textile', id }, loose)}>
        Roter
      </Button>
      <Button
        variant="ghost"
        icon={Unlink}
        aria-pressed={loose}
        title={loose ? 'Dra flytter bare denne, forbi magneten · trykk for å flytte med det den er koblet til' : 'Løsne: dra flytter bare denne, ut av det den er koblet til og forbi magneten · på desktop også Alt + dra'}
        onClick={() => p.onSelect({ ...p.selection, loose: !loose })}
      >
        Løsne
      </Button>
    </>
  )
}
