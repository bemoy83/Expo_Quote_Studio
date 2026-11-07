import { describe, expect, it } from 'vitest'
import { beamSummary, standScope } from './names'

describe('standScope', () => {
  it('names organiser beams instead of uten takdrager', () => {
    expect(standScope({ wallLm: 9, organiserWallLm: 8, beamLm: 8, organiserBeamLm: 8 })).toBe(
      '1 lm vegg · fra arrangør: 8 lm standvegg, 8 m takdrager',
    )
  })
  it('splits own and organiser beams', () => {
    expect(standScope({ wallLm: 9, organiserWallLm: 8, beamLm: 11, organiserBeamLm: 8 })).toBe(
      '1 lm vegg · 3 m takdrager · fra arrangør: 8 lm standvegg, 8 m takdrager',
    )
  })
  it('says uten takdrager only when there are none', () => {
    expect(standScope({ wallLm: 6, organiserWallLm: 0, beamLm: 0, organiserBeamLm: 0 })).toBe('6 lm vegg · uten takdrager')
  })
  it('never names posts beside walls or takdrager', () => {
    expect(beamSummary({ beamLengths: 2 })).toBe('2 lengder')
  })
})
