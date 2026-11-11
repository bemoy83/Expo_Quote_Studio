import { describe, expect, it } from 'vitest'
import { focusOf, layoutOf } from './focus'

describe('What the wall drawer shows', () => {
  it('is about what is chosen on the wall, the felt only when no frame, decal, shelf or door is', () => {
    expect(focusOf('opening', undefined)).toBe('door')
    expect(focusOf('textile', undefined)).toBe('textile')
    expect(focusOf('foil', undefined)).toBe('foil')
    expect(focusOf('shelf', undefined)).toBe('shelf')
    expect(focusOf('wall', 3)).toBe('felt')
    expect(focusOf('wall', 0)).toBe('felt')
    expect(focusOf('wall', undefined)).toBe('wall')
  })

  it('a door: its panel and mini plan, no library and no foot', () => {
    for (const page of ['decor', 'extras'] as const) expect(layoutOf('door', page)).toMatchObject({ panel: 'door', library: null, foot: false, paint: false })
  })

  it('a frame, decal or shelf: its own panel on either page; the face button moves it', () => {
    for (const page of ['decor', 'extras'] as const) {
      expect(layoutOf('textile', page)).toMatchObject({ panel: 'textile', library: null, foot: true, moves: true, fill: true, pageSwitch: false, doors: false, paint: false })
      expect(layoutOf('foil', page)).toMatchObject({ panel: 'foil', library: { add: null }, moves: true, fill: false, pageSwitch: false })
      expect(layoutOf('shelf', page)).toMatchObject({ panel: 'shelf', library: null, moves: true, backToFelt: true, pageSwitch: false })
    }
  })

  it('a felt: colour with the library and «+ Dekal», or its shelves; no door buttons and no paint tools', () => {
    expect(layoutOf('felt', 'decor')).toMatchObject({ panel: 'felt-decor', library: { add: 'decal' }, pageSwitch: true, doors: false, paint: false, moves: false })
    expect(layoutOf('felt', 'extras')).toMatchObject({ panel: 'felt-extras', library: null, pageSwitch: true })
  })

  it('the whole wall: colour with the library and «+ Tekstilvegg», or its shelves; door buttons and live paint tools', () => {
    expect(layoutOf('wall', 'decor')).toMatchObject({ panel: 'wall-decor', library: { add: 'frame' }, pageSwitch: true, doors: true, paint: true, moves: false, backToFelt: false })
    expect(layoutOf('wall', 'extras')).toMatchObject({ panel: 'wall-extras', library: null, doors: true, paint: true })
  })
})
