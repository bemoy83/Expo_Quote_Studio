import { describe, expect, it } from 'vitest'
import type { Variant } from '../../domain/types'
import { createVariant } from '../../domain/variant'
import { brushTo, PRINT, strokeAt, type PaintTool, type StrokePlate } from './paintTools'

describe('the brush, the same in the wall and the counter drawer', () => {
  it('lays its colour, and on the press gives a plate that has it its own again', () => {
    expect(brushTo('9010', '3020', '9010', false, true)).toBe('3020')
    expect(brushTo('3020', '3020', '9010', false, true)).toBe('9010')
  })
  it('a plate swept over that has the colour is left, a printed one is coloured (the last stroke wins)', () => {
    expect(brushTo('3020', '3020', '9010', false, false)).toBeNull()
    expect(brushTo('3020', '3020', '9010', true, false)).toBe('3020')
    expect(brushTo('3020', '3020', '9010', true, true)).toBe('3020')
  })
})

// The one stroke rule of the paint bucket and the brush (felles plateregel, Bjørn 18.11.2026): the wall and the counter
// drawer only say what their plate is (StrokePlate).
const v = createVariant('A', { width: 4, depth: 3, type: 'row' })
const mark = (what: string) => (x: Variant) => ({ ...x, name: what }) as unknown as Variant

function run(tool: PaintTool, paint: string, plate: Partial<StrokePlate>, first = true, motif: string | undefined = 'logo') {
  const edits: string[] = []
  const toasts: string[] = []
  let checkpoints = 0
  const full: StrokePlate = {
    fill: (r) => ({ v: mark(`fill ${r}`)(v), skipped: 0 }),
    printSide: (m) => mark(`side ${m}`),
    noPrint: () => null,
    printOne: (m) => mark(`one ${m}`),
    colour: () => ({ cur: '9010', base: '9010', printed: false }),
    paintOne: (r) => mark(`paint ${r}`),
    ...plate,
  }
  strokeAt({ v, tool, paint, motif, kept: (n) => `${n} kept`, onEdit: (fn) => edits.push(fn(v).name), onCheckpoint: () => checkpoints++, onToast: (t) => toasts.push(t) }, full, first)
  return { edits, toasts, checkpoints }
}

describe('strokeAt: the bucket and the brush on any plate', () => {
  it('the bucket works on the press only: a colour fills the side, «Print» one picture, or says why not', () => {
    expect(run('bucket', '3020', {}).edits).toEqual(['fill 3020'])
    expect(run('bucket', '3020', {}, false).edits).toEqual([])
    expect(run('bucket', PRINT, {}).edits).toEqual(['side logo'])
    expect(run('bucket', PRINT, { printSide: () => 'Ingen plate' }).toasts).toEqual(['Ingen plate'])
  })

  it('«Print» without a motif says so on the press', () => {
    expect(run('brush', PRINT, {}, true, '').toasts).toHaveLength(1)
    expect(run('brush', PRINT, {}, false, '').toasts).toEqual([])
  })

  it('the brush prints one plate, says on the press why one takes none, and does nothing where it has the motif', () => {
    expect(run('brush', PRINT, {})).toEqual({ edits: ['one logo'], toasts: [], checkpoints: 1 })
    expect(run('brush', PRINT, { noPrint: () => 'Åpen' }).toasts).toEqual(['Åpen'])
    expect(run('brush', PRINT, { noPrint: () => 'Åpen' }, false).toasts).toEqual([])
    expect(run('brush', PRINT, { printOne: () => null }).edits).toEqual([])
  })

  it('the brush colours one plate, or gives it its own colour back on the press when it has the brush\'s already', () => {
    expect(run('brush', '3020', {}).edits).toEqual(['paint 3020'])
    expect(run('brush', '3020', { colour: () => ({ cur: '3020', base: '9010', printed: false }) }).edits).toEqual(['paint 9010'])
    expect(run('brush', '3020', { colour: () => ({ cur: '3020', base: '9010', printed: false }) }, false).edits).toEqual([])
    expect(run('brush', '3020', { colour: () => null }).edits).toEqual([])
    expect(run(null, '3020', {}).edits).toEqual([])
  })
})
