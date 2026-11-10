// A shelf seen from in front, as ShelfFront (elevation.tsx) draws it: where its board and brackets go in the drawing.
import { bracketSpans, shelfSpan, type CornerLayout } from '../../domain/shelves/corners'
import type { Shelf, Variant } from '../../domain/types'
import { rules } from '../env'

/** Where a shelf's board and brackets go in an elevation (Byggeregler H10, H11): from shelfSpan and bracketSpans, along
 *  the wall turned into drawing x by `spanX` (the face is drawn as seen standing in front of it). */
export function shelfFront(v: Variant, f: Shelf, layout: CornerLayout, spanX: (a: number, b: number) => number) {
  const span = shelfSpan(v, rules, f, layout)
  const brackets = bracketSpans(rules, f, span).map(([a, b]): [number, number] => [spanX(a, b), spanX(a, b) + Math.abs(b - a)])
  return { x: spanX(span.a, span.b), width: span.b - span.a, brackets }
}
