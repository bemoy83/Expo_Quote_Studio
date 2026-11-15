// Frihåndsrom (Byggeregel R3): an edit or a drag that walls in an area with a door turns it into a room, as its own undo
// step, and the room is chosen with its grips (R8). An edit with history is looked at at once (App's onEdit); a drag
// stores its steps without history from one checkpoint, so it is looked at when let go, against the sketch it began on.
import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject } from 'react'
import { roomSize } from '../domain/rooms'
import type { Variant } from '../domain/types'
import type { SketchAction } from '../state/history'
import { closeRooms, roomsFrom } from './edits'
import type { PlanSelection } from './plan/selection'
import type { ToastMsg } from './useToast'

type Ratio = (id: string | undefined) => number

interface Args {
  v: Variant
  /** The sketch shown, as of the last render. */
  vRef: RefObject<Variant>
  ratio: Ratio
  dispatch: Dispatch<SketchAction>
  setSelection: (s: PlanSelection) => void
  showToast: (m: ToastMsg) => void
}

export function useCloseRooms({ v, vRef, ratio, dispatch, setSelection, showToast }: Args) {
  /** Areas `after` walls in that `before` did not, made rooms: one more undo step, chosen, told in a toast. */
  const closeSince = useCallback(
    (before: Variant, after: Variant, r: Ratio) => {
      const closed = closeRooms(before, after, r)
      if (!closed) return
      const { areas } = closed
      dispatch({ type: 'edit', fn: (x) => roomsFrom(x, areas, r) })
      const made = closed.v.rooms.filter((x) => !after.rooms.some((y) => y.id === x.id))
      if (made.length === 1) setSelection({ roomId: made[0].id })
      const size = areas.map((outline) => roomSize({ outline })).join(' og ')
      showToast({ text: `Gjort om til rom ${size}`, action: 'Angre', onAction: () => dispatch({ type: 'undo' }) })
    },
    [dispatch, setSelection, showToast],
  )

  /** The sketch when the drag under way began; an edit with history ends it (`editDone`). */
  const dragFrom = useRef<Variant | null>(null)
  const onCheckpoint = useCallback(() => {
    dragFrom.current = vRef.current
    dispatch({ type: 'checkpoint' })
  }, [vRef, dispatch])
  const editDone = useCallback(() => {
    dragFrom.current = null
  }, [])

  // Looked at once the sketch holds the drag's last step (a step stored on release counts too): in an effect after the
  // render that `drops` asks for
  const dropped = useRef<Variant | null>(null)
  const [drops, setDrops] = useState(0)
  const onDragEnd = useCallback(() => {
    if (!dragFrom.current) return
    dropped.current = dragFrom.current
    dragFrom.current = null
    setDrops((n) => n + 1)
  }, [])
  useEffect(() => {
    const from = dropped.current
    dropped.current = null
    if (from) closeSince(from, v, ratio)
  }, [drops, v, ratio, closeSince])

  return { closeSince, editDone, onCheckpoint, onDragEnd }
}
