import { describe, expect, it } from 'vitest'
import { paintWalls } from '../../domain/edit'
import { createVariant } from '../../domain/variant'
import { faceAt } from '../../domain/faces'
import { isStandWall } from '../../domain/walls'
import { mm, placementRow, planDims, totalSides } from './dims'

describe('plan dimensions', () => {
  const corner = () => createVariant('A', { width: 6, depth: 4, type: 'corner' })

  it('totals on the closed sides, and always a width and a depth', () => {
    expect(totalSides(corner())).toEqual(['back', 'left'])
    expect(totalSides(createVariant('A', { width: 6, depth: 4, type: 'row' }))).toEqual(['back', 'left', 'right'])
    // An island has no stand walls: width on the back, depth on the left
    expect(totalSides(createVariant('A', { width: 6, depth: 4, type: 'island' }))).toEqual(['back', 'left'])
  })

  it('a placement row marks where an inner wall meets the side, and is empty when nothing does', () => {
    const v = corner()
    expect(placementRow(v, 'back')).toEqual([])
    const w = paintWalls(v, [2, 0], [2, 2])
    expect(placementRow(w, 'back')).toEqual([0, 2, 6])
    expect(placementRow(w, 'left')).toEqual([])
  })

  it('a selected stand wall shows its modules in place of the placement row; compact shows none', () => {
    const v = paintWalls(corner(), [2, 0], [2, 2])
    const back = v.walls.find((w) => isStandWall(w) && w.from[1] === 0 && w.to[1] === 0)!
    const sel = { wallId: back.id }
    const row = planDims(v, sel, false).sides.find((s) => s.side === 'back')!
    expect(row.near).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(row.total).toEqual([0, 6])
    expect(planDims(v, sel, true).sides.find((s) => s.side === 'back')!.near).toEqual([0, 2, 6])
  })

  it('a selected inner wall gets its module chain on the side toward the stand centre', () => {
    const v = paintWalls(corner(), [1, 3], [4, 3])
    const w = v.walls.find((x) => !isStandWall(x))!
    const { inner } = planDims(v, { wallId: w.id }, false)
    expect(inner).toMatchObject({ axis: 'x', at: 3, dir: -1, ts: [1, 2, 3, 4] })
    expect(planDims(v, { wallId: w.id }, true).inner).toBeNull()
  })

  it('writes millimetres with a space every thousand', () => {
    expect(mm(6).replace(/\s/g, ' ')).toBe('6 000')
    expect(mm(2.35).replace(/\s/g, ' ')).toBe('2 350')
  })
  it('a selected textile on a wall face is measured on its own, in front of that face', () => {
    const v = corner()
    const back = v.walls.find((w) => w.from[1] === 0 && w.to[1] === 0)!
    const t = { id: 't1', wallId: back.id, side: faceAt(v, back, { x: 1, y: 0.5 }), from: 1, width: 2 }
    const x = { ...v, textiles: [t] }
    const d = planDims(x, { wallId: back.id, textileId: 't1' }, false)
    expect(d.inner).toMatchObject({ axis: 'x', at: 0, dir: 1, clear: 'mounted' })
    // The frame: 2 000 span − 30 = 1 970, centred
    expect(d.inner!.ts).toEqual([...new Set([back.from[0], back.to[0], 1.015, 2.985])].sort((a, b) => a - b))
    // The wall's module chain is not shown
    expect(d.sides.find((s) => s.side === 'back')!.near).not.toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})
