// The quote shows some kalkyle lines as one (Bjørn 31.10.2026): a textile wall's frame (rental) and its textile (sale)
// are two lines in the kalkyle and one on the quote. Pure.
import { DEFAULT_PRICING, type PricingData } from '../pricing/data';
import type { CalcGroup, CalcLine } from './calc';

/** Lines of one group as the quote shows them: lines sharing a quote key merged at the first one's place. */
export function quoteLines(lines: CalcLine[], pricing: PricingData = DEFAULT_PRICING): CalcLine[] {
  const out: CalcLine[] = [];
  const merged = new Map<string, CalcLine[]>();
  for (const l of lines) {
    if (!l.quote) {
      out.push(l);
      continue;
    }
    const k = l.quote.key;
    if (!merged.has(k)) {
      merged.set(k, []);
      // Placeholder, filled in below
      out.push({ ...l, artnr: `quote:${k}` });
    }
    merged.get(k)!.push(l);
  }
  return out.map((l) => {
    if (!l.artnr.startsWith('quote:')) return l;
    const parts = merged.get(l.quote!.key)!;
    if (parts.length === 1) return parts[0];
    const lead = parts.filter((p) => p.quote!.lead);
    const qty = lead.length ? lead.reduce((a, p) => a + p.qty, 0) : 1;
    const sum = parts.reduce((a, p) => a + p.sum, 0);
    const transfers = new Set(parts.flatMap((p) => (p.transfer === 'blandet' ? ['leie', 'salg'] : p.transfer ? [p.transfer] : [])));
    const terms = transfers.size === 2 ? (pricing.terms.tekstil ?? 'Delvis leie, delvis kjøp') : undefined;
    const known = parts.every((p) => p.cost !== null);
    const cost = known ? parts.reduce((a, p) => a + p.cost!, 0) : null;
    return {
      ...parts[0],
      name: l.quote!.name,
      qty,
      unit: lead[0]?.unit ?? 'stk',
      price: qty ? sum / qty : sum,
      sum,
      artnr: parts.map((p) => p.artnr).join('+'),
      placeholder: parts.some((p) => p.placeholder),
      meta: undefined,
      cost,
      dg: cost === null || !sum ? null : (sum - cost) / sum,
      terms,
      quote: undefined,
    };
  });
}

/** The groups as the quote shows them. */
export const quoteGroups = (groups: CalcGroup[], pricing?: PricingData): CalcGroup[] => groups.map((g) => ({ ...g, lines: quoteLines(g.lines, pricing) }));
