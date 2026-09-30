// How lines get their look. Deterministic, so a shared link always draws the same picture:
// colour = the scenario when it varies, else the first varying option;
// dash = the down payment when it varies (and is not the colour), else the next varying option.
import type { Dim } from './config';

export const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
export const DASHES = ['', '8 4', '2 4', '12 4 2 4'];

export interface Encoding {
  colorKey: string;
  dashKey: string;
  colorOf: (key: string, v: number | string) => string | null;
  dashOf: (key: string, v: number | string) => string | null;
  line: (combo: Record<string, number | string>) => { color: string; dash: string };
}

export function encoding(varying: Dim[]): Encoding {
  const keys = varying.map((d) => d.key);
  const colorKey = keys.includes('cycle') ? 'cycle' : keys[0] ?? '';
  const dashKey = keys.includes('downPct') && colorKey !== 'downPct' ? 'downPct' : keys.find((k) => k !== colorKey) ?? '';
  const idx = (key: string, v: number | string) => varying.find((d) => d.key === key)?.values.indexOf(v as never) ?? -1;
  const colorOf = (key: string, v: number | string) => (key === colorKey && idx(key, v) >= 0 ? COLORS[idx(key, v) % COLORS.length] : null);
  const dashOf = (key: string, v: number | string) => (key === dashKey && idx(key, v) >= 0 ? DASHES[idx(key, v) % DASHES.length] : null);
  return {
    colorKey,
    dashKey,
    colorOf,
    dashOf,
    line: (combo) => ({
      color: colorKey ? colorOf(colorKey, combo[colorKey]) ?? COLORS[0] : COLORS[0],
      dash: dashKey ? dashOf(dashKey, combo[dashKey]) ?? '' : '',
    }),
  };
}
