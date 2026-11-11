// Rules and catalog the UI works with. The product list and the production assumptions can be edited, so these
// are live bindings: setCatalogEdits and setInFrame replace them, save them and notify subscribers (App re-renders).
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog'
import { applyEdits, NO_EDITS, type CatalogEdits } from '../catalog/edits'
import { indexCatalog, placeContext } from '../catalog/lookup'
import type { Product } from '../catalog/types'
import { EXAMPLE_BASIS, parseBasis, serializeBasis, type CostBasis } from '../cost/basis'
import { readHistory, withEntry, type HistoryEntry } from '../cost/history'
import { pricingFrom } from '../pricing/data'
import { KEYS, loadCostBasis, loadJson, saveCostBasis, saveJson } from '../persistence/storage'
import { ownInFrame, RULES, type InFrameParams, type Rules } from '../rules/rules'

const loadEdits = (): CatalogEdits => {
  const e = loadJson<CatalogEdits>(KEYS.catalog, NO_EDITS)
  return e?.version === 1 && e.variants && Array.isArray(e.added) ? e : NO_EDITS
}
const withInFrame = (p: Partial<InFrameParams>): Rules => ({ ...RULES, textile: { ...RULES.textile, inFrame: { ...RULES.textile.inFrame, ...p } } })

export let edits: CatalogEdits = loadEdits()
export let rules: Rules = withInFrame(ownInFrame(loadJson<Partial<InFrameParams>>(KEYS.inFrame, {}), true))
export let catalog = applyEdits(DEFAULT_CATALOG, edits)
export let idx = indexCatalog(catalog)
export let place = placeContext(rules, catalog)
/** The kostgrunnlag the cost engine runs on: a file loaded in this browser, else the example. */
export let costBasis: CostBasis = loadCostBasis() ?? EXAMPLE_BASIS
/** The price items, with wall and takdrager costed from the kostgrunnlag. */
export let pricing = pricingFrom(costBasis)

let version = 0
const listeners = new Set<() => void>()
export const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const getVersion = () => version
const changed = () => {
  idx = indexCatalog(catalog)
  place = placeContext(rules, catalog)
  version++
  listeners.forEach((fn) => fn())
}

export function setCatalogEdits(e: CatalogEdits) {
  edits = e
  catalog = applyEdits(DEFAULT_CATALOG, e)
  saveJson(KEYS.catalog, e)
  changed()
}

export function setInFrame(p: InFrameParams) {
  rules = withInFrame(p)
  saveJson(KEYS.inFrame, ownInFrame(p))
  changed()
}

/** Load a kostgrunnlag, or null to go back to the example. False when the browser would not keep it; it is still used
 *  until the page is reloaded. */
export function setCostBasis(b: CostBasis | null): boolean {
  costBasis = b ?? EXAMPLE_BASIS
  pricing = pricingFrom(costBasis)
  const kept = saveCostBasis(b)
  changed()
  return kept
}

/** Saved versions of the kostgrunnlag, newest first (cost/history.ts). */
export let costHistory: HistoryEntry[] = readHistory(loadJson<unknown>(KEYS.costHistory, []))

const keepEntry = (e: HistoryEntry) => {
  costHistory = withEntry(costHistory, e)
  saveJson(KEYS.costHistory, costHistory)
}

/** Use `b`, made from the basis in use by the changes in `entry`, and keep the entry. False as for setCostBasis. */
export function saveBasisVersion(b: CostBasis, entry: HistoryEntry): boolean {
  keepEntry(entry)
  return setCostBasis(b)
}

/** Back to the basis the newest saved version replaced; kept in the history as a version of its own. An error text
 *  when there is none, or it cannot be read. */
export function revertBasis(at: string): string | null {
  const last = costHistory[0]
  if (!last) return 'Ingen tidligere versjon'
  const read = last.before === null ? null : parseBasis(last.before)
  if (read && !read.ok) return read.error
  const back = read ? read.basis : null
  const now = costBasis
  keepEntry({ at, version: back?.version ?? 'eksempel', from: now.version, comment: `Tilbake til ${back ? back.version : 'eksempeltall'}`, changes: [], before: now === EXAMPLE_BASIS ? null : serializeBasis(now) })
  setCostBasis(back)
  return null
}

export const DEFAULT_IN_FRAME = RULES.textile.inFrame

export const productOf = (artnr: string): Product | undefined => idx.byArtnr.get(artnr)?.product

export const plateColor = (ral: string) => idx.wallByRal.get(ral)?.variant.color ?? '#ddd'
export const plateName = (ral: string) => idx.wallByRal.get(ral)?.variant.name ?? `RAL ${ral}`

/** Wall colours: the variants of the wall product (level 1). */
export const wallPlates = () => catalog.products.find((p) => p.id === catalog.system.wall)?.variants ?? []

/** Counters (Disker, Byggeregler K1–K6): products built of Foga profiles, placed like furniture. */
export const counterProducts = () => catalog.products.filter((p) => p.counter)
export const isCounter = (artnr: string) => !!idx.byArtnr.get(artnr)?.product.counter

export const openingProducts = () => catalog.products.filter((p) => p.opening)
