import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { validUntil } from './delivery';

const q = RULES.quote;

describe('quote validity', () => {
  it('30 days when montering is far away or unknown', () => {
    expect(validUntil('2026-11-01', undefined, q)).toEqual({ until: '2026-12-01', byMount: false, late: false });
    expect(validUntil('2026-11-01', { montering: '2027-03-01' }, q).until).toBe('2026-12-01');
  });
  it('ends 14 days before montering when that comes first', () => {
    // Montering 1 Dec → 17 Nov
    expect(validUntil('2026-11-01', { montering: '2026-12-01' }, q)).toEqual({ until: '2026-11-17', byMount: true, late: false });
  });
  it('flags a quote sent too close to montering', () => {
    expect(validUntil('2026-11-25', { montering: '2026-12-01' }, q)).toMatchObject({ until: '2026-11-17', late: true });
  });
});
