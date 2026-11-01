// The rows of the picking list, shared by Plukkliste and Arbeidsordre.
import type { CalcResult } from '../../calc/calc'
import { FILL_NAME, textileRows } from '../../calc/production'
import { resolveGroup } from '../../catalog/groups'
import { plateName } from '../env'
import { fmt } from '../format'

export interface PickRow {
  key: string
  group: string
  code: string
  title: string
  /** Foga parts: what the piece is made of, or its cut lengths. */
  detail?: string
  preassembled?: boolean
  lm?: number
  qty: string
}

/** Calc lines that are picked (not built from Foga parts), then the Foga parts list, then the print of each frame. */
export function pickRows(res: CalcResult): PickRow[] {
  const B = res.bom
  // Calc lines first, so a door comes before the parts of its header
  return [
    ...res.groups
      .flatMap((g) => g.lines)
      .filter((l) => !l.foga && !resolveGroup(l.group).subgroup.notPicked)
      .flatMap((l) =>
        // Carpet tiles: one row per size, in pieces. Rolled floor: running metres of roll, with the lanes as cut.
        l.tiles
          ? l.tiles.map((t) => ({ key: `${l.artnr}|${t.size}`, group: l.group, code: l.artnr, title: `${l.name} ${t.size}`, qty: `${t.qty} stk` }))
          : l.roll
          ? [
              { key: l.artnr + l.name, group: l.group, code: l.artnr, title: `${l.name} · rull ${fmt(l.roll.width, 1)} m`, detail: rollDetail(l.roll), qty: `${fmt(l.roll.lm, 1)} lm` },
              // Tape is part of laying the carpet: picked, not priced
              { key: `${l.artnr}|teip`, group: l.group, code: '', title: `Teppeteip til ${l.name.toLowerCase()}`, detail: 'omriss og skjøter', qty: `${fmt(Math.ceil(l.roll.tape), 0)} lm` },
            ]
          : [{ key: l.artnr + l.name, group: l.group, code: l.artnr, title: l.name, qty: `${fmt(l.qty, l.unit === 'stk' ? 0 : 1)} ${l.unit}` }],
      ),
    ...B.lines.map((l) => ({
      key: `${l.name}|${l.detail}`,
      group: l.group,
      code: l.ral ? `RAL ${l.ral}` : l.artnr,
      title: l.ral ? `${l.name} · ${plateName(l.ral)}` : l.name,
      detail: l.detail,
      preassembled: l.preassembled,
      lm: l.lm,
      qty: `${l.qty} stk`,
    })),
    // The textile of each frame and face: not Foga, sold as its own line
    ...textileRows(res.production).map((t) => ({
      key: `textile|${t.pos}`,
      group: 'prof.tekstil',
      code: t.pos,
      title: FILL_NAME[t.fill],
      detail: t.fill === 'reuse' ? `${t.W} × ${t.H} mm synlig · ${t.where}` : `${t.pw} × ${t.ph} mm inkl. bleed · ${t.where}`,
      qty: '1 stk',
    })),
  ]
}

/** "2 × 5,2 m · 1 × 2,7 m delt på langs i 2 × 1 m, lagt etter hverandre · 1 × 5,2 m kappet til 1 m bredde · svinn
 * 1,4 m²": pieces as cut from the roll, with the end allowance. */
function rollDetail(r: NonNullable<CalcResult['groups'][number]['lines'][number]['roll']>) {
  const pieces = r.pieces.map((x) => {
    const how = x.parts.length > 1 ? ` delt på langs i ${x.parts.length} × ${fmt(x.parts[0], 1)} m${x.endToEnd ? ', lagt etter hverandre' : ''}` : x.parts[0] < r.width - 1e-9 ? ` kappet til ${fmt(x.parts[0], 1)} m bredde` : ''
    return `${x.qty} × ${fmt(x.length, 1)} m${how}`
  })
  return [...pieces, `svinn ${fmt(r.waste, 1)} m²`].join(' · ')
}
