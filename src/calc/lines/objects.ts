// Placed objects and counted items (Arbeidstimer too: hours counted in the panel), in catalog order, then the loose
// lines typed in the panel.
import { countBy, type CalcContext } from '../context';
import type { CalcLine } from '../types';

export function objectLines(c: CalcContext): CalcLine[] {
  const { v } = c;
  const objectCounts = countBy(v.objects.map((o) => o.product));
  for (const x of v.counted) objectCounts.set(x.product, (objectCounts.get(x.product) ?? 0) + x.qty);
  return [...objectCounts].map(([a, n]) => c.line(a, n));
}

export function looseLines(c: CalcContext): CalcLine[] {
  return c.v.loose.map((l): CalcLine => ({
    name: l.name,
    qty: l.qty,
    unit: 'stk',
    price: l.price,
    sum: l.qty * l.price,
    artnr: '',
    placeholder: false,
    group: 'tjen.lose',
    meta: l.price ? undefined : 'pris settes i tilbudet',
    cost: null,
    dg: null,
    strategy: 'fast',
    transfer: null,
    time: {},
    payer: 'utstiller',
  }));
}
