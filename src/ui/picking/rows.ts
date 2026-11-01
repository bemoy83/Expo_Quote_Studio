// The rows of the picking list, shared by Plukkliste and Arbeidsordre.
import type { CalcResult } from '../../calc/calc'
import { FILL_NAME, textileRows } from '../../calc/production'
import { resolveGroup } from '../../catalog/groups'
import { ROLL_END } from '../../domain/floor'
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
          ? [{ key: l.artnr + l.name, group: l.group, code: l.artnr, title: `${l.name} · rull ${fmt(l.roll.width, 1)} m`, detail: rollDetail(l.roll), qty: `${fmt(l.roll.lm, 1)} lm` }]
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

/** "2 baner à 5,2 m · 1 bane à 5,2 m kappet til 1 m bredde · svinn 5,8 m²": lengths as cut, with the end allowance. */
function rollDetail(r: NonNullable<CalcResult['groups'][number]['lines'][number]['roll']>) {
  const lanes = r.lanes.map((l) => `${l.qty} ${l.qty === 1 ? 'bane' : 'baner'} à ${fmt(l.length + 2 * ROLL_END, 1)} m${l.cut ? ` kappet til ${fmt(l.width, 1)} m bredde` : ''}`)
  return [...lanes, `svinn ${fmt(r.waste, 1)} m²`].join(' · ')
}
