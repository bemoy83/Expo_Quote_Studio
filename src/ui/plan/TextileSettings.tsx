// The settings of a textile wall in its drawer, one for every textile wall whatever it stands on (Byggeregel X18,
// Bjørn 28.11.2026): the frame's length and height, and the textile on the face shown. «Fra gulv» only on a wall: on
// foot plates it always stands on the floor.
import { frameLength, resizeTextile, setTextileSize, textileSize, updateFace } from '../../domain/textile/edit'
import type { FaceKey } from '../../domain/textile/free'
import { mountedOn } from '../../domain/textile/mounts'
import type { Motif, Variant } from '../../domain/types'
import { Dim, Section } from '../controls'
import { rules } from '../env'
import { FabricSection } from './drawerParts'

export function TextileSettings(p: {
  v: Variant
  id: string
  face: FaceKey
  motifs: Motif[]
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onUpload: (f: File) => void
  onToast: (text: string) => void
}) {
  const { v, id, face } = p
  const t = v.textiles.find((x) => x.id === id)
  if (!t) return null
  const size = textileSize(v, rules, id)
  const onWall = !!mountedOn(v, id)
  const setLength = (n: number) => {
    const next = resizeTextile(v, rules, id, n)
    if (!next) return p.onToast('Tekstilveggen får ikke plass med den lengden')
    p.onEdit(() => next)
  }
  const fill = t[face]?.fill ?? 'print'
  return (
    <>
      <Section title="Mål">
        <div className="wd-dims">
          <Dim big label="Lengde" value={frameLength(v, id)} decimals={2} min={rules.textile.minLength} onChange={setLength} />
          <Dim big label="Høyde" value={size.height} decimals={2} min={rules.textile.minHeight} max={rules.textile.maxHeight} onChange={(n) => p.onEdit((x) => setTextileSize(x, rules, id, { height: n }))} />
          {onWall && <Dim big label="Fra gulv" value={size.bottom} onChange={(n) => p.onEdit((x) => setTextileSize(x, rules, id, { bottom: n }))} />}
        </div>
      </Section>
      <hr className="set-rule" />
      <FabricSection
        value={fill}
        onChange={(f) => p.onEdit((x) => updateFace(x, id, face, { fill: f }))}
        motifs={p.motifs}
        motif={t[face]?.motif}
        onPick={(m) => p.onEdit((x) => updateFace(x, id, face, { motif: m }))}
        onUpload={p.onUpload}
      />
    </>
  )
}
