// Keeps docs/byggeregler.md and the code in step: every rule names code and a test that exist, the code it names cites
// it («Byggeregel T7»), and no code cites a rule that is not in the register.
import { describe, expect, it } from 'vitest';

const DOC = Object.values(import.meta.glob<string>('../../docs/byggeregler.md', { query: '?raw', import: 'default', eager: true }))[0];
const SRC = import.meta.glob<string>(['../**/*.ts', '../**/*.tsx'], { query: '?raw', import: 'default', eager: true });
/** Source files by repo path (src/…). */
const files = new Map(Object.entries(SRC).map(([k, text]) => [`src/${k.replace(/^\.\.\//, '')}`, text]));

interface Rule {
  id: string;
  name: string;
  code: string[];
  tests: string[];
  source: string;
}

function parseRules(doc: string): Rule[] {
  const out: Rule[] = [];
  const re = /^- \*\*([A-Z]\d+) ([^*]+)\*\*([\s\S]*?)(?=^- \*\*|^## |(?![\s\S]))/gm;
  for (const m of doc.matchAll(re)) {
    const meta = m[3].match(/\*([^*]+)\*\s*$/)?.[1] ?? '';
    const paths = (part: string) => [...part.matchAll(/`(src\/[^`]+)`/g)].map((x) => x[1]);
    out.push({
      id: m[1],
      name: m[2].trim(),
      source: meta.split(' · ')[0],
      code: paths(meta.match(/kode (.*?)(?: · test|$)/)?.[1] ?? ''),
      tests: paths(meta.match(/test (.*)$/)?.[1] ?? ''),
    });
  }
  return out;
}

/** Rule ids a text cites: «Byggeregel T7», «byggeregler T8–T12», «Byggeregler S1–S3, S5–S7». */
export function citedIds(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/[Bb]ygge(?:regel|regler) ((?:[A-Z]\d+(?:–[A-Z]\d+)?(?:, | og )?)+)/g)) {
    for (const t of m[1].matchAll(/([A-Z])(\d+)(?:–[A-Z](\d+))?/g)) {
      const from = Number(t[2]);
      const to = t[3] ? Number(t[3]) : from;
      for (let n = from; n <= to; n++) out.push(`${t[1]}${n}`);
    }
  }
  return out;
}

const RULES = parseRules(DOC);
const IDS = new Set(RULES.map((r) => r.id));

describe('docs/byggeregler.md', () => {
  it('has the rules, each id once', () => {
    expect(RULES.length).toBeGreaterThan(40);
    expect(IDS.size).toBe(RULES.length);
  });

  it.each(RULES.map((r) => [r.id, r] as const))('%s names who decided, code and a test that exist', (_id, r) => {
    expect(r.source).toMatch(/^Bjørn \d/);
    expect(r.code.length).toBeGreaterThan(0);
    expect(r.tests.length).toBeGreaterThan(0);
    for (const f of [...r.code, ...r.tests]) expect(files.has(f), f).toBe(true);
  });

  it.each(RULES.map((r) => [r.id, r] as const))('%s is cited by the code it names', (id, r) => {
    expect(r.code.some((f) => citedIds(files.get(f) ?? '').includes(id)), `${id} in ${r.code.join(', ')}`).toBe(true);
  });

  it('the code cites no rule that is not in the register', () => {
    const unknown = [...files].flatMap(([f, text]) => citedIds(text).filter((id) => !IDS.has(id)).map((id) => `${f}: ${id}`));
    expect(unknown).toEqual([]);
  });

  it('reads citations with ranges', () => {
    expect(citedIds('// Byggeregler S1–S3, S5 (docs/byggeregler.md).')).toEqual(['S1', 'S2', 'S3', 'S5']);
    expect(citedIds('byggeregel T7')).toEqual(['T7']);
  });
});
