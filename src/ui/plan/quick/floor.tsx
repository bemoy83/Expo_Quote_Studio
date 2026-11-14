// Gulv by function (Bjørn 14.11.2026): Pensel is one button per floor type with its kortnavn and the colour last in hand
// behind it; Farge its colours and the bucket; Tilpasset the tile size, none for engangsteppe (one brush, the engine
// lays the lanes).
import { mainGroupOf } from '../../../catalog/groups'
import { shortName } from '../../../catalog/lookup'
import { Segmented } from '../../controls'
import { catalog, idx } from '../../env'
import { FLOOR_MAIN, FLOOR_OTHER, floorSizeLabel, type Brush } from '../../tools'
import { MAX } from './limits'
import { Palette, QBtn, Sep } from './parts'
import type { QuickCtx, QuickPicksProps } from './types'

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
  const cur = brush?.kind === 'floor' ? idx.byArtnr.get(brush.product)?.product : undefined
  const rollBrush = !!cur?.roll
  const picks = p.picks.floor ?? {}
  const floors = catalog.products.filter((x) => mainGroupOf(x.group) === 'gulv' && x.kind === 'surface')
  return (
    <>
      {head}
      {floors.map((x) => {
        // The colour last in hand for this floor type, else its first
        const last = picks[x.id] && x.variants.find((v) => v.artnr === picks[x.id])
        const v = cur?.id === x.id && brush?.kind === 'floor' ? x.variants.find((y) => y.artnr === brush.product)! : (last || x.variants[0])
        return (
          <QBtn key={x.id} on={cur?.id === x.id} title={`${x.name} · ${x.dim ?? 'dra et område'}`} label={shortName(x)} onClick={() => onPick({ kind: 'floor', product: v.artnr })}>
            <i className="q-floor" style={{ background: v.color }} />
            {shortName(x)}
          </QBtn>
        )
      })}
      <Sep />
      <Palette
        swatches={(cur?.variants ?? []).slice(0, MAX).map((x) => {
          const b: Brush = { kind: 'floor', product: x.artnr }
          return { key: x.artnr, color: x.color, title: `${cur!.name} ${x.name.toLowerCase()} · ${x.artnr}`, on: is(b), onClick: () => onPick(b) }
        })}
        fill="Fyll hele standen med denne fargen"
        onFill={p.onFill}
      />
      {/* Tilpasset: the tile size; engangsteppe has one brush, the engine lays the lanes */}
      {!rollBrush && (
        <>
          <Sep />
          <FloorSizes p={p} />
        </>
      )}
      <Sep />
      {more}
    </>
  )
}
