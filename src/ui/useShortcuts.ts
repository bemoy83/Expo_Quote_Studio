// Keyboard on the sketch screen: V S G T M E (dock tools), P (last pen), R (turn a lane, furniture or a frittstående
// tekstilvegg, or the roll direction of the pen), Escape, ⌘Z / ⇧⌘Z, and Delete or Backspace on the selection (plan/selection.ts says what goes).
import { useEffect } from 'react'
import { rotateLane } from '../domain/floor/edit'
import type { Variant } from '../domain/types'
import { deleteSelection, doorWall, type PlanSelection } from './plan/selection'
import { turnFree, turnObject } from './plan/turn'
import type { DockTool } from './tools'
import type { Tools } from './useTools'

const DOCK_KEYS: Record<string, DockTool> = { v: 'select', s: 'wall', g: 'floor', t: 'profile', m: 'object', e: 'erase' }

interface Shortcuts {
  v: Variant
  tools: Tools
  selection: PlanSelection
  setSelection: (s: PlanSelection) => void
  /** The drawer is open on the selection. */
  drawerOpen: boolean
  onEdit: (fn: (v: Variant) => Variant) => void
  onToast: (text: string) => void
  undo: () => void
  redo: () => void
  /** P takes the last pen up again, in the plan. */
  toPlan: () => void
}

export function useShortcuts(s: Shortcuts) {
  // Set up again on every render, so the handler always sees the current selection and tool
  useEffect(() => {
    const { v, tools, selection, setSelection, onEdit } = s
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select')) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod || e.altKey) return
      const k = e.key.toLowerCase()
      const del = k === 'delete' || k === 'backspace'
      const selected = tools.tool === 'select' && Object.keys(selection).length > 0
      if (k === 'escape' && selection.openingId && s.drawerOpen) {
        // From the door's settings back to its wall: colour and graphics (the door is part of the wall)
        setSelection(doorWall(v, selection))
      } else if (k === 'escape' && selected) setSelection({})
      else if (k === 'escape') tools.setTool('select')
      else if (k === 'r' && selection.lane && tools.tool === 'select') {
        const r = rotateLane(v, selection.lane)
        if (r) {
          onEdit(() => r.v)
          setSelection({ lane: { i: r.lane.i, j: r.lane.j } })
        }
      } else if (k === 'r' && selection.objectId && tools.tool === 'select') turnObject({ v, onEdit, onToast: s.onToast }, selection.objectId)
      else if (k === 'r' && selection.freeTextileId && tools.tool === 'select') turnFree({ v, onEdit, onToast: s.onToast }, selection.freeTextileId)
      else if (k === 'p' && tools.brush) {
        tools.setTool('brush')
        s.toPlan()
      } else if (k === 'r' && tools.rollBrush) tools.setRollDir(tools.roll === 'x' ? 'y' : 'x')
      else if (DOCK_KEYS[k]) tools.activate(DOCK_KEYS[k])
      else if (del) {
        const d = deleteSelection(v, selection)
        if (d) {
          onEdit(d.edit)
          // The drawer stays on the wall a removed frame, decal or door was on; without it nothing stays selected
          setSelection(s.drawerOpen ? d.select : {})
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}
