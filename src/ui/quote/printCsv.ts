// Trykkliste as CSV, from Tilbud: every textile to produce, with frame, print and file size, for the print order.
// The same rows as the print list on Arbeidsordre (calc/textile/production.ts textileRows).
import { FILL_NAME, textileRows, type Production } from '../../calc/textile/production'
import { toCsvText } from '../../persistence/csv'
import type { InFrameParams } from '../../rules/rules'

export function printCsv(P: Production, s: InFrameParams): string {
  const d = (x: number | undefined) => (x === undefined ? '' : String(x).replace('.', ','))
  return toCsvText([
    ['Pos', 'Plassering', 'Duk', 'Ramme B', 'Ramme H', 'Trykkfil B', 'Trykkfil H', 'Bleed per side', 'Fil B', 'Fil H', 'Filskala', 'Filnavn', 'Trykk m²'],
    ...textileRows(P).map((r) => [
      r.pos,
      r.where,
      FILL_NAME[r.fill],
      r.W,
      r.H,
      r.pw,
      r.ph,
      s.bleed,
      d(r.fw),
      d(r.fh),
      `${s.scale} %`,
      r.fileName ?? '',
      r.fill === 'reuse' ? '0,00' : ((r.pw * r.ph) / 1e6).toFixed(2).replace('.', ','),
    ]),
  ])
}
