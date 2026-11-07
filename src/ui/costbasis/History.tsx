// Historikk: the versions saved in this browser, newest first, with old and new value for each number changed.
// cost/history.ts, ui/env.ts. docs/kostmodell.md.
import { Download, History as HistoryIcon, RotateCcw } from 'lucide-react'
import type { HistoryEntry } from '../../cost/history'
import { Button } from '../controls'
import { download } from '../download'
import { costBasis, revertBasis } from '../env'
import type { ToastMsg } from '../useToast'
import { today, valueText } from './text'

/** The saved versions, newest first, with what changed in each; back to the one before the newest. */
export function History({ entries, onToast }: { entries: readonly HistoryEntry[]; onToast: (t: ToastMsg | string) => void }) {
  const canRevert = entries.length > 0 && entries[0].version === costBasis.version
  return (
    <>
      <div className="cat-tools">
        <Button
          icon={RotateCcw}
          disabled={!canRevert}
          onClick={() => {
            const err = revertBasis(new Date().toISOString())
            onToast(err ?? `Tilbake til ${entries[0].from}`)
          }}
        >
          Tilbake til forrige versjon{canRevert ? ` (${entries[0].from})` : ''}
        </Button>
        <Button icon={Download} disabled={!entries.length} onClick={() => download(JSON.stringify(entries, null, 2), 'application/json', `kostgrunnlag-historikk-${today()}.json`)}>
          Last ned historikk
        </Button>
      </div>
      {!entries.length && (
        <div className="tbl-empty">
          <HistoryIcon size={14} /> Ingen versjoner lagret her ennå. Trykk på et tall for å endre det; endringene lagres samlet som en ny versjon.
        </div>
      )}
      {entries.map((e) => (
        <section key={e.at + e.version} className="tbl-sec">
          <div className="tbl-sec-head">
            {e.version}
            <span className="num">
              fra {e.from} · {e.at.slice(0, 10)} {e.at.slice(11, 16)}
            </span>
          </div>
          {e.comment && <p className="page-intro kg-comment-text">{e.comment}</p>}
          {e.changes.map((c) => (
            <div key={c.path} className="kg-grid kg-row tbl-row">
              <span className="n">{c.label}</span>
              <span className="r num">
                <s className="faint">{valueText({ value: c.old, unit: c.unit })}</s> {valueText({ value: c.new, unit: c.unit })}
              </span>
              <span className="kg-status">{c.note?.status ?? 'Bjørn'}</span>
              <span className="kg-src">{c.note?.kilde ?? c.path}</span>
            </div>
          ))}
        </section>
      ))}
    </>
  )
}
