// Waste drawn hatched: the strip of roll cut off a lane narrower than the roll. Each one has its own pattern id, so
// several plans on the page (plan, mini plan, work order) never share one.
import { useId } from 'react'

export function Hatched({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const id = `hatch${useId().replace(/:/g, '')}`
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={0.12} height={0.12} patternTransform="rotate(135)">
          <rect width={0.12} height={0.12} fill="rgb(var(--ink) / .06)" />
          <line x1={0} y1={0} x2={0} y2={0.12} stroke="rgb(var(--ink) / .45)" strokeWidth={0.025} />
        </pattern>
      </defs>
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id})`} />
    </g>
  )
}
