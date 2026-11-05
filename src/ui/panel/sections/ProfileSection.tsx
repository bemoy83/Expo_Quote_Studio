// Panel tab Profilering: textile walls (on a system wall or free-standing, one brush) and the motif library.
import { Paintbrush, Upload } from 'lucide-react'
import { useRef } from 'react'
import { wallLabel } from '../../../calc/production'
import { textileBox } from '../../../domain/textile/inFrame'
import { Button, IconButton, ImageInput } from '../../controls'
import { decorSource } from '../../dnd'
import { catalog, productOf, rules } from '../../env'
import { count, fmt, kr } from '../../format'
import { findMotif, SAMPLE_MOTIFS } from '../../motifs'
import { penOn } from '../../tools'
import { ProductRow } from '../ProductRow'
import type { RailProps } from '../Rail'

const FILL_SHORT = { print: 'trykk', white: 'hvit', reuse: 'kundens' } as const

/** Profilering: textile walls (on a system wall or free-standing, one brush) and the motif library. Counted profiling items follow below. */
export function ProfileSection({ v, res, brush, tool, pick, motifs, onUpload, onSelect }: RailProps) {
  const file = useRef<HTMLInputElement>(null)
  const pen = penOn(tool, brush, 'textile')
  const textile = productOf(catalog.system.textile)?.variants[0]
  const freeFrame = productOf(catalog.system.freeTextile)?.variants[0]
  const k = res.keyFigures
  return (
    <>
      <div className="panel-sec eyebrow">Tekstilvegg</div>
      <ProductRow
        on={v.textiles.length + v.freeTextiles.length > 0}
        pen={pen}
        thumb={<i className="tex-thumb" />}
        drag={decorSource({ kind: 'textile' })}
        title="Tekstilvegg"
        meta={
          <>
            Tegnet på en systemvegg monteres den på veggen, ellers står den fritt på fotplater med tekstil på begge sider · leie av ramme{' '}
            <span className="num">{kr(textile?.price ?? 0)} kr/m²</span> på vegg, <span className="num">{kr(freeFrame?.price ?? 0)} kr/lm</span> frittstående + tekstil per m²
          </>
        }
        result={
          [
            v.textiles.length ? `${v.textiles.length} på vegg · ${fmt(k.textileM2)} m²` : '',
            res.production.free.length ? `${res.production.free.length} frittstående · ${fmt(res.production.freeLm, 2)} lm` : '',
          ]
            .filter(Boolean)
            .join(' · ') || null
        }
        action={<IconButton icon={Paintbrush} label="Tegn tekstilvegg i plan" pressed={pen && tool === 'brush'} onClick={() => pick({ kind: 'textile' })} />}
      />
      {v.textiles.map((t) => {
        const w = v.walls.find((x) => x.id === t.wallId)
        if (!w) return null
        const m = findMotif(motifs, t.motif)?.name
        return (
          <button key={t.id} type="button" className="trow" onClick={() => onSelect({ wallId: w.id, side: t.side, textileId: t.id })}>
            <span className="name">
              {wallLabel(w)}
              {t.fill === 'reuse' ? <span className="faint"> · kundens duk</span> : t.fill === 'white' ? <span className="faint"> · hvit</span> : m ? <span className="faint"> · {m}</span> : <span className="warn"> · uten motiv</span>}
            </span>
            <span className="num">
              {fmt(t.width)} × {fmt(textileBox(t, rules).height, 2)} m
            </span>
          </button>
        )
      })}
      {res.production.free.map((f) => (
        <button key={f.textileId} type="button" className="trow" onClick={() => onSelect({ freeTextileId: f.textileId, freeFace: 'a' })}>
          <span className="name">
            {f.pos} frittstående
            <span className="faint"> · {f.faces.map((x) => `${x.face.toUpperCase()} ${FILL_SHORT[x.fill]}`).join(', ')}</span>
          </span>
          <span className="num">{fmt(f.length / 1000, 2)} m</span>
        </button>
      ))}

      <div className="panel-sec eyebrow gfx-head">
        <span>Grafikk · {motifs.length}</span>
        <Button icon={Upload} onClick={() => file.current?.click()}>
          Last opp
        </Button>
      </div>
      <ImageInput ref={file} onFile={onUpload} />
      <div className="gfx-grid">
        {motifs.map((m) => {
          const on = penOn(tool, brush, 'motif', m.id)
          return (
            <button
              key={m.id}
              type="button"
              className={on ? 'gfx on' : 'gfx'}
              aria-pressed={on}
              onClick={() => pick({ kind: 'motif', motif: m.id })}
              {...decorSource({ kind: 'motif', motif: m.id })}
            >
              <span className="art">
                <img src={m.src} alt="" draggable={false} />
              </span>
              <span className="lbl">
                {m.name}
                {!SAMPLE_MOTIFS.includes(m) && <span className="faint"> · eget</span>}
              </span>
            </button>
          )
        })}
      </div>
      <p className="panel-note">
        Velg et motiv og klikk på en tekstilvegg for trykk, eller på et veggfelt for foliedekor. Du kan også dra motivet rett til veggen i plan eller 3D. Folie går aldri over en stolpe. Velg veggen for å justere størrelse og plassering.
      </p>
      {v.foils.length > 0 && (
        <p className="panel-note num">
          {count(v.foils.length, 'foliedekor', 'foliedekorer')} · {fmt(k.foilM2)} m²
        </p>
      )}
    </>
  )
}
