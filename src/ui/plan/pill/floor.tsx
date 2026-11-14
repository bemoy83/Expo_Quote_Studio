// The pill on engangsteppe: a fill laid by Fyll, or a lane placed on its own (docs/pille-og-skuff.md).
import { RotateCw } from 'lucide-react'
import { rotateLane } from '../../../domain/floor/edit'
import { CELL } from '../../../domain/grid'
import { fmt, mm } from '../../format'
import { QBtn } from '../quick/parts'
import type { Chosen } from '../selection'
import { idx } from '../../env'
import type { Content, PillActions } from './parts'

const variantName = (a: string) => idx.byArtnr.get(a)?.variant.name.toLowerCase() ?? a

export function fillPill(c: Extract<Chosen, { kind: 'fill' }>, remove: () => void): Content {
  const m2 = c.tiles.reduce((a, t) => a + t.w * t.h * CELL * CELL, 0)
  return { name: `Engangsteppe ${variantName(c.tiles[0].product)}`, meta: `${fmt(m2, 1)} m²`, more: true, remove }
}

export function lanePill(p: PillActions, c: Extract<Chosen, { kind: 'lane' }>, remove: () => void): Content {
  const { lane, tile: t } = c
  const len = (t.roll === 'y' ? t.h : t.w) * CELL
  return {
    name: 'Bane',
    meta: `${variantName(t.product)} · ${mm(len)}`,
    body: (
      <QBtn
        title="Snu banen (R)"
        label="Snu"
        onClick={() => {
          const r = rotateLane(p.v, lane)
          if (!r) return p.onToast('Banen får ikke plass snudd')
          p.onEdit(() => r.v)
          p.onSelect({ lane: { i: r.lane.i, j: r.lane.j } })
        }}
      >
        <RotateCw size={15} />
      </QBtn>
    ),
    more: true,
    remove,
  }
}
