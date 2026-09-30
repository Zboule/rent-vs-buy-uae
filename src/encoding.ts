// How lines get their look. Deterministic, so a shared link always draws the same picture:
// colour = the scenario when it varies, else the first varying option;
// dash   = the down payment when it varies (and is not the colour), else the next varying option;
// shade  = the next varying option after that: same hue, lightness stepped by --shade-step (darker in light mode, lighter in dark).
import type { Dim } from './config';

export const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
export const DASHES = ['', '8 4', '2 4', '12 4 2 4'];
export const SHADES = [0, 1, 2];

export const shade = (color: string, step: number) => (step <= 0 ? color : `oklch(from ${color} calc(l + var(--shade-step) * ${step}) c h)`);

export interface Encoding {
  colorKey: string;
  dashKey: string;
  shadeKey: string;
  colorOf: (key: string, v: number | string) => string | null;
  dashOf: (key: string, v: number | string) => string | null;
  shadeOf: (key: string, v: number | string) => number | null;
  line: (combo: Record<string, number | string>) => { color: string; dash: string };
}

export function encoding(varying: Dim[]): Encoding {
  const keys = varying.map((d) => d.key);
  const colorKey = keys.includes('cycle') ? 'cycle' : keys[0] ?? '';
  const dashKey = keys.includes('downPct') && colorKey !== 'downPct' ? 'downPct' : keys.find((k) => k !== colorKey) ?? '';
  const shadeKey = keys.find((k) => k !== colorKey && k !== dashKey) ?? '';
  const idx = (key: string, v: number | string) => varying.find((d) => d.key === key)?.values.indexOf(v as never) ?? -1;
  const colorOf = (key: string, v: number | string) => (key === colorKey && idx(key, v) >= 0 ? COLORS[idx(key, v) % COLORS.length] : null);
  const dashOf = (key: string, v: number | string) => (key === dashKey && idx(key, v) >= 0 ? DASHES[idx(key, v) % DASHES.length] : null);
  const shadeOf = (key: string, v: number | string) => (key === shadeKey && idx(key, v) >= 0 ? SHADES[idx(key, v) % SHADES.length] : null);
  return {
    colorKey,
    dashKey,
    shadeKey,
    colorOf,
    dashOf,
    shadeOf,
    line: (combo) => {
      const base = colorKey ? colorOf(colorKey, combo[colorKey]) ?? COLORS[0] : COLORS[0];
      const s = shadeKey ? shadeOf(shadeKey, combo[shadeKey]) ?? 0 : 0;
      return { color: shade(base, s), dash: dashKey ? dashOf(dashKey, combo[dashKey]) ?? '' : '' };
    },
  };
}
