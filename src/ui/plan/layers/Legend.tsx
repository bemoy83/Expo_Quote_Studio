// Legend and drawing head in the outer corner of the front aisle (docs/arbeidstegning.md): the keys, one row per floor
// (swatch and area), the textile and print patterns and the takdrager with its running metres, beside the drawing head
// with the variant and a scale bar. Rows that do not fit fall away; nothing is ever drawn outside the aisle.
import { useId } from 'react'
import type { CalcResult } from '../../../calc/calc'
import type { Variant } from '../../../domain/types'
import { INK, INK_FAINT, INK_MUTED, SURFACE } from '../../colors'
import { fmt } from '../../format'
import { idx, productOf, rules } from '../../env'
import { EM, linePx, sizePx, textPx, usePlanScale } from '../planScale'
import { beamBody, PLAN_MARGIN } from '../planStyle'
import { DIM_NEAR, DIM_TOTAL, FRONT_NAME_DROP, sideNameOffset, totalSides } from '../dims'
import { BeamStroke } from './BeamLayer'
import { RasterPattern, TextileStroke } from './TextileLayer'

/** Gap from the aisle's edges, row height and type sizes, screen px. */
const PAD = 12
const ROW = 14
/** Between the two columns, and from a front chain's line to the legend (past its numbers), screen px. */
const GAP = 16
const CHAIN_CLEAR = 18
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

/** The two blocks of the legend, each top to bottom: the keys (empty when there is nothing to explain) and the drawing head. */
function legendBlocks(v: Variant, res: CalcResult, doc: boolean): { keys: Row[]; head: Row[] } {
  const k = res.keyFigures
  const keys: Row[] = []
  for (const [a, m2] of Object.entries(k.floor)) {
    const hit = idx.byArtnr.get(a)
    keys.push({ kind: 'floor', colour: hit?.variant.color, text: `${productOf(a)?.name ?? a} ${hit?.variant.name.toLowerCase() ?? ''} · ${fmt(m2)} m²` })
  }
  const textiles = v.textiles.length + v.freeTextiles.length
  if (textiles) keys.push({ kind: 'textile', text: `Tekstilvegg · ${textiles} stk` })
  if (v.foils.length) keys.push({ kind: 'print', text: 'Print og dekal' })
  if (k.beamLm > 1e-9) keys.push({ kind: 'beam', text: beamText(k) })
  return {
    keys: keys.length ? [{ kind: 'eyebrow', text: 'TEGNFORKLARING' }, ...keys] : [],
    head: [{ kind: 'eyebrow', text: 'TEGNING' }, { kind: 'head', text: doc ? `Variant ${v.name}` : `Variant ${v.name} · ${today()}` }, { kind: 'scale', m: doc ? 2 : 1 }],
  }
}

/** One column placed in the aisle: its rows, left edge and top. */
interface Column {
  rows: Row[]
  x0: number
  top: number
}

/**
 * The legend in the outer corner of the front aisle, as a drawing's title block (Bjørn 11.11.2026): the drawing head
 * in the corner and the keys beside it, both standing on the aisle's bottom edge, so they keep clear of the dimension
 * chains along the front. Stacked in one column when the aisle is too narrow for two.
 */
export function Legend({ v, res, doc }: { v: Variant; res: CalcResult; doc: boolean }) {
  const sc = usePlanScale()
  const ids = useId().replace(/:/g, '')
  const M = PLAN_MARGIN
  const { width: W, depth: D } = v.stand
  const px = (n: number) => sizePx(sc, n)
  // The aisle in front: the legend never leaves it
  const bottom = D + M - px(PAD / 2)
  const right = W + M - px(PAD)
  const left = -M + px(PAD)
  // Below the chains along the front (dims.ts): the total row where the front has one, else the placement row
  const below = D + px((totalSides(v).includes('front') ? DIM_TOTAL : DIM_NEAR) + CHAIN_CLEAR)
  const { keys, head } = legendBlocks(v, res, doc)
  // As wide as its longest row (a rough measure of the text, the scale bar at its length)
  const rowWidth = (r: Row) =>
    r.kind === 'scale' ? r.m / px(1) + 24 : r.kind === 'eyebrow' ? textPx(r.text, EYEBROW, EM.caps) : r.kind === 'head' ? textPx(r.text, TEXT + 1, EM.mono) : textPx(r.text, TEXT, EM.ui) + 15
  const width = (rows: Row[]) => px(Math.max(0, ...rows.map(rowWidth)))
  /** A column with its right edge at `x1`, standing on the bottom; rows that do not fit fall away from the end. */
  const column = (rows: Row[], x1: number): Column => {
    const x0 = Math.max(left, x1 - width(rows))
    // Under the side name «Front · …» (Labels.tsx, about 1,2 m wide round the middle) when the column reaches it
    const top = x0 < W / 2 + 0.75 ? Math.max(below, D + sideNameOffset(sc, false) + FRONT_NAME_DROP + 0.1) : below
    const fit = rows.slice(0, Math.max(0, Math.floor((bottom - top + 1e-9) / px(ROW))))
    // A lone eyebrow at the end is dropped with its rows
    while (fit.length && fit[fit.length - 1].kind === 'eyebrow') fit.pop()
    return { rows: fit, x0, top: bottom - fit.length * px(ROW) }
  }
  const headCol = column(head, right)
  // Side by side when the keys fit to the left of the head, else one column with the keys on top
  const twoUp = keys.length && headCol.x0 - px(GAP) - width(keys) >= left
  const cols = !keys.length ? [headCol] : twoUp ? [column(keys, headCol.x0 - px(GAP)), headCol] : [column([...keys, ...head], right)]
  if (!cols.some((c) => c.rows.length)) return null
  const sw = px(10)
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={`aisle${ids}`}>
          <rect x={-M} y={D} width={W + 2 * M} height={M} />
        </clipPath>
        <RasterPattern id={`raster${ids}`} sc={sc} />
      </defs>
      <g clipPath={`url(#aisle${ids})`}>
        {cols.flatMap(({ rows, x0, top }, c) => rows.map((r, n) => {
          const tx = x0 + px(15)
          const base = top + n * px(ROW) + px(ROW) * 0.7
          const mid = base - px(TEXT) * 0.35
          const text = (s: string, style: object) => (
            <text x={r.kind === 'eyebrow' || r.kind === 'head' || r.kind === 'scale' ? x0 : tx} y={base} style={style}>
              {s}
            </text>
          )
          switch (r.kind) {
            case 'eyebrow':
              return <g key={`${c}-${n}`}>{text(r.text, { font: `600 ${px(EYEBROW)}px var(--font-ui)`, letterSpacing: px(0.6), fill: INK_FAINT })}</g>
            case 'head':
              return <g key={`${c}-${n}`}>{text(r.text, { font: `500 ${px(TEXT + 1)}px var(--font-numeric)`, fill: INK })}</g>
            case 'floor':
              return (
                <g key={`${c}-${n}`}>
                  <rect x={x0} y={mid - sw / 2} width={sw} height={sw} rx={px(1.5)} fill={r.colour} stroke={INK} strokeOpacity={0.35} strokeWidth={linePx(sc, 0.5)} />
                  {text(r.text, { font: `400 ${px(TEXT)}px var(--font-ui)`, fill: INK_MUTED })}
                </g>
              )
            case 'textile':
              return (
                <g key={`${c}-${n}`}>
                  <TextileStroke a={[x0, mid]} b={[x0 + sw, mid]} sc={sc} />
                  {text(r.text, { font: `400 ${px(TEXT)}px var(--font-ui)`, fill: INK_MUTED })}
                </g>
              )
            case 'print':
              return (
                <g key={`${c}-${n}`}>
                  <rect x={x0} y={mid - px(1.5)} width={sw} height={px(3)} fill={`url(#raster${ids})`} />
                  {text(r.text, { font: `400 ${px(TEXT)}px var(--font-ui)`, fill: INK_MUTED })}
                </g>
              )
            case 'beam':
              return (
                <g key={`${c}-${n}`}>
                  <BeamStroke a={[x0, mid]} b={[x0 + sw, mid]} body={beamBody(sc, rules.beam.thickness)} />
                  {text(r.text, { font: `400 ${px(TEXT)}px var(--font-ui)`, fill: INK_MUTED })}
                </g>
              )
            case 'scale': {
              // A true-scale bar: half filled, half open, its length in metres beside it; 1 m when 2 m does not fit
              const h = px(3.5)
              const m = x0 + r.m + px(24) <= right ? r.m : 1
              return (
                <g key={`${c}-${n}`}>
                  <rect x={x0} y={mid - h / 2} width={m / 2} height={h} fill={INK} />
                  <rect x={x0 + m / 2} y={mid - h / 2} width={m / 2} height={h} fill={SURFACE} stroke={INK} strokeWidth={linePx(sc, 0.6)} />
                  <text x={x0 + m + px(5)} y={base} style={{ font: `500 ${px(TEXT)}px var(--font-numeric)`, fill: INK_MUTED }}>
                    {m} m
                  </text>
                </g>
              )
            }
          }
        }))}
      </g>
    </g>
  )
}
