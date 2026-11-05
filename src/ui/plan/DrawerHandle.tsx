// The edge on top of the drawer (docs/pille-og-skuff.md, «To høyder»): drag it up for detail, down for compact, or click
// it to switch. Shows which height the drawer has.
import { useRef } from 'react'

/** How far the edge must be dragged before the height changes, px. */
const DRAG_PX = 20

export function DrawerHandle({ detail, onChange }: { detail: boolean; onChange: (detail: boolean) => void }) {
  const start = useRef<{ y: number; moved: boolean } | null>(null)
  return (
    <div
      className="drawer-handle"
      role="separator"
      aria-orientation="horizontal"
      aria-label={detail ? 'Skuffen i detalj: dra ned eller klikk for kompakt' : 'Skuffen kompakt: dra opp eller klikk for detalj'}
      title={detail ? 'Dra ned eller klikk for kompakt skuff' : 'Dra opp eller klikk for detalj'}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { y: e.clientY, moved: false }
      }}
      onPointerMove={(e) => {
        const s = start.current
        if (!s) return
        const dy = e.clientY - s.y
        if (Math.abs(dy) < DRAG_PX) return
        s.moved = true
        if (dy < 0 !== detail) onChange(dy < 0)
      }}
      onPointerUp={() => {
        const s = start.current
        start.current = null
        if (s && !s.moved) onChange(!detail)
      }}
      onPointerCancel={() => (start.current = null)}
    >
      <span className="drawer-grip" aria-hidden />
      {detail ? 'Detalj' : 'Kompakt'}
    </div>
  )
}
