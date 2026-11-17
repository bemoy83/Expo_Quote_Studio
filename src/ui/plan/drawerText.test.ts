import { describe, expect, it } from 'vitest'
import { createVariant } from '../../domain/variant'
import type { Foil, TextileWall } from '../../domain/types'
import { RULES } from '../../rules/rules'
import { hintLine, REUSE_NOTE } from './drawerText'
import { wallWhy } from './wallDrawer/text'

describe('drawer hint line', () => {
  it('joins its parts with « · », leaving the empty ones out', () => {
    expect(hintLine(false, 'Dra', null, undefined, '', 'Delete fjerner')).toBe('Dra · Delete fjerner')
    expect(hintLine()).toBe('')
  })

  it('the wall drawer puts what a choice means first, never as a line in the column', () => {
    const v = createVariant('A', { width: 6, depth: 4, type: 'corner' })
    const w = v.walls[0]
    const x = { twoFaces: false, shelves: 0 }
    expect(wallWhy(v, RULES, w, 1, { ...x, F: { full: true } as Foil })).toBe(`Dekker hele platen, ${RULES.wall.plate.width} × ${RULES.wall.plate.height} mm`)
    expect(wallWhy(v, RULES, w, 1, { ...x, T: { fill: 'reuse' } as TextileWall })).toBe(REUSE_NOTE)
    expect(wallWhy(v, RULES, w, 1, x)).toBeNull()
  })
})
