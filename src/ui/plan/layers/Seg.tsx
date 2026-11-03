// A line in model coordinates: walls, beams, textiles and previews in the plan are drawn with it.
import type { SVGProps } from 'react'
import type { Point } from '../../../domain/types'

/** A line from a to b in model coordinates. */
export function Seg({ a, b, ...rest }: { a: Point; b: Point } & SVGProps<SVGLineElement>) {
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...rest} />
}
