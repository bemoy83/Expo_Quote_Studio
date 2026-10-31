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

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** '2 rammer' */
export const frameCount = (n: number) => count(n, 'ramme', 'rammer')
