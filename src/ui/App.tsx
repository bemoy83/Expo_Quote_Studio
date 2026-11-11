import { Maximize2 } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { r2 } from '../calc/referenceStands'
import { addObject } from '../domain/objects'
import { addDefaultRoom, roomSize } from '../domain/rooms'
import { paintAllWalls } from '../domain/panels'
import type { StandWallTerms, Variant } from '../domain/types'
import { customerName, fillFloor, standWallTerms } from '../domain/variant'
import { basisLabel, basisRef, sameBasis } from '../cost/basis'
import { newSketch, parse, serialize, type Sketch } from '../persistence/file'
import { KEYS, loadJson, loadSketch, saveJson, saveSketch } from '../persistence/storage'
import { initState, reduce } from '../state/history'
import { CalcPanel } from './calc/CalcPanel'
import { calcOf } from './calcCache'
import { closeRooms, editResult, ratioFor, roomsFrom, settle } from './edits'
import { CatalogPage } from './catalog/CatalogPage'
import { CostBasisPage } from './costbasis/CostBasisPage'
import { BASIS_EVENT } from './costbasis/link'
import { IconButton, Toast } from './controls'
import { download } from './download'
import { catalog, costBasis, getVersion, idx, place, plateColor, pricing, subscribe } from './env'
import { hint, HINT_3D } from './hints'
import { motifLibrary, readMotif } from './motifs'
import { NameTip } from './NameTip'
import { Rail } from './panel/Rail'
import { DrawerHandle } from './plan/DrawerHandle'
import { Drawers } from './plan/Drawers'
import { PlanPreview } from './plan/PlanPreview'
import { PlanView } from './plan/PlanView'
import { PriceChangePill } from './plan/PriceChangePill'
import { QuickPicks } from './plan/QuickPicks'
import { hasDrawer, type DrawerState, type PlanSelection } from './plan/selection'
import { StandChip } from './plan/StandChip'
import { ToolDock } from './plan/ToolDock'
import { usePriceChange } from './plan/usePriceChange'
import { QuotePage } from './quote/QuotePage'
import { SketchBand, type Layout } from './shell/SketchBand'
import { TopNav, type Page } from './shell/TopNav'
import type { Highlight, PenTool } from './tools'
import { useShortcuts } from './useShortcuts'
import { useToast } from './useToast'
import { useTools } from './useTools'
import { WorkOrderPage } from './workorder/WorkOrderPage'

// three.js is only loaded when the 3D view is opened
const Scene3D = lazy(() => import('./scene3d/Scene3D').then((m) => ({ default: m.Scene3D })))
// The plan's 3D mini map shares three.js and the scene builder with it, so they load with the plan (and 3D opens quicker)
const Scene3DPreview = lazy(() => import('./scene3d/Scene3DPreview').then((m) => ({ default: m.Scene3DPreview })))

function exampleSketch(): Sketch {
  let v: Variant = fillFloor(r2(), '5903')
  v = addObject(v, place, '5276', 4, 2.7) ?? v
  v = addObject(v, place, '5186', 3.3, 2.7) ?? v
  v = addObject(v, place, '5186', 4.7, 2.7) ?? v
  return { ...newSketch(), variants: [v] }
}

export default function App() {
  useSyncExternalStore(subscribe, getVersion)
  const [state, dispatch] = useReducer(reduce, undefined, () => initState(loadSketch() ?? exampleSketch()))
  const { sketch, current } = state
  const v = sketch.variants[current]
  const terms = standWallTerms(sketch.project)
  const calcFor = useCallback((x: Variant) => calcOf(x, terms), [terms])
  /** Who pays the stand walls and their colour: a project setting, set from the stand chip. */
  const setTerms = (patch: Partial<StandWallTerms>) => dispatch({ type: 'standWalls', patch })
  const res = calcFor(v)
  const [page, setPage] = useState<Page>('skisse')
  // A kostgrunnlag path from «Slik er det regnet»: the page opens on it. `n` makes the same path a new request.
  const [basisFocus, setBasisFocus] = useState<{ path: string; n: number } | null>(null)
  useEffect(() => {
    const on = (e: Event) => {
      setBasisFocus((f) => ({ path: (e as CustomEvent<string>).detail, n: (f?.n ?? 0) + 1 }))
      setPage('kostgrunnlag')
    }
    window.addEventListener(BASIS_EVENT, on)
    return () => window.removeEventListener(BASIS_EVENT, on)
  }, [])
  const [view, setView] = useState<'plan' | '3d'>('plan')
  /** Why what the plan's pointer aims at cannot be stored, shown in the hint line instead of the tool's help. */
  const [planHint, setPlanHint] = useState<string | null>(null)
  const [tab, setTabRaw] = useState('vegg')
  /** Panel and calc can be folded away for more drawing room; remembered on this machine. */
  const [layout, setLayout] = useState<Layout>(() => ({ ...LAYOUT, ...loadJson<Partial<Layout>>(KEYS.layout, {}) }))
  const fold = (k: keyof Layout, open: boolean) => setLayout((l) => ({ ...l, [k]: open }))
  useEffect(() => {
    saveJson(KEYS.layout, layout)
  }, [layout])
  const [highlight, setHighlight] = useState<Highlight>(null)
  const [selection, setSelectionRaw] = useState<PlanSelection>({})
  /** The drawer has its own state: a plain click only selects; Mer in the pill opens it (docs/pille-og-skuff.md). */
  const [drawer, setDrawer] = useState<DrawerState>('closed')
  /** Select; the drawer stays open while the selection has one (another wall, a frame on it), else it closes. */
  const setSelection = useCallback((s: PlanSelection) => {
    setSelectionRaw(s)
    if (!hasDrawer(s)) setDrawer('closed')
  }, [])
  /** Select and open the drawer in detail: Mer in the pill, a frame chosen in the panel, a click in 3D. */
  const openDrawer = useCallback((s: PlanSelection) => {
    setSelectionRaw(s)
    setDrawer(hasDrawer(s) ? 'detail' : 'closed')
  }, [])
  /** 3D keeps the drawer on a plain click for now (no pill there). */
  const select3d = useCallback((s: PlanSelection) => (hasDrawer(s, '3d') ? openDrawer(s) : setSelection(s)), [openDrawer, setSelection])
  const drawerOpen = drawer !== 'closed' && hasDrawer(selection, view)
  const [toast, showToast] = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => saveSketch(sketch), 300)
    return () => window.clearTimeout(t)
  }, [sketch])

  const motifs = useMemo(() => motifLibrary(sketch.motifs), [sketch.motifs])
  const tools = useTools({
    v,
    res,
    motifs,
    onPick: () => {
      setView('plan')
      setSelection({})
    },
    onErase: () => setView('plan'),
  })
  const { tool, setTool, brush, active, pick } = tools
  const vRef = useRef(v)
  useEffect(() => {
    vRef.current = v
  }, [v])
  // Every edit keeps textiles and foils valid: on a wall, off openings, inside their felt.
  // An edit that walls in an area with a door turns it into a room (frihåndsrom), as its own undo step.
  const onEdit = useCallback(
    (fn: (v: Variant) => Variant, history = true) => {
      const ratio = ratioFor(motifs)
      const apply = (x: Variant) => settle(fn(x), ratio)
      dispatch({ type: 'edit', fn: apply, history })
      if (!history) return
      const areas = closeRooms(vRef.current, apply(vRef.current), ratio)?.areas
      if (!areas) return
      dispatch({ type: 'edit', fn: (x) => roomsFrom(x, areas, ratio) })
      const size = areas.map((outline) => roomSize({ outline })).join(' og ')
      showToast({ text: `Gjort om til rom ${size}`, action: 'Angre', onAction: () => dispatch({ type: 'undo' }) })
    },
    [motifs, showToast],
  )
  /** What an edit on the sketch shown would store, and its calc: the plan shows it dimmed before the click. */
  const preview = useMemo(() => ({ result: (fn: (x: Variant) => Variant) => editResult(v, fn, motifs), calc: calcFor }), [v, motifs, calcFor])
  const onCheckpoint = useCallback(() => dispatch({ type: 'checkpoint' }), [])
  const selectVariant = (index: number) => dispatch({ type: 'select', index })

  /** Changing panel tab always returns to Velg. */
  const setTab = (k: string) => {
    setTabRaw(k)
    setTool('select')
  }
  /** Plan or 3D, from the stand chip or a mini map: always in Velg. The brushes only draw in the plan, and the drawers only
   *  open in Velg, so a pen carried into 3D would leave a clicked wall without its drawer. */
  const showView = (x: 'plan' | '3d') => {
    setView(x)
    setTool('select')
  }

  useShortcuts({
    v,
    tools,
    selection,
    setSelection,
    drawerOpen,
    onEdit,
    onToast: showToast,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    toPlan: () => setView('plan'),
  })

  /** Sketches opened or started; a new one starts the price change over. */
  const [loads, setLoads] = useState(0)
  const change = usePriceChange(res.sum, `${loads}:${current}`)
  const others = sketch.variants.filter((_, i) => i !== current).map((x) => ({ name: x.name, sum: calcFor(x).sum }))
  const saveFile = () => {
    const name = customerName(sketch.project).replace(/[^A-Za-z0-9æøåÆØÅ]+/g, '') || 'standskisse'
    // The file remembers which kostgrunnlag the quote was calculated with
    const project = { ...sketch.project, costBasis: basisRef(costBasis, pricing.code) }
    download(serialize({ ...sketch, project }), 'application/json', `${name}.standskisse.json`)
  }
  /** Replace the whole sketch (Ny, Åpne fil). One undo step, offered in the toast. */
  const load = (next: Sketch, text: string) => {
    dispatch({ type: 'load', sketch: next })
    setLoads((n) => n + 1)
    setSelection({})
    setTool('select')
    showToast({ text, action: 'Angre', onAction: () => dispatch({ type: 'undo' }) })
  }
  const newFile = () => {
    load(newSketch(), 'Nytt tilbud startet')
    setPage('skisse')
    setView('plan')
    setTabRaw('vegg')
  }
  const openFile = async (f: File) => {
    const r = parse(await f.text())
    if (!r.ok) return showToast(r.error)
    const was = r.sketch.project.costBasis
    const now = basisRef(costBasis, pricing.code)
    // Same name with other numbers counts too: the code says the content differs
    const other = was && !sameBasis(was, now) ? ` · regnet med kostgrunnlag ${basisLabel(was, true)}, nå ${basisLabel(now, true)}` : ''
    load(r.sketch, `Åpnet ${f.name}${other}`)
  }

  const brushLabel = tools.describeBrush()

  const fillWithPen = () => {
    if (brush?.kind !== 'floor') return
    const product = brush.product
    onEdit((x) => fillFloor(x, product, idx.byArtnr.get(product)?.product.roll, pricing.carpet))
  }
  /** Bakrom 1 × 1 m with a door in a free corner; from the wall tool's quick picks and the panel. */
  const addRoom = () => {
    const door = catalog.products.find((p) => p.opening === 'door')!.variants[0].artnr
    const next = addDefaultRoom(v, door)
    if (next) onEdit(() => next)
    else showToast('Ingen ledige hjørner til bakrom')
  }
  /** A customer's own motif into the library. From the profiling tool it also becomes the pen; the panel only adds it. */
  const uploadMotif = async (f: File, take = true) => {
    try {
      const m = await readMotif(f, motifs.map((x) => x.id))
      dispatch({ type: 'motifs', motifs: [...sketch.motifs, m] })
      if (take) pick({ kind: 'motif', motif: m.id })
      showToast(`${m.name} lagt til i grafikkbiblioteket`)
    } catch (e) {
      showToast((e as Error).message)
    }
  }
  const quick = (
    <QuickPicks
      tool={active}
      brush={brush}
      name={brushLabel.name}
      meta={brushLabel.meta}
      wallRal={tools.wallRal}
      motifs={motifs}
      onPick={(b) => pick(b)}
      onMore={() => {
        if (active === 'select' || active === 'erase') return
        setTabRaw(PANEL_TAB[active])
        fold('panel', true)
      }}
      onAddRoom={addRoom}
      onUpload={(f) => void uploadMotif(f)}
      floorSize={tools.floorSize}
      onFloorSize={tools.setFloorSize}
      otherSize={tools.otherSize}
      onOtherSize={tools.setOtherSize}
      gridStep={tools.gridStep}
      onGridStep={tools.setGridStep}
      onFill={fillWithPen}
      onFillWalls={() => onEdit((x) => paintAllWalls(x, tools.wallRal))}
    />
  )
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
          <SketchBand
            variants={sketch.variants}
            current={current}
            res={res}
            others={others}
            layout={layout}
            fold={fold}
            onSelect={selectVariant}
            onDuplicate={() => dispatch({ type: 'duplicate' })}
            onRemove={() => dispatch({ type: 'remove', index: current })}
          />
          <div className="workspace">
            <Rail
              v={v}
              res={res}
              tab={tab}
              setTab={setTab}
              open={layout.panel}
              setOpen={(o) => fold('panel', o)}
              tool={tool}
              brush={brush}
              pick={pick}
              onEdit={onEdit}
              onToast={showToast}
              motifs={motifs}
              onUpload={(f) => void uploadMotif(f, false)}
              onAddRoom={addRoom}
              onSelect={(s) => {
                setTool('select')
                openDrawer(s)
              }}
              selection={selection}
            />
            <main className="stage">
              <div className="plan-wrap">
                {view === 'plan' ? (
                  <>
                    <PlanView
                      v={v}
                      res={res}
                      tool={tool}
                      brush={brush}
                      floorSize={tools.floorSize}
                      gridStep={tools.gridStep}
                      highlight={highlight}
                      selection={selection}
                      onSelect={setSelection}
                      drawerOpen={drawerOpen}
                      onOpenDrawer={openDrawer}
                      onEdit={onEdit}
                      onCheckpoint={onCheckpoint}
                      onToast={showToast}
                      motifs={motifs}
                      onHint={setPlanHint}
                      preview={preview}
                    />
                    <div className="minimap">
                      <Suspense fallback={null}>
                        <Scene3DPreview v={v} res={res} motifs={motifs} />
                      </Suspense>
                      <IconButton icon={Maximize2} label="Vis 3D" size={14} className="minimap-open" onClick={() => showView('3d')} />
                    </div>
                  </>
                ) : (
                  <Suspense fallback={<div className="stage-empty">Laster 3D …</div>}>
                    <Scene3D
                      v={v}
                      res={res}
                      highlight={highlight}
                      selection={selection}
                      onSelect={select3d}
                      onEdit={onEdit}
                      onCheckpoint={onCheckpoint}
                      onToast={showToast}
                      motifs={motifs}
                    />
                    <div className="minimap low">
                      <PlanPreview mini v={v} res={res} />
                      <IconButton icon={Maximize2} label="Vis plan" size={14} className="minimap-open" onClick={() => showView('plan')} />
                    </div>
                  </Suspense>
                )}
                <StandChip v={v} res={res} onEdit={onEdit} terms={terms} onTerms={setTerms} view={view} onView={showView} hint={view === '3d' ? HINT_3D : planHint ? { text: planHint, more: planHint } : hint(tool, brush, tools.rollBrush)} />
                {view === 'plan' && change?.at && <PriceChangePill key={change.id} change={change} />}
                <ToolDock
                  tools={view === 'plan'}
                  active={active}
                  onTool={tools.activate}
                  stripes={{ wall: plateColor(tools.wallRal), floor: tools.floorPen?.kind === 'floor' ? idx.byArtnr.get(tools.floorPen.product)?.variant.color : undefined }}
                  canUndo={state.past.length > 0}
                  canRedo={state.future.length > 0}
                  onUndo={() => dispatch({ type: 'undo' })}
                  onRedo={() => dispatch({ type: 'redo' })}
                  change={change && !(view === 'plan' && change.at) ? change : null}
                >
                  {quick}
                </ToolDock>
              </div>
              {tool === 'select' && drawerOpen && (
                <div className={`drawer-frame ${drawer}`}>
                  <DrawerHandle detail={drawer === 'detail'} onChange={(d) => setDrawer(d ? 'detail' : 'compact')} />
                  <Drawers
                    v={v}
                    res={res}
                    view={view}
                    selection={selection}
                    onSelect={setSelection}
                    onEdit={onEdit}
                    onCheckpoint={onCheckpoint}
                    onToast={showToast}
                    motifs={motifs}
                    onUpload={(f) => void uploadMotif(f, false)}
                  />
                </div>
              )}
            </main>
            {layout.calc && <CalcPanel res={res} name={v.name} onHover={setHighlight} onQuote={() => setPage('tilbud')} />}
          </div>
        </>
      ) : page === 'tilbud' ? (
        <QuotePage project={sketch.project} variants={sketch.variants} current={current} onSelect={selectVariant} calcOf={calcFor} motifs={motifs} />
      ) : page === 'arbeidsordre' ? (
        <WorkOrderPage project={sketch.project} variants={sketch.variants} current={current} onSelect={selectVariant} calcOf={calcFor} />
      ) : page === 'kostgrunnlag' ? (
        <CostBasisPage key={basisFocus?.n ?? 0} focus={basisFocus?.path ?? null} onToast={showToast} />
      ) : (
        <CatalogPage onToast={showToast} onBasis={() => setPage('kostgrunnlag')} />
      )}
      <Toast msg={toast} />
      <NameTip />
    </div>
  )
}

const LAYOUT: Layout = { panel: true, calc: true }

/** «…» on the quick picks opens the panel on the tool's tab, where all its options are. */
const PANEL_TAB: Record<PenTool, string> = { wall: 'vegg', floor: 'gulv', profile: 'prof', fitting: 'hyll', object: 'mob' }
