import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLICK_MS, type PlanSelection } from '../selection'
import { clickRules, type ClickInput } from './click'

describe('Click rules in Velg', () => {
  let selection: PlanSelection
  let drawer: boolean
  let input: () => ClickInput
  beforeEach(() => {
    vi.useFakeTimers()
    selection = {}
    drawer = false
    input = () => ({
      selection,
      drawerOpen: drawer,
      onSelect: (s) => (selection = s),
      onOpenDrawer: (s) => {
        selection = s
        drawer = true
      },
    })
  })
  afterEach(() => vi.useRealTimers())
  const wall = { wallId: 'w1', side: 1 as const }
  const chair = { objectId: 'o1' }

  it('selects on a click, and a second click on the same object lets go only after CLICK_MS', () => {
    const r = clickRules()
    r.click(input(), wall, 0)
    expect(selection).toEqual(wall)
    r.click(input(), wall, 1000)
    expect(selection).toEqual(wall)
    vi.advanceTimersByTime(CLICK_MS)
    expect(selection).toEqual({})
  })

  it('switches to another object, and lets go on empty floor', () => {
    const r = clickRules()
    r.click(input(), wall, 0)
    r.click(input(), chair, 1000)
    expect(selection).toEqual(chair)
    r.click(input(), {}, 2000)
    expect(selection).toEqual({})
  })

  it('opens the drawer on a double click, without letting go first', () => {
    const r = clickRules()
    r.click(input(), wall, 0)
    r.click(input(), wall, CLICK_MS - 50)
    vi.advanceTimersByTime(CLICK_MS * 2)
    expect(drawer).toBe(true)
    expect(selection).toEqual(wall)
  })

  it("the browser's slower double click cancels the pending let-go", () => {
    const r = clickRules()
    r.click(input(), wall, 0)
    r.click(input(), wall, 400)
    r.double(input(), wall)
    vi.advanceTimersByTime(CLICK_MS * 2)
    expect(drawer).toBe(true)
    expect(selection).toEqual(wall)
  })

  it('a double click on furniture (no drawer) keeps it selected', () => {
    const r = clickRules()
    r.click(input(), chair, 0)
    r.click(input(), chair, 100)
    vi.advanceTimersByTime(CLICK_MS * 2)
    expect(drawer).toBe(false)
    expect(selection).toEqual(chair)
  })

  it('a click on the selected wall keeps it while its drawer is open', () => {
    const r = clickRules()
    selection = wall
    drawer = true
    r.click(input(), { wallId: 'w1', side: -1 as const }, 0)
    vi.advanceTimersByTime(CLICK_MS * 2)
    expect(selection).toEqual({ wallId: 'w1', side: -1 as const })
  })
})
