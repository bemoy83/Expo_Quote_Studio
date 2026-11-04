import { describe, expect, it } from 'vitest'
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog'
import { parse } from '../persistence/file'
import { RULES } from '../rules/rules'
import { standWallTerms } from '../domain/variant'
import { calc } from './calc'
import { lineKey, positions } from './positions'
import { quoteGroups } from './quoteLines'

const TEXTS = import.meta.glob<string>('../test/fixtures/*.json', { query: '?raw', import: 'default', eager: true })

const all = Object.entries(TEXTS).flatMap(([f, text]) => {
  const res = parse(text)
  if (!res.ok) throw new Error(f)
  return res.sketch.variants.map((v) => {
    const r = calc(v, RULES, DEFAULT_CATALOG, standWallTerms(res.sketch.project))
    return { name: `${f.replace('../test/fixtures/', '')} ${v.name}`, v, r }
  })
})

describe('position numbers', () => {
  it.each(all.map((x) => [x.name, x] as const))('%s: one number per article, 1…n, the same on the kalkyle and the quote', (_, { v, r }) => {
    const kalkyle = r.groups.flatMap((g) => g.lines)
    const quote = quoteGroups(r.groups).flatMap((g) => g.lines)
    const p = positions(v, kalkyle, DEFAULT_CATALOG)
    const used = [...new Set(p.items.map((i) => i.pos))].sort((a, b) => a - b)
    expect(used).toEqual(used.map((_, n) => n + 1))
    // Every number stands on exactly one quote line, and the quote and the kalkyle agree
    for (const n of used) {
      expect(quote.filter((l) => p.ofLine(l).includes(n))).toHaveLength(1)
      expect(kalkyle.some((l) => p.ofLine(l).includes(n))).toBe(true)
      expect(p.nameOf(n)).toBeTruthy()
    }
    // Same article, same number
    const byKey = new Map<string, number>()
    for (const i of p.items) {
      if (byKey.has(i.key)) expect(i.pos).toBe(byKey.get(i.key))
      byKey.set(i.key, i.pos)
    }
  })

  it('numbers in drawing order: textile, plate swap, graphics, door, furniture; alike things share a number', () => {
    const find = (f: string) => all.find((x) => x.name.startsWith(f))!
    const textile = find('08-tekstil')
    const furniture = find('10-mobler')
    const v = { ...textile.v, objects: furniture.v.objects }
    const r = calc(v, RULES, DEFAULT_CATALOG)
    const p = positions(v, r.groups.flatMap((g) => g.lines), DEFAULT_CATALOG)
    expect(p.items.map((i) => `${i.pos} ${i.kind}`)).toEqual(['1 textile', '1 textile', '2 freeTextile', '2 freeTextile', '3 object', '4 object', '5 object'])
    // Swaps before doors; two plates with the same colour are one article
    const arr = positions(find('01-hjorne').v, find('01-hjorne').r.groups.flatMap((g) => g.lines), DEFAULT_CATALOG)
    expect(arr.items.map((i) => `${i.pos} ${i.kind}`)).toEqual(['1 swap', '1 swap', '2 swap', '2 swap', '2 swap', '2 swap', '3 door'])
    expect(arr.nameOf(3)).toMatch(/^Dør/)
    // A door and a curtain are two articles
    const room = find('03-rom')
    expect(positions(room.v, room.r.groups.flatMap((g) => g.lines), DEFAULT_CATALOG).items.map((i) => i.pos)).toEqual([1, 2])
  })

  it('a merged textile line on the quote goes by its quote key', () => {
    const sys = DEFAULT_CATALOG.system
    expect(lineKey(DEFAULT_CATALOG, { artnr: `${sys.textile}+${Object.values(sys.textileFill)[0]}` })).toBe('quote:tekstil-vegg')
    expect(lineKey(DEFAULT_CATALOG, { artnr: `${sys.freeTextile}+x` })).toBe('quote:tekstil-fri')
    expect(lineKey(DEFAULT_CATALOG, { artnr: sys.textile, quote: { key: 'tekstil-vegg', name: '', lead: true } })).toBe('quote:tekstil-vegg')
  })
})
