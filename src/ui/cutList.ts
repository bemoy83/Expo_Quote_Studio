// Engangsteppe cut list in words, shared by the carpet drawer and the work order: for each piece cut from the roll,
// how long it is cut and which lanes in the plan it becomes, and how.
import type { RollPiece } from '../domain/floor'
import { fmt } from './format'

export interface CutRow {
  /** «Kapp 3,7 m av rullen» */
  cut: string
  /** «Blir bane 1, 3,5 m lang i full bredde.» */
  what: string
}

const m = (n: number) => `${fmt(n, 2)} m`
const names = (ns: number[]) => (ns.length === 1 ? `bane ${ns[0]}` : `bane ${ns.slice(0, -1).join(', ')} og ${ns[ns.length - 1]}`)

export function cutRows(pieces: readonly RollPiece[], roll: number): CutRow[] {
  return pieces.map((x) => {
    const ls = x.lanes
    const lanes = names(ls.map((l) => l.n))
    const what = x.endToEnd
      ? `Deles på langs i to halve à ${m(roll / 2)}, som legges etter hverandre som ${lanes}: ${m(ls[0].length)} + ${m(ls[1].length)}.`
      : x.split
        ? `Deles på langs i to à ${m(roll / 2)}: ${ls.map((l) => `bane ${l.n} ${m(l.length)}`).join(' og ')}${ls.some((l) => l.width < roll / 2 - 1e-9) ? ', kappet til bredden' : ''}.`
        : ls[0].width < roll - 1e-9
          ? `Blir ${lanes}, ${m(ls[0].length)} lang. Kappes til ${m(ls[0].width)} bredde, ${m(roll - ls[0].width)} av bredden er svinn.`
          : `Blir ${lanes}, ${m(ls[0].length)} lang i full bredde.`
    return { cut: `Kapp ${m(x.length)} av rullen`, what }
  })
}

export const CUT_FOOT = 'Hvert stykke kappes 10 cm lengre i hver ende og tilpasses ved legging.'
