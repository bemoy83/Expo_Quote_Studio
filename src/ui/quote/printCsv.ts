// Trykkliste as CSV, from Tilbud: every textile to produce, with frame, print and file size, for the print order.
// Moved from the Produksjon page (Bjørn 8.11.2026).
import { FILL_NAME, type Production } from '../../calc/production'
import { toCsvText } from '../../persistence/csv'
import type { InFrameParams } from '../../rules/rules'

export function printCsv(P: Production, s: InFrameParams): string {
  const c = (x: number) => x.toFixed(2).replace('.', ',')
  const d = (x: number) => String(x).replace('.', ',')
  const rows: (string | number)[][] = [
    ['Pos', 'Del', 'Vegg', 'Duk', 'Ramme B', 'Ramme H', 'Trykkfil B', 'Trykkfil H', 'Bleed per side', 'Fil B', 'Fil H', 'Filskala', 'Filnavn', 'Trykk m²'],
  ]
  for (const p of P.pieces)
    rows.push([p.pos, 'Tekstilvegg', p.wall, FILL_NAME[p.fill], p.W, p.H, p.pw, p.ph, s.bleed, d(p.fw), d(p.fh), `${s.scale} %`, p.fileName ?? '', c(p.fill === 'reuse' ? 0 : p.area)])
  for (const f of P.free)
    for (const x of f.faces)
      rows.push([x.pos, 'Tekstilvegg frittstående', `${f.pos} side ${x.face.toUpperCase()}`, FILL_NAME[x.fill], x.W, x.H, x.pw, x.ph, s.bleed, d(x.fw), d(x.fh), `${s.scale} %`, x.fileName ?? '', c(x.fill === 'reuse' ? 0 : x.printArea)])
  return toCsvText(rows)
}
