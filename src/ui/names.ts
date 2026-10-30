// Display names and short texts shared by several screens.
import type { KeyFigures } from '../calc/calc'
import { count } from './format'

export const TYPE_NAME = { row: 'Rekkestand', corner: 'Hjørnestand', end: 'Endestand', island: 'Øystand' } as const

/** '2 lengder · 3 stolper' */
export const beamSummary = (k: Pick<KeyFigures, 'beamLengths' | 'beamPosts'>) => `${count(k.beamLengths, 'lengde', 'lengder')} · ${count(k.beamPosts, 'stolpe', 'stolper')}`

/** '2 rammer' */
export const frameCount = (n: number) => count(n, 'ramme', 'rammer')
