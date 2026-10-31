// Delivery dates and how long a quote holds (Bjørn 31.10.2026: 30 days, and the time left to the project also limits
// it). Dates are ISO strings (YYYY-MM-DD) and computed in UTC, so a day is never shifted by the time zone.
import type { Rules } from '../rules/rules';
import type { Delivery } from './types';

const DAY = 864e5;
const parse = (iso: string | undefined) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Date.parse(`${iso}T00:00:00Z`) : NaN);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Today as an ISO date, in local time. */
export function today(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export interface Validity {
  /** Last day the quote holds. */
  until: string;
  /** Set by the montering date rather than the 30 days. */
  byMount: boolean;
  /** Montering is so close that the quote would already have run out. */
  late: boolean;
}

/** Quote sent on `sent`: holds `validDays`, but ends `beforeMount` days before montering when that comes first. */
export function validUntil(sent: string, d: Delivery | undefined, q: Rules['quote']): Validity {
  const s = parse(sent);
  const byDays = s + q.validDays * DAY;
  const m = parse(d?.montering);
  const byMountT = Number.isNaN(m) ? Infinity : m - q.beforeMount * DAY;
  const until = Math.min(byDays, byMountT);
  return { until: iso(until), byMount: byMountT < byDays, late: until < s };
}

/** "12. mai 2027" from an ISO date, '' when missing. */
export function dateText(isoDate: string | undefined): string {
  const t = parse(isoDate);
  return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export const DELIVERY_FIELDS: { key: keyof Delivery; name: string }[] = [
  { key: 'montering', name: 'Montering' },
  { key: 'apning', name: 'Åpning' },
  { key: 'demontering', name: 'Demontering' },
];
