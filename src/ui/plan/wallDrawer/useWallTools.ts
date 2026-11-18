// What the wall drawer keeps between renders (Bjørn 2.11 and 9.11.2026): the paint tools (usePaintTools, as in the
// counter drawer), the page open for a felt or the whole wall, and the shelf brush with its hint. Choosing something on
// the wall puts the shelf brush away.
import { useState } from 'react'
import { usePaintTools } from '../paintTools'
import type { FeltPage } from './focus'

export function useWallTools() {
  /**
   * Colouring as in a paint program: pick the paint bucket (the whole face) or the brush (one plate at a time), pick a
   * colour or «Print», then click the wall. No tool: the drawing selects and moves as usual (Bjørn 2.11.2026).
   */
  const paint = usePaintTools()
  const { setTool } = paint
  /** The page shown for a felt or the whole wall: colour and profilering, or shelves and hooks. Kept from felt to felt. */
  const [page, setPage] = useState<FeltPage>('decor')
  /** The shelf brush (Hyller og heng): shelves are laid in the drawing where it is clicked (Bjørn 9.11.2026). */
  const [shelfBrush, setShelfBrush] = useState(false)
  /** The hint line while the shelf brush aims at a felt that takes none, or too high. */
  const [brushHint, setBrushHint] = useState<string | null>(null)
  /** Whether something on the wall was chosen at the last render: choosing something puts the brush away. */
  const [wasPicked, setWasPicked] = useState(false)

  /**
   * Whether the shelf brush is live, given whether something on the wall (a felt, door, frame, decal or shelf) is chosen
   * now: only on the whole wall's «Hyller og heng». Choosing something puts it away. Called once per render.
   */
  const brushLive = (picked: boolean) => {
    if (picked !== wasPicked) {
      setWasPicked(picked)
      if (picked) setShelfBrush(false)
    }
    return shelfBrush && page === 'extras' && !picked
  }

  /** «Hyller og heng» ↔ «Farge og profilering»: the paint tools and the shelf brush are put away. */
  const switchPage = () => {
    setTool(null)
    setShelfBrush(false)
    setPage(page === 'extras' ? 'decor' : 'extras')
  }

  return { ...paint, page, setPage, setShelfBrush, brushHint, setBrushHint, brushLive, switchPage }
}
