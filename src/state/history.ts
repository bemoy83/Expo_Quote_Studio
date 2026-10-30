// Sketch state with undo and redo at model level (snapshots). Pure reducer, no React.
import type { Project, Variant, VariantName } from '../domain/types';
import type { Sketch } from '../persistence/file';

export interface SketchState {
  sketch: Sketch;
  /** Index of the variant being edited. */
  current: number;
  past: Snapshot[];
  future: Snapshot[];
}

type Snapshot = Pick<SketchState, 'sketch' | 'current'>;

const LIMIT = 100;
export const NAMES: VariantName[] = ['A', 'B', 'C', 'D'];

export type SketchAction =
  /** Change the current variant. `history: false` skips the undo step (used while dragging after a checkpoint). */
  | { type: 'edit'; fn: (v: Variant) => Variant; history?: boolean }
  | { type: 'checkpoint' }
  | { type: 'project'; project: Project }
  | { type: 'select'; index: number }
  | { type: 'duplicate' }
  | { type: 'remove'; index: number }
  | { type: 'undo' }
  | { type: 'redo' }
  /** Replace everything (open file). Undoable. */
  | { type: 'load'; sketch: Sketch };

export function initState(sketch: Sketch): SketchState {
  return { sketch, current: 0, past: [], future: [] };
}

const snap = (s: SketchState): Snapshot => ({ sketch: s.sketch, current: s.current });

function commit(s: SketchState, next: Snapshot, history = true): SketchState {
  if (next.sketch === s.sketch && next.current === s.current) return s;
  return {
    ...next,
    past: history ? [...s.past, snap(s)].slice(-LIMIT) : s.past,
    future: history ? [] : s.future,
  };
}

export function reduce(s: SketchState, a: SketchAction): SketchState {
  const { sketch, current } = s;
  switch (a.type) {
    case 'edit': {
      const v = sketch.variants[current];
      const nv = a.fn(v);
      if (nv === v) return s;
      const variants = sketch.variants.map((x, i) => (i === current ? nv : x));
      return commit(s, { sketch: { ...sketch, variants }, current }, a.history !== false);
    }
    case 'checkpoint':
      return { ...s, past: [...s.past, snap(s)].slice(-LIMIT), future: [] };
    case 'project':
      return commit(s, { sketch: { ...sketch, project: a.project }, current });
    case 'select':
      return a.index === current ? s : { ...s, current: a.index };
    case 'duplicate': {
      if (sketch.variants.length >= NAMES.length) return s;
      const used = new Set(sketch.variants.map((v) => v.name));
      const name = NAMES.find((n) => !used.has(n))!;
      const copy = { ...structuredClone(sketch.variants[current]), name };
      const variants = [...sketch.variants, copy];
      return commit(s, { sketch: { ...sketch, variants }, current: variants.length - 1 });
    }
    case 'remove': {
      if (sketch.variants.length <= 1) return s;
      const variants = sketch.variants.filter((_, i) => i !== a.index);
      return commit(s, { sketch: { ...sketch, variants }, current: Math.min(current, variants.length - 1) });
    }
    case 'undo': {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return { ...prev, past: s.past.slice(0, -1), future: [snap(s), ...s.future] };
    }
    case 'redo': {
      const next = s.future[0];
      if (!next) return s;
      return { ...next, past: [...s.past, snap(s)], future: s.future.slice(1) };
    }
    case 'load':
      return commit(s, { sketch: a.sketch, current: 0 });
  }
}
