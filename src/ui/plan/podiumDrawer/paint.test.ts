// The counter drawer's paint tools, as the wall drawer's (Bjørn 18.11.2026).
import { describe, expect, it } from 'vitest';
import { printOf, setPodiumPrint, takesDecor } from '../../../domain/podiumDecor';
import { partKey, podiumParts } from '../../../domain/podiumFaces';
import { stockSections } from '../../../domain/podiumStock';
import type { PlacedObject, Variant } from '../../../domain/types';
import { createVariant } from '../../../domain/variant';
import { PRINT } from '../drawerParts';
import type { PaintTool } from '../paintTools';
import { counterPaintAt } from './paint';
import { drawerSides, sideElevation } from './podiumView';

const counter: PlacedObject = { id: 'c1', product: '6571', x: 2, y: 1.5, rot: 0, sections: stockSections() };
const start = (): Variant => ({ ...createVariant('A', { width: 4, depth: 3, type: 'row' }), objects: [counter] });
const logo = { id: 'logo', name: 'Logo', ratio: 1 } as never;

/** A stroke with `tool` laying `paint` on part i, light 0 of the front, and what came of it. */
function stroke(v: Variant, tool: PaintTool, paint: string, i = 0, first = true) {
  const o = v.objects[0];
  const side = sideElevation(o, drawerSides(o)[0].side).parts;
  let out = v;
  const toasts: string[] = [];
  counterPaintAt({ v, o, side, tool, paint, pm: logo, onEdit: (fn) => (out = fn(out)), onCheckpoint: () => {}, onToast: (t) => toasts.push(t) })(i, 0, first);
  return { v: out, toasts, side: sideElevation(out.objects[0], drawerSides(out.objects[0])[0].side).parts };
}

describe('the counter drawer: bucket and brush', () => {
  it('the brush colours one plate; again with the same colour gives the counter its colour back', () => {
    const a = stroke(start(), 'brush', '3020');
    expect(a.side[0].rals[0]).toBe('3020');
    expect(stroke(a.v, 'brush', '3020').v.objects[0]).toEqual(counter);
  });

  it('the bucket colours the side shown and leaves a printed part as it is, saying so', () => {
    const o = start().objects[0];
    const front = sideElevation(o, drawerSides(o)[0].side).parts.find((p) => takesDecor(o.sections!, p.part))!;
    const v = setPodiumPrint(start(), 'c1', [front.key], 'logo');
    const r = stroke(v, 'bucket', '3020');
    expect(r.toasts).toEqual(['1 del med print står som før']);
    expect(printOf(r.v.objects[0].sections!, front.part)).toBe('logo');
  });

  it('the print brush prints a part, the same motif again does nothing', () => {
    const a = stroke(start(), 'brush', PRINT);
    const key = partKey(podiumParts(a.v.objects[0].sections!).find((p) => printOf(a.v.objects[0].sections!, p))!);
    expect(key).toBeTruthy();
    expect(stroke(a.v, 'brush', PRINT, 0, false).v).toBe(a.v);
  });
});
