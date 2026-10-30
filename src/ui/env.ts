// Rules and catalog the UI works with. Later the catalog comes from the product list page (and OMS import).
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog'
import { indexCatalog, placeContext } from '../catalog/lookup'
import type { Product, ProductVariant } from '../catalog/types'
import { RULES } from '../rules/rules'

export const rules = RULES
export const catalog = DEFAULT_CATALOG
export const idx = indexCatalog(catalog)
export const place = placeContext(rules, catalog)

export const variantOf = (artnr: string): ProductVariant | undefined => idx.byArtnr.get(artnr)?.variant
export const productOf = (artnr: string): Product | undefined => idx.byArtnr.get(artnr)?.product

export const plateColor = (ral: string) => idx.plateByRal.get(ral)?.variant.color ?? '#ddd'
export const plateName = (ral: string) => idx.plateByRal.get(ral)?.variant.name ?? `RAL ${ral}`

export const wallPlates = () => catalog.products.find((p) => p.variants.some((v) => v.ral))?.variants ?? []

export const openingProducts = () => catalog.products.filter((p) => p.opening)
