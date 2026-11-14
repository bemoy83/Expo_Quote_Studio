// Gulv: the floor type, its colours and the bucket, and the tile size (or the brush for engangsteppe).
import { Paintbrush } from 'lucide-react'
import { mainGroupOf } from '../../../catalog/groups'
import { Segmented } from '../../controls'
import { catalog, idx } from '../../env'
import { FLOOR_MAIN, FLOOR_OTHER, floorSizeLabel, type Brush } from '../../tools'
import { MAX } from './limits'
import { Palette, QBtn, Sep } from './parts'
import type { QuickCtx, QuickPicksProps } from './types'

/** Short names for the floor types on the pill. */
const FLOOR_SHORT: Record<string, string> = { Teppefliser: 'Fliser', Engangsteppe: 'Engangs', Vinylgulv: 'Vinyl' }

/** The tile sizes: the main ones, and «Andre» opening the smaller ones. */
function FloorSizes({ p }: { p: QuickPicksProps }) {
  return (
    <>
      <Segmented<string>
        label="Penselstørrelse"
        value={FLOOR_MAIN.some((s) => s.label === floorSizeLabel(p.floorSize)) ? floorSizeLabel(p.floorSize) : 'Andre'}
        onChange={(l) => p.onFloorSize(FLOOR_MAIN.find((s) => s.label === l)?.size ?? p.otherSize)}
        options={[
          ...FLOOR_MAIN.map((s) => ({ value: s.label, title: s.title, label: <span className="num">{s.label}</span> })),
          { value: 'Andre', title: 'Andre størrelser · 1 × 0,5, 0,5 × 1 og 0,5 × 0,5', label: 'Andre' },
        ]}
      />
      {p.floorSize !== 'auto' && FLOOR_OTHER.some((s) => s.label === floorSizeLabel(p.floorSize)) && (
        <Segmented<string>
          label="Mindre fliser"
          value={floorSizeLabel(p.floorSize)}
          onChange={(l) => {
            const size = FLOOR_OTHER.find((s) => s.label === l)!.size
            p.onOtherSize(size)
            p.onFloorSize(size)
          }}
          options={FLOOR_OTHER.map((s) => ({ value: s.label, label: <span className="num">{s.label}</span> }))}
        />
      )}
    </>
  )
}

export function FloorPicks({ p, head, more, is }: QuickCtx) {
  const { brush, onPick } = p
  const rollBrush = brush?.kind === 'floor' && !!idx.byArtnr.get(brush.product)?.product.roll
    const cur = brush?.kind === 'floor' ? idx.byArtnr.get(brush.product)?.product : undefined
    const floors = catalog.products.filter((x) => mainGroupOf(x.group) === 'gulv' && x.kind === 'surface')
    return (
      <>
        {head}
        <Segmented<string>
          label="Gulvtype"
          value={cur?.id ?? ''}
          onChange={(id) => onPick({ kind: 'floor', product: floors.find((x) => x.id === id)!.variants[0].artnr })}
          options={floors.map((x) => ({ value: x.id, title: x.name, label: FLOOR_SHORT[x.name] ?? x.name }))}
        />
        <Sep />
        <Palette
          swatches={(cur?.variants ?? []).slice(0, MAX).map((x) => {
            const b: Brush = { kind: 'floor', product: x.artnr }
            return { key: x.artnr, color: x.color, title: `${cur!.name} ${x.name.toLowerCase()} · ${x.artnr}`, on: is(b), onClick: () => onPick(b) }
          })}
          fill="Fyll hele standen med denne fargen"
          onFill={p.onFill}
        />
        <Sep />
        {rollBrush ? (
          // Engangsteppe has one pen, the brush: drag an area or click free floor, the engine lays the lanes
          <QBtn on setting title="Malerkost · dra et område, eller klikk ledig gulv eller en bane" label="Kost" onClick={() => brush && onPick(brush)}>
            <Paintbrush size={15} />
          </QBtn>
        ) : (
          <FloorSizes p={p} />
        )}
        {more}
      </>
    )
}
