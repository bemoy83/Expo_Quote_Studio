// Kostgrunnlag: which numbers the cost engine runs on, and loading a file with the real ones. The file stays in this
// browser (it holds purchase prices, which are never published). docs/kostmodell.md.
import { Download, RotateCcw, Upload } from 'lucide-react'
import { useRef } from 'react'
import { basisLabel, basisTemplate, parseBasis, serializeBasis, usesExample } from '../../cost/basis'
import { Button } from '../controls'
import { download } from '../download'
import { costBasis, pricing, setCostBasis } from '../env'
import type { ToastMsg } from '../useToast'

/** "parametere.owned.interest" → "owned.interest"; a whole part by its name. */
const missingName = (path: string) => (path === 'parametere' ? 'alle parametere' : path.replace(/^parametere\./, ''))

export function CostBasisCard({ onToast }: { onToast: (t: ToastMsg | string) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const b = costBasis
  const example = b.version === 'eksempel'
  const partly = !example && usesExample(b)

  const change = (next: typeof b | null, text: string) => {
    const before = example ? null : b
    const kept = setCostBasis(next)
    onToast({ text: kept ? text : `${text} · nettleseren lagret det ikke, så det gjelder til siden lastes på nytt`, action: 'Angre', onAction: () => setCostBasis(before) })
  }
  const load = async (f: File) => {
    const r = parseBasis(await f.text())
    if (!r.ok) return onToast(r.error)
    change(r.basis, `Kostgrunnlag ${basisLabel(r.basis)} lastet inn`)
  }

  return (
    <section className="basis-card" aria-label="Kostgrunnlag">
      <div className="basis-text">
        <span className="basis-title">
          Kostgrunnlag
          {example || partly ? <i className="ph-dot" /> : null}
          <span className="num">
            {basisLabel(b)} · {pricing.code}
          </span>
        </span>
        <span className="page-intro">
          {example
            ? 'Kostmotoren regner med eksempeltall og oppdiktede innpriser. Last inn kostgrunnlaget for å regne med ekte tall; filen blir bare i denne nettleseren.'
            : partly
              ? `Fra ${b.source || 'fil'}. Eksempeltall for det filen mangler: ${b.fromExample.map(missingName).join(', ')}.`
              : `Fra ${b.source || 'fil'}. Ligger bare i denne nettleseren.`}
        </span>
      </div>
      <Button icon={Upload} onClick={() => file.current?.click()}>
        Last inn
      </Button>
      <Button
        icon={Download}
        onClick={() =>
          example
            ? download(basisTemplate(), 'application/json', 'kostgrunnlag-mal.json')
            : download(serializeBasis(b), 'application/json', `kostgrunnlag-${b.version.replace(/\s+/g, '-')}-${pricing.code}.json`)
        }
      >
        {example ? 'Last ned mal' : 'Last ned'}
      </Button>
      {!example && (
        <Button icon={RotateCcw} onClick={() => change(null, 'Tilbake til eksempeltall')}>
          Eksempeltall
        </Button>
      )}
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void load(f)
        }}
      />
    </section>
  )
}
