// Byggeregel X1, X18: the edits of a textile wall, one set whatever it stands on. A textile wall is one run with faces A
// and B (X1); what differs on a wall is only checked there (the span it may take, X2, X4), on foot plates only there
// (the volume of the feet, F2). Callers do not ask how it is mounted. Pure.
import type { Rules } from '../../rules/rules';
import type { FreeTextile, TextileFace, Variant } from '../types';
import { resizeFreeTextile, runLength, type FaceKey } from './free';
import { fullTextileHeight, textileBox, updateTextile } from './inFrame';
import { mountedOn, outFace, wallTextiles } from './mounts';

const EPS = 1e-6;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Take textile wall `id` away. */
export function removeTextile(v: Variant, id: string): Variant {
  return { ...v, textiles: v.textiles.filter((t) => t.id !== id) };
}

/** Byggeregel X18 (43TX always has two faces; where it stands decides which are seen): the faces of textile wall `id` that are
 *  seen, A and B on foot plates, only the one out from the wall when it is mounted. */
export function seenFaces(v: Variant, id: string): FaceKey[] {
  const t = v.textiles.find((x) => x.id === id);
  const on = mountedOn(v, id);
  if (!t) return [];
  return on ? [outFace(t, on.wall, on.side)] : ['a', 'b'];
}

/** Change one face: print, white or the customer's own textile, and the motif shown. The motif is kept when the face
 *  turns white or the customer's, so it comes back with print (Byggeregel V15, Bjørn 18.11.2026, as on a textile in a wall). */
export function updateFace(v: Variant, id: string, face: FaceKey, patch: { fill?: TextileFace['fill']; motif?: string | null }): Variant {
  return {
    ...v,
    textiles: v.textiles.map((t) => {
      if (t.id !== id) return t;
      const f: TextileFace = { ...t[face] };
      if (patch.fill !== undefined) {
        if (patch.fill === 'print') delete f.fill;
        else f.fill = patch.fill;
      }
      if (patch.motif === null) delete f.motif;
      else if (patch.motif !== undefined) f.motif = patch.motif;
      // A motif picked is a print
      if (patch.motif) delete f.fill;
      const out: FreeTextile = { ...t, [face]: f };
      if (!Object.keys(f).length) delete out[face];
      return out;
    }),
  };
}

/** Byggeregel X18: the frame's length, m, the same for every textile wall: from frame end to frame end (or corner). */
export function frameLength(v: Variant, id: string): number {
  const t = v.textiles.find((x) => x.id === id);
  return t ? runLength(t) : 0;
}

/** Byggeregel X18: textile wall `id` made `length` m long. On a wall it grows or shrinks in its span (X2, X4); on foot plates from
 *  its from end (F2). Null when it does not fit. */
export function resizeTextile(v: Variant, rules: Rules, id: string, length: number): Variant | null {
  if (!mountedOn(v, id)) return resizeFreeTextile(v, rules, id, length);
  const view = wallTextiles(v).find((x) => x.id === id);
  if (!view) return null;
  // The span is longer than the frame by the side deduction and air, or out to a 92LTX corner (X2, X7)
  const next = updateTextile(v, rules, id, { width: view.width + length - frameLength(v, id) });
  return next === v ? null : next;
}

/** Byggeregel X14, X18: textile wall `id` `height` m tall, and on a wall `bottom` m up from the floor. The same limits
 *  whatever it stands on (X14, X17); on foot plates it always stands on the floor. */
export function setTextileSize(v: Variant, rules: Rules, id: string, patch: { height?: number; bottom?: number }): Variant {
  if (mountedOn(v, id)) return updateTextile(v, rules, id, patch);
  const full = fullTextileHeight(rules);
  return {
    ...v,
    textiles: v.textiles.map((t) => {
      if (t.id !== id || patch.height === undefined) return t;
      const height = r3(Math.min(rules.textile.maxHeight, Math.max(rules.textile.minHeight, patch.height)));
      const { height: _h, bottom: _b, ...rest } = t;
      return Math.abs(height - full) > EPS ? { ...rest, height } : rest;
    }),
  };
}

/** Height and bottom of textile wall `id`, m, whatever it stands on. */
export function textileSize(v: Variant, rules: Rules, id: string): { bottom: number; height: number } {
  const view = wallTextiles(v).find((x) => x.id === id);
  if (view) return textileBox(view, rules);
  const t = v.textiles.find((x) => x.id === id);
  return { bottom: 0, height: t?.height ?? fullTextileHeight(rules) };
}
