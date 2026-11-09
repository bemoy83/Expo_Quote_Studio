// The release in 3D (Bjørn 9.11.2026): a click selects what was pressed, a drag never counts as a click, so moving a
// shelf, a frame or a decal leaves the selection (and the drawer) as it was.
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { addShelfRow } from '../../../domain/shelves/edit'
import { createVariant } from '../../../domain/variant'
import { rules } from '../../env'
import type { PlanSelection } from '../../plan/selection'
import { endDrag, type Drag, type PointerProps } from './drag'
import type { Hit, SceneHits } from './hits'

const v = addShelfRow(createVariant('A', { width: 6, depth: 3, type: 'row' }), rules, 'side-back', 1, 2, 1).v
const wall = v.walls.find((x) => x.id === 'side-back')!
const props = (selection: PlanSelection = {}) => {
  const onSelect = vi.fn()
  const P: PointerProps = { v, selection, onSelect, onEdit: vi.fn(), onCheckpoint: vi.fn(), onToast: vi.fn(), motifs: [] }
  return { P, onSelect }
}
const hits = { toModel: (p: THREE.Vector3) => p, faceOf: () => null } as unknown as SceneHits
const at = (pick: Partial<Hit>): Hit => ({ ...pick, point: new THREE.Vector3() }) as Hit
const shelfDrag = (moved: boolean, copy: boolean): Drag => ({
  kind: 'shelf', shelf: v.shelves![0], ids: ['h1', 'h2'], w: wall, s: 1, t0: 0, h0: 0, moved, copy: copy ? v : null, follow: false,
})

describe('release in 3D', () => {
  it('a click on a shelf selects it', () => {
    const { P, onSelect } = props()
    endDrag(P, hits, shelfDrag(false, false), at({ shelfId: 'h1' }), true)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ wallId: 'side-back', shelfId: 'h1' }))
  })

  it('a shelf dragged (moved or copied) selects nothing', () => {
    for (const copy of [false, true]) {
      const { P, onSelect } = props()
      endDrag(P, hits, shelfDrag(true, copy), at({ shelfId: 'h1' }), false)
      expect(onSelect).not.toHaveBeenCalled()
    }
  })

  it('a drag that came back to where it started is still a drag', () => {
    const { P, onSelect } = props()
    endDrag(P, hits, shelfDrag(true, false), at({ shelfId: 'h1' }), true)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('a frame or decal dragged selects nothing', () => {
    const decor: Drag = { kind: 'decor', item: { foil: {} as never }, w: wall, s: 1, t0: 0, h0: 0, moved: true }
    const { P, onSelect } = props()
    endDrag(P, hits, decor, at({ foilId: 'x' }), false)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('an orbit is not a click: the wall under it stays unselected', () => {
    const { P, onSelect } = props({ objectId: 'o1' })
    endDrag(P, hits, { kind: 'orbit' }, at({ wallId: 'side-back' }), false)
    expect(onSelect).not.toHaveBeenCalled()
    endDrag(P, hits, { kind: 'orbit' }, at({ wallId: 'side-back' }), true)
    expect(onSelect).toHaveBeenCalledWith({ wallId: 'side-back', side: undefined })
  })
})
