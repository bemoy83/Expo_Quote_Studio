// Rules and catalog the UI works with. The product list and the production assumptions can be edited, so these
// are live bindings: setCatalogEdits and setInFrame replace them, save them and notify subscribers (App re-renders).
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog'
import { applyEdits, NO_EDITS, type CatalogEdits } from '../catalog/edits'
import { indexCatalog, placeContext } from '../catalog/lookup'
import type { Product, ProductVariant } from '../catalog/types'
import { KEYS, loadJson, saveJson } from '../persistence/storage'
import { RULES, type InFrameParams, type Rules } from '../rules/rules'

const loadEdits = (): CatalogEdits => {
  const e = loadJson<CatalogEdits>(KEYS.catalog, NO_EDITS)
  return e?.version === 1 && e.variants && Array.isArray(e.added) ? e : NO_EDITS
}
const withInFrame = (p: Partial<InFrameParams>): Rules => ({ ...RULES, textile: { ...RULES.textile, inFrame: { ...RULES.textile.inFrame, ...p } } })

export let edits: CatalogEdits = loadEdits()
export let rules: Rules = withInFrame(loadJson<Partial<InFrameParams>>(KEYS.inFrame, {}))
export let catalog = applyEdits(DEFAULT_CATALOG, edits)
export let idx = indexCatalog(catalog)
export let place = placeContext(rules, catalog)

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
  saveJson(KEYS.inFrame, p)
  changed()
}

export const DEFAULT_IN_FRAME = RULES.textile.inFrame

export const variantOf = (artnr: string): ProductVariant | undefined => idx.byArtnr.get(artnr)?.variant
export const productOf = (artnr: string): Product | undefined => idx.byArtnr.get(artnr)?.product

export const plateColor = (ral: string) => idx.wallByRal.get(ral)?.variant.color ?? '#ddd'
export const plateName = (ral: string) => idx.wallByRal.get(ral)?.variant.name ?? `RAL ${ral}`

/** Wall colours: the variants of the wall product (level 1). */
export const wallPlates = () => catalog.products.find((p) => p.id === catalog.system.wall)?.variants ?? []

export const openingProducts = () => catalog.products.filter((p) => p.opening)
