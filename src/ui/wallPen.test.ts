import { describe, expect, it } from 'vitest'
import { CURTAIN, DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog'
import { openingLabel, openingPen, penColour, wallPicksOf, withColour, withOpening } from './wallPen'

const products = DEFAULT_CATALOG.products

describe('the wall pen by function (Bjørn 14.11.2026)', () => {
  it('Dør puts the opening last in hand in hand, at the start the catalog\'s first, with its leaf colour', () => {
    expect(openingPen({}, products)).toEqual({ kind: 'opening', product: DOOR })
    const curtain = withOpening({ kind: 'opening', product: DOOR, ral: '3020', fabric: 'bla' }, CURTAIN)
    expect(openingPen(wallPicksOf(curtain), products)).toEqual({ kind: 'opening', product: CURTAIN, ral: '3020', fabric: 'bla' })
  })

  it('the Dør button is named after the opening behind it, from the kortnavn', () => {
    expect(openingLabel({ kind: 'wall', ral: '9010' }, {}, products)).toBe('Dør')
    expect(openingLabel({ kind: 'wall', ral: '9010' }, { opening: CURTAIN }, products)).toBe('Forheng')
    expect(openingLabel({ kind: 'opening', product: CURTAIN }, {}, products)).toBe('Forheng')
  })

  it('a colour goes on the item in hand and never changes the pen', () => {
    expect(withColour({ kind: 'wall', ral: '9010' }, { ral: '7012' })).toEqual({ kind: 'wall', ral: '7012' })
    expect(withColour({ kind: 'opening', product: DOOR }, { ral: '7012' })).toEqual({ kind: 'opening', product: DOOR, ral: '7012' })
    expect(withColour({ kind: 'opening', product: CURTAIN }, { fabric: 'gra' })).toEqual({ kind: 'opening', product: CURTAIN, fabric: 'gra' })
    expect(withColour({ kind: 'beam' }, { ral: '7012' })).toEqual({ kind: 'beam' })
  })

  it('Farge: hidden for Takdrager, fabrics for Forheng (first by default), a door without its own colour the stand\'s', () => {
    expect(penColour({ kind: 'beam' }, products, '9010')).toEqual({ kind: 'none' })
    const c = penColour({ kind: 'opening', product: CURTAIN }, products, '9010')
    expect(c.kind === 'fabric' && [c.fabric, c.fabrics.map((f) => f.name)]).toEqual(['sort', ['Sort', 'Grå', 'Blå']])
    expect(penColour({ kind: 'opening', product: DOOR }, products, '7038')).toEqual({ kind: 'ral', ral: '7038' })
    expect(penColour({ kind: 'wall', ral: '7012' }, products, '9010')).toEqual({ kind: 'ral', ral: '7012' })
  })
})
