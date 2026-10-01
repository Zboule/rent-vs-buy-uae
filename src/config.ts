import { DEFAULTS, PRESETS, SCENARIOS, simulateBuy, type Emirate, type Params, type ScenarioKey, type SellRow } from './engine';
import { abbr } from './format';

// Every numeric option is a LIST of values. The graph draws one line per combination of
// all the values (a cartesian product), so "5 price trends × 4 returns × 2 down payments"
// is 40 lines.

export const NOW = new Date().getFullYear();

export type Kind = 'aed' | 'pct' | 'yrs';

export interface FieldDef {
  key: string;
  label: string;
  kind: Kind;
  group: string;
  hint?: string;
  min?: number;
  max?: number;
  int?: boolean;
  /** how one value reads inside a line's name */
  tag: (v: number) => string;
  /** plural noun for the line equation ("2 down payments") */
  noun?: string;
  /** shown up front in Essentials */
  essential?: boolean;
  /** values offered when comparing; defaults by kind */
  suggest?: number[];
}

const pc = (v: number) => `${+(v * 100).toFixed(2)}%`;
const sg = (v: number) => `${v >= 0 ? '+' : ''}${pc(v)}`;

const FIELD_LIST: FieldDef[] = [
  { key: 'buyYear', min: 0, max: 20, int: true, label: 'Buy in, years from now', kind: 'yrs', group: 'Timing', hint: '0 = now. Several values compare waiting.', tag: (v) => `buy ${NOW + v}` },

  { key: 'price', min: 100_000, label: 'Property price today', kind: 'aed', group: 'Mortgage', tag: (v) => `${abbr(v)} home` },
  { key: 'downPct', min: 0.05, max: 1, label: 'Down payment', kind: 'pct', group: 'Mortgage', hint: '100 = cash buyer. Expats: min 20% up to AED 5M, 30% above.', tag: (v) => (v >= 1 ? 'cash buyer' : `${pc(v)} down`) },
  { key: 'fixedRate', label: 'Fixed mortgage rate', kind: 'pct', group: 'Mortgage', hint: 'Best 3-year fixed ~3.95% (Sept 2026)', tag: (v) => `${pc(v)} fixed` },
  { key: 'fixedYears', min: 0, max: 30, int: true, label: 'Fixed for', kind: 'yrs', group: 'Mortgage', tag: (v) => `fixed ${v}y` },
  { key: 'varRate', label: 'Rate after the fixed period', kind: 'pct', group: 'Mortgage', hint: '3-month EIBOR (~4.35%) + ~1.75%', tag: (v) => `then ${pc(v)}` },
  { key: 'term', min: 1, max: 30, int: true, label: 'Mortgage term', kind: 'yrs', group: 'Mortgage', hint: 'Sets the yearly payment. Max 25.', tag: (v) => `${v}y mortgage` },

  { key: 'rent', min: 0, label: 'Annual rent for a similar home', kind: 'aed', group: 'Renting', tag: (v) => `rent ${abbr(v)}` },
  { key: 'rentGrowth', label: 'Rent increase per year', kind: 'pct', group: 'Renting', tag: (v) => `rent ${sg(v)}/yr` },
  { key: 'moveEveryYears', min: 0, max: 30, int: true, label: 'Move every (years)', kind: 'yrs', group: 'Renting', hint: '0 = never', tag: (v) => `move every ${v}y` },
  { key: 'rentAgentPct', label: 'Agent fee per move', kind: 'pct', group: 'Renting', hint: '% of annual rent, + VAT', tag: (v) => `rent agent ${pc(v)}` },
  { key: 'moveCost', label: 'Other costs per move', kind: 'aed', group: 'Renting', tag: (v) => `move ${abbr(v)}` },

  { key: 'rentFollows', label: 'Rents follow price swings by', kind: 'pct', group: 'Market', hint: 'In 2009 rents fell ~30% while prices fell ~50%: about 60%', tag: (v) => `rents follow ${pc(v)}` },
  { key: 'priceGrowth', label: 'Prices change per year', kind: 'pct', group: 'Constant trend', tag: (v) => `prices ${sg(v)}/yr` },

  { key: 'investReturn', label: 'Your savings earn', kind: 'pct', group: 'Constant trend', hint: 'Per year, on money not spent on the home', tag: (v) => `invest ${pc(v)}` },
  { key: 'investTax', label: 'Tax on investment returns', kind: 'pct', group: 'Market', hint: '0 in the UAE', tag: (v) => `tax ${pc(v)}` },

  { key: 'buyAgentPct', label: 'Agent commission', kind: 'pct', group: 'Buying costs', hint: '+ 5% VAT', tag: (v) => `buy agent ${pc(v)}` },
  { key: 'bankFeePct', label: 'Bank arrangement fee', kind: 'pct', group: 'Buying costs', hint: '% of loan, + VAT', tag: (v) => `bank fee ${pc(v)}` },
  { key: 'valuation', label: 'Valuation', kind: 'aed', group: 'Buying costs', tag: (v) => `valuation ${abbr(v)}` },
  { key: 'moveInCost', label: 'Moving in', kind: 'aed', group: 'Buying costs', tag: (v) => `move-in ${abbr(v)}` },

  { key: 'serviceCharge', label: 'Service charges per year', kind: 'aed', group: 'Owning costs', hint: 'Usually AED 12-30 per sq ft', tag: (v) => `service ${abbr(v)}` },
  { key: 'serviceChargeGrowth', label: 'Service charge increase', kind: 'pct', group: 'Owning costs', tag: (v) => `service ${sg(v)}/yr` },
  { key: 'maintenancePct', label: 'Maintenance per year', kind: 'pct', group: 'Owning costs', hint: '% of value', tag: (v) => `maint. ${pc(v)}` },
  { key: 'insurancePct', label: 'Home insurance per year', kind: 'pct', group: 'Owning costs', hint: '% of value', tag: (v) => `insurance ${pc(v)}` },
  { key: 'lifeInsPct', label: 'Mortgage life insurance', kind: 'pct', group: 'Owning costs', hint: '% of loan balance per year', tag: (v) => `life ins. ${pc(v)}` },

  { key: 'sellAgentPct', label: 'Agent commission', kind: 'pct', group: 'Selling costs', hint: '+ 5% VAT', tag: (v) => `sell agent ${pc(v)}` },
  { key: 'sellFixed', label: 'NOC + mortgage release', kind: 'aed', group: 'Selling costs', tag: (v) => `sell fees ${abbr(v)}` },
  { key: 'earlySettlePct', label: 'Early settlement fee', kind: 'pct', group: 'Selling costs', hint: '% of loan left', tag: (v) => `settle ${pc(v)}` },
  { key: 'earlySettleCap', label: 'Early settlement cap', kind: 'aed', group: 'Selling costs', hint: 'Central Bank: AED 10k', tag: (v) => `cap ${abbr(v)}` },
];

// extra presentation data, kept apart so the table above stays readable
const EXTRA: Record<string, Partial<FieldDef>> = {
  buyYear: { noun: 'buy years', suggest: [0, 1, 2, 3, 5] },
  price: { noun: 'prices', essential: true },
  downPct: { noun: 'down payments', essential: true, suggest: [0.2, 0.25, 0.3, 0.5, 1] },
  fixedRate: { noun: 'fixed rates', essential: true, suggest: [0.035, 0.0395, 0.045, 0.05] },
  fixedYears: { noun: 'fixed periods', suggest: [1, 3, 5] },
  varRate: { noun: 'reversion rates', suggest: [0.05, 0.061, 0.07] },
  term: { noun: 'mortgage terms', suggest: [15, 20, 25] },
  rent: { noun: 'rents', essential: true },
  rentGrowth: { noun: 'rent increases', essential: true, suggest: [0, 0.03, 0.05, 0.08] },
  moveEveryYears: { noun: 'moving rhythms', suggest: [0, 2, 3, 5] },
  rentAgentPct: { noun: 'rent agent fees' },
  moveCost: { noun: 'moving costs' },
  rentFollows: { noun: 'rent sensitivities', suggest: [0, 0.3, 0.6, 1] },
  priceGrowth: { noun: 'price trends', suggest: [-0.02, 0, 0.03, 0.05, 0.07] },
  investReturn: { noun: 'returns', suggest: [0.04, 0.06, 0.08, 0.1] },
  investTax: { noun: 'tax rates' },
  buyAgentPct: { noun: 'buy agent fees' },
  bankFeePct: { noun: 'bank fees' },
  valuation: { noun: 'valuations' },
  moveInCost: { noun: 'move-in costs' },
  serviceCharge: { noun: 'service charges' },
  serviceChargeGrowth: { noun: 'service charge increases' },
  maintenancePct: { noun: 'maintenance rates' },
  insurancePct: { noun: 'insurance rates' },
  lifeInsPct: { noun: 'life cover rates' },
  sellAgentPct: { noun: 'sell agent fees' },
  sellFixed: { noun: 'selling fees' },
  earlySettlePct: { noun: 'settlement fees' },
  earlySettleCap: { noun: 'settlement caps' },
};
export const FIELDS: FieldDef[] = FIELD_LIST.map((f) => ({ ...f, ...EXTRA[f.key] }));
export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<string, FieldDef>;
export const GROUPS = ['Timing', 'Mortgage', 'Renting', 'Market', 'Buying costs', 'Owning costs', 'Selling costs'];

/** Values to offer when comparing an option: its own list, else a spread around the first value. */
export function suggestions(f: FieldDef, current: number[]): number[] {
  const v = current[0];
  let raw: number[];
  if (f.suggest) raw = f.suggest;
  else if (f.kind === 'aed') {
    const r = (x: number) => { const m = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, x))) - 1)); return Math.round(x / m) * m; };
    raw = [r(v * 0.8), r(v * 0.9), r(v * 1.1), r(v * 1.2)];
  } else if (f.kind === 'pct') raw = [v - 0.02, v - 0.01, v + 0.01, v + 0.02].map((x) => +x.toFixed(4));
  else raw = [v - 2, v - 1, v + 1, v + 2];
  return raw.map((x) => clampValue(f, x)).filter((x, i, a) => a.indexOf(x) === i && !current.includes(x));
}

// fees that differ by emirate: one value per emirate
export const EM_FIELDS: { key: string; label: string; kind: Kind }[] = [
  { key: 'transferPct', label: 'Transfer fee (DLD / DMT)', kind: 'pct' },
  { key: 'regFixed', label: 'Title deed + trustee, incl. VAT', kind: 'aed' },
  { key: 'mortgageRegPct', label: 'Mortgage registration, % of loan', kind: 'pct' },
  { key: 'mortgageRegFixed', label: 'Mortgage registration, fixed', kind: 'aed' },
  { key: 'renterHousingFeePct', label: 'Tenant housing fee, % of rent', kind: 'pct' },
  { key: 'ownerHousingFeePct', label: 'Owner housing fee, % of rent value', kind: 'pct' },
];

export const EMIRATES: Emirate[] = ['DXB', 'AUH'];
export const EM_LABEL: Record<Emirate, string> = { DXB: 'Dubai', AUH: 'Abu Dhabi' };
export const CYCLES = SCENARIOS;

export interface Config {
  lists: Record<string, number[]>;
  emirates: Emirate[];
  cycles: ScenarioKey[];
  emFees: Record<Emirate, Record<string, number>>;
  scenRet: Record<string, number>; // each scenario's investment return
  off: Record<string, number[]>; // values kept in the list but switched off (not drawn)
  horizon: number; // years shown after the (latest) buy year
  sell: number | null; // the readout's sell year (calendar), null = end of horizon
  focus: string | null; // "key:value": show only lines with that value
}

const P = DEFAULTS as unknown as Record<string, number>;

export const DEFAULT_CONFIG: Config = {
  lists: {
    ...Object.fromEntries(FIELDS.map((f) => [f.key, [f.key === 'buyYear' ? 0 : P[f.key]]])),
    price: [3_000_000],
    downPct: [0.2],
    rent: [240_000],
    rentGrowth: [0.05],
    investReturn: [0.06],
  },
  emirates: ['DXB'],
  cycles: ['boom', 'tension', 'bust', 'broken', 'invasion'],
  emFees: Object.fromEntries(
    EMIRATES.map((e) => [e, Object.fromEntries(EM_FIELDS.map((f) => [f.key, ({ ...P, ...PRESETS[e] } as Record<string, number>)[f.key]]))]),
  ) as Record<Emirate, Record<string, number>>,
  scenRet: Object.fromEntries(SCENARIOS.map((x) => [x.key, x.ret])),
  off: {},
  horizon: 10,
  sell: null,
  focus: null,
};

/* ---------------------------------------------------------------- dimensions */

export interface Dim {
  key: string;
  label: string;
  noun: string;
  values: (number | string)[];
  tag: (v: number | string) => string;
}

export function dims(c: Config): Dim[] {
  return [
    { key: 'cycle', label: 'Scenario', noun: 'scenarios', values: CYCLES.map((x) => x.key).filter((k) => c.cycles.includes(k)), tag: (v: number | string) => CYCLES.find((s) => s.key === v)!.label },
    { key: 'emirate', label: 'Emirate', noun: 'emirates', values: c.emirates, tag: (v: number | string) => EM_LABEL[v as Emirate] },
    ...FIELDS.map((f) => ({ key: f.key, label: f.label, noun: f.noun ?? f.label.toLowerCase(), values: c.lists[f.key], tag: (v: number | string) => f.tag(v as number) })),
  ];
}

export const MAX_LINES = 160;

/** Clamp a value to its field's allowed range (a 0-year term would be a free loan). */
export function clampValue(f: FieldDef, v: number): number {
  let x = f.int ? Math.round(v) : v;
  if (f.min != null) x = Math.max(f.min, x);
  if (f.max != null) x = Math.min(f.max, x);
  return x;
}

// options that only exist when there is a loan: a cash buyer ignores them
// options a combination ignores: the constant trend only applies to the "trend" scenario,
// rentFollows only to the others
const ignored = (combo: Record<string, number | string>) => [
  ...((combo.downPct as number) >= 1 ? LOAN_KEYS : []),
  ...((combo.moveEveryYears as number) === 0 ? ['rentAgentPct', 'moveCost'] : []),
  ...((combo.fixedYears as number) >= (combo.term as number) ? ['varRate'] : []),
  ...(combo.cycle === 'trend' ? ['rentFollows'] : ['priceGrowth', 'investReturn']),
];
const LOAN_KEYS = ['fixedRate', 'fixedYears', 'varRate', 'term', 'bankFeePct', 'valuation', 'lifeInsPct', 'earlySettlePct', 'earlySettleCap'];

export interface LineDef {
  id: string;
  combo: Record<string, number | string>;
  name: string;
  /** the name's pieces by option key, for reordering */
  parts: Record<string, string>;
  buyYear: number;
  rows: SellRow[];
  paymentYear: number; // mortgage payments in the first year
  rentYear: number; // rent in the year you buy
}

/** Why a combination is dropped as a repeat of another line (null = it is its own line). */
function dropCause(c: Config, combo: Record<string, number | string>): 'cash' | 'trend' | 'other' | null {
  const bad = ignored(combo).filter((k) => combo[k] !== c.lists[k][0]);
  if (!bad.length) return null;
  if ((combo.downPct as number) >= 1 && bad.some((k) => LOAN_KEYS.includes(k))) return 'cash';
  if (bad.some((k) => k === 'priceGrowth' || k === 'investReturn' || k === 'rentFollows')) return 'trend';
  return 'other';
}

function walkCombos(c: Config, visit: (combo: Record<string, number | string>) => void) {
  const ds = dims(c);
  if (ds.some((d) => d.values.length === 0)) return;
  const walk = (i: number, combo: Record<string, number | string>) => {
    if (i === ds.length) return visit(combo);
    for (const v of ds[i].values) walk(i + 1, { ...combo, [ds[i].key]: v });
  };
  walk(0, {});
}

export interface LineCount {
  total: number; // lines drawn (after repeats are dropped, before the cap)
  product: number; // plain product of value counts
  dropped: { cash: number; trend: number; other: number };
  varying: Dim[];
}

export function countLines(c: Config): LineCount {
  const varying = dims(c).filter((d) => d.values.length > 1);
  const dropped = { cash: 0, trend: 0, other: 0 };
  let total = 0, product = 0;
  walkCombos(c, (combo) => {
    product++;
    const cause = dropCause(c, combo);
    if (cause) dropped[cause]++;
    else total++;
  });
  return { total, product, dropped, varying };
}

export function lines(c: Config): { lines: LineDef[]; total: number; varying: Dim[] } {
  const varying = dims(c).filter((d) => d.values.length > 1);
  const maxBuy = Math.max(...c.lists.buyYear);
  const out: LineDef[] = [];
  let total = 0;
  walkCombos(c, (combo) => {
    if (dropCause(c, combo)) return;
    if (++total > MAX_LINES) return;
    const em = combo.emirate as Emirate;
    const X = combo.buyYear as number;
    const p = {
      ...DEFAULTS,
      ...combo,
      ...c.emFees[em],
      emirate: em,
      scenario: combo.cycle as ScenarioKey,
      investReturn: combo.cycle === 'trend' ? combo.investReturn : c.scenRet[combo.cycle as string],
      // every line runs to the same last sell year: latest buy year + horizon
      maxHold: maxBuy + c.horizon - X,
    } as unknown as Params;
    const b = simulateBuy(p, X, []);
    out.push({
      id: `l${out.length}`,
      combo: { ...combo },
      name: '',
      parts: Object.fromEntries(varying.filter((d) => !ignored(combo).includes(d.key)).map((d) => [d.key, d.tag(combo[d.key])])),
      buyYear: X,
      rows: b.rows,
      paymentYear: b.monthlyPayment * 12,
      rentYear: b.rent,
    });
  });
  return { lines: out, total, varying };
}

/* ---------------------------------------------------------------- URL state */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function readConfig(): Config {
  const q = new URLSearchParams(location.hash.slice(1));
  const c: Config = structuredClone(DEFAULT_CONFIG);
  for (const f of FIELDS) {
    const v = q.get(f.key);
    if (v != null) {
      const vs = [...new Set(v.split('_').filter(Boolean).map(Number).filter(Number.isFinite).map((x) => clampValue(f, x)))];
      if (vs.length) c.lists[f.key] = vs;
    }
  }
  if (q.get('em') != null) c.emirates = q.get('em')!.split('_').filter((x): x is Emirate => x === 'DXB' || x === 'AUH');
  if (q.get('cy') != null) c.cycles = q.get('cy')!.split('_').filter((x) => CYCLES.some((s) => s.key === x)) as ScenarioKey[];
  for (const e of EMIRATES)
    for (const f of EM_FIELDS) {
      const v = q.get(`${e}.${f.key}`);
      if (v != null && Number.isFinite(Number(v))) c.emFees[e][f.key] = Number(v);
    }
  for (const x of SCENARIOS) {
    const v = q.get(`ret.${x.key}`);
    if (v != null && Number.isFinite(Number(v))) c.scenRet[x.key] = Number(v);
  }
  const hz = Number(q.get('horizon'));
  if (q.get('horizon') && Number.isFinite(hz)) c.horizon = Math.max(1, Math.min(35, Math.round(hz)));
  for (const f of FIELDS) {
    const v = q.get(`off.${f.key}`);
    if (v) {
      const vs = v.split('_').map(Number).filter(Number.isFinite).map((x) => clampValue(f, x)).filter((x) => !c.lists[f.key].includes(x));
      if (vs.length) c.off[f.key] = [...new Set(vs)];
    }
  }
  const sell = Number(q.get('sell'));
  if (q.get('sell') && Number.isFinite(sell)) c.sell = Math.round(sell);
  if (q.get('focus')) c.focus = q.get('focus');
  return c;
}

export function writeConfig(c: Config) {
  const q = new URLSearchParams();
  const d = DEFAULT_CONFIG;
  for (const f of FIELDS) if (!same(c.lists[f.key], d.lists[f.key])) q.set(f.key, c.lists[f.key].join('_'));
  if (!same(c.emirates, d.emirates)) q.set('em', c.emirates.join('_'));
  if (!same(c.cycles, d.cycles)) q.set('cy', c.cycles.join('_'));
  for (const e of EMIRATES)
    for (const f of EM_FIELDS) if (c.emFees[e][f.key] !== d.emFees[e][f.key]) q.set(`${e}.${f.key}`, String(c.emFees[e][f.key]));
  for (const x of SCENARIOS) if (c.scenRet[x.key] !== d.scenRet[x.key]) q.set(`ret.${x.key}`, String(c.scenRet[x.key]));
  if (c.horizon !== d.horizon) q.set('horizon', String(c.horizon));
  for (const [k, vs] of Object.entries(c.off)) if (vs.length) q.set(`off.${k}`, vs.join('_'));
  if (c.sell != null) q.set('sell', String(c.sell));
  if (c.focus) q.set('focus', c.focus);
  const h = q.toString();
  history.replaceState(null, '', h ? `#${h}` : location.pathname);
}

/* ---------------------------------------------------------------- plain-language count */

const LOAN_OPTS = ['fixedRate', 'fixedYears', 'varRate', 'term', 'bankFeePct', 'valuation', 'lifeInsPct', 'earlySettlePct', 'earlySettleCap'];
const TREND_OPTS = ['priceGrowth', 'investReturn'];
const pcts = (vs: number[]) => vs.map((v) => `${+(v * 100).toFixed(2)}%`);
const orList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);

/**
 * "7 scenarios × 3 ways to buy": the factors that multiply into the line count, merging the
 * options that only apply to some lines (loan options only to mortgage buyers, trend options only
 * to the Constant trend scenario) so the numbers multiply exactly.
 */
export function describeCount(c: Config, cnt: LineCount): { factors: string[]; detail: string | null; skipped: number } {
  const vary = new Set(cnt.varying.map((d) => d.key));
  const factors: string[] = [];
  let detail: string | null = null;
  let product = 1;

  // scenarios (with the trend's own options folded in)
  const trendVar = TREND_OPTS.filter((k) => vary.has(k));
  const hasTrend = c.cycles.includes('trend');
  const nScen = hasTrend && trendVar.length ? c.cycles.length - 1 + trendVar.reduce((n, k) => n * c.lists[k].length, 1) : c.cycles.length;
  if (nScen > 1) factors.push(`${nScen} scenarios`);
  product *= nScen;

  // ways to buy: down payments × loan options, where cash has no loan
  const loanVar = LOAN_OPTS.filter((k) => vary.has(k));
  const downs = c.lists.downPct;
  const cash = downs.filter((v) => v >= 1).length;
  const loanDowns = downs.filter((v) => v < 1);
  const loanCombos = loanVar.reduce((n, k) => n * c.lists[k].length, 1);
  const ways = loanDowns.length * loanCombos + cash;
  if (ways > 1) {
    factors.push(`${ways} ways to buy`);
    if (loanVar.length || cash) {
      const parts: string[] = [];
      if (loanDowns.length) {
        const loanTxt = loanVar.map((k) => `${orList(FIELD[k].kind === 'pct' ? pcts(c.lists[k]) : c.lists[k].map(String))} ${FIELD[k].noun?.replace(/s$/, '') ?? ''}`.trim());
        parts.push(`${orList(pcts(loanDowns))} down${loanTxt.length ? ` at ${loanTxt.join(' and ')}` : ''}`);
      }
      if (cash) parts.push('cash');
      detail = parts.join(', or ');
    }
  }
  product *= ways;

  // everything else multiplies plainly
  for (const d of cnt.varying) {
    if (d.key === 'cycle' || d.key === 'downPct' || LOAN_OPTS.includes(d.key) || TREND_OPTS.includes(d.key)) continue;
    factors.push(`${d.values.length} ${d.noun}`);
    product *= d.values.length;
  }
  return { factors, detail, skipped: Math.max(0, product - cnt.total) };
}
