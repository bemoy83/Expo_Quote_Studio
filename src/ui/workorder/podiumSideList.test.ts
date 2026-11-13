// The work order draws a side of a counter of Disker og podier only when it is more than plates (trinn 2, PR 6).
import { describe, expect, it } from 'vitest'
import { createVariant } from '../../domain/variant'
import type { Variant } from '../../domain/types'
import { podiumSidesToDraw } from './podiumSideList'

const sec = { x: [-500, 500] as [number, number], z: [-250, 250] as [number, number], h: 1000 }
const vOf = (sections: Variant['objects'][number]['sections']): Variant => ({ ...createVariant('A', { width: 6, depth: 5, type: 'row' }), walls: [], objects: [{ id: 'a', product: '6570', x: 3, y: 2.5, rot: 0, sections }] })

describe('sides in the work order', () => {
  it('none for a counter of plates only', () => {
    expect(podiumSidesToDraw(vOf([sec]))).toEqual([])
  })
  it('a side with an open part, and every side with a shelf behind it', () => {
    expect(podiumSidesToDraw(vOf([{ ...sec, sides: { 'z-': { lights: ['open'] } } }])).map((s) => s.title)).toEqual(['Disk 1 · mot bak'])
    expect(podiumSidesToDraw(vOf([{ ...sec, shelves: [500] }]))).toHaveLength(4)
  })
})
