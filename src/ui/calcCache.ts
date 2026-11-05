// The calculation of a variant, kept while the variant is unchanged. calc is pure, so the result is cached per variant
// object and unchanged variants are not recalculated. A new catalog or new rules (product list, production assumptions)
// start a fresh cache, and so do new stand-wall terms (the project says who pays the stand walls).
import { calc, type CalcResult } from '../calc/calc'
import type { StandWallTerms, Variant } from '../domain/types'
import { catalog, getVersion, rules } from './env'

let cache = new WeakMap<Variant, CalcResult>()
let version = getVersion()
let cacheTerms: StandWallTerms | null = null

export function calcOf(v: Variant, terms: StandWallTerms): CalcResult {
  if (version !== getVersion() || cacheTerms !== terms) {
    cache = new WeakMap()
    version = getVersion()
    cacheTerms = terms
  }
  let r = cache.get(v)
  if (!r) {
    r = calc(v, rules, catalog, terms)
    cache.set(v, r)
  }
  return r
}
