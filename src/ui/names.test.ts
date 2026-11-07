import { describe, expect, it } from 'vitest'
import { standScope } from './names'

describe('standScope', () => {
  it('names organiser beams instead of saying uten takdrager', () => {
    expect(standScope({ wallLm: 9, organiserWallLm: 8, beamLm: 8, organiserBeamLm: 8 }, 1)).toBe(
      '1 lm vegg (+ 8 lm standvegg fra arrangør) · 8 m takdrager fra arrangør · 1 stolpe',
    )
  })
  it('splits own and organiser beams', () => {
    expect(standScope({ wallLm: 9, organiserWallLm: 8, beamLm: 11, organiserBeamLm: 8 }, 3)).toBe(
      '1 lm vegg (+ 8 lm standvegg fra arrangør) · 3 m takdrager (+ 8 m fra arrangør) · 3 stolper',
    )
  })
  it('says uten takdrager only when there are none', () => {
    expect(standScope({ wallLm: 6, organiserWallLm: 0, beamLm: 0, organiserBeamLm: 0 }, 4)).toBe('6 lm vegg · uten takdrager · 4 stolper')
  })
})
