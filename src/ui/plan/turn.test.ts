import { describe, expect, it } from 'vitest'
import { paintWalls } from '../../domain/edit'
import type { Variant } from '../../domain/types'
import { createVariant } from '../../domain/variant'
import { turnableWall, turnPart } from './turn'

const inner = (): Variant => paintWalls(createVariant('A', { width: 6, depth: 4, type: 'row' }), [3, 1], [3, 3])
const innerWall = (v: Variant) => v.walls.find((w) => !w.id.startsWith('side'))!

function turn(v: Variant, id: string, loose = false) {
  let out = v
  const toasts: string[] = []
  turnPart({ v, onEdit: (fn) => (out = fn(v)), onToast: (t) => toasts.push(t) }, { kind: 'wall', id }, loose)
  return { v: out, toasts }
}

describe('Roter on an inner wall, as on a free textile wall (Bjørn 21.11.2026)', () => {
  it('a wall standing free turns 90° round its middle', () => {
    const v = inner()
    const w = innerWall(v)
    const r = turn(v, w.id)
    expect(r.toasts).toEqual([])
    const t = r.v.walls.find((x) => !x.id.startsWith('side'))!
    expect(t.from[1]).toBe(t.to[1])
    expect(Math.abs(t.to[0] - t.from[0])).toBe(2)
  })
  it('a wall joined to a stand wall says why it stands, and R knows a whole inner wall from a door or felt on it', () => {
    const v = paintWalls(createVariant('A', { width: 6, depth: 4, type: 'row' }), [3, 0], [3, 2])
    const w = innerWall(v)
    expect(turn(v, w.id).toasts).toEqual(['Veggen er koblet til en vegg som står fast · Løsne den først'])
    expect(turnableWall(v, { wallId: w.id })).toBe(true)
    expect(turnableWall(v, { wallId: w.id, felt: 0 })).toBe(false)
    expect(turnableWall(v, { wallId: 'side-back' })).toBe(false)
  })
})
