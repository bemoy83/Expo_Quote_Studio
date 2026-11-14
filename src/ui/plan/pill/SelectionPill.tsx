// The selection pill (docs/pille-og-skuff.md): quick grips on what is selected in Velg, over the object on the plan.
// One build for all: name and size · colour or motif · rotate (where it makes sense) · Detaljer (the drawer) · remove.
// Shown as soon as a click selects; hidden while dragging, while the drawer is open, with a pen in hand and in 3D
// (PlanView decides). Where it stands: pillAnchor.ts. What it holds per kind of selection: floor.tsx (engangsteppe),
// objects.tsx (room, takdrager, furniture, frittstående tekstilvegg), door.tsx, wall.tsx (wall, frame, decal), shelf.tsx.
import { PanelBottomOpen, Trash2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { QBtn, QName, Sep } from '../quick/parts'
import { chosen, deleteSelection } from '../selection'
import { doorPill } from './door'
import { fillPill, lanePill } from './floor'
import { beamPill, freePill, objectPill, roomPill } from './objects'
import type { Content, PillActions, SecondFace } from './parts'
import { placePill, type PillPlace } from './pillAnchor'
import { shelfPill } from './shelf'
import { foilPill, textilePill, wallPill } from './wall'

export function SelectionPill(p: PillActions & { place: PillPlace }) {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  /** The pill's second face: «Grafikk» on a wall, «Høyde» on a shelf. Back to the first when the selection changes. */
  const [second, setSecond] = useState(false)
  const key = JSON.stringify(p.selection)
  const [secondFor, setSecondFor] = useState(key)
  if (secondFor !== key) {
    setSecondFor(key)
    setSecond(false)
  }
  // Its own size, to keep it inside the plan; it changes with what it shows
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setDims({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const c = content(p, { on: second, set: setSecond })
  if (!c) return null
  const at = placePill(p.place, dims)
  return (
    <div ref={ref} className="sel-pill" style={{ left: at.left, top: at.top, visibility: dims.w ? 'visible' : 'hidden' }} role="toolbar" aria-label={`Valgt: ${c.name}`} onPointerDown={(e) => e.stopPropagation()}>
      <QName name={c.name} meta={c.meta} />
      {c.body && (
        <>
          <Sep />
          {c.body}
        </>
      )}
      {(c.more || c.remove) && <Sep />}
      {c.more && (
        <QBtn title="Detaljer · åpne skuffen med alle innstillinger og veggrisset" label="Detaljer" onClick={() => p.onOpenDrawer(p.selection)}>
          <PanelBottomOpen size={15} />
          Detaljer
        </QBtn>
      )}
      {c.remove && (
        <QBtn title={c.removeLabel ?? 'Fjern (Delete)'} label={c.removeLabel ?? 'Fjern'} onClick={c.remove}>
          <Trash2 size={15} />
        </QBtn>
      )}
    </div>
  )
}

/** What the pill holds for the selection, or null when it is gone. */
function content(p: PillActions, second: SecondFace): Content | null {
  const c = chosen(p.v, p.selection)
  if (!c) return null
  const del = () => {
    const d = deleteSelection(p.v, p.selection)
    if (!d) return
    p.onEdit(d.edit)
    p.onSelect({})
  }
  switch (c.kind) {
    case 'fill':
      return fillPill(c, del)
    case 'lane':
      return lanePill(p, c, del)
    case 'room':
      return roomPill(c, del)
    case 'beam':
      return beamPill(p, c, del)
    case 'object':
      return objectPill(p, c, del)
    case 'free':
      return freePill(p, c, del)
    case 'opening':
      return doorPill(p, c, del)
    case 'textile':
      return textilePill(p, c, del)
    case 'foil':
      return foilPill(p, c, del)
    case 'shelf':
      return shelfPill(p, c, second, del)
    case 'wall':
      return wallPill(p, c, second)
  }
}
