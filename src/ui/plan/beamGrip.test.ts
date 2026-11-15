// End grips of a drawn takdrager (Byggeregel T8): both ends, in Velg and with the Takdrager pen, whole metres, Fin 500.
import { describe, expect, it } from 'vitest'
import { createVariant } from '../../domain/variant'
import type { Variant } from '../../domain/types'
import { dragGrip, gripsOf, gripWith } from './grips'

const v: Variant = { ...createVariant('A', { width: 6, depth: 4, type: 'row' }), innerBeams: [{ id: 'td1', from: [1, 2], to: [3, 2] }] }

describe('takdrager end grips (Byggeregel T8)', () => {
  it('stand on both ends, in Velg and with the Takdrager pen', () => {
    const gs = gripsOf(v, { beamId: 'td1' })
    expect(gs.map((g) => g.at)).toEqual([[1, 2], [3, 2]])
    expect(gripWith(gs[0].on, 'select', null)).toBe(true)
    expect(gripWith(gs[0].on, 'brush', { kind: 'beam' } as never)).toBe(true)
  })
  it('drag in whole metres, half metres with Fin', () => {
    const [, to] = gripsOf(v, { beamId: 'td1' })
    const whole = dragGrip(v, to.on, [3, 2], [4.4, 2], false)!
    expect('v' in whole && whole.v.innerBeams?.[0].to).toEqual([4, 2])
    const fine = dragGrip(v, to.on, [3, 2], [4.4, 2], true)!
    expect('v' in fine && fine.v.innerBeams?.[0].to).toEqual([4.5, 2])
  })
  it('stops short of the standard front beam', () => {
    const tall: Variant = { ...v, innerBeams: [{ id: 'td1', from: [2, 1], to: [2, 2] }] }
    const [, to] = gripsOf(tall, { beamId: 'td1' })
    const r = dragGrip(tall, to.on, [2, 2], [2, 6], false)!
    expect('v' in r && r.v.innerBeams?.[0].to).toEqual([2, 4])
  })
})
