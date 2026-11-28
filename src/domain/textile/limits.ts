// Byggeregel X17: how short a textile wall may be, one limit whatever it stands on (Bjørn 28.11.2026: it follows the
// build system, not the placement). Pure.
import type { Rules } from '../../rules/rules';

/** Byggeregel X17: the shortest span a frame on a wall is drawn in, m: the shortest frame of any textile wall plus the
 *  side deduction and air (X2), so the frame itself is as short as one on foot plates may be. */
export const minSpan = (rules: Rules) => rules.textile.minLength + (rules.textile.inFrame.side + rules.textile.inFrame.air) / 1000;

/** Byggeregel X17: the message when a textile wall is shorter than the shortest frame. */
export const tooShort = (rules: Rules) => `Tekstilveggen må være minst ${String(rules.textile.minLength).replace('.', ',')} m`;
