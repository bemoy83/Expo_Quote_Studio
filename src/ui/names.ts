// Display names and short texts shared by several screens.
import type { KeyFigures } from '../calc/calc'
import { count, fmt } from './format'

export const TYPE_NAME = { row: 'Rekkestand', corner: 'Hjørnestand', end: 'Endestand', island: 'Øystand' } as const

/** '2 lengder · 3 stolper' */
export const beamSummary = (k: Pick<KeyFigures, 'beamLengths' | 'beamPosts'>) => `${count(k.beamLengths, 'lengde', 'lengder')} · ${count(k.beamPosts, 'stolpe', 'stolper')}`

/** What the organiser delivers, '' when nothing: 'standvegger 10 lm i hvit og takdrager 10 m'. */
export function fromOrganiser(k: Pick<KeyFigures, 'organiserWallLm' | 'organiserBeamLm'>, colour: string) {
  if (!k.organiserWallLm) return ''
  return `standvegger ${fmt(k.organiserWallLm)} lm i ${colour.toLowerCase()}${k.organiserBeamLm ? ` og takdrager ${fmt(k.organiserBeamLm)} m` : ''}`
}

/** Work order stand line: '1 lm vegg (+ 8 lm standvegg fra arrangør) · 8 m takdrager fra arrangør · 1 stolpe'.
 *  Organiser-supplied walls and beams are named as such; 'uten takdrager' only when there are none at all. */
export function standScope(k: Pick<KeyFigures, 'wallLm' | 'organiserWallLm' | 'beamLm' | 'organiserBeamLm'>, posts: number) {
  const ownWall = k.wallLm - k.organiserWallLm
  const ownBeam = k.beamLm - k.organiserBeamLm
  const wall = `${fmt(ownWall)} lm vegg${k.organiserWallLm > 1e-9 ? ` (+ ${fmt(k.organiserWallLm)} lm standvegg fra arrangør)` : ''}`
  const beam =
    k.beamLm <= 1e-9
      ? 'uten takdrager'
      : ownBeam <= 1e-9
        ? `${fmt(k.organiserBeamLm)} m takdrager fra arrangør`
        : `${fmt(ownBeam)} m takdrager${k.organiserBeamLm > 1e-9 ? ` (+ ${fmt(k.organiserBeamLm)} m fra arrangør)` : ''}`
  return [wall, beam, count(posts, 'stolpe', 'stolper')].join(' · ')
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** '2 rammer' */
export const frameCount = (n: number) => count(n, 'ramme', 'rammer')
