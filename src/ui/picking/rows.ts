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
        // Carpet tiles: one row per size, in pieces
        l.tiles
          ? l.tiles.map((t) => ({ key: `${l.artnr}|${t.size}`, group: l.group, code: l.artnr, title: `${l.name} ${t.size}`, qty: `${t.qty} stk` }))
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
