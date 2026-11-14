// Møbel: the furniture the pen places.
import { mainGroupOf } from '../../../catalog/groups'
import { catalog } from '../../env'
import { ObjectThumb } from '../../panel/ProductRow'
import type { Brush } from '../../tools'
import { MAX } from './limits'
import { Sep } from './parts'
import type { QuickCtx } from './types'

export function ObjectPicks({ p, head, more, is }: QuickCtx) {
  const { onPick } = p
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
