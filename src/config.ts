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
  /** how one value reads inside a line's name */
  tag: (v: number) => string;
}

const pc = (v: number) => `${+(v * 100).toFixed(2)}%`;
const sg = (v: number) => `${v >= 0 ? '+' : ''}${pc(v)}`;

export const FIELDS: FieldDef[] = [
  { key: 'buyYear', label: 'Buy in, years from now', kind: 'yrs', group: 'Timing', hint: '0 = now. Several values compare waiting.', tag: (v) => `buy ${NOW + v}` },

  { key: 'price', label: 'Property price today', kind: 'aed', group: 'Property & mortgage', tag: (v) => `${abbr(v)} home` },
  { key: 'downPct', label: 'Down payment', kind: 'pct', group: 'Property & mortgage', hint: '100 = cash buyer. Expats: min 20% up to AED 5M, 30% above.', tag: (v) => (v >= 1 ? 'cash buyer' : `${pc(v)} down`) },
  { key: 'fixedRate', label: 'Fixed mortgage rate', kind: 'pct', group: 'Property & mortgage', hint: 'Best 3-year fixed ~3.95% (Sept 2026)', tag: (v) => `${pc(v)} fixed` },
  { key: 'fixedYears', label: 'Fixed for', kind: 'yrs', group: 'Property & mortgage', tag: (v) => `fixed ${v}y` },
  { key: 'varRate', label: 'Rate after the fixed period', kind: 'pct', group: 'Property & mortgage', hint: '3-month EIBOR (4.2%) + ~1.75%', tag: (v) => `then ${pc(v)}` },
  { key: 'term', label: 'Mortgage term', kind: 'yrs', group: 'Property & mortgage', hint: 'Sets the yearly payment. Max 25.', tag: (v) => `${v}y mortgage` },

  { key: 'rent', label: 'Annual rent for a similar home', kind: 'aed', group: 'Renting', tag: (v) => `rent ${abbr(v)}` },
  { key: 'rentGrowth', label: 'Rent increase per year', kind: 'pct', group: 'Renting', tag: (v) => `rent ${sg(v)}/yr` },
  { key: 'moveEveryYears', label: 'Move every (years)', kind: 'yrs', group: 'Renting', hint: '0 = never', tag: (v) => `move every ${v}y` },
  { key: 'rentAgentPct', label: 'Agent fee per move', kind: 'pct', group: 'Renting', hint: '% of annual rent, + VAT', tag: (v) => `rent agent ${pc(v)}` },
  { key: 'moveCost', label: 'Other costs per move', kind: 'aed', group: 'Renting', tag: (v) => `move ${abbr(v)}` },

  { key: 'rentFollows', label: 'Rents follow price swings by', kind: 'pct', group: 'Market', hint: 'In 2009 rents fell ~30% while prices fell ~50%: about 60%', tag: (v) => `rents follow ${pc(v)}` },
  { key: 'priceGrowth', label: 'Constant trend, per year', kind: 'pct', group: 'Market', hint: 'Only for the "Constant trend" scenario', tag: (v) => `prices ${sg(v)}/yr` },

  { key: 'investReturn', label: 'Return on money not spent on the home', kind: 'pct', group: 'Opportunity cost', hint: 'What the down payment, fees and monthly savings would earn invested', tag: (v) => `invest ${pc(v)}` },
  { key: 'investTax', label: 'Tax on that return', kind: 'pct', group: 'Opportunity cost', hint: '0 in the UAE', tag: (v) => `tax ${pc(v)}` },

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
  horizon: number; // years shown after the (latest) buy year
  colorBy: string;
  styleBy: string;
  widthBy: string;
}

const P = DEFAULTS as unknown as Record<string, number>;

export const DEFAULT_CONFIG: Config = {
  lists: {
    ...Object.fromEntries(FIELDS.map((f) => [f.key, [f.key === 'buyYear' ? 0 : P[f.key]]])),
    price: [3_000_000],
    downPct: [0.2],
    rent: [240_000],
    rentGrowth: [0.05],
    investReturn: [0.04, 0.06, 0.08, 0.1],
  },
  emirates: ['DXB'],
  cycles: ['veryGood', 'good', 'neutral', 'bleed', 'bad', 'chaos', 'veryBad'],
  emFees: Object.fromEntries(
    EMIRATES.map((e) => [e, Object.fromEntries(EM_FIELDS.map((f) => [f.key, ({ ...P, ...PRESETS[e] } as Record<string, number>)[f.key]]))]),
  ) as Record<Emirate, Record<string, number>>,
  horizon: 10,
  colorBy: 'cycle',
  styleBy: 'investReturn',
  widthBy: 'downPct',
};

/* ---------------------------------------------------------------- dimensions */

export interface Dim {
  key: string;
  label: string;
  values: (number | string)[];
  tag: (v: number | string) => string;
}

export function dims(c: Config): Dim[] {
  return [
    ...FIELDS.map((f) => ({ key: f.key, label: f.label, values: c.lists[f.key], tag: (v: number | string) => f.tag(v as number) })),
    { key: 'emirate', label: 'Emirate', values: c.emirates, tag: (v: number | string) => EM_LABEL[v as Emirate] },
    { key: 'cycle', label: 'Price scenario', values: CYCLES.map((x) => x.key).filter((k) => c.cycles.includes(k)), tag: (v: number | string) => CYCLES.find((s) => s.key === v)!.label },
  ];
}

export const MAX_LINES = 160;

// options that only exist when there is a loan: a cash buyer ignores them
// options a combination ignores: the constant trend only applies to the "trend" scenario,
// rentFollows only to the others
const ignored = (combo: Record<string, number | string>) => [
  ...((combo.downPct as number) >= 1 ? LOAN_KEYS : []),
  ...(combo.cycle === 'trend' ? ['rentFollows'] : ['priceGrowth']),
];
const LOAN_KEYS = ['fixedRate', 'fixedYears', 'varRate', 'term', 'bankFeePct', 'lifeInsPct', 'earlySettlePct', 'earlySettleCap'];

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

export function lines(c: Config): { lines: LineDef[]; total: number; varying: Dim[] } {
  const ds = dims(c);
  const varying = ds.filter((d) => d.values.length > 1);
  if (ds.some((d) => d.values.length === 0)) return { lines: [], total: 0, varying };
  let total = 0;

  const out: LineDef[] = [];
  const walk = (i: number, combo: Record<string, number | string>) => {
    if (i === ds.length) {
      // a cash buyer with several terms/rates would draw identical lines: keep only the first
      if (ignored(combo).some((k) => combo[k] !== c.lists[k][0])) return;
      if (++total > MAX_LINES) return;
      const em = combo.emirate as Emirate;
      const p = {
        ...DEFAULTS,
        ...combo,
        ...c.emFees[em],
        emirate: em,
        scenario: combo.cycle as ScenarioKey,
        maxHold: c.horizon,
      } as unknown as Params;
      const X = combo.buyYear as number;
      const b = simulateBuy(p, X, []);
      out.push({
        id: `l${out.length}`,
        combo: { ...combo },
        name: '',
        parts: Object.fromEntries(
          varying.filter((d) => !ignored(combo).includes(d.key)).map((d) => [d.key, d.tag(combo[d.key])]),
        ),
        buyYear: X,
        rows: b.rows,
        paymentYear: b.monthlyPayment * 12,
        rentYear: b.rent,
      });
      return;
    }
    for (const v of ds[i].values) walk(i + 1, { ...combo, [ds[i].key]: v });
  };
  walk(0, {});
  return { lines: out, total, varying };
}

/* ---------------------------------------------------------------- URL state */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function readConfig(): Config {
  const q = new URLSearchParams(location.hash.slice(1));
  const c: Config = structuredClone(DEFAULT_CONFIG);
  for (const f of FIELDS) {
    const v = q.get(f.key);
    if (v != null) c.lists[f.key] = v.split('_').filter(Boolean).map(Number).filter(Number.isFinite);
  }
  if (q.get('em') != null) c.emirates = q.get('em')!.split('_').filter((x): x is Emirate => x === 'DXB' || x === 'AUH');
  if (q.get('cy') != null) c.cycles = q.get('cy')!.split('_').filter((x) => CYCLES.some((s) => s.key === x)) as ScenarioKey[];
  for (const e of EMIRATES)
    for (const f of EM_FIELDS) {
      const v = q.get(`${e}.${f.key}`);
      if (v != null && Number.isFinite(Number(v))) c.emFees[e][f.key] = Number(v);
    }
  for (const k of ['horizon'] as const) if (q.get(k)) c.horizon = Number(q.get(k));
  for (const k of ['colorBy', 'styleBy', 'widthBy'] as const) if (q.get(k) != null) c[k] = q.get(k)!;
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
  if (c.horizon !== d.horizon) q.set('horizon', String(c.horizon));
  for (const k of ['colorBy', 'styleBy', 'widthBy'] as const) if (c[k] !== d[k]) q.set(k, c[k]);
  const h = q.toString();
  history.replaceState(null, '', h ? `#${h}` : location.pathname);
}
