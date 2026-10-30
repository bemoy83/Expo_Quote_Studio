import type { ReactNode } from 'react'

/** Band at the top of Tilbud, Produksjon and Produktliste: title, short status and actions. */
export function PageBand({ title, meta, children }: { title: string; meta?: string; children?: ReactNode }) {
  return (
    <div className="band no-print" data-band="eple">
      <div className="band-head">
        <h1>{title}</h1>
        {meta && <span className="band-meta">{meta}</span>}
        <span className="spacer" />
        {children}
      </div>
    </div>
  )
}
