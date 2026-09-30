import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  DEFAULTS, PRESETS, SCENARIOS, VAT, marketPath, simulateAll, simulateBuy, type BuyResult, type Emirate, type Params, type SellRow,
} from './engine';
import { DEFAULT_CMP, initialCustom, readHash, writeHash, type AppState, type Compare, type Financing } from './state';
import { abbr, aed, pct } from './format';

const NOW = new Date().getFullYear();
const BUY = 'var(--buy)';
const RENT = 'var(--rent)';

export default function App() {
  const [s, setS] = useState<AppState>(readHash);
  useEffect(() => writeHash(s), [s]);

  const { p, custom } = s;
  const set = (patch: Partial<Params>) => setS((o) => ({ ...o, p: { ...o.p, ...patch } }));
  const all = useMemo(() => simulateAll(p, custom), [p, custom]);
  const X = Math.min(s.buyYear, p.maxBuyYear);
  const sel = all[X];
  const val = (r: SellRow) => (s.real ? r.advantageReal : r.advantage);

  return (
    <div className="page">
      <header className="hero">
        <h1>Rent or buy, UAE</h1>
        <p className="tagline">If I buy in year X and sell in year Y, am I better off than if I had kept renting?</p>
        <p className="intro">
          Both paths spend exactly the same money. The buyer puts cash into the down payment and fees; the renter invests
          that cash instead. Every month, whoever spends less on housing invests the difference. When the owner sells,
          they pay the agent, clear the mortgage and keep the rest. <b className="c-buy">Blue</b> means buying leaves you
          richer, <b className="c-rent">orange</b> means renting does.
        </p>
      </header>

      <div className="layout">
        <aside className="inputs">
          <Inputs s={s} setS={setS} set={set} />
        </aside>

        <main className="results">
          <BuyYearPicker all={all} X={X} onPick={(x) => setS((o) => ({ ...o, buyYear: x }))} />
          <Headline r={sel} real={s.real} />

          <section className="card">
            <h2>Presets compared: buy in {NOW + X}, sell over the years</h2>
            <p className="sub">
              Each line is one combination of the ticked presets, on top of your inputs. Above zero, buying leaves you
              richer than renting if you sell that year; below zero, renting does.
            </p>
            <PresetCompare
              p={p}
              custom={custom}
              X={X}
              real={s.real}
              cmp={s.cmp}
              setCmp={(cmp) => setS((o) => ({ ...o, cmp }))}
            />
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Buy in {NOW + X}, sell in year…</h2>
              <label className="toggle">
                <input type="checkbox" checked={s.real} onChange={(e) => setS((o) => ({ ...o, real: e.target.checked }))} />
                today's money
              </label>
            </div>
            <p className="sub">Wealth if you bought, minus wealth if you kept renting, at the moment you sell.</p>
            <AdvantageChart r={sel} val={val} />
          </section>

          <section className="card">
            <h2>Every buy year × every holding period</h2>
            <p className="sub">
              Rows: the year you buy. Columns: how many years you keep it. Tap a row to see it in detail.
            </p>
            <Heatmap all={all} X={X} val={val} onPick={(x) => setS((o) => ({ ...o, buyYear: x }))} />
          </section>

          <section className="card">
            <h2>Year by year, buying in {NOW + X}</h2>
            <p className="sub">All amounts in AED at the time of sale{s.real ? ', advantage also in today\'s money' : ''}.</p>
            <SellTable r={sel} real={s.real} />
          </section>

          <section className="card">
            <h2>What buying in {NOW + X} costs upfront</h2>
            <CostBreakdown r={sel} />
          </section>

          <section className="card">
            <h2>Market path</h2>
            <p className="sub">Price and rent, indexed to 100 today. This is where the buy year starts to matter.</p>
            <MarketChart p={p} custom={custom} />
          </section>

          <Notes />
        </main>
      </div>
      <footer className="foot">
        Not financial advice. Defaults are 2026 estimates and every one of them is editable.{' '}
        <a href="https://github.com/Zboule/rent-vs-buy-uae">Source and method</a>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ results */

function BuyYearPicker({ all, X, onPick }: { all: BuyResult[]; X: number; onPick: (x: number) => void }) {
  return (
    <div className="picker" role="tablist" aria-label="Buy year">
      <span className="picker-label">Buy in</span>
      <div className="chips">
        {all.map((b) => (
          <button key={b.buyYear} className={b.buyYear === X ? 'chip on' : 'chip'} onClick={() => onPick(b.buyYear)}>
            {b.buyYear === 0 ? `Now (${NOW})` : NOW + b.buyYear}
          </button>
        ))}
      </div>
    </div>
  );
}

function Headline({ r, real }: { r: BuyResult; real: boolean }) {
  const pick = (h: number) => r.rows.find((x) => x.held === h);
  const v = (x?: SellRow) => (x ? (real ? x.advantageReal : x.advantage) : 0);
  const marks = [1, 3, 5, 10, 20].filter((h) => pick(h));
  return (
    <section className="headline">
      <div className="verdict">
        {r.breakEven == null ? (
          <>Buying in {NOW + r.buyYear} <b className="c-rent">never catches up</b> with renting within {r.rows.length} years.</>
        ) : r.breakEven === 1 ? (
          <>Buying in {NOW + r.buyYear} <b className="c-buy">wins from the first year</b>.</>
        ) : (
          <>
            Buying in {NOW + r.buyYear} beats renting if you keep it <b className="c-buy">{r.breakEven} years or more</b>{' '}
            (sell in {NOW + r.buyYear + r.breakEven} or later).
          </>
        )}
      </div>
      <div className="tiles">
        {marks.map((h) => {
          const a = v(pick(h));
          return (
            <div className="tile" key={h}>
              <div className="tile-k">sell after {h}y</div>
              <div className={a >= 0 ? 'tile-v c-buy' : 'tile-v c-rent'}>{a >= 0 ? '+' : ''}{abbr(a)}</div>
            </div>
          );
        })}
      </div>
      <div className="facts">
        Price {aed(r.price)} · rent {aed(r.rent)}/yr · price-to-rent {(r.price / r.rent).toFixed(1)}×
        {r.costs.loan > 0 && <> · mortgage {aed(r.monthlyPayment)}/mo</>}
      </div>
    </section>
  );
}

// categorical slots, fixed order (validated palette)
const SLOTS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
// emirate × financing are carried by the line style, so colour stays for the market
const DASH: Record<string, string | undefined> = {
  'DXB-loan': undefined, 'AUH-loan': '7 4', 'DXB-cash': '2 3', 'AUH-cash': '9 3 2 3',
};
const EM_LABEL: Record<Emirate, string> = { DXB: 'Dubai', AUH: 'Abu Dhabi' };
const FIN_LABEL: Record<Financing, string> = { loan: 'mortgage', cash: 'cash buyer' };
// optimistic -> pessimistic
const TRENDS = [0.07, 0.05, 0.03, 0.01, -0.02];
const TREND_NAME: Record<string, string> = { '0.07': 'Hot', '0.05': 'Strong', '0.03': 'Moderate', '0.01': 'Flat', '-0.02': 'Falling' };
const RETURNS = [0.04, 0.06, 0.08, 0.1];
const signed = (x: number) => `${x >= 0 ? '+' : ''}${pct(x)}`;

/** Round tick values (1/2/2.5/5 × 10^n) covering lo..hi, always including 0. */
function niceTicks(lo: number, hi: number, target = 5): number[] {
  const raw = Math.max(1, hi - lo) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw)!;
  const out: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= Math.ceil(hi / step) * step + step / 2; t += step) out.push(t);
  return out;
}

interface Series { key: string; name: string; color: string; dash?: string; mine: boolean; byRet: Record<string, SellRow[]> }

function PresetCompare({
  p, custom, X, real, cmp, setCmp,
}: { p: Params; custom: number[]; X: number; real: boolean; cmp: Compare; setCmp: (c: Compare) => void }) {
  const toggle = <K extends keyof Compare>(k: K, v: string) => {
    const cur = cmp[k] as string[];
    setCmp({ ...cmp, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const scenarios = SCENARIOS.filter((x) => x.key !== 'custom' || p.scenario === 'custom');
  const trendKeys = ['in', ...TRENDS.map(String)].filter((k) => cmp.g.includes(k));
  const scKeys = scenarios.map((x) => x.key).filter((k) => cmp.sc.includes(k));
  const retKeys = ['in', ...RETURNS.map(String)].filter((k) => cmp.r.includes(k));
  const emKeys = (['DXB', 'AUH'] as Emirate[]).filter((e) => cmp.em.includes(e));
  const finKeys = (['loan', 'cash'] as Financing[]).filter((f) => cmp.fin.includes(f));
  const trendVal = (k: string) => (k === 'in' ? p.priceGrowth : Number(k));
  const retVal = (k: string) => (k === 'in' ? p.investReturn : Number(k));
  const trendLabel = (k: string) => (k === 'in' ? `Your input, ${signed(p.priceGrowth)}/yr` : `${TREND_NAME[k]}, ${signed(Number(k))}/yr`);
  const retLabel = (k: string) => (k === 'in' ? `your input, ${pct(p.investReturn)}` : pct(Number(k)));

  const combos = trendKeys.flatMap((g) => scKeys.map((sc) => ({ g, sc })));
  const tooMany = combos.length > SLOTS.length;

  const series = useMemo<Series[]>(() => {
    const out: Series[] = [];
    combos.slice(0, SLOTS.length).forEach(({ g, sc }, ci) => {
      for (const em of emKeys)
        for (const fin of finKeys) {
          const byRet: Record<string, SellRow[]> = {};
          for (const r of retKeys) {
            const q: Params = {
              ...p,
              ...(em !== p.emirate ? { ...PRESETS[em], emirate: em } : {}),
              scenario: sc,
              priceGrowth: trendVal(g),
              investReturn: retVal(r),
              downPct: fin === 'cash' ? 1 : p.downPct,
            };
            byRet[r] = simulateBuy(q, X, custom).rows;
          }
          const name = [
            trendKeys.length > 1 || g !== 'in' ? trendLabel(g) : '',
            scKeys.length > 1 || sc !== 'steady' ? SCENARIOS.find((x) => x.key === sc)!.label : '',
            emKeys.length > 1 || em !== p.emirate ? EM_LABEL[em] : '',
            finKeys.length > 1 || fin !== 'loan' ? FIN_LABEL[fin] : '',
          ].filter(Boolean).join(' · ') || 'Your inputs';
          out.push({
            key: `${g}|${sc}|${em}|${fin}`,
            name,
            color: SLOTS[ci],
            dash: DASH[`${em}-${fin}`],
            mine: g === 'in' && sc === p.scenario && em === p.emirate && (fin === 'cash') === (p.downPct >= 1),
            byRet,
          });
        }
    });
    return out;
  }, [p, custom, X, cmp]);

  const v = (r: SellRow) => (real ? r.advantageReal : r.advantage);
  const all = series.flatMap((s) => retKeys.flatMap((r) => s.byRet[r].map(v)));
  const lo = Math.min(0, ...all);
  const ticks = niceTicks(lo, Math.max(0, ...all)).filter((t) => t >= lo || t === 0);
  const yDomain = [Math.min(lo * 1.1, ticks[0]), ticks[ticks.length - 1]];
  const breakEven = (rows: SellRow[]) => {
    const i = rows.findIndex((_, j) => rows.slice(j).every((x) => x.advantage > 0));
    return i < 0 ? null : rows[i].held;
  };

  const Box = ({ on, label, onClick, dash }: { on: boolean; label: string; onClick: () => void; dash?: string }) => (
    <label className={on ? 'cbx on' : 'cbx'}>
      <input type="checkbox" checked={on} onChange={onClick} />
      {dash !== undefined && (
        <svg width="22" height="8" className="dashsw"><line x1="0" y1="4" x2="22" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray={dash || undefined} /></svg>
      )}
      {label}
    </label>
  );

  return (
    <>
      <div className="cmp">
        <div className="cmp-g">
          <div className="cmp-h">Price trend (optimistic to pessimistic)</div>
          {['in', ...TRENDS.map(String)].map((k) => (
            <Box key={k} on={cmp.g.includes(k)} label={trendLabel(k)} onClick={() => toggle('g', k)} />
          ))}
          <div className="cmp-h">Market cycle</div>
          {scenarios.map((x) => (
            <Box key={x.key} on={cmp.sc.includes(x.key)} label={x.label} onClick={() => toggle('sc', x.key)} />
          ))}
        </div>
        <div className="cmp-g">
          <div className="cmp-h">Investment return (one panel each)</div>
          {['in', ...RETURNS.map(String)].map((k) => (
            <Box key={k} on={cmp.r.includes(k)} label={k === 'in' ? `Your input, ${pct(p.investReturn)}/yr` : `${pct(Number(k))}/yr`} onClick={() => toggle('r', k)} />
          ))}
          <div className="cmp-h">Emirate fees</div>
          {(['DXB', 'AUH'] as Emirate[]).map((e) => (
            <Box key={e} on={cmp.em.includes(e)} label={EM_LABEL[e]} dash={DASH[`${e}-loan`] ?? ''} onClick={() => toggle('em', e)} />
          ))}
          <div className="cmp-h">Financing</div>
          {(['loan', 'cash'] as Financing[]).map((f) => (
            <Box key={f} on={cmp.fin.includes(f)} label={f === 'loan' ? `Mortgage (${pct(1 - Math.min(1, p.downPct))} loan)` : 'Cash buyer'} dash={DASH[`DXB-${f}`] ?? ''} onClick={() => toggle('fin', f)} />
          ))}
        </div>
      </div>
      {tooMany && <p className="warn small">Colours are capped at 8 trend × cycle combinations; untick some to see the rest.</p>}
      {series.length === 0 || retKeys.length === 0 ? (
        <p className="muted">Tick at least one box in each group.</p>
      ) : (
        <>
          <div className="cmp-legend">
            {series.map((s) => (
              <div key={s.key} className="cmp-li">
                <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={s.color} strokeWidth={s.mine ? 3 : 2} strokeDasharray={s.dash} /></svg>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
          <div className={retKeys.length > 1 ? 'panels multi' : 'panels'}>
            {retKeys.map((r) => {
              const data = series[0].byRet[r].map((row, i) => {
                const d: Record<string, number> = { year: NOW + row.sellYear, held: row.held };
                for (const s of series) d[s.key] = v(s.byRet[r][i]);
                return d;
              });
              return (
                <div className="panel" key={r}>
                  <div className="panel-t">Investments earn {retLabel(r)}/yr</div>
                  <ResponsiveContainer width="100%" height={retKeys.length > 1 ? 220 : 300}>
                    <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--grid)" />
                      <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={14} />
                      <YAxis domain={yDomain} ticks={ticks} tickFormatter={(x) => abbr(x)} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={56} tickLine={false} axisLine={false} />
                      <ReferenceLine y={0} stroke="var(--axis)" strokeWidth={1.5} />
                      <Tooltip
                        cursor={{ stroke: 'var(--axis)', strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as Record<string, number>;
                          const sorted = [...series].sort((a, b) => d[b.key] - d[a.key]);
                          return (
                            <div className="tip">
                              <div className="tip-t">Sell in {d.year} (held {d.held}y), invest at {retLabel(r)}</div>
                              {sorted.map((s) => (
                                <div key={s.key} className="tip-row">
                                  <span className="sw" style={{ background: s.color }} />
                                  <span className="tip-n">{s.name}</span>
                                  <span className={d[s.key] >= 0 ? 'c-buy' : 'c-rent'}>{d[s.key] >= 0 ? '+' : ''}{abbr(d[s.key])}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      {series.map((s) => (
                        <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={s.mine ? 3 : 2}
                          strokeDasharray={s.dash} dot={false} activeDot={{ r: 4, stroke: 'var(--panel)', strokeWidth: 2 }} isAnimationActive={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
          <div className="table-wrap">
            <table className="grid be-table">
              <thead>
                <tr>
                  <th>Break-even holding period</th>
                  {retKeys.map((r) => <th key={r}>invest {retLabel(r)}</th>)}
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.key}>
                    <td><span className="sw" style={{ background: s.color }} /> {s.name}</td>
                    {retKeys.map((r) => {
                      const b = breakEven(s.byRet[r]);
                      return <td key={r} className={b == null ? 'c-rent' : 'c-buy'}>{b == null ? 'never' : `${b}y`}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function AdvantageChart({ r, val }: { r: BuyResult; val: (x: SellRow) => number }) {
  const data = r.rows.map((x) => ({ year: NOW + x.sellYear, held: x.held, v: val(x) }));
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis tickFormatter={(v) => abbr(v)} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={62} tickLine={false} axisLine={false} />
          <ReferenceLine y={0} stroke="var(--axis)" />
          <Tooltip
            cursor={{ fill: 'var(--hover)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div className="tip">
                  <div className="tip-t">Sell in {d.year} (held {d.held}y)</div>
                  <div className={d.v >= 0 ? 'c-buy' : 'c-rent'}>
                    {d.v >= 0 ? 'Buying ahead by ' : 'Renting ahead by '}{aed(Math.abs(d.v))}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="v" radius={[4, 4, 4, 4]} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.year} fill={d.v >= 0 ? BUY : RENT} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// diverging scale: rent pole (orange) <- neutral gray -> buy pole (blue)
function cellColor(v: number, max: number): string {
  const t = Math.max(-1, Math.min(1, v / max));
  const a = Math.sqrt(Math.abs(t));
  const pole = t >= 0 ? 'var(--buy)' : 'var(--rent)';
  return `color-mix(in oklab, ${pole} ${Math.round(a * 100)}%, var(--mid))`;
}

function Heatmap({ all, X, val, onPick }: { all: BuyResult[]; X: number; val: (x: SellRow) => number; onPick: (x: number) => void }) {
  const [hover, setHover] = useState<{ b: number; h: number } | null>(null);
  const max = Math.max(1, ...all.flatMap((b) => b.rows.map((x) => Math.abs(val(x)))));
  const holds = all[0].rows.map((x) => x.held);
  const hv = hover ? all[hover.b].rows[hover.h - 1] : null;
  return (
    <>
      <div className="heat-read">
        {hv ? (
          <>
            Buy {NOW + hover!.b}, sell {NOW + hv.sellYear} ({hv.held}y):{' '}
            <b className={val(hv) >= 0 ? 'c-buy' : 'c-rent'}>
              {val(hv) >= 0 ? 'buying ahead by ' : 'renting ahead by '}{aed(Math.abs(val(hv)))}
            </b>
          </>
        ) : (
          <span className="muted">Hover or tap a cell for its value.</span>
        )}
      </div>
      <div className="heat-wrap">
        <table className="heat" onMouseLeave={() => setHover(null)}>
          <thead>
            <tr>
              <th className="rowh">buy \ held</th>
              {holds.map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {all.map((b) => (
              <tr key={b.buyYear} className={b.buyYear === X ? 'sel' : ''} onClick={() => onPick(b.buyYear)}>
                <th className="rowh">{NOW + b.buyYear}</th>
                {b.rows.map((x) => (
                  <td
                    key={x.held}
                    style={{ background: cellColor(val(x), max) }}
                    className={b.breakEven === x.held ? 'be' : ''}
                    onMouseEnter={() => setHover({ b: b.buyYear, h: x.held })}
                    onTouchStart={() => setHover({ b: b.buyYear, h: x.held })}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="heat-legend">
        <span className="c-rent">renting ahead {abbr(max)}</span>
        <span className="bar" />
        <span className="c-buy">buying ahead {abbr(max)}</span>
        <span className="muted">· outlined cell = break-even</span>
      </div>
    </>
  );
}

function SellTable({ r, real }: { r: BuyResult; real: boolean }) {
  return (
    <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            <th>Sell</th><th>Held</th><th>Sale price</th><th>Selling costs</th><th>Loan left</th><th>Net from sale</th>
            <th>Owner's savings</th><th>Owner total</th><th>Renter total</th><th>Buy vs rent</th>
            {real && <th>in today's AED</th>}
          </tr>
        </thead>
        <tbody>
          {r.rows.map((x) => (
            <tr key={x.held} className={r.breakEven === x.held ? 'be' : ''}>
              <td>{NOW + x.sellYear}</td>
              <td>{x.held}y</td>
              <td>{abbr(x.salePrice)}</td>
              <td>−{abbr(x.sellCosts)}</td>
              <td>{x.loanLeft >= 1 ? `−${abbr(x.loanLeft)}` : '0'}</td>
              <td>{abbr(x.netProceeds)}</td>
              <td>{abbr(x.ownerPortfolio)}</td>
              <td>{abbr(x.ownerWealth)}</td>
              <td>{abbr(x.renterWealth)}</td>
              <td className={x.advantage >= 0 ? 'c-buy b' : 'c-rent b'}>{x.advantage >= 0 ? '+' : ''}{abbr(x.advantage)}</td>
              {real && <td className={x.advantageReal >= 0 ? 'c-buy' : 'c-rent'}>{x.advantageReal >= 0 ? '+' : ''}{abbr(x.advantageReal)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CostBreakdown({ r }: { r: BuyResult }) {
  const c = r.costs;
  const rows: [string, number][] = [
    ['Down payment', c.down],
    ['Transfer fee (DLD / DMT)', c.transfer],
    ['Agent commission incl. VAT', c.agent],
    ['Registration & trustee', c.registration],
    ['Mortgage: registration, bank fee, valuation', c.mortgageFees],
    ['Moving in', c.moveIn],
  ];
  return (
    <div className="costs">
      {rows.filter(([, v]) => v > 0).map(([k, v]) => (
        <div className="cost" key={k}><span>{k}</span><span>{aed(v)}</span></div>
      ))}
      <div className="cost total"><span>Cash needed at purchase</span><span>{aed(c.upfront)}</span></div>
      <div className="cost muted"><span>of which sunk costs (not equity)</span><span>{aed(c.total)} · {pct(c.total / r.price)} of price</span></div>
      {c.loan > 0 && <div className="cost muted"><span>Loan</span><span>{aed(c.loan)}</span></div>}
    </div>
  );
}

function MarketChart({ p, custom }: { p: Params; custom: number[] }) {
  const n = p.maxBuyYear + p.maxHold;
  const m = marketPath(p, custom, n);
  let pi = 100, ri = 100;
  const data = [{ year: NOW, price: 100, rent: 100 }];
  for (let y = 0; y < n; y++) {
    pi *= 1 + m.price[y];
    ri *= 1 + m.rent[y];
    data.push({ year: NOW + y + 1, price: +pi.toFixed(1), rent: +ri.toFixed(1) });
  }
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} width={40} tickLine={false} axisLine={false} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="tip">
                  <div className="tip-t">{label}</div>
                  <div>Price index {payload[0].payload.price}</div>
                  <div>Rent index {payload[0].payload.rent}</div>
                </div>
              ) : null
            }
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
          <Line type="monotone" dataKey="price" name="Property price" stroke="var(--buy)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="rent" name="Rent" stroke="var(--rent)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Notes() {
  return (
    <section className="card notes">
      <h2>How it works and what it leaves out</h2>
      <ul>
        <li>
          <b>Same money on both sides.</b> At purchase the renter invests the buyer's down payment and fees. Each month the
          cheaper side invests the gap (often the renter early on, the owner once the mortgage is paid off). Both pots earn
          the investment return.
        </li>
        <li>
          <b>No property tax, no capital gains tax</b> in the UAE. If your home country taxes you on investment gains, set
          the tax on returns.
        </li>
        <li>
          <b>Down payment rules (Central Bank):</b> expats need at least 20% up to AED 5M and 30% above; UAE nationals 15% /
          25%; second homes and off-plan need more (about 35-50%). Check with your bank.
        </li>
        <li>
          <b>Early settlement fee</b> is capped by the Central Bank at 1% of the outstanding loan or AED 10,000, whichever
          is lower. Some fixed-rate deals charge more when you break the fixed period; adjust if yours does.
        </li>
        <li>
          <b>Housing fee.</b> Dubai charges 5% of the rental value through DEWA to tenants and owner-occupiers alike, so it
          mostly cancels out. In Abu Dhabi expat tenants pay 5% of rent to the municipality; owner-occupiers are set to 0 by
          default, change it if you are charged.
        </li>
        <li>
          <b>Not counted:</b> the security deposit (5-10% of rent, returned), off-plan payment plans, renting the
          property out, a Golden Visa (property worth AED 2M or more qualifies, a real non-financial benefit), and the
          freedom to leave the country quickly.
        </li>
        <li>
          <b>Why the buy year matters.</b> With steady growth every row of the grid is nearly the same. Pick a market
          scenario (a crash, a slump) to see how timing changes the answer.
        </li>
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ inputs */

type Kind = 'aed' | 'pct' | 'yrs';

function Num({
  label, value, onChange, kind, hint, step,
}: { label: string; value: number; onChange: (v: number) => void; kind: Kind; hint?: ReactNode; step?: number }) {
  const shown = kind === 'pct' ? +(value * 100).toFixed(3) : value;
  const [txt, setTxt] = useState(String(shown));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setTxt(String(shown));
  }, [shown, focus]);
  const commit = (t: string) => {
    setTxt(t);
    const n = Number(t.replace(/,/g, ''));
    if (t.trim() !== '' && Number.isFinite(n)) onChange(kind === 'pct' ? n / 100 : n);
  };
  return (
    <label className="field">
      <span className="field-l">{label}</span>
      <span className="field-in">
        {kind === 'aed' && <span className="unit pre">AED</span>}
        <input
          inputMode="decimal"
          value={focus ? txt : kind === 'aed' ? Number(shown).toLocaleString('en-US') : txt}
          step={step}
          onFocus={() => { setFocus(true); setTxt(String(shown)); }}
          onBlur={() => setFocus(false)}
          onChange={(e) => commit(e.target.value)}
        />
        {kind === 'pct' && <span className="unit">%</span>}
        {kind === 'yrs' && <span className="unit">yrs</span>}
      </span>
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

const PHONE = typeof window !== 'undefined' && window.matchMedia('(max-width: 880px)').matches;

function Group({ title, summary, children, open }: { title: string; summary?: string; children: ReactNode; open?: boolean }) {
  // on phones only the first group starts open, so the results are not buried under the inputs
  const [isOpen] = useState(PHONE ? title === 'Property & mortgage' : !!open);
  return (
    <details className="group" open={isOpen}>
      <summary>
        <span>{title}</span>
        {summary && <span className="gsum">{summary}</span>}
      </summary>
      <div className="gbody">{children}</div>
    </details>
  );
}

function Inputs({ s, setS, set }: { s: AppState; setS: (f: (o: AppState) => AppState) => void; set: (p: Partial<Params>) => void }) {
  const { p } = s;
  const loan = p.price * (1 - p.downPct);
  const setEmirate = (e: Emirate) => set({ ...PRESETS[e], emirate: e });
  const minDown = p.price > 5_000_000 ? 0.3 : 0.2;
  const sc = SCENARIOS.find((x) => x.key === p.scenario)!;
  return (
    <div className="form">
      <div className="seg" role="radiogroup" aria-label="Emirate">
        {(['DXB', 'AUH'] as Emirate[]).map((e) => (
          <button key={e} className={p.emirate === e ? 'on' : ''} onClick={() => setEmirate(e)}>
            {e === 'DXB' ? 'Dubai' : 'Abu Dhabi'}
          </button>
        ))}
      </div>

      <Group title="Property & mortgage" summary={`${abbr(p.price)} · ${pct(p.downPct)} down`} open>
        <Num label="Property price today" kind="aed" value={p.price} onChange={(v) => set({ price: v })} />
        <Num
          label="Down payment"
          kind="pct"
          value={p.downPct}
          onChange={(v) => set({ downPct: v })}
          hint={
            <>
              Loan {aed(loan)}.{' '}
              {p.downPct < minDown && p.downPct < 1 ? (
                <span className="warn">Expats need at least {pct(minDown)} at this price.</span>
              ) : p.downPct >= 1 ? 'Cash buyer.' : `Expat minimum ${pct(minDown)}.`}
            </>
          }
        />
        <Num label="Fixed rate" kind="pct" value={p.fixedRate} onChange={(v) => set({ fixedRate: v })} />
        <Num label="Fixed for" kind="yrs" value={p.fixedYears} onChange={(v) => set({ fixedYears: v })} />
        <Num
          label="Rate after fixed period"
          kind="pct"
          value={p.varRate}
          onChange={(v) => set({ varRate: v })}
          hint="3-month EIBOR (4.2% in Sept 2026) + about 1.75%"
        />
        <Num label="Mortgage term" kind="yrs" value={p.term} onChange={(v) => set({ term: v })} hint="Max 25 years, must end by age 65 for most expats" />
      </Group>

      <Group title="Renting" summary={`${abbr(p.rent)}/yr · +${pct(p.rentGrowth)}`} open>
        <Num label="Annual rent for a similar home" kind="aed" value={p.rent} onChange={(v) => set({ rent: v })} hint={`Gross yield ${pct(p.rent / p.price)}`} />
        <Num label="Rent increase per year" kind="pct" value={p.rentGrowth} onChange={(v) => set({ rentGrowth: v })} />
        <Num label={p.emirate === 'DXB' ? 'Housing fee (DEWA)' : 'Municipality fee'} kind="pct" value={p.renterHousingFeePct} onChange={(v) => set({ renterHousingFeePct: v })} hint="% of annual rent" />
        <Num label="Move every" kind="yrs" value={p.moveEveryYears} onChange={(v) => set({ moveEveryYears: v })} hint="0 = never move" />
        <Num label="Agent fee per move" kind="pct" value={p.rentAgentPct} onChange={(v) => set({ rentAgentPct: v })} hint="% of annual rent, + VAT" />
        <Num label="Other costs per move" kind="aed" value={p.moveCost} onChange={(v) => set({ moveCost: v })} hint="Movers, Ejari/Tawtheeq, reconnection" />
      </Group>

      <Group title="Market" summary={`${pct(p.priceGrowth)}/yr · ${sc.label}`} open>
        <Num label="Property price change per year" kind="pct" value={p.priceGrowth} onChange={(v) => set({ priceGrowth: v })} />
        <label className="field">
          <span className="field-l">Scenario</span>
          <select
            value={p.scenario}
            onChange={(e) => {
              const key = e.target.value as Params['scenario'];
              setS((o) => ({
                ...o,
                p: { ...o.p, scenario: key },
                custom: key === 'custom' ? marketPath(o.p, o.custom, o.p.maxBuyYear + o.p.maxHold).price : o.custom,
              }));
            }}
          >
            {SCENARIOS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <span className="hint">{sc.note}</span>
        </label>
        <Num label="Rents follow price swings by" kind="pct" value={p.rentFollows} onChange={(v) => set({ rentFollows: v })} hint="100% = rents move as much as prices in a crash or boom" />
        {p.scenario === 'custom' && (
          <div className="custom">
            <div className="custom-h">
              Price change per year
              <button className="link" onClick={() => setS((o) => ({ ...o, custom: initialCustom(o.p) }))}>reset</button>
            </div>
            <div className="custom-grid">
              {Array.from({ length: p.maxBuyYear + p.maxHold }, (_, i) => s.custom[i] ?? p.priceGrowth).map((g, i) => (
                <Num
                  key={i}
                  label={String(NOW + i)}
                  kind="pct"
                  value={g}
                  onChange={(v) => setS((o) => { const c = [...o.custom]; while (c.length <= i) c.push(o.p.priceGrowth); c[i] = v; return { ...o, custom: c }; })}
                />
              ))}
            </div>
          </div>
        )}
      </Group>

      <Group title="Investing the difference" summary={`${pct(p.investReturn)}/yr`} open>
        <Num label="Investment return per year" kind="pct" value={p.investReturn} onChange={(v) => set({ investReturn: v })} hint="What cash not tied up in the home earns" />
        <Num label="Tax on returns" kind="pct" value={p.investTax} onChange={(v) => set({ investTax: v })} hint="0 in the UAE; set it if your home country taxes you" />
        <Num label="Inflation" kind="pct" value={p.inflation} onChange={(v) => set({ inflation: v })} hint="Only used for the today's-money view" />
      </Group>

      <Group title="Buying costs" summary={`${pct(p.transferPct)} transfer + ${pct(p.buyAgentPct)} agent`}>
        <Num label={p.emirate === 'DXB' ? 'DLD transfer fee' : 'DMT transfer fee'} kind="pct" value={p.transferPct} onChange={(v) => set({ transferPct: v })} />
        <Num label="Agent commission" kind="pct" value={p.buyAgentPct} onChange={(v) => set({ buyAgentPct: v })} hint={`+ ${pct(VAT)} VAT`} />
        <Num label="Title deed + trustee office" kind="aed" value={p.regFixed} onChange={(v) => set({ regFixed: v })} hint="Incl. VAT" />
        <Num label="Mortgage registration" kind="pct" value={p.mortgageRegPct} onChange={(v) => set({ mortgageRegPct: v })} hint="% of loan" />
        <Num label="Mortgage registration, fixed" kind="aed" value={p.mortgageRegFixed} onChange={(v) => set({ mortgageRegFixed: v })} />
        <Num label="Bank arrangement fee" kind="pct" value={p.bankFeePct} onChange={(v) => set({ bankFeePct: v })} hint="% of loan (max 1%), + VAT" />
        <Num label="Valuation" kind="aed" value={p.valuation} onChange={(v) => set({ valuation: v })} />
        <Num label="Moving in" kind="aed" value={p.moveInCost} onChange={(v) => set({ moveInCost: v })} hint="Movers, DEWA/ADDC deposit, small fixes" />
      </Group>

      <Group title="Owning costs" summary={`${abbr(p.serviceCharge)}/yr service`}>
        <Num label="Service charges per year" kind="aed" value={p.serviceCharge} onChange={(v) => set({ serviceCharge: v })} hint="Usually AED 12-30 per sq ft" />
        <Num label="Service charge increase" kind="pct" value={p.serviceChargeGrowth} onChange={(v) => set({ serviceChargeGrowth: v })} />
        <Num label="Maintenance per year" kind="pct" value={p.maintenancePct} onChange={(v) => set({ maintenancePct: v })} hint="% of property value (more for villas)" />
        <Num label="Home insurance per year" kind="pct" value={p.insurancePct} onChange={(v) => set({ insurancePct: v })} hint="% of property value" />
        <Num label="Mortgage life insurance" kind="pct" value={p.lifeInsPct} onChange={(v) => set({ lifeInsPct: v })} hint="% of loan balance per year" />
        <Num label="Owner housing fee" kind="pct" value={p.ownerHousingFeePct} onChange={(v) => set({ ownerHousingFeePct: v })} hint="% of equivalent rent" />
      </Group>

      <Group title="Selling costs" summary={`${pct(p.sellAgentPct)} agent`}>
        <Num label="Agent commission" kind="pct" value={p.sellAgentPct} onChange={(v) => set({ sellAgentPct: v })} hint={`+ ${pct(VAT)} VAT`} />
        <Num label="Other selling fees" kind="aed" value={p.sellFixed} onChange={(v) => set({ sellFixed: v })} hint="Developer NOC, mortgage release" />
        <Num label="Early settlement fee" kind="pct" value={p.earlySettlePct} onChange={(v) => set({ earlySettlePct: v })} hint="% of loan left..." />
        <Num label="...capped at" kind="aed" value={p.earlySettleCap} onChange={(v) => set({ earlySettleCap: v })} />
      </Group>

      <Group title="Horizon">
        <Num label="Latest buy year" kind="yrs" value={p.maxBuyYear} onChange={(v) => set({ maxBuyYear: Math.max(0, Math.min(20, Math.round(v))) })} hint="Years from now" />
        <Num label="Longest holding period" kind="yrs" value={p.maxHold} onChange={(v) => set({ maxHold: Math.max(1, Math.min(35, Math.round(v))) })} />
      </Group>

      <button
        className="reset"
        onClick={() => setS(() => ({ p: { ...DEFAULTS }, custom: initialCustom(DEFAULTS), buyYear: 0, real: false, cmp: DEFAULT_CMP }))}
      >
        Reset everything
      </button>
    </div>
  );
}
