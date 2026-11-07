// All localStorage access goes through here. One key per kind of data.
import { parseBasis, serializeBasis, type CostBasis } from '../cost/basis';
import { parse, serialize, type Sketch } from './file';

export const KEYS = {
  sketch: 'expo-quote-studio.sketch',
  catalog: 'expo-quote-studio.catalog',
  inFrame: 'expo-quote-studio.inframe',
  layout: 'expo-quote-studio.layout',
  theme: 'expo-quote-studio.theme',
  /** The kostgrunnlag loaded from a file. Only in this browser; never sent anywhere. */
  costBasis: 'expo-quote-studio.kostgrunnlag',
  /** Saved versions of the kostgrunnlag, with the basis each replaced. Only in this browser, like the basis. */
  costHistory: 'expo-quote-studio.kostgrunnlag-historikk',
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // nothing stored, or storage blocked: either way it is gone
  }
}

export function loadSketch(): Sketch | null {
  const text = read(KEYS.sketch);
  if (!text) return null;
  const res = parse(text);
  return res.ok ? res.sketch : null;
}

export const saveSketch = (s: Sketch) => write(KEYS.sketch, serialize(s));

export function loadJson<T>(key: string, fallback: T): T {
  const text = read(key);
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export const saveJson = (key: string, value: unknown) => write(key, JSON.stringify(value));

/** Light or dark, or follow the system. index.html reads the same key before the first paint. */
export type Theme = 'system' | 'light' | 'dark';

export function loadTheme(): Theme {
  const t = read(KEYS.theme);
  return t === 'light' || t === 'dark' ? t : 'system';
}

export const saveTheme = (t: Theme) => write(KEYS.theme, t);

/** The kostgrunnlag kept in this browser, or null for the example. */
export function loadCostBasis(): CostBasis | null {
  const text = read(KEYS.costBasis);
  if (!text) return null;
  const r = parseBasis(text);
  return r.ok ? r.basis : null;
}

/** Keep a kostgrunnlag in this browser, or null to go back to the example. False when the browser would not store it. */
export function saveCostBasis(b: CostBasis | null): boolean {
  if (!b) {
    remove(KEYS.costBasis);
    return true;
  }
  return write(KEYS.costBasis, serializeBasis(b));
}
