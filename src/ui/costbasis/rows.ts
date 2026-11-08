// What the Kostgrunnlag page shows beside the numbers: the build rules the quantities come from (docs/byggeregler.md)
// and the formulas that turn numbers into cost and price (docs/kostmodell.md).
import type { FieldTab } from '../../cost/fields'
import type { Rules } from '../../rules/rules'
import { fmt, mm } from '../format'

export interface RuleRow {
  group: string
  label: string
  value: string
  /** Byggeregel id in docs/byggeregler.md, or where the number lives. */
  id: string
  use: string
}

export function ruleRows(r: Rules): RuleRow[] {
  return [
    { group: 'Systemvegg', label: 'Modul, senteravstand mellom stolper', value: `${mm(r.wall.cc)} mm`, id: 'V1', use: 'Antall moduler, stolper og skinner per meter vegg' },
    { group: 'Systemvegg', label: 'Stolpe, høyde uten fot', value: `${mm(r.wall.height)} mm`, id: 'V2', use: 'Stolpelengde i plukklisten' },
    { group: 'Systemvegg', label: 'Fot under stolpen', value: `${mm(r.wall.feet)} mm`, id: 'V3', use: 'Systemhøyde 2540' },
    { group: 'Systemvegg', label: 'Veggplate, lysåpning', value: `${r.wall.plate.width} × ${r.wall.plate.height} mm`, id: 'V5', use: 'Én plate per modul' },
    { group: 'Takdrager', label: 'Lengste takdrager i én lengde', value: `${fmt(r.beam.max)} m`, id: 'T1 · T2', use: 'Deling og skjøter, takdragerstolper' },
    { group: 'Takdrager', label: 'Fritt spenn som gir støttedrager', value: `${fmt(r.beam.supportSpan)} m`, id: 'T7', use: 'Støttedrager på lange standvegger' },
    { group: 'Gulv', label: 'Rutenett for teppefliser', value: `${fmt(r.floor.cell)} m`, id: 'G1', use: 'Fliser per m²' },
    { group: 'Gulv', label: 'Ekstra i hver ende av en rull', value: `${fmt(r.floor.rollEnd)} m`, id: 'G3', use: 'Meter fra rullen' },
    { group: 'Tilbud', label: 'Tilbudet gjelder', value: `${r.quote.validDays} dager`, id: 'Tilbud', use: 'Gyldig til-dato' },
    { group: 'Tilbud', label: 'Merverdiavgift', value: `${fmt(r.vat * 100)} %`, id: 'Tilbud', use: 'Sum inkl. mva.' },
  ]
}

export interface Formula {
  rule?: number
  title: string
  formula: string
  text: string
  tab?: FieldTab
  unused?: boolean
}

export const FORMULAS: readonly Formula[] = [
  {
    rule: 1,
    title: 'Eid og leid ut',
    formula: 'kost per bruk = (innkjøp / levetid + innkjøp / 2 × rente) / bruk i året + innkjøp × tap per jobb',
    text: 'Profiler i standardlengde, koblinger, føtter, stolper, plater. Innkjøp er listeprisen flyttet med materialindeksen til kostgrunnlagets år, med valuta og frakt.',
    tab: 'avskrivning',
  },
  {
    rule: 2,
    title: 'Spesialkapp',
    formula: 'kost = innkjøp per m × lengde × (1 + svinn) × (1 − gjenbruk) + kappetid',
    text: 'Profil kappet utenfor sortimentet (X9). Tekstilrammer kappes alltid til mål og har i stedet egen slitasje.',
    tab: 'avskrivning',
    unused: true,
  },
  { rule: 3, title: 'Kjøpt til jobben', formula: 'kost = innkjøp × (1 + svinn)', text: 'Trykt tekstil, folie, teip.', tab: 'avskrivning' },
  {
    rule: 4,
    title: 'Arbeid',
    formula: 'kost = personminutter / 60 × timekost, timekost = timelønn × lønnsindeks / fakturerbar andel',
    text: 'Plukk, vask, transport, forhåndsmontering, montering, demontering. Samme montør og timekost for gulv, Foga, tekstil og møbler. To montører i 3 minutter er 6 personminutter.',
    tab: 'arbeid',
  },
  { rule: 5, title: 'Per ordre', formula: 'kost = fast beløp og minutter, én gang per tilbud', text: 'Startkost trykk (bare med trykt tekstil), administrasjon og plukk, levering. Aldri i linjeprisene.', tab: 'ordrekost' },
  {
    rule: 6,
    title: 'Høyde',
    formula: 'kost = lift per dag + monteringsminutter × faktor',
    text: 'Over 3,0 m, der en 5-trinns stige ikke rekker. Appen tegner ikke over 3,0 m ennå.',
    tab: 'arbeid',
    unused: true,
  },
  {
    title: 'Pris',
    formula: 'veiledende pris = direkte kost × (1 + indirekte) / (1 − DG-mål)',
    text: 'For det motoren priser: tekstil og spesialmål. Standardleveranser (vegg, dør, forheng, takdrager) har fast katalogpris fra OMS, og motoren gir bare kost, DG og tid.',
    tab: 'paslag',
  },
  { title: 'DG', formula: 'DB = pris − direkte kost, DG = DB / pris, igjen = DB − direkte kost × indirekte', text: 'DG regnes på direkte kost; kalkylen viser hva som er igjen etter indirekte kost.' },
]
