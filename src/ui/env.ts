// Rules and catalog the UI works with. The product list and the production assumptions can be edited, so these
// are live bindings: setCatalogEdits and setInFrame replace them, save them and notify subscribers (App re-renders).
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog'
import { builtProduct } from '../catalog/podium'
import { applyEdits, NO_EDITS, type CatalogEdits } from '../catalog/edits'
import { displayName, indexCatalog, placeContext } from '../catalog/lookup'
import { doorFloors, type FloorBoxes } from '../domain/doors'
import { objectBoxes, type PlaceContext } from '../domain/objects'
import { calcContext } from '../calc/context'
import type { PlanRect } from '../domain/counters'
import { DEFAULT_STAND_WALLS } from '../domain/variant'
import type { Product } from '../catalog/types'
import { EXAMPLE_BASIS, parseBasis, serializeBasis, type CostBasis } from '../cost/basis'
import { readHistory, withEntry, type HistoryEntry } from '../cost/history'
import { soldAs } from '../domain/podiumStock'
import type { PlacedObject, Point, Variant } from '../domain/types'
import { pricingFrom } from '../pricing/data'
import { KEYS, loadCostBasis, loadJson, saveCostBasis, saveJson } from '../persistence/storage'
import { ownInFrame, RULES, type InFrameParams, type Rules } from '../rules/rules'

const loadEdits = (): CatalogEdits => {
  const e = loadJson<CatalogEdits>(KEYS.catalog, NO_EDITS)
  return e?.version === 1 && e.variants && Array.isArray(e.added) ? e : NO_EDITS
}
const withInFrame = (p: Partial<InFrameParams>): Rules => ({ ...RULES, textile: { ...RULES.textile, inFrame: { ...RULES.textile.inFrame, ...p } } })

export let edits: CatalogEdits = loadEdits()
export let rules: Rules = withInFrame(ownInFrame(loadJson<Partial<InFrameParams>>(KEYS.inFrame, {})))
export let catalog = applyEdits(DEFAULT_CATALOG, edits)
export let idx = indexCatalog(catalog)
export let place = withPosts(placeContext(rules, catalog))
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
  place = withPosts(placeContext(rules, catalog))
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

/** Disker og podier (Byggeregel K13): the product built on site for a function (`disker`, `podier`). */
export const builtOf = (func: string) => builtProduct(catalog.products, func)
export const isCounter = (artnr: string) => place.isCounter(artnr)

/** Furniture, counters and the doors' own free floor as boxes: none may stand in a door's free floor (Byggeregel D7). */
export const floorBoxes: FloorBoxes = (v) => [...v.objects.flatMap((o) => objectBoxes(place, o)), ...doorFloors(v, place.swings)]

export const openingProducts = () => catalog.products.filter((p) => p.opening)

/** What an art.nr is called: its name in the product list, the same as the calc and the quote (`displayName`): «Bardisk»,
 *  «Podie 50 × 50 75 cm» (Bjørn 14.11.2026: every name comes from the product list). */
export const artnrName = (artnr: string) => {
  const r = idx.byArtnr.get(artnr)
  return r ? displayName(r) : artnr
}

/** The name of a counter of Disker og podier: the standard item it is (K22), else the product it is built as on site,
 *  «Disk» or «Podie» (K13). */
export const counterName = (o: Pick<PlacedObject, 'product' | 'sections'>) => artnrName(soldAs(o))

/** What the counters of a variant stand among (calc): every post of its walls and takdrager, and every foot plate
 *  (Byggeregel K10, K23). Kept while that is unchanged: a drag moves only objects, so the walls, beams, textiles and stand
 *  stay the same arrays and nothing is counted again. */
type Built = { posts: readonly Point[]; plates: readonly PlanRect[] }
const builtCache = new WeakMap<Variant['walls'], { keys: unknown[]; built: Built }>()
function standsOn(v: Variant): Built {
  const keys = [v.stand, v.innerBeams, v.noBeams, v.textiles, v.freeTextiles, v.openings, rules, catalog, pricing]
  const hit = builtCache.get(v.walls)
  if (hit && hit.keys.every((k, i) => k === keys[i])) return hit.built
  const c = calcContext({ ...v, objects: [] }, rules, catalog, DEFAULT_STAND_WALLS, pricing)
  const built = { posts: [...c.allPosts.values()], plates: c.plates }
  builtCache.set(v.walls, { keys, built })
  return built
}

/** Every foot plate of a variant (Byggeregel K23). */
export const footPlatesOf = (v: Variant): readonly PlanRect[] => standsOn(v).plates

/** The place context of the app: with the posts of takdrager standing free (Byggeregel K10, Bjørn 16.11.2026). */
function withPosts(c: PlaceContext): PlaceContext {
  return { ...c, posts: (v) => standsOn(v).posts }
}
