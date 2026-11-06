import { describe, expect, it } from 'vitest'
import { clickSelection } from './click'

describe('clickSelection', () => {
  it('selects what was clicked', () => {
    expect(clickSelection({}, { wallId: 'w1' })).toEqual({ wallId: 'w1' })
  })
  it('a second click on the selected object lets go of it', () => {
    expect(clickSelection({ wallId: 'w1' }, { wallId: 'w1' })).toEqual({})
  })
  it('a click on another object switches', () => {
    expect(clickSelection({ wallId: 'w1' }, { objectId: 'o1' })).toEqual({ objectId: 'o1' })
  })
  it('empty floor lets go', () => {
    expect(clickSelection({ wallId: 'w1' }, {})).toEqual({})
  })
  it('with the drawer open a click on the selected object keeps it', () => {
    expect(clickSelection({ wallId: 'w1' }, { wallId: 'w1' }, true)).toEqual({ wallId: 'w1' })
  })
})
