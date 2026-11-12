// The end of a drawn counter under the Disker pen, as a handle (Byggeregler K7, K8): drawn by PreviewLayer from what
// plan/next.ts finds at the pointer.
import type { CounterEnd } from '../../../domain/counterEnds'
import { INK, INK_MUTED } from '../../colors'
import { linePx, sizePx, usePlanScale } from '../planScale'
import { AimRect } from './Previews'

/** A counter's end under the pen (K7, K8): outlined as the thing to take hold of, with an arrow for each way a drag can
 *  go and what it does, so the pointer says what a drag from here makes before it starts (Bjørn 12.11.2026). */
export function CounterHandle({ h }: { h: CounterEnd }) {
  const sc = usePlanScale()
  const c: [number, number] = [(h.box.x0 + h.box.x1) / 2, (h.box.y0 + h.box.y1) / 2]
  const arrows: { d: readonly [number, number]; text: string }[] = [
    ...h.out.map((d) => ({ d, text: 'lengre' })),
    ...(h.in ? [{ d: h.in, text: 'kortere' }] : []),
    { d: h.back, text: 'hjørne' },
  ]
  const from = sizePx(sc, 7)
  const to = sizePx(sc, 26)
  const head = sizePx(sc, 5)
  const fs = sizePx(sc, 10)
  return (
    <g>
      <AimRect x={h.box.x0} y={h.box.y0} width={h.box.x1 - h.box.x0} height={h.box.y1 - h.box.y0} halo />
      {arrows.map(({ d, text }) => {
        const [dx, dy] = d
        const tip: [number, number] = [c[0] + dx * to, c[1] + dy * to]
        const side: [number, number] = [-dy, dx]
        const wing = (s: number) => `${tip[0] - dx * head + side[0] * head * s * 0.7},${tip[1] - dy * head + side[1] * head * s * 0.7}`
        const label: [number, number] = [tip[0] + dx * sizePx(sc, 4) + (dy ? sizePx(sc, 4) : 0), tip[1] + dy * sizePx(sc, 4) + (dx ? -sizePx(sc, 4) : fs * 0.35)]
        return (
          <g key={text + dx + dy}>
            <line x1={c[0] + dx * from} y1={c[1] + dy * from} x2={tip[0]} y2={tip[1]} stroke={INK} strokeWidth={linePx(sc, 1.4)} strokeLinecap="round" />
            <polyline points={`${wing(1)} ${tip[0]},${tip[1]} ${wing(-1)}`} fill="none" stroke={INK} strokeWidth={linePx(sc, 1.4)} strokeLinecap="round" strokeLinejoin="round" />
            <text x={label[0]} y={label[1]} textAnchor={dx > 0 ? 'start' : dx < 0 ? 'end' : 'start'} style={{ font: `500 ${fs}px var(--font-sans, system-ui)`, fill: INK_MUTED }}>
              {text}
            </text>
          </g>
        )
      })}
    </g>
  )
}

