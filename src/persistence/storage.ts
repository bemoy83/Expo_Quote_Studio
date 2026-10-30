// All localStorage access goes through here. One key per kind of data.
import { parse, serialize, type Sketch } from './file';

export const KEYS = {
  sketch: 'expo-quote-studio.sketch',
  catalog: 'expo-quote-studio.catalog',
  inFrame: 'expo-quote-studio.inframe',
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
