// The release in 3D (Bjørn 9.11.2026): a click selects what was pressed, a drag never counts as a click, so moving a
// shelf, a frame or a decal leaves the selection (and the drawer) as it was.
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { addShelfRow } from '../../../domain/shelves/edit'
import { createVariant } from '../../../domain/variant'
import { rules } from '../../env'
import type { PlanSelection } from '../../plan/selection'
import { endDrag, moveDrag, podiumTopAt, startDrag, type Drag, type PointerProps } from './drag'
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

describe('the top of a section of Disker og podier (K18)', () => {
  // A podium 1000 × 1000 at CC 500 in the middle of the stand: world origin is the stand's middle
  const pv = { ...createVariant('A', { width: 6, depth: 3, type: 'row' }), walls: [], objects: [{ id: 'p', product: '6571', x: 3, y: 1.5, rot: 0, sections: [{ x: [-500, 500] as [number, number], z: [-500, 500] as [number, number], h: 500, shelves: [250] }] }] }
  const hit = (y: number): Hit => ({ objectId: 'p', point: new THREE.Vector3(0.2, y, 0.1) }) as Hit
  it('is grabbed within 80 mm of the top, else the podium moves', () => {
    expect(podiumTopAt(pv, hit(0.52))).toEqual({ id: 'p', section: 0, h: 500 })
    expect(podiumTopAt(pv, hit(0.3))).toBeUndefined()
  })
  it('dragged up and down it snaps to the grid, from the sketch at the press', () => {
    const edits: ((v: typeof pv) => typeof pv)[] = []
    const P = { v: pv, selection: {}, onSelect: vi.fn(), onEdit: (fn: (v: typeof pv) => typeof pv) => edits.push(fn), onCheckpoint: vi.fn(), onToast: vi.fn(), motifs: [] } as unknown as PointerProps
    let y = 0.52
    const h = { onUpright: () => y } as unknown as SceneHits
    const d = startDrag(P, h, hit(0.52), {} as PointerEvent)
    expect(d.kind).toBe('podiumTop')
    y = 0.52 - 0.3
    moveDrag(P, h, d as Exclude<Drag, { kind: 'orbit' }>, {} as PointerEvent)
    y = 0.52 + 0.2
    moveDrag(P, h, d as Exclude<Drag, { kind: 'orbit' }>, {} as PointerEvent)
    const [low, high] = edits.map((f) => f(pv).objects[0].sections![0])
    expect(low.h).toBe(250)
    expect(low.shelves).toBeUndefined()
    // Up again before the release: the shelf the lower height took is back
    expect(high).toMatchObject({ h: 750, shelves: [250] })
  })
})
