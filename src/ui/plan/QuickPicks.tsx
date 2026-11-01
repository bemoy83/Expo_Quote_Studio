// Quick picks over the active tool in the dock: everything the tool draws, in fixed places so the hand learns where the
// colours are. The tool's own settings (floor type, size or roll direction, drawing grid) sit here too, and the last
// button («…») opens the panel on the tool's tab for the rest.
import { Blinds, Box, DoorClosed, Ellipsis, PaintBucket, Upload } from 'lucide-react'
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
  /** Open the panel on the tool's tab. */
  onMore: () => void
  /** Add a 1 × 1 m bakrom in a free corner. */
  onAddRoom: () => void
  /** Add the customer's own motif to the library. */
  onUpload: (f: File) => void
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
/** Motifs on the pill: the newest of the library (the customer's own come last), plus the chosen one. */
const MOTIFS = 5

/** Short names for the floor types on the pill. */
const FLOOR_SHORT: Record<string, string> = { Teppefliser: 'Fliser', Engangsteppe: 'Engangs', Vinylgulv: 'Vinyl' }

/** The quick pill over the active tool, or nothing when the tool has none (Velg, and Tøm without a floor brush). */
export function QuickPicks(p: QuickPicksProps) {
  const content = quickContent(p)
  return content ? (
    <div key={p.tool} className="dock-pill dock-quick">
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
    <button type="button" className="q-btn q-more" title="Alle valg i panelet" aria-label="Alle valg i panelet" onClick={p.onMore}>
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
        <Sep />
        <QBtn title="Bakrom 1 × 1 m med dør i et ledig hjørne" label="Legg til bakrom" onClick={p.onAddRoom}>
          <Box size={15} />
        </QBtn>
        {more}
      </>
    )
  }

  if (tool === 'floor') {
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
        <Sep />
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
        {p.motifs
          .filter((m, i) => i >= p.motifs.length - MOTIFS || (brush?.kind === 'motif' && brush.motif === m.id))
          .map((m) => {
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
        <Sep />
        <label className="q-btn" title="Last opp kundens eget motiv" aria-label="Last opp motiv">
          <Upload size={15} />
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) p.onUpload(f)
              e.target.value = ''
            }}
          />
        </label>
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
      <Sep />
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

const Sep = () => <span className="q-sep" aria-hidden />

export function BeamIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} aria-hidden>
      <path d="M-.9 0 H.9" stroke="currentColor" strokeWidth=".16" strokeDasharray=".3 .15" />
    </svg>
  )
}

