// 3D shows what is built, the same pieces the picking list counts (Bjørn 28.11.2026: the stand is built once, 3D only
// reads it). For every example sketch, the Foga pieces drawn in 3D are counted against the structure of everything drawn
// (foga/fromVariant.ts, as if the exhibitor builds it all, so the organiser's beams count too): a rule worked out again
// in 3D shows up here as a difference.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { calc } from '../../../calc/calc'
import { fromVariant } from '../../../foga/fromVariant'
import { parse } from '../../../persistence/file'
import { standWallTerms } from '../../../domain/variant'
import { catalog, rules } from '../../env'
import { build, type Tag } from '../build'

const TEXTS = import.meta.glob<string>('../../../test/fixtures/*.json', { query: '?raw', import: 'default', eager: true })

describe.each(Object.keys(TEXTS).sort().map((f) => [f.replace(/.*\//, ''), f]))('%s', (_name, f) => {
  const read = parse(TEXTS[f])
  if (!read.ok) throw new Error(read.error)
  const { sketch } = read
  it.each(sketch.variants.map((v) => [v.name, v] as const))('variant %s: 3D draws what is picked', (_, v) => {
    const res = calc(v, rules, catalog, standWallTerms(sketch.project))
    const s = fromVariant(v, rules)
    const meshes: THREE.Mesh[] = []
    build(v, res).traverse((o) => meshes.push(o as THREE.Mesh))
    const n = (name: string, layer?: string) => meshes.filter((m) => m.geometry?.name === name && (!layer || (m.userData as Tag).layer === layer)).length
    // Takdrager: one 292 per length, and a standing 92 in each half-metre joint (T18)
    expect(n('foga-292', 'beams')).toBe(s.beams.length)
    expect(n('foga-92', 'beams')).toBe(s.beams.filter((b) => b.joined).length)
    // Hooks in 01 (T15): a piece on top of the beam and a leg down each side a beam hangs from
    const hooks = s.beamHooks ?? { oneWay: 0, twoWay: 0 }
    expect(n('foga-01', 'beams') + n('foga-01-flip', 'beams')).toBe(2 * hooks.oneWay + 3 * hooks.twoWay)
    // Shelves: 91F under one board, 91FF between two
    expect(n('foga-91F')).toBe(s.shelves?.end ?? 0)
    expect(n('foga-91FF')).toBe(s.shelves?.twin ?? 0)
  })
})
