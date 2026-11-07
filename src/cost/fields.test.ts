import { describe, expect, it } from 'vitest';
import { EXAMPLE_BASIS as B, parseBasis, serializeBasis } from './basis';
import { basisFields, fieldsAt, withValues } from './fields';
import { DEFAULT_COST_PARAMS } from './params';
import { DEFAULT_PRICING, pricingFrom } from '../pricing/data';

const leaves = (o: unknown, at: string): string[] =>
  typeof o === 'object' && o !== null ? Object.entries(o).flatMap(([k, v]) => leaves(v, `${at}.${k}`)) : [at];

describe('kostgrunnlag fields', () => {
  const fields = basisFields(B);
  const paths = new Set(fields.map((f) => f.path));

  it('every parameter the engine has is a field: no number off the page', () => {
    for (const p of leaves(DEFAULT_COST_PARAMS, 'parametere')) expect(paths, p).toContain(p);
    for (const [id, t] of Object.entries(B.times)) for (const s of Object.keys(t)) expect(paths, id).toContain(`tider.${id}.${s}`);
    for (const o of B.orderCosts) expect(fields.some((f) => f.path.startsWith(`ordrekost.${o.id}.`)), o.id).toBe(true);
    expect(fields.some((f) => f.path.startsWith('katalog.kost.'))).toBe(true);
  });

  it('every path «Slik er det regnet» names is on the page', () => {
    for (const it of DEFAULT_PRICING.items.values())
      for (const r of it.trace!.rows) for (const from of r.from) expect(fieldsAt(fields, from).length, `${it.id}: ${from}`).toBeGreaterThan(0);
  });

  it('the example is example numbers, with the status from params.ts', () => {
    expect(fields.every((f) => !f.own)).toBe(true);
    expect(fields.find((f) => f.path === 'parametere.labour.baseRate')).toMatchObject({ status: 'Bjørn', value: 391.4 });
    expect(fields.find((f) => f.path === 'parametere.owned.groups.profile.usesPerYear')).toMatchObject({ status: 'kalibrert' });
    expect(fields.find((f) => f.path === 'parametere.cut.waste')).toMatchObject({ unused: true, rule: 2 });
    expect(fields.find((f) => f.path === 'tider.stolpe-94.plukk')).toMatchObject({ status: 'kalibrert', value: 0.34 });
  });

  it('a new value takes the road of a loaded file: own, noted, and the calc follows', () => {
    const name = { version: '2026-11 B', date: '2026-11-08', source: 'Bjørn' };
    const at = (path: string) => fields.find((f) => f.path === path)!;
    const r = withValues(
      B,
      [
        { field: at('parametere.indirect'), value: 0.12, note: { status: 'Bjørn', kilde: 'Regnskap 2026', dato: '2026-11-08' } },
        { field: at('tider.stolpe-94.plukk'), value: 0.5 },
        { field: at('prisliste Egne innkjøp (eksempelpriser) TRYKK-BLACKBACK'), value: 224 },
        { field: at('oppskrifter.stolpe-94.parts.0'), value: 2.5 },
        { field: at('katalog.kost.mob.'), value: 0.5 },
        { field: at('ordrekost.administrasjon.personMinutes'), value: 30 },
      ],
      name,
    );
    if (!r.ok) throw new Error(r.error);
    const b = r.basis;
    expect(b.version).toBe('2026-11 B');
    expect(b.params.indirect).toBe(0.12);
    expect(b.times['stolpe-94']).toEqual({ plukk: 0.5, vask: 0.34, transport: 0.34 });
    expect(b.recipes['stolpe-94'].parts![0]).toEqual(['94', 2.5]);
    expect(b.catalog.cost['mob.']).toBe(0.5);
    expect(b.orderCosts.find((o) => o.id === 'administrasjon')!.personMinutes).toBe(30);
    const after = basisFields(b);
    const f = (path: string) => after.find((x) => x.path === path)!;
    expect(f('parametere.indirect')).toMatchObject({ own: true, status: 'Bjørn', source: 'Regnskap 2026' });
    expect(f('parametere.owned.interest').own).toBe(false);
    expect(f('tider.stolpe-94.vask').own).toBe(true);
    expect(f('tider.veggplate.vask').own).toBe(false);
    expect(pricingFrom(b).code).not.toBe(DEFAULT_PRICING.code);
    // Stored and read again, the same
    const again = parseBasis(serializeBasis(b));
    expect(again.ok && again.basis).toEqual(b);
  });
});
