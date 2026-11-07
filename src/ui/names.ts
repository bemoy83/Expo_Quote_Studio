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

/** Work order stand line: what the exhibitor builds, then what the organiser delivers:
 *  '1 lm vegg · 1 stolpe · fra arrangør: 8 lm standvegg, 8 m takdrager'. `posts` are the exhibitor's own (walls and
 *  own takdrager), so they sit with the own part. 'uten takdrager' only when there are none at all. */
export function standScope(k: Pick<KeyFigures, 'wallLm' | 'organiserWallLm' | 'beamLm' | 'organiserBeamLm'>, posts: number) {
  const some = (n: number) => n > 1e-9
  const ownBeam = k.beamLm - k.organiserBeamLm
  const own = [
    `${fmt(k.wallLm - k.organiserWallLm)} lm vegg`,
    ...(some(ownBeam) ? [`${fmt(ownBeam)} m takdrager`] : some(k.beamLm) ? [] : ['uten takdrager']),
    count(posts, 'stolpe', 'stolper'),
  ]
  const theirs = [
    ...(some(k.organiserWallLm) ? [`${fmt(k.organiserWallLm)} lm standvegg`] : []),
    ...(some(k.organiserBeamLm) ? [`${fmt(k.organiserBeamLm)} m takdrager`] : []),
  ]
  return [...own, ...(theirs.length ? [`fra arrangør: ${theirs.join(', ')}`] : [])].join(' · ')
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** '2 rammer' */
export const frameCount = (n: number) => count(n, 'ramme', 'rammer')
