import { Search } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import type { CalcResult } from '../../calc/calc'
import { mainGroupOf } from '../../catalog/groups'
import type { Variant } from '../../domain/types'
import type { Motif } from '../../persistence/file'
import { productOf } from '../env'
import { type PlanSelection } from '../plan/selection'
import type { Brush, Tool } from '../tools'
import { MENUS } from './menus'
import { EquipSection, SearchResults } from './sections/EquipSection'
import { FloorSection } from './sections/FloorSection'
import { ProfileSection } from './sections/ProfileSection'
import { WallSection } from './sections/WallSection'

export interface RailProps {
  v: Variant
  res: CalcResult
  tab: string
  setTab: (k: string) => void
  /** The panel beside the strip is shown; folded, only the strip stays. */
  open: boolean
  setOpen: (open: boolean) => void
  tool: Tool
  brush: Brush | null
  /** Choose what the brush draws, and switch to the brush (or eraser). */
  pick: (b: Brush, tool?: Tool) => void
  onEdit: (fn: (v: Variant) => Variant) => void
  onToast: (t: string) => void
  /** Motif library: samples and the customer's own. */
  motifs: Motif[]
  /** Add the customer's own motif to the library (same as upload on the profiling quick picks). */
  onUpload: (f: File) => void
  /** Add a 1 × 1 m bakrom in a free corner (same as on the wall tool's quick picks). */
  onAddRoom: () => void
  /** Open a textile in the wall drawer. */
  onSelect: (s: PlanSelection) => void
  selection?: PlanSelection
}


export function Rail(p: RailProps) {
  const { v, tab, setTab, open, setOpen } = p
  const [q, setQ] = useState('')
  const menu = MENUS.find((m) => m.key === tab) ?? MENUS[0]
  const counts = useMemo(() => menuCounts(v), [v])

  return (
    <aside className="rail">
      <nav className="strip" aria-label="Produktgrupper">
        {(['build', 'equip'] as const).map((g) => (
          <Fragment key={g}>
            <span className="grp">{g === 'build' ? 'Bygg' : 'Utstyr'}</span>
            {MENUS.filter((m) => m.group === g).map((m) => (
              <button
                key={m.key}
                type="button"
                className="strip-btn"
                aria-current={open && m.key === tab}
                title={open && m.key === tab ? 'Fold inn panelet' : undefined}
                onClick={() => {
                  // Like a tab bar: another group opens the panel on it, the open group folds the panel away.
                  if (open && m.key === tab) return setOpen(false)
                  setTab(m.key)
                  setOpen(true)
                }}
              >
                {counts[m.key] ? <span className="count">{counts[m.key]}</span> : null}
                <m.icon size={18} />
                {m.short ?? m.name}
              </button>
            ))}
          </Fragment>
        ))}
      </nav>
      {open && (
        <div className="panel">
          <div className="panel-scroll">
            <label className="search">
              <Search size={15} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk vare eller varenr" aria-label="Søk vare eller varenr" />
            </label>
            {q.trim() ? (
              <SearchResults {...p} q={q.trim()} />
            ) : (
              <>
                <div className="panel-head">
                  <h2>{menu.name}</h2>
                </div>
                {tab === 'vegg' && <WallSection {...p} />}
                {tab === 'gulv' && <FloorSection {...p} />}
                {tab === 'prof' && <ProfileSection {...p} />}
                {menu.group === 'equip' && <EquipSection {...p} menu={menu.key} />}
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}

function menuCounts(v: Variant): Record<string, number> {
  const out: Record<string, number> = {}
  const add = (artnr: string, n: number) => {
    const p = productOf(artnr)
    if (p) out[mainGroupOf(p.group)] = (out[mainGroupOf(p.group)] ?? 0) + n
  }
  v.objects.forEach((o) => add(o.product, 1))
  v.counted.forEach((c) => add(c.product, c.qty))
  delete out.vegg
  delete out.gulv
  return out
}
