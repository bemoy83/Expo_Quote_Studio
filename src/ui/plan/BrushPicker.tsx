// «Alle valg» for a drawing tool: a popover over the dock, opened by clicking the active tool again. Same brushes as the
// panel for that tool (Vegg · Gulv · Profilering · Møbel). Picking only sets the tool's pen: a wall colour here is the
// colour new inner walls are drawn with, the stand's wall plate is still set in the panel.
import { Blinds, DoorClosed, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { mainGroupOf, PRODUCT_GROUPS } from '../../catalog/groups'
import type { Motif } from '../../persistence/file'
import { catalog, wallPlates } from '../env'
import { ObjectThumb, Swatch } from '../panel/ProductRow'
import type { Brush, PenTool } from '../tools'
import { BeamIcon } from './QuickPicks'

const HEAD: Record<PenTool, { title: string; sub: string }> = {
  wall: { title: 'Vegg', sub: 'Innervegg, åpning eller takdrager' },
  floor: { title: 'Gulv', sub: 'Gulvtype og farge' },
  profile: { title: 'Profilering', sub: 'Tekstilvegg eller motiv' },
  object: { title: 'Møbel', sub: 'Klikk i planen for å sette ut' },
}

export function BrushPicker({
  tool,
  brush,
  wallRal,
  motifs,
  onPick,
  onClose,
}: {
  tool: PenTool
  brush: Brush | null
  /** Colour the wall pen draws new inner walls with. */
  wallRal: string
  motifs: Motif[]
  onPick: (b: Brush) => void
  onClose: () => void
}) {
  const is = (b: Brush) => JSON.stringify(b) === JSON.stringify(brush)
  const plates = wallPlates()
  const wallPlate = plates.find((p) => p.ral === wallRal)
  const openings = catalog.products.filter((p) => p.opening)
  const floors = catalog.products.filter((p) => mainGroupOf(p.group) === 'gulv' && p.kind === 'surface')
  const objects = catalog.products.filter((p) => p.kind === 'object' && !p.opening)
  const objectGroups = [...new Set(objects.map((p) => mainGroupOf(p.group)))]
  // A press anywhere else closes it (the dock's tool buttons toggle it themselves)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Element
      if (!box.current?.contains(t) && !t.closest('.dock-tools')) onClose()
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [onClose])

  return (
    <div ref={box} className="picker" role="dialog" aria-label={`Alle valg for ${HEAD[tool].title}`}>
      <div className="picker-head">
        <span className="picker-title">{HEAD[tool].title}</span>
        <span className="picker-sub">{HEAD[tool].sub}</span>
        <button type="button" className="picker-close" aria-label="Lukk" title="Lukk (Esc)" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="picker-body">
        {tool === 'wall' && (
        <Section title="Vegger">
          <div className="picker-tiles">
            <Tile on={brush?.kind === 'wall'} label="Innervegg" sub={`RAL ${wallRal}`} onClick={() => onPick({ kind: 'wall', ral: wallRal })}>
              <Swatch color={wallPlate?.color} />
            </Tile>
            <Tile on={is({ kind: 'beam' })} label="Innvendig takdrager" onClick={() => onPick({ kind: 'beam' })}>
              <BeamIcon size={26} />
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
        )}

        {tool === 'floor' && (
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
        )}

        {tool === 'profile' && (
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
        )}

        {tool === 'object' && objectGroups.map((g) => (
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
