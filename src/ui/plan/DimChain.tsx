// One dimension chain in millimetres (docs/arbeidstegning.md, «Mål»): a hairline in muted ink, slashes as end marks
// and the number between them. Drawn by the plan (layers/DimLayer.tsx) and the wall drawing (wallDrawer/ElevationDims.tsx).
import { INK_MUTED } from '../colors'
import { mm } from './dims'
import { linePx, sizePx, textPx, type PlanScale } from './planScale'

/** Number size, screen px. */
const DIM_FONT = 10

/**
 * One chain along `axis` at the fixed coordinate `at`, through the positions `ts`. Numbers stand on the `dir` side of
 * the line; a number that does not fit between its marks is left out, unless `keep` (a single measure the montør needs,
 * Byggeregel T15). `suffix` follows each number («2 490 vegg»).
 */
export function Chain({ sc, axis, at, ts, dir, suffix, keep }: { sc: PlanScale; axis: 'x' | 'y'; at: number; ts: number[]; dir: 1 | -1; suffix?: string; keep?: boolean }) {
  if (ts.length < 2) return null
  const P = (t: number, o = 0): [number, number] => (axis === 'x' ? [t, at + o] : [at + o, t])
  const k = sizePx(sc, 2.5)
  const wit = sizePx(sc, 3.5)
  const gap = sizePx(sc, 3)
  const fs = sizePx(sc, DIM_FONT)
  const a = P(ts[0])
  const b = P(ts[ts.length - 1])
  return (
    <g stroke={INK_MUTED} fill="none">
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={linePx(sc, 0.6)} />
      {ts.map((t) => {
        const [x, y] = P(t)
        const [w0, w1] = [P(t, -wit), P(t, wit)]
        return (
          <g key={t}>
            <line x1={w0[0]} y1={w0[1]} x2={w1[0]} y2={w1[1]} strokeWidth={linePx(sc, 0.6)} />
            <line x1={x - k} y1={y + k} x2={x + k} y2={y - k} strokeWidth={linePx(sc, 1.4)} />
          </g>
        )
      })}
      {ts.slice(1).map((t, i) => {
        const len = t - ts[i]
        // Fits: the number and a little air between the marks; with a suffix, the number alone when that is all that fits
        const fits = (t: string) => len >= sizePx(sc, textPx(t, DIM_FONT) + 8)
        const long = suffix ? `${mm(len)} ${suffix}` : mm(len)
        const text = fits(long) ? long : fits(mm(len)) || keep ? mm(len) : null
        if (!text) return null
        const mid = (t + ts[i]) / 2
        // Baseline: just off the line on the dir side, glyphs growing away from it
        const off = dir < 0 ? -gap : gap + fs * 0.78
        const [x, y] = P(mid, off)
        return (
          <text
            key={`n${t}`}
            x={x}
            y={y}
            transform={axis === 'y' ? `rotate(-90 ${x} ${y})` : undefined}
            textAnchor="middle"
            stroke="none"
            style={{ font: `500 ${fs}px var(--font-numeric)`, fill: INK_MUTED }}
          >
            {text}
          </text>
        )
      })}
    </g>
  )
}
