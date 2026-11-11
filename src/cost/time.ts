// Time per handling step: what the cost engine prices (minutes × hourly cost) and what the work order plans by.

/** Handling steps, in the order the work is done. Time is kept per step: it is cost (× hourly rate, in the OMS) and
 *  it is the plan on the work order. */
export const HANDLING_STEPS = ['plukk', 'vask', 'transport', 'forhåndsmontering', 'montering', 'demontering'] as const;
export type HandlingStep = (typeof HANDLING_STEPS)[number];
/** Minutes per handling step. */
export type Time = Partial<Record<HandlingStep, number>>;

/** a + b × times, per step. */
export function addTime(a: Time, b: Time | undefined, times = 1): Time {
  if (!b) return a;
  const out: Time = { ...a };
  for (const s of HANDLING_STEPS) if (b[s]) out[s] = (out[s] ?? 0) + b[s]! * times;
  return out;
}
