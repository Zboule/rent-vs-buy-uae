import { DEFAULTS, PRESETS, type Emirate, type Params, type ScenarioKey } from './engine';

export type Financing = 'loan' | 'cash';
export interface Compare {
  em: Emirate[];
  sc: ScenarioKey[];
  fin: Financing[];
}
export const DEFAULT_CMP: Compare = { em: ['DXB'], sc: ['steady', 'crash08', 'slump14', 'boomBust'], fin: ['loan'] };

// All state lives in the URL hash so any scenario is a shareable link.
// Only values that differ from the defaults are written.

export interface AppState {
  p: Params;
  custom: number[]; // per-year price growth for the custom scenario
  buyYear: number;
  real: boolean; // show today's money
  cmp: Compare; // which presets the comparison chart combines
}

export const initialCustom = (p: Params) => Array.from({ length: p.maxBuyYear + p.maxHold }, () => p.priceGrowth);

export function readHash(): AppState {
  const q = new URLSearchParams(location.hash.slice(1));
  const p: Params = { ...DEFAULTS };
  const emirate = q.get('emirate');
  if (emirate === 'AUH' || emirate === 'DXB') Object.assign(p, PRESETS[emirate], { emirate });
  for (const [k, v] of q) {
    if (!(k in DEFAULTS) || k === 'emirate') continue;
    const d = (DEFAULTS as unknown as Record<string, unknown>)[k];
    (p as unknown as Record<string, unknown>)[k] = typeof d === 'number' ? Number(v) : v;
  }
  const custom = q.get('path')?.split(',').map(Number) ?? initialCustom(p);
  return {
    p,
    custom,
    buyYear: Number(q.get('x') ?? 0),
    real: q.get('real') === '1',
    cmp: q.get('cmp') ? parseCmp(q.get('cmp')!) : { ...DEFAULT_CMP, em: [p.emirate] },
  };
}

export function writeHash(s: AppState) {
  const q = new URLSearchParams();
  const base: Params = { ...DEFAULTS, ...PRESETS[s.p.emirate] };
  for (const k of Object.keys(s.p) as (keyof Params)[]) {
    if (k === 'emirate' ? s.p.emirate !== 'DXB' : s.p[k] !== base[k]) q.set(k, String(s.p[k]));
  }
  if (s.p.scenario === 'custom') q.set('path', s.custom.map((g) => +g.toFixed(4)).join(','));
  if (s.buyYear) q.set('x', String(s.buyYear));
  if (s.real) q.set('real', '1');
  const cmpDefault = { ...DEFAULT_CMP, em: [s.p.emirate] };
  if (JSON.stringify(s.cmp) !== JSON.stringify(cmpDefault)) q.set('cmp', [s.cmp.em.join('.'), s.cmp.sc.join('.'), s.cmp.fin.join('.')].join('~'));
  const h = q.toString();
  history.replaceState(null, '', h ? `#${h}` : location.pathname);
}

function parseCmp(v: string): Compare {
  const [em = '', sc = '', fin = ''] = v.split('~');
  const list = <T extends string>(x: string) => x.split('.').filter(Boolean) as T[];
  return { em: list<Emirate>(em), sc: list<ScenarioKey>(sc), fin: list<Financing>(fin) };
}
