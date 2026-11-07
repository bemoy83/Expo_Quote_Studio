import { describe, expect, it } from 'vitest'
import { standScope } from './names'

describe('standScope', () => {
  it('keeps own posts with own walls and names organiser beams instead of uten takdrager', () => {
    expect(standScope({ wallLm: 9, organiserWallLm: 8, beamLm: 8, organiserBeamLm: 8 }, 1)).toBe(
      '1 lm vegg · 1 stolpe · fra arrangør: 8 lm standvegg, 8 m takdrager',
    )
  })
  it('splits own and organiser beams', () => {
    expect(standScope({ wallLm: 9, organiserWallLm: 8, beamLm: 11, organiserBeamLm: 8 }, 3)).toBe(
      '1 lm vegg · 3 m takdrager · 3 stolper · fra arrangør: 8 lm standvegg, 8 m takdrager',
    )
  })
  it('says uten takdrager only when there are none', () => {
    expect(standScope({ wallLm: 6, organiserWallLm: 0, beamLm: 0, organiserBeamLm: 0 }, 4)).toBe('6 lm vegg · uten takdrager · 4 stolper')
  })
})
