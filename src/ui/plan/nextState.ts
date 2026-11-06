// The next variant the plan previews (docs/forhandsvisning.md): what the target's edit would store, its calc and where
// it differs from the sketch per layer (nextArea.ts). Worked out again only when the target or the sketch changes, so
// moving the pointer within one target costs nothing.
import type { CalcResult } from '../../calc/calc'
import { conflicts } from '../../domain/objects'
import type { Variant } from '../../domain/types'
import { builtModules } from '../../domain/walls'
import { place } from '../env'
import type { NextOutcome, NextTarget } from './next'
import { changedAreas, unchanged, type Areas, type PlanState } from './nextArea'

/** What an edit would store (App's onEdit without storing it) and its calc. */
export interface Preview {
  result: (fn: (v: Variant) => Variant) => Variant
  calc: (v: Variant) => CalcResult
}

/** What the pen would store, and the next variant as the plan draws it with where it differs (null: nothing changes). */
export interface NextState {
  outcome: NextOutcome
  scene: (PlanState & { areas: Areas }) | null
}

/** The last next state worked out per sketch: moving the pointer within the same target reuses it. */
const cache = new WeakMap<Variant, { key: string; res: CalcResult; preview: Preview; value: NextState }>()

/** The next state for the target over the sketch `base`, worked out again only when the target or the sketch changes. */
export function nextOf(t: NextTarget, base: PlanState, preview: Preview): NextState {
  const c = cache.get(base.v)
  if (c && c.key === t.key && c.res === base.res && c.preview === preview) return c.value
  const value = nextStateOf(t.outcome(), base, preview)
  cache.set(base.v, { key: t.key, res: base.res, preview, value })
  return value
}

function nextStateOf(outcome: NextOutcome, base: PlanState, preview: Preview): NextState {
  const { v, res } = base
  if (!outcome.edit) return { outcome, scene: null }
  const nv = preview.result(outcome.edit)
  if (nv === v) return { outcome, scene: null }
  const scene: PlanState = { v: nv, res: onlyObjects(v, nv) ? res : preview.calc(nv), mods: builtModules(nv), bad: conflicts(nv, place) }
  const areas = changedAreas(base, scene)
  return { outcome, scene: unchanged(areas) ? null : { ...scene, areas } }
}

/** Only the furniture differs: the calc's frame (beams, posts, foot plates, free-standing textile) is the same. */
function onlyObjects(a: Variant, b: Variant): boolean {
  return (Object.keys(b) as (keyof Variant)[]).every((k) => k === 'objects' || a[k] === b[k])
}
