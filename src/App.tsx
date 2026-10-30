import { useMemo } from 'react'
import { DEFAULT_CATALOG } from './catalog/defaultCatalog'
import { calc } from './calc/calc'
import { r1, r2, r3 } from './calc/referenceStands'
import { RULES } from './rules/rules'

const STANDS = [
  { name: 'R1 · Rekkestand 3 × 3 m', make: r1 },
  { name: 'R2 · Hjørnestand 6 × 4 m, bakrom og tekstilvegg', make: r2 },
  { name: 'R3 · Øystand 8 × 6 m', make: r3 },
]

const nb = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 })

// Temporary page until the sketch UI exists: shows the calc for the reference stands.
export default function App() {
  const results = useMemo(() => STANDS.map((s) => ({ ...s, res: calc(s.make(), RULES, DEFAULT_CATALOG) })), [])
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ font: '700 22px system-ui', letterSpacing: '-.02em', margin: 0 }}>Expo Planner · Standskisse</h1>
      <p style={{ color: 'var(--ink-muted)' }}>Under bygging. Kalkylen for referansestandene, med eksempelpriser eks. mva.</p>
      {results.map(({ name, res }) => (
        <section key={name} style={{ background: 'var(--panel)', borderRadius: 12, padding: 16, marginTop: 16 }}>
          <h2 style={{ font: '700 14px system-ui', margin: '0 0 8px' }}>{name}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {res.groups.flatMap((g) =>
                g.lines.map((l) => (
                  <tr key={g.id + l.artnr + l.name} style={{ borderTop: '1px solid var(--g-row)' }}>
                    <td style={{ padding: '4px 0' }}>{l.name}{l.preliminary ? ' †' : ''}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{nb(l.qty)} {l.unit}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{nb(l.sum)}</td>
                  </tr>
                )),
              )}
              <tr style={{ borderTop: '1px solid var(--g-row)', fontWeight: 700 }}>
                <td style={{ padding: '4px 0' }}>Sum eks. mva.</td>
                <td />
                <td className="num" style={{ textAlign: 'right' }}>{nb(res.sum)} kr</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}
    </main>
  )
}
