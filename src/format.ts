export function aed(n: number): string {
  return `AED ${Math.round(n).toLocaleString('en-US')}`;
}

/** Abbreviated, ~3 sig figs: 468k, 1.42M. */
export function abbr(v: number): string {
  const s = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2)}M`;
  if (a >= 1_000) return `${s}${Math.round(a / 1000)}k`;
  return `${s}${Math.round(a)}`;
}

export function pct(x: number): string {
  return `${+(x * 100).toFixed(2)}%`;
}
