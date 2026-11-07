import { describe, expect, it } from 'vitest';
import { EXAMPLE_BASIS as B, serializeBasis } from './basis';
import { basisFields, withValues } from './fields';
import { entryFor, HISTORY_MAX, nextVersion, parseNumber, readHistory, readPastedList, withEntry } from './history';

describe('kostgrunnlag history', () => {
  it('names the next version by letter, in the month it is made', () => {
    expect(nextVersion('2026-11 A', '2026-11-07')).toBe('2026-11 B');
    expect(nextVersion('2026-11 Z', '2026-11-07')).toBe('2026-11 AA');
    expect(nextVersion('2026-11 B', '2026-12-01')).toBe('2026-12 A');
    expect(nextVersion('eksempel', '2026-11-07')).toBe('2026-11 A');
    expect(nextVersion('eksempel', '2026-11-07', ['2026-11 A'])).toBe('2026-11 B');
  });

  it('reads numbers as typed', () => {
    expect(parseNumber('1 234,5')).toBe(1234.5);
    expect(parseNumber('12,5 %')).toBe(12.5);
    expect(parseNumber('391 kr')).toBe(391);
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('')).toBeNull();
  });

  it('reads a pasted price list by art.nr, with or without spaces, and names what it does not know', () => {
    const fields = basisFields(B);
    const foga = fields.find((f) => f.list?.supplier.startsWith('Foga'))!;
    const r = readPastedList(`Varenr\tNavn\tPris\n${foga.list!.artnr.replace(/\s/g, '')}\tProfil\t123,50\n999 999 99\tUkjent\t10\n`, fields, foga.list!.supplier);
    expect(r.lines).toBe(2);
    expect(r.changes).toEqual([{ field: foga, value: 123.5 }]);
    expect(r.unknown).toEqual(['999 999 99']);
  });

  it('an edit saved as a new version makes the number the owner’s and keeps the rest', () => {
    const f = basisFields(B).find((x) => x.path === 'parametere.owned.interest')!;
    const r = withValues(B, [{ field: f, value: 0.07, note: { status: 'Bjørn', kilde: 'Bank', dato: '2026-11-07' } }], { version: '2026-11 A', date: '2026-11-07', source: 'Bjørn' });
    if (!r.ok) throw new Error(r.error);
    expect(r.basis.params.owned.interest).toBe(0.07);
    expect(r.basis.version).toBe('2026-11 A');
    const after = basisFields(r.basis).find((x) => x.path === f.path)!;
    expect(after).toMatchObject({ own: true, status: 'Bjørn', source: 'Bank', value: 0.07 });
    expect(basisFields(r.basis).filter((x) => x.own).map((x) => x.path)).toEqual([f.path]);
    const e = entryFor(B, null, '2026-11 A', 'Ny rente', [{ field: f, value: 0.07 }], '2026-11-07T10:00:00Z');
    expect(e.changes).toEqual([{ path: f.path, label: f.label, unit: '%', old: f.value, new: 0.07 }]);
  });

  it('keeps the newest entries and reads back only whole ones', () => {
    const e = entryFor(B, serializeBasis(B), '2026-11 A', '', [], 'x');
    let h = [] as ReturnType<typeof withEntry>;
    for (let i = 0; i < HISTORY_MAX + 5; i++) h = withEntry(h, { ...e, version: String(i) });
    expect(h).toHaveLength(HISTORY_MAX);
    expect(h[0].version).toBe(String(HISTORY_MAX + 4));
    expect(readHistory([e, { at: 1 }, null])).toEqual([e]);
    expect(readHistory('nei')).toEqual([]);
  });
});
