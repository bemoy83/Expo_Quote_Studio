import { describe, expect, it } from 'vitest'
import { parse } from '../../persistence/file'
import type { Variant } from '../../domain/types'
import { chosen, deleteSelection, doorWall, hasDrawer, selectionKey } from './selection'
import { doorFace } from '../../domain/doors'
import { faces } from '../../domain/faces'

const TEXTS = import.meta.glob<string>('../../test/fixtures/*.json', { query: '?raw', import: 'default', eager: true })
const variants: Variant[] = Object.values(TEXTS).flatMap((t) => {
  const r = parse(t)
  return r.ok ? r.sketch.variants : []
})
const first = <T,>(pick: (v: Variant) => T | undefined) => {
  for (const v of variants) {
    const x = pick(v)
    if (x) return { v, x }
  }
  throw new Error('no example sketch has this')
}

describe('Delete on the selection', () => {
  it('removes nothing when nothing removable is selected', () => {
    expect(deleteSelection(variants[0], {})).toBeNull()
    expect(deleteSelection(variants[0], { wallId: variants[0].walls[0]?.id })).toBeNull()
  })

  it('removes furniture and selects nothing', () => {
    const { v, x } = first((v) => v.objects[0])
    const d = deleteSelection(v, { objectId: x.id })!
    expect(d.edit(v).objects.map((o) => o.id)).not.toContain(x.id)
    expect(d.select).toEqual({})
  })

  it('removes a door and keeps the wall drawer on its wall', () => {
    const { v, x } = first((v) => v.openings[0])
    const d = deleteSelection(v, { openingId: x.id, side: 1 })!
    expect(d.edit(v).openings.map((o) => o.id)).not.toContain(x.id)
    expect(d.select).toEqual({ wallId: x.wallId, side: 1 })
    expect(doorWall(v, { openingId: x.id }).wallId).toBe(x.wallId)
  })

  it('removes a textile frame and keeps its wall face', () => {
    const { v, x } = first((v) => v.textiles[0])
    const d = deleteSelection(v, { wallId: x.wallId, side: 1, textileId: x.id })!
    expect(d.edit(v).textiles.map((t) => t.id)).not.toContain(x.id)
    expect(d.select).toEqual({ wallId: x.wallId, side: 1 })
  })

  it('removes a decal and keeps its wall face', () => {
    const { v, x } = first((v) => v.foils[0])
    const d = deleteSelection(v, { wallId: x.wallId, side: -1, foilId: x.id })!
    expect(d.edit(v).foils.map((f) => f.id)).not.toContain(x.id)
    expect(d.select).toEqual({ wallId: x.wallId, side: -1 })
  })

  it('removes a free-standing textile wall, a room and a drawn beam', () => {
    const ft = first((v) => v.freeTextiles[0])
    expect(deleteSelection(ft.v, { freeTextileId: ft.x.id })!.edit(ft.v).freeTextiles.map((t) => t.id)).not.toContain(ft.x.id)
    const room = first((v) => v.rooms[0])
    expect(deleteSelection(room.v, { roomId: room.x.id })!.edit(room.v).rooms.map((r) => r.id)).not.toContain(room.x.id)
    const beam = first((v) => v.innerBeams?.[0])
    expect(deleteSelection(beam.v, { beamId: beam.x.id })!.edit(beam.v).innerBeams?.map((b) => b.id) ?? []).not.toContain(beam.x.id)
  })
})

describe('Selection key and drawer', () => {
  it('names the object, not the face shown', () => {
    expect(selectionKey({ wallId: 'w', side: 1 })).toBe(selectionKey({ wallId: 'w', side: -1 }))
    expect(selectionKey({ wallId: 'w', textileId: 't' })).not.toBe(selectionKey({ wallId: 'w' }))
    expect(selectionKey({})).toBe('')
  })

  it('walls, doors, free textile walls and engangsteppe in the plan have a drawer; furniture, rooms and beams not', () => {
    expect(hasDrawer({ wallId: 'w' })).toBe(true)
    expect(hasDrawer({ openingId: 'd' })).toBe(true)
    expect(hasDrawer({ freeTextileId: 'f' })).toBe(true)
    expect(hasDrawer({ fill: 'f' })).toBe(true)
    expect(hasDrawer({ fill: 'f' }, '3d')).toBe(false)
    expect(hasDrawer({ objectId: 'o' })).toBe(false)
    expect(hasDrawer({ roomId: 'r' })).toBe(false)
    expect(hasDrawer({ beamId: 'b' })).toBe(false)
  })
})

describe('What is chosen', () => {
  it('is nothing with nothing selected, or when what was selected is gone', () => {
    expect(chosen(variants[0], {})).toBeNull()
    expect(chosen(variants[0], { objectId: 'gone' })).toBeNull()
    expect(chosen(variants[0], { wallId: 'gone' })).toBeNull()
    expect(chosen(variants[0], { openingId: 'gone' })).toBeNull()
  })

  it('a door: its own wall, on the face its drawer shows', () => {
    const { v, x } = first((v) => v.openings[0])
    const c = chosen(v, { openingId: x.id })!
    const w = v.walls.find((y) => y.id === x.wallId)!
    expect(c.kind).toBe('opening')
    expect(c.kind === 'opening' && c.wall.id).toBe(w.id)
    const want = doorFace(v, w, x)
    expect(c.kind === 'opening' && c.side).toBe(faces(v, w).includes(want) ? want : faces(v, w)[0])
  })

  it('a frame, decal or shelf on its wall; one that is gone leaves the wall chosen', () => {
    const { v, x } = first((v) => v.textiles[0])
    expect(chosen(v, { wallId: x.wallId, textileId: x.id })).toMatchObject({ kind: 'textile', textile: x, wall: { id: x.wallId } })
    expect(chosen(v, { wallId: x.wallId, textileId: 'gone' })).toMatchObject({ kind: 'wall', wall: { id: x.wallId } })
    const f = first((v) => v.foils[0])
    expect(chosen(f.v, { wallId: f.x.wallId, foilId: f.x.id })?.kind).toBe('foil')
    const s = first((v) => v.shelves?.[0])
    expect(chosen(s.v, { wallId: s.x.wallId, shelfId: s.x.id })?.kind).toBe('shelf')
  })

  it('a wall keeps the felt chosen in its drawer, and a face it does not have falls back to its first', () => {
    const { v, x } = first((v) => v.walls[0])
    const c = chosen(v, { wallId: x.id, side: 7 as never, felt: 2 })
    expect(c).toMatchObject({ kind: 'wall', felt: 2, side: faces(v, x)[0] })
  })

  it('furniture, rooms, beams, free-standing textile walls and engangsteppe', () => {
    const o = first((v) => v.objects[0])
    expect(chosen(o.v, { objectId: o.x.id })).toEqual({ kind: 'object', object: o.x })
    const r = first((v) => v.rooms[0])
    expect(chosen(r.v, { roomId: r.x.id })).toEqual({ kind: 'room', room: r.x })
    const b = first((v) => v.innerBeams?.[0])
    expect(chosen(b.v, { beamId: b.x.id, beamFine: true })).toEqual({ kind: 'beam', beam: b.x, fine: true })
    const ft = first((v) => v.freeTextiles[0])
    expect(chosen(ft.v, { freeTextileId: ft.x.id })).toEqual({ kind: 'free', textile: ft.x, face: 'a' })
    const t = first((v) => v.floor.tiles.find((x) => x.fill))
    const c = chosen(t.v, { fill: t.x.fill })
    expect(c?.kind === 'fill' && c.tiles.every((x) => x.fill === t.x.fill)).toBe(true)
  })
})
