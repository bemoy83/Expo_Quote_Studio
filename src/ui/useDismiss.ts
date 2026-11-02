import { useEffect, type RefObject } from 'react'

/** Close a popover on a press outside it (and outside its own button, which toggles it) or on Escape. */
export function useDismiss(pop: RefObject<HTMLElement | null>, button: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !button.current?.contains(t)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // Capture: the plan and 3D handle their own presses and may stop them
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key)
    }
  }, [pop, button, onClose])
}
