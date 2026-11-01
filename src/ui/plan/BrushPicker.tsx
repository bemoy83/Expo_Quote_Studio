// What the brush draws, picked on the drawing surface: a popover over the tools, opened by clicking the active Pensel.
// Same brushes as the panel, grouped the same way (Vegger · Gulv · Profilering · Møbler). Picking only sets the brush:
// a wall colour here is the colour new inner walls are drawn with, the stand's wall plate is still set in the panel.
import { Blinds, DoorClosed, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { mainGroupOf, PRODUCT_GROUPS } from '../../catalog/groups'
import type { Motif } from '../../persistence/file'
import { catalog, wallPlates } from '../env'
import { INK } from '../colors'
import { ObjectThumb, Swatch } from '../panel/ProductRow'
import type { Brush } from '../tools'

export function BrushPicker({ brush, defaultPlate, motifs, onPick, onClose }: { brush: Brush | null; defaultPlate: string; motifs: Motif[]; onPick: (b: Brush) => void; onClose: () => void }) {
  const is = (b: Brush) => JSON.stringify(b) === JSON.stringify(brush)
  const plates = wallPlates()
  const wallRal = brush?.kind === 'wall' ? brush.ral : defaultPlate
  const wallPlate = plates.find((p) => p.ral === wallRal)
  const openings = catalog.products.filter((p) => p.opening)
  const floors = catalog.products.filter((p) => mainGroupOf(p.group) === 'gulv' && p.kind === 'surface')
  const objects = catalog.products.filter((p) => p.kind === 'object' && !p.opening)
  const objectGroups = [...new Set(objects.map((p) => mainGroupOf(p.group)))]
  // A press anywhere else closes it (the Pensel button toggles it itself)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Element
      if (!box.current?.contains(t) && !t.closest('.dock-brush')) onClose()
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [onClose])

  return (
    <div ref={box} className="picker" role="dialog" aria-label="Hva penselen tegner">
      <div className="picker-head">
        <span className="picker-title">Pensel</span>
        <span className="picker-sub">Velg hva du vil tegne</span>
        <button type="button" className="picker-close" aria-label="Lukk" title="Lukk (Esc)" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="picker-body">
        <Section title="Vegger">
          <div className="picker-tiles">
            <Tile on={brush?.kind === 'wall'} label="Innervegg" sub={`RAL ${wallRal}`} onClick={() => onPick({ kind: 'wall', ral: wallRal })}>
              <Swatch color={wallPlate?.color} />
            </Tile>
            <Tile on={is({ kind: 'beam' })} label="Innvendig takdrager" onClick={() => onPick({ kind: 'beam' })}>
              <svg viewBox="-1 -1 2 2" width="26" height="26" aria-hidden>
                <path d="M-.8 0 H.8" stroke={INK} strokeWidth=".14" strokeDasharray=".3 .15" />
                <rect x="-.9" y="-.12" width=".24" height=".24" fill={INK} />
              </svg>
            </Tile>
            {openings.map((p) => {
              const b: Brush = { kind: 'opening', product: p.variants[0].artnr }
              return (
                <Tile key={p.id} on={is(b)} label={p.opening === 'door' ? 'Dør' : 'Forheng'} sub="med overstykke" onClick={() => onPick(b)}>
                  {p.opening === 'door' ? <DoorClosed size={18} /> : <Blinds size={18} />}
                </Tile>
              )
            })}
          </div>
          <div className="picker-swatches" role="group" aria-label="Farge på nye innervegger">
            {plates.map((p) => (
              <button
                key={p.ral}
                type="button"
                className="picker-sw"
                aria-pressed={brush?.kind === 'wall' && brush.ral === p.ral}
                title={`Innervegg ${p.name} · RAL ${p.ral}`}
                style={{ background: p.color }}
                onClick={() => onPick({ kind: 'wall', ral: p.ral! })}
              />
            ))}
          </div>
        </Section>

        <Section title="Gulv">
          {floors.map((p) => (
            <div key={p.id} className="picker-line">
              <span className="picker-name">{p.name}</span>
              <div className="picker-swatches">
                {p.variants.map((x) => {
                  const b: Brush = { kind: 'floor', product: x.artnr }
                  return <button key={x.artnr} type="button" className="picker-sw" aria-pressed={is(b)} title={`${p.name} ${x.name.toLowerCase()} · ${x.artnr}`} style={{ background: x.color }} onClick={() => onPick(b)} />
                })}
              </div>
            </div>
          ))}
        </Section>

        <Section title="Profilering">
          <div className="picker-tiles">
            <Tile on={brush?.kind === 'textile'} label="Tekstilvegg" sub="på vegg eller frittstående" onClick={() => onPick({ kind: 'textile' })}>
              <i className="tex-thumb" />
            </Tile>
          </div>
          <div className="picker-motifs">
            {motifs.map((m) => {
              const b: Brush = { kind: 'motif', motif: m.id }
              return (
                <button key={m.id} type="button" className="picker-motif" aria-pressed={is(b)} title={`Motiv: ${m.name}`} onClick={() => onPick(b)}>
                  <img src={m.src} alt={m.name} draggable={false} />
                </button>
              )
            })}
          </div>
        </Section>

        {objectGroups.map((g) => (
          <Section key={g} title={PRODUCT_GROUPS.find((x) => x.id === g)?.name ?? g}>
            <div className="picker-tiles">
              {objects
                .filter((p) => mainGroupOf(p.group) === g)
                .flatMap((p) =>
                  p.variants.map((x) => {
                    const b: Brush = { kind: 'object', product: x.artnr }
                    return (
                      <Tile key={x.artnr} on={is(b)} label={p.variants.length > 1 ? `${p.name} ${x.name.toLowerCase()}` : p.name} onClick={() => onPick(b)}>
                        <ObjectThumb product={p} color={x.color} />
                      </Tile>
                    )
                  }),
                )}
            </div>
          </Section>
        ))}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="picker-sec">
      <div className="eyebrow">{title}</div>
      {children}
    </section>
  )
}

function Tile({ on, label, sub, onClick, children }: { on: boolean; label: string; sub?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="picker-tile" aria-pressed={on} onClick={onClick} title={sub ? `${label} · ${sub}` : label}>
      <span className="picker-thumb">{children}</span>
      <span className="picker-label">{label}</span>
    </button>
  )
}
