// Legend and drawing head in the aisle in front of the stand (docs/arbeidstegning.md): a column to the right with one
// row per floor (swatch and area), the textile and print patterns, the takdrager with its running metres, the
// variant, and a scale bar. Rows that do not fit fall away; nothing is ever drawn outside the aisle.
import { useId } from 'react'
import type { CalcResult } from '../../../calc/calc'
import type { Variant } from '../../../domain/types'
import { INK, INK_FAINT, INK_MUTED, SURFACE } from '../../colors'
import { fmt } from '../../format'
import { idx, productOf, rules } from '../../env'
import { linePx, sizePx, usePlanScale } from '../planScale'
import { beamBody, PLAN_MARGIN } from '../planStyle'
import { BeamStroke } from './BeamLayer'
import { RasterPattern, TextileStroke } from './TextileLayer'

/** Gap from the aisle's right edge and from the stand, row height and type sizes, screen px. */
const PAD = 12
const ROW = 14
const EYEBROW = 7.5
const TEXT = 9.5

type Row =
  | { kind: 'eyebrow'; text: string }
  | { kind: 'floor'; colour: string | undefined; text: string }
  | { kind: 'textile' | 'print' | 'beam'; text: string }
  | { kind: 'head'; text: string }
  | { kind: 'scale'; m: number }

/** «X fra arrangør · Y tilvalg» when the organiser pays some takdragere, else the running metres. */
function beamText(k: CalcResult['keyFigures']): string {
  const ours = k.beamLm - k.organiserBeamLm
  if (k.organiserBeamLm) return `Takdrager · ${fmt(k.organiserBeamLm)} m fra arrangør${ours > 1e-9 ? ` · ${fmt(ours)} m tilvalg` : ''}`
  return `Takdrager · ${fmt(k.beamLm)} m`
}

const today = () => new Date().toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** The rows of the legend, top to bottom. */
function legendRows(v: Variant, res: CalcResult, doc: boolean): Row[] {
  const k = res.keyFigures
  const rows: Row[] = []
  const keys: Row[] = []
  for (const [a, m2] of Object.entries(k.floor)) {
    const hit = idx.byArtnr.get(a)
    keys.push({ kind: 'floor', colour: hit?.variant.color, text: `${productOf(a)?.name ?? a} ${hit?.variant.name.toLowerCase() ?? ''} · ${fmt(m2)} m²` })
  }
  const textiles = v.textiles.length + v.freeTextiles.length
  if (textiles) keys.push({ kind: 'textile', text: `Tekstilvegg · ${textiles} stk` })
  if (v.foils.length) keys.push({ kind: 'print', text: 'Print og dekal' })
  if (k.beamLm > 1e-9) keys.push({ kind: 'beam', text: beamText(k) })
  if (keys.length) rows.push({ kind: 'eyebrow', text: 'TEGNFORKLARING' }, ...keys)
  rows.push({ kind: 'eyebrow', text: 'TEGNING' }, { kind: 'head', text: doc ? `Variant ${v.name}` : `Variant ${v.name} · ${today()}` })
  rows.push({ kind: 'scale', m: doc ? 2 : 1 })
  return rows
}

/** The legend column at the right of the front aisle. */
export function Legend({ v, res, doc }: { v: Variant; res: CalcResult; doc: boolean }) {
  const sc = usePlanScale()
  const ids = useId().replace(/:/g, '')
  const M = PLAN_MARGIN
  const { width: W, depth: D } = v.stand
  const px = (n: number) => sizePx(sc, n)
  // The aisle in front: the legend never leaves it
  let top = D + px(PAD)
  const bottom = D + M - px(PAD / 2)
  const right = W + M - px(PAD)
  const all = legendRows(v, res, doc)
  // As wide as its longest row (a rough measure of the text), right-aligned in the aisle
  const textWidth = (r: Row) => ('text' in r ? r.text.length * (r.kind === 'eyebrow' ? EYEBROW * 0.75 : TEXT * 0.56) : 0) + (r.kind === 'eyebrow' || r.kind === 'head' ? 0 : 15)
  const col = Math.max(...all.map(textWidth))
  const x0 = Math.max(-M + px(PAD), right - px(col))
  // Under the side name «Front · …» (Labels.tsx, about 1,2 m wide round the middle) when the column reaches it
  if (x0 < W / 2 + 0.75) top = Math.max(top, D + px(14) + 0.22)
  // Rows that fit; a lone eyebrow at the end is dropped with its rows
  const fit: Row[] = []
  let y = top
  for (const r of all) {
    if (y + px(ROW) > bottom + 1e-9) break
    fit.push(r)
    y += px(ROW)
  }
  while (fit.length && fit[fit.length - 1].kind === 'eyebrow') fit.pop()
  if (!fit.length) return null
  const sw = px(10)
  const tx = x0 + px(15)
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={`aisle${ids}`}>
          <rect x={-M} y={D} width={W + 2 * M} height={M} />
        </clipPath>
        <RasterPattern id={`raster${ids}`} sc={sc} />
      </defs>
      <g clipPath={`url(#aisle${ids})`}>
        {fit.map((r, n) => {
          const base = top + n * px(ROW) + px(ROW) * 0.7
          const mid = base - px(TEXT) * 0.35
          const text = (s: string, style: object) => (
            <text x={r.kind === 'eyebrow' || r.kind === 'head' || r.kind === 'scale' ? x0 : tx} y={base} style={style}>
              {s}
            </text>
          )
          switch (r.kind) {
            case 'eyebrow':
              return <g key={n}>{text(r.text, { font: `600 ${px(EYEBROW)}px var(--font-ui)`, letterSpacing: px(0.6), fill: INK_FAINT })}</g>
            case 'head':
              return <g key={n}>{text(r.text, { font: `500 ${px(TEXT + 1)}px var(--font-numeric)`, fill: INK })}</g>
            case 'floor':
              return (
                <g key={n}>
                  <rect x={x0} y={mid - sw / 2} width={sw} height={sw} rx={px(1.5)} fill={r.colour} stroke={INK} strokeOpacity={0.35} strokeWidth={linePx(sc, 0.5)} />
                  {text(r.text, { font: `400 ${px(TEXT)}px var(--font-ui)`, fill: INK_MUTED })}
                </g>
              )
            case 'textile':
              return (
                <g key={n}>
                  <TextileStroke a={[x0, mid]} b={[x0 + sw, mid]} sc={sc} />
                  {text(r.text, { font: `400 ${px(TEXT)}px var(--font-ui)`, fill: INK_MUTED })}
                </g>
              )
            case 'print':
              return (
                <g key={n}>
                  <rect x={x0} y={mid - px(1.5)} width={sw} height={px(3)} fill={`url(#raster${ids})`} />
                  {text(r.text, { font: `400 ${px(TEXT)}px var(--font-ui)`, fill: INK_MUTED })}
                </g>
              )
            case 'beam':
              return (
                <g key={n}>
                  <BeamStroke a={[x0, mid]} b={[x0 + sw, mid]} body={beamBody(sc, rules.beam.thickness)} />
                  {text(r.text, { font: `400 ${px(TEXT)}px var(--font-ui)`, fill: INK_MUTED })}
                </g>
              )
            case 'scale': {
              // A true-scale bar: half filled, half open, its length in metres beside it; 1 m when 2 m does not fit
              const h = px(3.5)
              const m = x0 + r.m + px(24) <= right ? r.m : 1
              return (
                <g key={n}>
                  <rect x={x0} y={mid - h / 2} width={m / 2} height={h} fill={INK} />
                  <rect x={x0 + m / 2} y={mid - h / 2} width={m / 2} height={h} fill={SURFACE} stroke={INK} strokeWidth={linePx(sc, 0.6)} />
                  <text x={x0 + m + px(5)} y={base} style={{ font: `500 ${px(TEXT)}px var(--font-numeric)`, fill: INK_MUTED }}>
                    {m} m
                  </text>
                </g>
              )
            }
          }
        })}
      </g>
    </g>
  )
}
