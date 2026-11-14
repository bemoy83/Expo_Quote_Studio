import { describe, expect, it } from 'vitest'
import { CURTAIN, DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog'
import { openingLabel, openingPen, penColour, wallPicksOf, withColour, withOpening } from './wallPen'

const products = DEFAULT_CATALOG.products

describe('the wall pen by function (Bjørn 14.11.2026)', () => {
  it('Dør puts the opening last in hand in hand, at the start the catalog\'s first, with its leaf colour', () => {
    expect(openingPen({}, products)).toEqual({ kind: 'opening', product: DOOR })
    const curtain = withOpening({ kind: 'opening', product: DOOR, ral: '3020' }, CURTAIN)
    expect(openingPen(wallPicksOf(curtain), products)).toEqual({ kind: 'opening', product: CURTAIN, ral: '3020' })
  })

  it('the Dør button is named after the opening behind it, from the kortnavn', () => {
    expect(openingLabel({ kind: 'wall', ral: '9010' }, {}, products)).toBe('Dør')
    expect(openingLabel({ kind: 'wall', ral: '9010' }, { opening: CURTAIN }, products)).toBe('Forheng')
    expect(openingLabel({ kind: 'opening', product: CURTAIN }, {}, products)).toBe('Forheng')
  })

  it('a colour goes on the item in hand and never changes the pen', () => {
    expect(withColour({ kind: 'wall', ral: '9010' }, '7012')).toEqual({ kind: 'wall', ral: '7012' })
    expect(withColour({ kind: 'opening', product: DOOR }, '7012')).toEqual({ kind: 'opening', product: DOOR, ral: '7012' })
    expect(withColour({ kind: 'beam' }, '7012')).toEqual({ kind: 'beam' })
  })

  it('Farge: hidden for Takdrager, grey for Forheng, a door without its own colour shows the stand\'s', () => {
    expect(penColour({ kind: 'beam' }, products, '9010')).toEqual({ kind: 'none' })
    expect(penColour({ kind: 'opening', product: CURTAIN }, products, '9010')).toEqual({ kind: 'off' })
    expect(penColour({ kind: 'opening', product: DOOR }, products, '7038')).toEqual({ kind: 'on', ral: '7038' })
    expect(penColour({ kind: 'wall', ral: '7012' }, products, '9010')).toEqual({ kind: 'on', ral: '7012' })
  })
})
