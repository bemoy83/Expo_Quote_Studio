// «Fin» (Bjørn 15.11.2026: one Fin for all): one switch for the whole app, as Shift held for touch. On, every pen
// draws in 250 and every drag of what is chosen (a room, a takdrager, a grip) moves in its fine steps. The pens'
// quick picks and the selection pill show the same switch (FinBtn in plan/quick/parts.tsx).
import { createContext, useContext } from 'react'

export interface Fine {
  fine: boolean
  setFine: (on: boolean) => void
}

export const FineContext = createContext<Fine>({ fine: false, setFine: () => {} })

export const useFine = () => useContext(FineContext)
