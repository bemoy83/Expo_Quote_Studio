import { describe, expect, it } from 'vitest'
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog'
import { penName, unitPrice } from './penName'
import { rememberPick } from './pens'

const products = DEFAULT_CATALOG.products

describe('what each tool remembers behind its Pensel buttons', () => {
  it('the opening and its colours on Vegg', () => {
    expect(rememberPick({}, { kind: 'opening', product: '6131', fabric: 'bla' }, products)).toEqual({ wall: { opening: '6131', ral: undefined, fabric: 'bla' } })
  })
  it('the colour per floor type on Gulv, keeping the other types', () => {
    const a = rememberPick({}, { kind: 'floor', product: '5903' }, products)
    const type = products.find((x) => x.variants.some((v) => v.artnr === '5903'))!.id
    expect(a.floor?.[type]).toBe('5903')
  })
  it('the graphics on Profilering, shared by its pens', () => {
    expect(rememberPick({}, { kind: 'motif', motif: 'm1', pen: 'print' }, products)).toEqual({ profile: { motif: 'm1' } })
    expect(rememberPick({ profile: { motif: 'm1' } }, { kind: 'textile' }, products)).toEqual({ profile: { motif: 'm1' } })
  })
  it('nothing for a pen with nothing behind it', () => {
    expect(rememberPick({}, { kind: 'shelf' }, products)).toEqual({})
    expect(rememberPick({}, { kind: 'beam' }, products)).toEqual({})
  })
})

describe('I hånden: named from the product list', () => {
  it('wall, beam and shelf by their products, with the price per unit', () => {
    expect(penName({ kind: 'wall', ral: '9010' }, []).name).toMatch(/^Rammevegg/)
    expect(penName({ kind: 'wall', ral: '9010' }, []).meta).toBe(`RAL 9010 · ${unitPrice('6120-9010')}`)
    expect(penName({ kind: 'beam' }, []).name).toBe('Takdrager 80 × 20 mm')
    expect(unitPrice('6110')).toBe('121 kr/lm')
    expect(penName({ kind: 'shelf' }, []).name).toBe('Rett hylle, d:30cm')
  })
  it('print and decal by their foil products, the motif under it', () => {
    expect(penName({ kind: 'motif', motif: 'x', pen: 'print' }, [])).toEqual({ name: 'Foliedekor, helt veggfelt 960 × 2420 mm', meta: 'Motiv' })
    expect(penName({ kind: 'motif', motif: 'x', pen: 'decal' }, []).name).toBe('Foliedekor, dekal')
  })
})
