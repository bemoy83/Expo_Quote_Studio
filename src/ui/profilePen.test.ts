import { describe, expect, it } from 'vitest'
import { motifOn, profileKind, profilePen, withMotif } from './profilePen'

describe('Profilering: one pen per product, the graphics shared (Bjørn 14.11.2026)', () => {
  it('a Pensel button keeps the motif in hand', () => {
    expect(profilePen('decal', { kind: 'textile', motif: 'm1' }, 'm2')).toEqual({ kind: 'motif', motif: 'm1', pen: 'decal' })
    expect(profilePen('textile', { kind: 'motif', motif: 'm1', pen: 'print' }, undefined)).toEqual({ kind: 'textile', motif: 'm1' })
  })
  it('without one in hand it takes the one last picked; Print and Dekal need one, Tekstil does not', () => {
    expect(profilePen('print', { kind: 'textile' }, 'm2')).toEqual({ kind: 'motif', motif: 'm2', pen: 'print' })
    expect(profilePen('print', null, undefined)).toBeNull()
    expect(profilePen('textile', null, undefined)).toEqual({ kind: 'textile' })
  })
  it('a motif goes on the pen in hand, never another pen', () => {
    expect(withMotif({ kind: 'motif', motif: 'm1', pen: 'print' }, 'm2')).toEqual({ kind: 'motif', motif: 'm2', pen: 'print' })
    expect(withMotif({ kind: 'textile' }, 'm2')).toEqual({ kind: 'textile', motif: 'm2' })
    expect(withMotif(null, 'm2')).toEqual({ kind: 'textile', motif: 'm2' })
  })
  it('names the pen and the motif on it', () => {
    expect(profileKind({ kind: 'motif', motif: 'm1' })).toBe('decal')
    expect(motifOn({ kind: 'textile', motif: 'm1' }, 'm1')).toBe(true)
    expect(motifOn({ kind: 'shelf' }, 'm1')).toBe(false)
  })
})
