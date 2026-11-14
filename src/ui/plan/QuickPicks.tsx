// Quick picks over the active tool in the dock: everything the tool draws, in fixed places so the hand learns where the
// colours are. The tool's own settings (floor type, tile size, drawing grid) sit here too, and the last
// button («…») opens the panel on the tool's tab for the rest.
import { stockByArtnr } from '../../domain/podiumStock'
import { Blinds, Box, DoorClosed, Ellipsis, PaintBucket, Paintbrush, Ruler, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { mainGroupOf } from '../../catalog/groups'
import { type FloorBrushSize } from '../../domain/floor/brush'
import { type TileSize } from '../../domain/floor/tiles'
import type { GridStep } from '../../domain/snapGrid'
import type { Motif } from '../../domain/types'
import { ImageInput, Segmented } from '../controls'
import { catalog, idx, rules } from '../env'
import { ObjectThumb } from '../panel/ProductRow'
import { FLOOR_MAIN, FLOOR_OTHER, floorSizeLabel, gridSteps, type Brush, type DockTool } from '../tools'
import { fineApplies, funcOf, PEN_FUNCS, penHeights, stockFor, withFunc, withHeight, type PenPicks } from '../podiumPen'
import { GridPicker } from './GridPicker'
import { StockOutline } from './StockOutline'
import { ralSwatches, type Swatch } from './swatches'

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
  gridStep: GridStep
  onGridStep: (s: GridStep) => void
  onFill: () => void
  /** The wall pen's bucket: every wall in the pen's colour. */
  onFillWalls: () => void
  /** The bucket of Disker og podier: every counter and podium it drew in the pen's colour. */
  onFillPodiums: () => void
  /** The item behind each function of Disker og podier. */
  podiumPicks: PenPicks
}

const MAX = 8
/** Motifs on the pill: the newest of the library (the customer's own come last), plus the chosen one. */
const MOTIFS = 5

/** Short names for the floor types on the pill. */
const FLOOR_SHORT: Record<string, string> = { Teppefliser: 'Fliser', Engangsteppe: 'Engangs', Vinylgulv: 'Vinyl' }

/** The quick pill over the active tool, or nothing when the tool has none (Velg and Tøm). */
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

  if (tool === 'select' || tool === 'erase') return null

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
        <Palette
          swatches={ralSwatches(brush?.kind === 'wall' ? brush.ral : undefined, (n) => `Innervegg ${n}`, (ral) => onPick({ kind: 'wall', ral }))}
          fill="Fyll alle vegger med denne fargen"
          onFill={p.onFillWalls}
        />
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
          floorSizes
        )}
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
          <ImageInput onFile={p.onUpload} />
        </label>
        {more}
      </>
    )
  }

  if (tool === 'fitting') {
    // Hyller: the shelf pen for now; heng (hanging fittings) joins it here later.
    return (
      <>
        {head}
        <QBtn on={brush?.kind === 'shelf'} title="Hylle 30 cm i et veggfelt · klikk en vegg, dra for flere" label="Hylle" onClick={() => onPick({ kind: 'shelf' })}>
          <ShelfIcon />
          Hylle
        </QBtn>
        <Sep />
        {more}
      </>
    )
  }

  if (tool === 'podium' && brush?.kind === 'podium') {
    // Disker og podier by function (Bjørn 14.11.2026): «Fri», then one button per function with the outline of the item
    // behind it; the plates in the wall colours and the bucket, as on Vegg (K6); Høyde (K12) and Fin. What does not apply
    // to what is in hand is grey where it always is.
    const { ral, fine } = brush
    const func = funcOf(brush)
    const fineOn = fineApplies(brush)
    return (
      <>
        {head}
        <QBtn on={!func} setting title="Fri · tegn fasongen selv · et klikk setter en seksjon 500 × 500, dra tegner fritt" label="Fri" onClick={() => onPick(withFunc(brush, undefined, p.podiumPicks))}>
          Fri
        </QBtn>
        {PEN_FUNCS.map((f) => {
          // The item behind the function: the one in hand, else the one it would put in hand
          const s = (func === f.func && brush.stock ? stockByArtnr(brush.stock) : undefined) ?? stockFor(f.func, p.podiumPicks, brush.h)
          const name = s ? idx.byArtnr.get(s.artnr)?.product.name : undefined
          return (
            <QBtn
              key={f.func}
              on={func === f.func}
              setting
              title={`${f.one} · ${f.does.toLowerCase()} · et klikk setter ${name ?? f.one.toLowerCase()}, dra tegner fritt`}
              label={f.one}
              onClick={() => onPick(withFunc(brush, f.func, p.podiumPicks))}
            >
              {s && <StockOutline sections={s.sections} />}
              {f.one}
            </QBtn>
          )
        })}
        <Sep />
        <Palette
          swatches={ralSwatches(ral, (n) => `Disk ${n}`, (r) => onPick({ ...brush, ral: r }))}
          fill="Fyll alle disker og podier med denne fargen"
          onFill={p.onFillPodiums}
        />
        <Sep />
        {/* Høyde, CC: what Fri draws (a påbygg takes its neighbour's, K12), or the item's height in hand */}
        {penHeights(brush).map(({ h, on, off }) => (
          <QBtn
            key={h}
            on={on}
            setting
            disabled={off}
            title={off ? `Høyde CC ${h} mm · finnes ikke for varen i hånden` : `Høyde CC ${h} mm (utvendig ${h + 40})`}
            label={`Høyde ${h}`}
            onClick={() => onPick(withHeight(brush, h))}
          >
            {h}
          </QBtn>
        ))}
        <Sep />
        {/* «Fin»: as Shift held, for touch; Fri only, a function places its item whole */}
        <QBtn
          on={fine && fineOn}
          setting
          disabled={!fineOn}
          title={!fineOn ? 'Fin · gjelder bare Fri' : fine ? 'Fin · 250-steg, dra fra en kant flytter den · trykk for 500-steg igjen' : 'Fin · 250-steg, og dra fra en kant for å flytte den · på desktop også Shift'}
          label="Fin"
          onClick={() => onPick({ ...brush, fine: !fine })}
        >
          <Ruler size={15} />
          Fin
        </QBtn>
        <Sep />
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

export function QName({ name, meta }: { name: string; meta?: string }) {
  return (
    <span className="q-name">
      <span className="q-name-main">{name}</span>
      {meta && <span className="q-name-meta num">{meta}</span>}
    </span>
  )
}

/**
 * The colours of a pen and its paint bucket right after them (Bjørn 11.11.2026): the same row on the wall, floor and
 * counter pill, the bucket filling the whole stand with the chosen colour.
 */
function Palette({ swatches, fill, onFill }: { swatches: Swatch[]; fill: string; onFill: () => void }) {
  return (
    <>
      {swatches.map(({ key, ...x }) => (
        <Sw key={key} {...x} />
      ))}
      <QBtn title={fill} label="Fyll" onClick={onFill}>
        <PaintBucket size={15} />
      </QBtn>
    </>
  )
}

/** A colour as a square swatch, chosen = an ink ring inside it (dock quick picks, stand popover). */
export function Sw({ color, title, on, onClick }: { color?: string; title: string; on: boolean; onClick: () => void }) {
  return <button type="button" className="q-sw" aria-pressed={on} title={title} aria-label={title} style={{ background: color }} onClick={onClick} />
}

/** A pill button. `on` marks the tool in hand (ink, like the dock); with `setting` it marks a chosen setting instead
 *  (`--chosen`, like every other choice on a surface). Bjørn 8.11.2026 and 10.11.2026: only drawing tools get ink. */
export function QBtn({
  on,
  setting,
  disabled,
  title,
  label,
  onClick,
  children,
}: {
  on?: boolean
  setting?: boolean
  /** Does not apply to what is in hand: grey, where it always is (Bjørn 14.11.2026). */
  disabled?: boolean
  title: string
  label?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className={setting ? 'q-btn q-set' : 'q-btn'} aria-pressed={on} disabled={disabled} title={title} aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}

export const Sep = () => <span className="q-sep" aria-hidden />

/** A shelf on its two brackets, seen from the front. */
export function ShelfIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth=".14" strokeLinecap="round">
      <path d="M-.85 -.1 H.85 M-.7 -.1 V.45 M.7 -.1 V.45" />
    </svg>
  )
}

export function BeamIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} aria-hidden>
      <path d="M-.9 0 H.9" stroke="currentColor" strokeWidth=".16" strokeDasharray=".3 .15" />
    </svg>
  )
}

