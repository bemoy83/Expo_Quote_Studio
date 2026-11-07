// What the Kostgrunnlag page shares between its tabs: a number shown with its unit, and the changes waiting to be
// saved. docs/kostmodell.md.
import type { FieldNote } from '../../cost/basis'
import type { Field } from '../../cost/fields'
import { fmt } from '../format'

/** A new value waiting to be saved, with the status and source given with it. */
export interface Pending {
  value: number
  note?: FieldNote
}

/** A pending value against the field it changes: what withValues takes. */
export interface Change {
  field: Field
  value: number
  note?: FieldNote
}

/** A number with its unit: shares as %, a year without thousands space. */
export function valueText(f: Pick<Field, 'value' | 'unit'>): string {
  if (f.unit === '%') return `${fmt(f.value * 100, 2)} %`
  if (f.unit === 'år' && f.value > 1900) return String(f.value)
  return `${fmt(f.value, 3)} ${f.unit}`
}

/** The changes waiting, against the fields of the basis in use. A path the basis no longer has is left out. */
export function changesOf(pending: ReadonlyMap<string, Pending>, fields: readonly Field[]): Change[] {
  return [...pending].flatMap(([path, p]) => {
    const field = fields.find((f) => f.path === path)
    return field ? [{ field, value: p.value, note: p.note }] : []
  })
}

/** Today as YYYY-MM-DD: the date of a new version and of a note on a number. */
export const today = () => new Date().toISOString().slice(0, 10)
