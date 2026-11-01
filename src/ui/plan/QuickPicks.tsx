// Quick picks over the active tool in the dock. Fixed places, so the hand learns where the colours are; the last button
// («…») opens all the tool's options. The tool's own settings (floor size or roll direction, drawing grid) sit here too.
import { Blinds, DoorClosed, Ellipsis, PaintBucket } from 'lucide-react'
import type { ReactNode } from 'react'
import { mainGroupOf } from '../../catalog/groups'
import type { RollDir, FloorBrushSize, TileSize } from '../../domain/floor'
import type { GridStep } from '../../domain/snapGrid'
import type { Motif } from '../../persistence/file'
import { Segmented } from '../controls'
import { catalog, idx, rules, wallPlates } from '../env'
import { ObjectThumb } from '../panel/ProductRow'
import { FLOOR_MAIN, FLOOR_OTHER, floorSizeLabel, gridSteps, type Brush, type DockTool } from '../tools'
import { GridPicker } from './GridPicker'

export interface QuickPicksProps {
  tool: DockTool
  brush: Brush | null
  /** Name of what the pen draws, and a short line under it. */
  name: string
  meta?: string
  wallRal: string
  motifs: Motif[]
  onPick: (b: Brush) => void
  onMore: () => void
  floorSize: FloorBrushSize
  onFloorSize: (s: FloorBrushSize) => void
  otherSize: TileSize
  onOtherSize: (s: TileSize) => void
  roll: RollDir
  onRoll: (d: RollDir) => void
  gridStep: GridStep
  onGridStep: (s: GridStep) => void
  onFill: () => void
}

const MAX = 8

/** The quick pill over the active tool, or nothing when the tool has none (Velg, and Tøm without a floor brush). */
export function QuickPicks(p: QuickPicksProps) {
  const content = quickContent(p)
  return content ? (
    <div key={p.tool} className="dock-quick">
      {content}
    </div>
  ) : null
}

function quickContent(p: QuickPicksProps): ReactNode {
  const { tool, brush, onPick } = p
  const is = (b: Brush) => JSON.stringify(b) === JSON.stringify(brush)
  const rollBrush = brush?.kind === 'floor' && !!idx.byArtnr.get(brush.product)?.product.roll

  const floorSizes = (
    <>
      <Segmented<string>
        label="Penselstørrelse"
        value={FLOOR_MAIN.some((s) => s.label === floorSizeLabel(p.floorSize)) ? floorSizeLabel(p.floorSize) : 'Andre'}
        onChange={(l) => p.onFloorSize(FLOOR_MAIN.find((s) => s.label === l)?.size ?? p.otherSize)}
        options={[
          ...FLOOR_MAIN.map((s) => ({ value: s.label, title: s.title, label: <span className="num">{s.label}</span> })),
          { value: 'Andre', title: 'Mindre fliser: 1 × 0,5, 0,5 × 1 og 0,5 × 0,5', label: 'Andre' },
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

  if (tool === 'erase') return brush?.kind === 'floor' && !rollBrush ? floorSizes : null
  if (tool === 'select') return null

  const more = (
    <button type="button" className="q-btn q-more" title="Alle valg" aria-label="Alle valg" onClick={p.onMore}>
      <Ellipsis size={15} />
    </button>
  )
  const head = <QName name={p.name} meta={p.meta} />

  if (tool === 'wall') {
    const openings = catalog.products.filter((x) => x.opening)
    return (
      <>
        {head}
        {wallPlates()
          .slice(0, MAX)
          .map((x) => (
            <Sw key={x.ral} color={x.color} title={`Innervegg ${x.name} · RAL ${x.ral}`} on={brush?.kind === 'wall' && brush.ral === x.ral} onClick={() => onPick({ kind: 'wall', ral: x.ral! })} />
          ))}
        <Sep />
        {openings.map((x) => {
          const b: Brush = { kind: 'opening', product: x.variants[0].artnr }
          return (
            <QBtn key={x.id} on={is(b)} title={`${x.name} · klikk en vegg eller tom kant`} label={x.opening === 'door' ? 'Dør' : 'Forheng'} onClick={() => onPick(b)}>
              {x.opening === 'door' ? <DoorClosed size={15} /> : <Blinds size={15} />}
            </QBtn>
          )
        })}
        <QBtn on={is({ kind: 'beam' })} title="Innvendig takdrager · dra langs rutenettet" label="Takdrager" onClick={() => onPick({ kind: 'beam' })}>
          <BeamIcon />
        </QBtn>
        {more}
      </>
    )
  }

  if (tool === 'floor') {
    const cur = brush?.kind === 'floor' ? idx.byArtnr.get(brush.product)?.product : undefined
    return (
      <>
        {head}
        {(cur?.variants ?? []).slice(0, MAX).map((x) => {
          const b: Brush = { kind: 'floor', product: x.artnr }
          return <Sw key={x.artnr} color={x.color} title={`${cur!.name} ${x.name.toLowerCase()} · ${x.artnr}`} on={is(b)} onClick={() => onPick(b)} />
        })}
        <Sep />
        {rollBrush ? (
          <Segmented<RollDir>
            label="Rulleretning"
            value={p.roll}
            onChange={p.onRoll}
            options={[
              { value: 'x', title: 'Banene går fra venstre til høyre (R snur)', label: <span className="num">↔ Bredden</span> },
              { value: 'y', title: 'Banene går fra bak til front (R snur)', label: <span className="num">↕ Dybden</span> },
            ]}
          />
        ) : (
          floorSizes
        )}
        <QBtn title="Fyll hele standen med denne fargen" label="Fyll" onClick={p.onFill}>
          <PaintBucket size={15} />
        </QBtn>
        {more}
      </>
    )
  }

  if (tool === 'profile') {
    return (
      <>
        {head}
        <QBtn on={brush?.kind === 'textile'} title="Tekstilvegg · på systemvegg eller frittstående" onClick={() => onPick({ kind: 'textile' })}>
          <i className="tex-thumb q-tex" />
          Tekstil
        </QBtn>
        <Sep />
        {p.motifs.slice(0, 4).map((m) => {
          const b: Brush = { kind: 'motif', motif: m.id }
          return (
            <button key={m.id} type="button" className="q-motif" aria-pressed={is(b)} title={`Motiv: ${m.name}`} onClick={() => onPick(b)}>
              <img src={m.src} alt={m.name} draggable={false} />
            </button>
          )
        })}
        {brush?.kind === 'textile' && (
          <>
            <Sep />
            <GridPicker value={p.gridStep} allowed={gridSteps(brush, rules)} onChange={p.onGridStep} />
          </>
        )}
        {more}
      </>
    )
  }

  // Møbel
  const objects = catalog.products.filter((x) => x.kind === 'object' && !x.opening && mainGroupOf(x.group) === 'mob')
  return (
    <>
      {head}
      {objects
        .flatMap((x) => x.variants.map((vr) => ({ x, vr })))
        .slice(0, MAX)
        .map(({ x, vr }) => {
          const b: Brush = { kind: 'object', product: vr.artnr }
          return (
            <button key={vr.artnr} type="button" className="q-obj" aria-pressed={is(b)} title={x.variants.length > 1 ? `${x.name} ${vr.name.toLowerCase()}` : x.name} onClick={() => onPick(b)}>
              <ObjectThumb product={x} color={vr.color} />
            </button>
          )
        })}
      {more}
    </>
  )
}

function QName({ name, meta }: { name: string; meta?: string }) {
  return (
    <span className="q-name">
      <span className="q-name-main">{name}</span>
      {meta && <span className="q-name-meta num">{meta}</span>}
    </span>
  )
}

function Sw({ color, title, on, onClick }: { color?: string; title: string; on: boolean; onClick: () => void }) {
  return <button type="button" className="q-sw" aria-pressed={on} title={title} aria-label={title} style={{ background: color }} onClick={onClick} />
}

function QBtn({ on, title, label, onClick, children }: { on?: boolean; title: string; label?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="q-btn" aria-pressed={on} title={title} aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}

/** Space between groups: no separator line. */
const Sep = () => <span className="q-gap" aria-hidden />

export function BeamIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} aria-hidden>
      <path d="M-.8 0 H.8" stroke="currentColor" strokeWidth=".16" strokeDasharray=".3 .15" />
      <rect x="-.95" y="-.15" width=".3" height=".3" fill="currentColor" />
    </svg>
  )
}

