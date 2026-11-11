// No circular imports between source files. A cycle works as long as only functions cross it, and breaks the day one of
// the files computes a constant from the other at load time, so this keeps the graph a tree of layers. Type-only
// imports (`import type`) are left out: they vanish at build time and cannot break anything.
import { describe, expect, it } from 'vitest';

const SRC = import.meta.glob<string>(['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
/** Source files by path under src/ (`calc/beams/beams.ts`). */
const files = new Map(Object.entries(SRC).map(([k, text]) => [k.replace(/^\.\.\//, ''), text]));

/** Normalised path of `spec` imported from `from`, or null when it is a package. */
function resolve(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const parts = from.split('/').slice(0, -1);
  for (const p of spec.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  }
  const base = parts.join('/');
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((f) => files.has(f)) ?? null;
}

/** The files a file imports at run time. */
export function runtimeImports(file: string, text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/^(?:import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
    if (m[1]) continue;
    const to = resolve(file, m[2]);
    if (to) out.push(to);
  }
  return out;
}

/** Every import cycle, each as the files around it. */
export function cycles(graph: Map<string, string[]>): string[][] {
  const found: string[][] = [];
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const visit = (f: string) => {
    state.set(f, 'open');
    stack.push(f);
    for (const to of graph.get(f) ?? []) {
      if (state.get(to) === 'open') found.push([...stack.slice(stack.indexOf(to)), to]);
      else if (!state.has(to)) visit(to);
    }
    stack.pop();
    state.set(f, 'done');
  };
  for (const f of [...graph.keys()].sort()) if (!state.has(f)) visit(f);
  return found;
}

describe('imports', () => {
  const graph = new Map([...files].map(([f, text]) => [f, runtimeImports(f, text)]));

  it('reads the imports of the source files', () => {
    expect(graph.get('calc/beams/beams.ts')).toContain('calc/beams/beamSegments.ts');
    expect(graph.get('domain/walls.ts')).toContain('domain/roomKeys.ts');
  });

  it('finds a cycle when there is one', () => {
    expect(cycles(new Map([['a', ['b']], ['b', ['c']], ['c', ['a']]]))).toEqual([['a', 'b', 'c', 'a']]);
  });

  it('keeps the cost engine free of the price model: pricing/ reads cost/, never the other way', () => {
    const wrong = [...graph].flatMap(([f, to]) => (f.startsWith('cost/') ? to.filter((t) => t.startsWith('pricing/')).map((t) => `${f} → ${t}`) : []));
    expect(wrong).toEqual([]);
  });

  it('has no circular imports', () => {
    expect(cycles(graph).map((c) => c.join(' → '))).toEqual([]);
  });
});
