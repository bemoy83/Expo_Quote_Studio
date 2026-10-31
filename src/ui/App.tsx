import { Copy, Eraser, Maximize2, MousePointer2, Paintbrush, Redo2, Trash2, Undo2 } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { calc, type CalcResult } from '../calc/calc'
import { r2 } from '../calc/referenceStands'
import { addObject } from '../domain/objects'
import { removeRoom, roomSize } from '../domain/rooms'
import type { StandWallTerms, Variant } from '../domain/types'
import { customerName, fillFloor, standWallTerms } from '../domain/variant'
import { newSketch, parse, serialize, type Sketch } from '../persistence/file'
import { loadSketch, saveSketch } from '../persistence/storage'
import { initState, reduce } from '../state/history'
import { CalcPanel } from './calc/CalcPanel'
import { Button, IconButton, Segmented, Toast, useToast } from './controls'
import { CatalogPage } from './catalog/CatalogPage'
import { catalog, getVersion, idx, place, plateColor, productOf, rules, subscribe } from './env'
import { download } from './download'
import { count, fmt, kr, signed } from './format'
import { frameCount, TYPE_NAME } from './names'
import { Rail } from './panel/Rail'
import { PlanPreview, PlanView, type PlanSelection } from './plan/PlanView'
import { WallDrawer } from './plan/WallDrawer'
import { findMotif, motifLibrary } from './motifs'
import { fitDecor, removeFoil, removeTextile } from '../domain/decor'
import { newlyClosedRooms, wallsToRoom } from '../domain/enclosures'
import { PickingPage } from './picking/PickingPage'
import { ProductionPage } from './production/ProductionPage'
import { QuotePage } from './quote/QuotePage'
import { TopNav, type Page } from './shell/TopNav'
import { WorkOrderPage } from './workorder/WorkOrderPage'
import { VariantTabs } from './shell/VariantTabs'
import { FLOOR_SIZES, type Brush, type FloorSize, type Highlight, type Tool } from './tools'

// three.js is only loaded when the 3D view is opened
const Scene3D = lazy(() => import('./scene3d/Scene3D').then((m) => ({ default: m.Scene3D })))

function exampleSketch(): Sketch {
  let v: Variant = fillFloor(r2(), '5903')
  v = addObject(v, place, '5276', 4, 2.7) ?? v
  v = addObject(v, place, '5186', 3.3, 2.7) ?? v
  v = addObject(v, place, '5186', 4.7, 2.7) ?? v
  return { ...newSketch(), variants: [v] }
}

// calc is pure; cache per variant object so unchanged variants are not recalculated.
// A new catalog or new rules (product list, production assumptions) start a fresh cache, and so do new stand-wall terms
// (the project says who pays the stand walls).
let calcCache = new WeakMap<Variant, CalcResult>()
let cacheVersion = getVersion()
let cacheTerms: StandWallTerms | null = null
const calcOf = (v: Variant, terms: StandWallTerms) => {
  if (cacheVersion !== getVersion() || cacheTerms !== terms) {
    calcCache = new WeakMap()
    cacheVersion = getVersion()
    cacheTerms = terms
  }
  let r = calcCache.get(v)
  if (!r) {
    r = calc(v, rules, catalog, terms)
    calcCache.set(v, r)
  }
  return r
}

export default function App() {
  useSyncExternalStore(subscribe, getVersion)
  const [state, dispatch] = useReducer(reduce, undefined, () => initState(loadSketch() ?? exampleSketch()))
  const { sketch, current } = state
  const v = sketch.variants[current]
  const terms = standWallTerms(sketch.project)
  const calcFor = useCallback((x: Variant) => calcOf(x, terms), [terms])
  const res = calcFor(v)
  const [page, setPage] = useState<Page>('skisse')
  const [view, setView] = useState<'plan' | '3d'>('plan')
  const [tab, setTabRaw] = useState('stand')
  const [tool, setTool] = useState<Tool>('select')
  const [brush, setBrush] = useState<Brush | null>(null)
  const [floorSize, setFloorSize] = useState<FloorSize>(FLOOR_SIZES[0].size)
  const [highlight, setHighlight] = useState<Highlight>(null)
  const [selection, setSelection] = useState<PlanSelection>({})
  const [toast, showToast] = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => saveSketch(sketch), 300)
    return () => window.clearTimeout(t)
  }, [sketch])

  const motifs = useMemo(() => motifLibrary(sketch.motifs), [sketch.motifs])
  const vRef = useRef(v)
  useEffect(() => {
    vRef.current = v
  }, [v])
  // Every edit keeps textiles and foils valid: on a wall, off openings, inside their felt.
  // An edit that walls in an area with a door turns it into a room (frihåndsrom), as its own undo step.
  const onEdit = useCallback(
    (fn: (v: Variant) => Variant, history = true) => {
      const ratio = (id: string | undefined) => findMotif(motifs, id)?.ratio ?? 0
      const apply = (x: Variant) => fitDecor(fn(x), rules, ratio)
      dispatch({ type: 'edit', fn: apply, history })
      if (!history) return
      const areas = newlyClosedRooms(vRef.current, apply(vRef.current))
      if (!areas.length) return
      dispatch({ type: 'edit', fn: (x) => fitDecor(areas.reduce((y, o) => wallsToRoom(y, o) ?? y, x), rules, ratio) })
      const size = areas.map((outline) => roomSize({ outline })).join(' og ')
      showToast({ text: `Gjort om til rom ${size}`, action: 'Angre', onAction: () => dispatch({ type: 'undo' }) })
    },
    [motifs, showToast],
  )
  const onCheckpoint = useCallback(() => dispatch({ type: 'checkpoint' }), [])
  const selectVariant = (index: number) => dispatch({ type: 'select', index })

  /** Changing panel tab always returns to Velg. */
  const setTab = (k: string) => {
    setTabRaw(k)
    setTool('select')
  }
  /** Choosing a brush always goes to the plan; the brushes draw there. */
  const pick = (b: Brush, t: Tool = 'brush') => {
    setBrush(b)
    setTool(t)
    setView('plan')
    setSelection({})
  }

  // Keyboard: V P E, S (wall brush), G (floor brush), ⌘Z / ⇧⌘Z, Delete for the selected object
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select')) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' })
        return
      }
      if (mod || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'v' || k === 'escape') setTool('select')
      else if (k === 'p' && brush) {
        setTool('brush')
        setView('plan')
      } else if (k === 'e') {
        setTool('erase')
        setView('plan')
      }
      else if (k === 's') pick({ kind: 'wall', ral: v.defaultPlate })
      else if (k === 'g') {
        const f = brush?.kind === 'floor' ? brush.product : (Object.keys(res.keyFigures.floor)[0] ?? '5902')
        pick({ kind: 'floor', product: f })
      } else if ((k === 'delete' || k === 'backspace') && (selection.textileId || selection.foilId)) {
        const { textileId, foilId } = selection
        onEdit((x) => (textileId ? removeTextile(x, textileId) : removeFoil(x, foilId!)))
        setSelection({ wallId: selection.wallId, side: selection.side })
      } else if ((k === 'delete' || k === 'backspace') && selection.roomId) {
        const id = selection.roomId
        onEdit((x) => removeRoom(x, id))
        setSelection({})
      } else if ((k === 'delete' || k === 'backspace') && selection.objectId) {
        const id = selection.objectId
        onEdit((x) => ({ ...x, objects: x.objects.filter((o) => o.id !== id) }))
        setSelection({})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const others = sketch.variants.filter((_, i) => i !== current).map((x) => ({ name: x.name, sum: calcFor(x).sum }))
  const k = res.keyFigures
  const plateRal = v.defaultPlate

  const saveFile = () => {
    const name = customerName(sketch.project).replace(/[^A-Za-z0-9æøåÆØÅ]+/g, '') || 'standskisse'
    download(serialize(sketch), 'application/json', `${name}.standskisse.json`)
  }
  /** Replace the whole sketch (Ny, Åpne fil). One undo step, offered in the toast. */
  const load = (next: Sketch, text: string) => {
    dispatch({ type: 'load', sketch: next })
    setSelection({})
    setTool('select')
    showToast({ text, action: 'Angre', onAction: () => dispatch({ type: 'undo' }) })
  }
  const newFile = () => {
    load(newSketch(), 'Nytt tilbud startet')
    setPage('skisse')
    setView('plan')
    setTabRaw('stand')
  }
  const openFile = async (f: File) => {
    const r = parse(await f.text())
    if (!r.ok) return showToast(r.error)
    load(r.sketch, `Åpnet ${f.name}`)
  }

  const brushLabel = describeBrush(brush)

  return (
    <div className="app">
      <TopNav
        page={page}
        setPage={setPage}
        project={sketch.project}
        setProject={(project) => dispatch({ type: 'project', project })}
        onNew={newFile}
        onOpen={() => fileInput.current?.click()}
        onSave={saveFile}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void openFile(f)
          e.target.value = ''
        }}
      />
      {page === 'skisse' ? (
        <>
          <div className="band" data-band="eple">
            <div className="band-head">
              <h1>Standskisse</h1>
              <span className="band-tag">Utkast</span>
              <span className="band-sep" />
              <Segmented<'plan' | '3d'>
                onBand
                label="Visning"
                value={view}
                onChange={(x) => {
                  setView(x)
                  setTool('select')
                }}
                options={[
                  { value: 'plan', label: 'Plan' },
                  { value: '3d', label: '3D' },
                ]}
              />
              <IconButton icon={Undo2} label="Angre (⌘Z)" onBand disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })} />
              <IconButton icon={Redo2} label="Gjør om (⇧⌘Z)" onBand disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })} />
              {view === 'plan' && <span className="band-sep" />}
              {view === 'plan' && (
                <Segmented<Tool>
                  onBand
                  label="Verktøy"
                  value={tool}
                  onChange={(t) => {
                    if (t === 'brush' && !brush) pick({ kind: 'wall', ral: plateRal })
                    else setTool(t)
                  }}
                  options={[
                    { value: 'select', label: <><MousePointer2 size={14} /> Velg</>, kbd: 'V' },
                    {
                      value: 'brush',
                      label: (
                        <span className="brush-chip">
                          {brushLabel.color ? <i className="dot" style={{ background: brushLabel.color }} /> : <Paintbrush size={14} />}
                          {brushLabel.name}
                        </span>
                      ),
                      kbd: 'P',
                    },
                    { value: 'erase', label: <><Eraser size={14} /> Tøm</>, kbd: 'E' },
                  ]}
                />
              )}
              {view === 'plan' && tool !== 'select' && brush?.kind === 'floor' && (
                <Segmented<string>
                  onBand
                  label="Penselstørrelse"
                  value={FLOOR_SIZES.find((s) => s.size.w === floorSize.w && s.size.h === floorSize.h)!.label}
                  onChange={(l) => setFloorSize(FLOOR_SIZES.find((s) => s.label === l)!.size)}
                  options={FLOOR_SIZES.map((s) => ({ value: s.label, label: <span className="num">{s.label}</span> }))}
                />
              )}
              <span className="spacer" />
              <VariantTabs variants={sketch.variants} current={current} onSelect={selectVariant} />
              <Button onBand icon={Copy} disabled={sketch.variants.length >= 4} onClick={() => dispatch({ type: 'duplicate' })}>
                Ny variant
              </Button>
              {sketch.variants.length > 1 && (
                <IconButton icon={Trash2} label={`Slett variant ${v.name}`} onBand onClick={() => dispatch({ type: 'remove', index: current })} />
              )}
            </div>
            <div className="kpis">
              <Kpi label="Areal" value={fmt(k.area)} unit="m²" sub={`${v.stand.width} × ${v.stand.depth} m`} />
              <Kpi label="Åpne sider" value={String(k.openSides)} sub={TYPE_NAME[v.stand.type]} />
              <Kpi
                label="Vegg"
                value={fmt(k.wallLm)}
                unit="lm"
                sub={[wallSplit(k), k.openings ? count(k.openings, 'åpning', 'åpninger') : ''].filter(Boolean).join(' · ') || undefined}
              />
              <Kpi label="Takdrager" value={fmt(k.beamLm)} unit="m" sub={k.organiserBeamLm ? 'fra arrangør' : undefined} />
              {k.textileM2 > 0 && <Kpi label="Tekstilvegg" value={fmt(k.textileM2)} unit="m²" sub={frameCount(res.production.pieces.length)} />}
              <span className="spacer" />
              <Kpi
                label="Veiledende sum"
                value={kr(res.sum)}
                unit="kr"
                sub={['eks. mva.', ...others.map((o) => `${o.name} ${signed(o.sum - res.sum)}`)].join(' · ')}
              />
            </div>
          </div>
          <div className="workspace">
            <Rail
              v={v}
              res={res}
              tab={tab}
              setTab={setTab}
              tool={tool}
              brush={brush}
              pick={pick}
              onEdit={onEdit}
              onToast={showToast}
              motifs={motifs}
              onAddMotif={(m) => dispatch({ type: 'motifs', motifs: [...sketch.motifs, m] })}
              onSelect={(s) => {
                setTool('select')
                setSelection(s)
              }}
              selection={selection}
            />
            <main className="stage">
              <div className="plan-wrap">
                {view === 'plan' ? (
                  <PlanView
                    v={v}
                    res={res}
                    tool={tool}
                    brush={brush}
                    floorSize={floorSize}
                    highlight={highlight}
                    selection={selection}
                    onSelect={setSelection}
                    onEdit={onEdit}
                    onCheckpoint={onCheckpoint}
                    onToast={showToast}
                    motifs={motifs}
                  />
                ) : (
                  <Suspense fallback={<div className="stage-empty">Laster 3D …</div>}>
                    <Scene3D
                      v={v}
                      res={res}
                      highlight={highlight}
                      selection={selection}
                      onSelect={setSelection}
                      onEdit={onEdit}
                      onCheckpoint={onCheckpoint}
                      onToast={showToast}
                      motifs={motifs}
                    />
                    <div className="minimap">
                      <PlanPreview mini v={v} res={res} />
                      <IconButton icon={Maximize2} label="Vis plan" size={14} className="minimap-open" onClick={() => setView('plan')} />
                    </div>
                  </Suspense>
                )}
              </div>
              {selection.wallId && tool === 'select' && (
                <WallDrawer
                  v={v}
                  selection={selection}
                  motifs={motifs}
                  onSelect={setSelection}
                  onEdit={onEdit}
                  onCheckpoint={onCheckpoint}
                  onToast={showToast}
                  onClose={() => setSelection({})}
                />
              )}
              <div className="stage-hint">{view === '3d' ? HINT_3D : hint(tool, brush)}</div>
            </main>
            <CalcPanel res={res} name={v.name} onHover={setHighlight} onQuote={() => setPage('tilbud')} />
          </div>
        </>
      ) : page === 'tilbud' ? (
        <QuotePage project={sketch.project} variants={sketch.variants} current={current} onSelect={selectVariant} calcOf={calcFor} />
      ) : page === 'produksjon' ? (
        <ProductionPage
          variants={sketch.variants}
          current={current}
          onSelect={selectVariant}
          customer={customerName(sketch.project)}
          motifName={(id) => findMotif(motifs, id)?.name}
          onToast={showToast}
        />
      ) : page === 'plukkliste' ? (
        <PickingPage project={sketch.project} variants={sketch.variants} current={current} onSelect={selectVariant} calcOf={calcFor} />
      ) : page === 'arbeidsordre' ? (
        <WorkOrderPage project={sketch.project} variants={sketch.variants} current={current} onSelect={selectVariant} calcOf={calcFor} />
      ) : (
        <CatalogPage onToast={showToast} />
      )}
      <Toast msg={toast} />
    </div>
  )

  function describeBrush(b: Brush | null): { name: string; color?: string } {
    if (!b) return { name: 'Pensel' }
    if (b.kind === 'wall') return { name: `Vegg RAL ${b.ral}`, color: plateColor(b.ral) }
    if (b.kind === 'textile') return { name: 'Tekstilvegg' }
    if (b.kind === 'motif') return { name: findMotif(motifs, b.motif)?.name ?? 'Motiv' }
    const r = idx.byArtnr.get(b.product)
    const name = r ? (r.product.variants.length > 1 ? `${r.product.name.split(' ')[0]} ${r.variant.name.toLowerCase()}` : r.product.name) : b.product
    return { name, color: r?.variant.color }
  }
}

const HINT_3D = 'Dra for å rotere · rull for å zoome · dra møbler, en innervegg eller grafikk for å flytte · dra et rom i veggen eller taket, toppkanten av en romvegg endrer størrelsen · dra grafikk eller tekstilvegg fra Profilering til en vegg'

function hint(tool: Tool, brush: Brush | null): string {
  if (tool === 'select') return 'Klikk en vegg for å endre den · dra en innervegg eller møbler for å flytte · dra gulvet i et rom for å flytte rommet, en romvegg for å endre størrelsen · Delete fjerner valgt møbel eller rom'
  const erase = tool === 'erase'
  switch (brush?.kind ?? 'wall') {
    case 'wall':
      return erase ? 'Klikk en veggmodul eller dra langs rutenettet for å fjerne vegg · standvegger kan ikke fjernes' : 'Klikk en kant eller dra langs rutenettet for å tegne vegg i hele meter'
    case 'floor':
      return erase ? 'Klikk og dra for å fjerne gulv' : 'Klikk og dra for å tegne gulv · velg penselstørrelse i båndet'
    case 'opening':
      return erase ? 'Klikk en åpning for å gjøre den til vegg igjen' : 'Klikk en vegg eller en tom kant for å sette inn åpning med overstykke · klikk en åpning for å bytte fyll'
    case 'textile':
      return erase ? 'Klikk en tekstilvegg for å fjerne den' : 'Klikk ved en vegg, på siden rammen skal stå · rammen fyller den ledige delen av veggen'
    case 'motif':
      return erase ? 'Klikk en foliedekor for å fjerne den, eller en tekstilvegg for å ta bort motivet' : 'Klikk en tekstilvegg for trykk, eller et veggfelt for foliedekor'
    case 'object':
      return erase ? 'Klikk et møbel for å fjerne det' : `Klikk i planen for å sette ut ${productOf(brush?.kind === 'object' ? brush.product : '')?.name.toLowerCase() ?? 'varen'}`
  }
}

/** Stand walls apart from inner and room walls, and who pays them. */
function wallSplit(k: CalcResult['keyFigures']) {
  if (!k.standWallLm || k.standWallLm === k.wallLm) return k.organiserWallLm ? 'standvegg fra arrangør' : ''
  return `${fmt(k.standWallLm)} standvegg${k.organiserWallLm ? ' fra arrangør' : ''} · ${fmt(k.wallLm - k.standWallLm)} inner`
}

function Kpi({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <span className="kpi">
      <span className="label">{label}</span>
      <span className="value num">{value}</span>
      {unit && <span className="unit">{unit}</span>}
      {sub && <span className="sub">{sub}</span>}
    </span>
  )
}
