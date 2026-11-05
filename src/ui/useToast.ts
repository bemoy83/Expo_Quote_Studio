// The toast at the bottom of the screen (drawn by Toast in controls.tsx): what it says, and an optional action such as «Angre».
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ToastMsg {
  text: string
  action?: string
  onAction?: () => void
}

/** One toast at a time; a new one replaces the old. */
export function useToast(): [ToastMsg | null, (m: ToastMsg | string) => void] {
  const [msg, setMsg] = useState<ToastMsg | null>(null)
  const t = useRef(0)
  const show = useCallback((m: ToastMsg | string) => {
    window.clearTimeout(t.current)
    setMsg(typeof m === 'string' ? { text: m } : m)
    t.current = window.setTimeout(() => setMsg(null), 3500)
  }, [])
  useEffect(() => () => window.clearTimeout(t.current), [])
  return [msg, show]
}
