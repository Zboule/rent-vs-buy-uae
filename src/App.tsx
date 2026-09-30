import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { breakEvenOf, SCENARIOS, type Emirate, type ScenarioKey } from './engine';
import {
  CYCLES, DEFAULT_CONFIG, EMIRATES, EM_FIELDS, EM_LABEL, FIELDS, MAX_LINES, NOW, lines, readConfig, writeConfig,
  type Config, type Dim, type Kind, type LineDef,
} from './config';
import { abbr } from './format';

// categorical slots in fixed order (validated palette), then line styles and widths
const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
const DASHES = ['', '9 4', '2 3', '12 3 2 3', '5 5', '1 3', '16 6', '6 2 2 2 2 2'];
const WIDTHS = [2.6, 1.2, 1.9];

export default function App() {
  const [c, setC] = useState<Config>(readConfig);
  useEffect(() => writeConfig(c), [c]);
  const res = useMemo(() => lines(c), [c]);

  return (
    <div className="page">
      <header className="hero">
        <h1>Rent or buy, UAE</h1>
      </header>
      <div className="layout">
        <main className="results">
          <Graph c={c} setC={setC} res={res} />
        </main>
        <aside className="inputs">
          <ConfigForm c={c} setC={setC} total={res.total} />
        </aside>
      </div>
      <footer className="foot">
        Not financial advice. 2026 defaults, all editable. <a href="https://github.com/Zboule/rent-vs-buy-uae">Source and method</a>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ graph */

function niceTicks(lo: number, hi: number, target = 6): number[] {
  const raw = Math.max(1, hi - lo) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw)!;
  const out: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= Math.ceil(hi / step) * step + step / 2; t += step) out.push(Math.round(t));
  return out;
}

function Swatch({ color, dash, width }: { color: string; dash: string; width: number }) {
  return (
    <svg width="28" height="10" className="swatch">
      <line x1="0" y1="5" x2="28" y2="5" stroke={color} strokeWidth={width + 0.4} strokeDasharray={dash || undefined} />
    </svg>
  );
}

interface Styled extends LineDef { color: string; dash: string; width: number }

function Graph({ c, setC, res }: { c: Config; setC: (f: (o: Config) => Config) => void; res: ReturnType<typeof lines> }) {
  const { varying } = res;
  const vKeys = varying.map((d) => d.key);
  // which dimension drives colour / line style / thickness
  const pick = (want: string, taken: string[]) =>
    vKeys.includes(want) && !taken.includes(want) ? want : vKeys.find((k) => !taken.includes(k)) ?? '';
  const colorBy = pick(c.colorBy, []);
  const styleBy = pick(c.styleBy, [colorBy]);
  const widthBy = pick(c.widthBy, [colorBy, styleBy]);
  const dimOf = (k: string) => varying.find((d) => d.key === k);
  const idx = (k: string, v: number | string) => (dimOf(k)?.values ?? []).indexOf(v as never);

  // name each line in the order colour, style, thickness, then the rest
  const order = [colorBy, styleBy, widthBy, ...vKeys].filter((k, i, a) => k && a.indexOf(k) === i);
  const styled: Styled[] = res.lines.map((l) => ({
    ...l,
    name: order.filter((k) => l.parts[k]).map((k) => l.parts[k]).join(' · ') || 'Your inputs',
    color: colorBy ? COLORS[idx(colorBy, l.combo[colorBy]) % COLORS.length] : COLORS[0],
    dash: styleBy ? DASHES[idx(styleBy, l.combo[styleBy]) % DASHES.length] : '',
    width: widthBy ? WIDTHS[idx(widthBy, l.combo[widthBy]) % WIDTHS.length] : 2.2,
  }));

  const [focus, setFocus] = useState<{ k: string; v: number | string } | null>(null);
  const on = (l: Styled) => !focus || l.combo[focus.k] === focus.v;

  const buys = c.lists.buyYear.length ? c.lists.buyYear : [0];
  const minBuy = Math.min(...buys);
  const maxBuy = Math.max(...buys);
  const years: number[] = [];
  for (let y = minBuy + 1; y <= maxBuy + c.horizon; y++) years.push(NOW + y);
  const data = years.map((year) => {
    const d: Record<string, number | null> = { year };
    for (const l of styled) {
      const r = l.rows.find((x) => NOW + x.sellYear === year);
      d[l.id] = r ? r.advantage : null;
    }
    return d;
  });

  const [active, setActive] = useState<number | null>(null);
  // default to the end of the horizon: the question is usually 'where do I stand if I sell then'
  const activeYear = active != null && years.includes(active) ? active : years[years.length - 1];

  if (!styled.length) {
    return (
      <section className="card">
        <p className="muted">Enter at least one value in every field, and tick at least one emirate and one price scenario.</p>
      </section>
    );
  }

  const vals = styled.filter(on).flatMap((l) => l.rows.map((r) => r.advantage));
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];

  const readout = styled
    .filter(on)
    .map((l) => ({ l, r: l.rows.find((x) => NOW + x.sellYear === activeYear) }))
    .filter((x) => x.r)
    .sort((a, b) => b.r!.advantage - a.r!.advantage);

  const EncSelect = ({ label, value, field }: { label: string; value: string; field: 'colorBy' | 'styleBy' | 'widthBy' }) => (
    <label className="enc">
      <span>{label}</span>
      <select value={value} onChange={(e) => setC((o) => ({ ...o, [field]: e.target.value }))}>
        {varying.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
      </select>
    </label>
  );

  const Key = ({ d, kind }: { d: Dim; kind: 'color' | 'style' | 'width' }) => (
    <div className="key-col">
      {d.values.map((v, i) => {
        const f = !!focus && focus.k === d.key && focus.v === v;
        return (
          <button key={String(v)} className={f ? 'key on' : 'key'} onClick={() => setFocus(f ? null : { k: d.key, v })}>
            <Swatch
              color={kind === 'color' ? COLORS[i % COLORS.length] : 'var(--text2)'}
              dash={kind === 'style' ? DASHES[i % DASHES.length] : ''}
              width={kind === 'width' ? WIDTHS[i % WIDTHS.length] : 2}
            />
            {d.tag(v)}
          </button>
        );
      })}
    </div>
  );

  return (
    <section className="card graph">
      <div className="graph-head">
        <h2>
          {styled.length} line{styled.length > 1 ? 's' : ''}
        </h2>
        {res.total > MAX_LINES && <span className="warn small">showing the first {MAX_LINES} of {res.total} combinations</span>}
        <div className="horizon" role="radiogroup" aria-label="Horizon">
          <span className="muted small">Next</span>
          {[3, 6, 10, 15, 25].map((h) => (
            <button key={h} className={c.horizon === h ? 'chip on' : 'chip'} onClick={() => setC((o) => ({ ...o, horizon: h }))}>
              {h}y
            </button>
          ))}
          <input
            className="hz-in"
            inputMode="numeric"
            aria-label="Years to show"
            value={c.horizon}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              if (n >= 1 && n <= 35) setC((o) => ({ ...o, horizon: n }));
            }}
          />
        </div>
      </div>

      {varying.length > 0 && (
        <>
          <div className="encodings">
            <div>
              <EncSelect label="Colour" value={colorBy} field="colorBy" />
              <Key d={dimOf(colorBy)!} kind="color" />
            </div>
            {styleBy && (
              <div>
                <EncSelect label="Line style" value={styleBy} field="styleBy" />
                <Key d={dimOf(styleBy)!} kind="style" />
              </div>
            )}
            {widthBy && (
              <div>
                <EncSelect label="Thickness" value={widthBy} field="widthBy" />
                <Key d={dimOf(widthBy)!} kind="width" />
              </div>
            )}
          </div>
          <p className="hint">Tap a value to show only its lines. Tap the chart to read a year below.</p>
        </>
      )}

      <div className="chart">
        <ResponsiveContainer width="100%" height={420}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            onMouseMove={(e) => e?.activeLabel != null && setActive(Number(e.activeLabel))}
            onClick={(e) => e?.activeLabel != null && setActive(Number(e.activeLabel))}
          >
            <ReferenceArea y1={0} y2={y1} fill="var(--buy)" fillOpacity={0.06} ifOverflow="hidden" />
            <ReferenceArea y1={y0} y2={0} fill="var(--rent)" fillOpacity={0.09} ifOverflow="hidden" />
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={12} />
            <YAxis
              domain={[y0, y1]}
              ticks={ticks}
              tickFormatter={(x) => abbr(x)}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              width={56}
              tickLine={false}
              axisLine={false}
              allowDataOverflow
            />
            <ReferenceLine y={0} stroke="var(--axis)" strokeWidth={1.5} />
            <ReferenceLine x={activeYear} stroke="var(--axis)" strokeDasharray="3 3" />
            {styled.map((l) => (
              <Line
                key={l.id}
                dataKey={l.id}
                stroke={l.color}
                strokeWidth={l.width}
                strokeDasharray={l.dash || undefined}
                strokeOpacity={on(l) ? 1 : 0.07}
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="zone-labels">
          <span className="c-buy">▲ buying cheaper</span>
          <span className="c-rent">▼ renting cheaper</span>
        </div>
      </div>

      <div className="readout">
        <div className="readout-h">
          <button className="step" onClick={() => setActive(Math.max(years[0], activeYear - 1))} aria-label="Previous year">‹</button>
          <b>Sell in {activeYear}</b>
          <button className="step" onClick={() => setActive(Math.min(years[years.length - 1], activeYear + 1))} aria-label="Next year">›</button>
        </div>
        <div className="ro ro-head muted">
          <span />
          <span className="ro-n">line</span>
          <span className="ro-v">rent − buy</span>
          <span className="ro-be">buy cheaper from</span>
          <span className="ro-p">mortgage vs rent, yr 1</span>
        </div>
        <div className="readout-list">
          {readout.map(({ l, r }) => {
            const be = breakEvenOf(l.rows, (x) => x.advantage);
            return (
              <div className="ro" key={l.id}>
                <Swatch color={l.color} dash={l.dash} width={l.width} />
                <span className="ro-n">{l.name}</span>
                <span className={r!.advantage >= 0 ? 'c-buy ro-v' : 'c-rent ro-v'}>
                  {r!.advantage >= 0 ? '+' : ''}
                  {abbr(r!.advantage)}
                </span>
                <span className="ro-be muted">{be == null ? 'never' : `${be}y held`}</span>
                <span className="ro-p muted">{l.paymentYear > 0 ? `${abbr(l.paymentYear)} vs ${abbr(l.rentYear)}` : `cash vs ${abbr(l.rentYear)}`}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ config */

function fmtList(vs: number[], kind: Kind): string {
  return vs
    .map((v) => {
      if (kind === 'pct') return String(+(v * 100).toFixed(3));
      if (kind === 'aed') {
        if (v !== 0 && v % 1_000_000 === 0) return `${v / 1_000_000}M`;
        if (v !== 0 && v % 1000 === 0) return `${v / 1000}k`;
      }
      return String(v);
    })
    .join(', ');
}

function parseList(t: string, kind: Kind): number[] {
  const out: number[] = [];
  for (const tok of t.split(/[,;\s]+/)) {
    const m = tok.trim().match(/^(-?\d*\.?\d+)([kKmM]?)$/);
    if (!m) continue;
    const mult = m[2].toLowerCase() === 'k' ? 1e3 : m[2].toLowerCase() === 'm' ? 1e6 : 1;
    let v = Number(m[1]) * mult;
    if (kind === 'pct') v = +(v / 100).toFixed(6);
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

function ListField({ label, hint, kind, values, onChange }: { label: string; hint?: string; kind: Kind; values: number[]; onChange: (v: number[]) => void }) {
  const [txt, setTxt] = useState(fmtList(values, kind));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setTxt(fmtList(values, kind));
  }, [values, kind, focus]);
  const n = values.length;
  return (
    <label className="field">
      <span className="field-l">
        {label}
        {n > 1 && <span className="badge">{n} values</span>}
      </span>
      <span className={n > 1 ? 'field-in multi' : 'field-in'}>
        {kind === 'aed' && <span className="unit pre">AED</span>}
        <input
          value={txt}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onChange={(e) => {
            setTxt(e.target.value);
            const v = parseList(e.target.value, kind);
            if (v.length) onChange(v);
          }}
        />
        {kind === 'pct' && <span className="unit">%</span>}
        {kind === 'yrs' && <span className="unit">yrs</span>}
      </span>
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

function Checks<T extends string>({
  label, all, value, name, onChange,
}: { label: string; all: T[]; value: T[]; name: (x: T) => string; onChange: (v: T[]) => void }) {
  return (
    <div className="field">
      <span className="field-l">
        {label}
        {value.length > 1 && <span className="badge">{value.length} values</span>}
      </span>
      <div className="checks">
        {all.map((x) => (
          <label key={x} className={value.includes(x) ? 'cbx on' : 'cbx'}>
            <input
              type="checkbox"
              checked={value.includes(x)}
              onChange={() => onChange(all.filter((y) => (y === x ? !value.includes(x) : value.includes(y))))}
            />
            {name(x)}
          </label>
        ))}
      </div>
    </div>
  );
}

function cumulative(key: ScenarioKey, years: number): number {
  const sc = SCENARIOS.find((x) => x.key === key)!;
  let v = 1;
  for (let y = 0; y < years; y++) v *= 1 + (sc.path[y] ?? sc.tail);
  return v - 1;
}

function ScenarioPicker({ value, onChange }: { value: ScenarioKey[]; onChange: (v: ScenarioKey[]) => void }) {
  const all = CYCLES.map((x) => x.key);
  const fmt = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
  return (
    <div className="field">
      <span className="field-l">
        Price scenario
        {value.length > 1 && <span className="badge">{value.length} values</span>}
      </span>
      <div className="scen-head muted"><span /><span>price after 3y · 6y · 10y</span></div>
      {CYCLES.map((sc) => {
        const on = value.includes(sc.key);
        return (
          <label key={sc.key} className={on ? 'scen on' : 'scen'}>
            <input type="checkbox" checked={on} onChange={() => onChange(all.filter((k) => (k === sc.key ? !on : value.includes(k))))} />
            <span className="scen-t">
              <span className="scen-l">{sc.label}</span>
              {sc.key !== 'trend' && (
                <span className="scen-c">{fmt(cumulative(sc.key, 3))} · {fmt(cumulative(sc.key, 6))} · {fmt(cumulative(sc.key, 10))}</span>
              )}
              <span className="hint">{sc.note}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function ConfigForm({ c, setC, total }: { c: Config; setC: (f: (o: Config) => Config) => void; total: number }) {
  const groups = [...new Set(FIELDS.map((f) => f.group))];
  const setList = (k: string, v: number[]) => setC((o) => ({ ...o, lists: { ...o.lists, [k]: v } }));
  const count = (g: string) =>
    FIELDS.filter((f) => f.group === g && c.lists[f.key].length > 1).length + (g === 'Market' && c.cycles.length > 1 ? 1 : 0);
  return (
    <div className="form">
      <p className="form-intro">
        Type one value, or several separated by commas (e.g. <code>7, 5, 3, 1, -2</code>). Every combination becomes one
        line: <b>{total}</b> now.
      </p>

      {groups.map((g, gi) => (
        <details className="group" key={g} open={gi < 5}>
          <summary>
            <span>{g}</span>
            {count(g) > 0 && <span className="gsum">{count(g)} varying</span>}
          </summary>
          <div className="gbody">
            {FIELDS.filter((f) => f.group === g).map((f) => (
              <ListField key={f.key} label={f.label} hint={f.hint} kind={f.kind} values={c.lists[f.key]} onChange={(v) => setList(f.key, v)} />
            ))}
            {g === 'Market' && (
              <div className="span2">
                <ScenarioPicker value={c.cycles} onChange={(v) => setC((o) => ({ ...o, cycles: v }))} />
              </div>
            )}
          </div>
        </details>
      ))}

      <details className="group">
        <summary>
          <span>Emirate fees</span>
          {c.emirates.length > 1 && <span className="gsum">1 varying</span>}
        </summary>
        <div className="gbody">
          <div className="span2">
            <Checks<Emirate> label="Emirate" all={EMIRATES} value={c.emirates} name={(e) => EM_LABEL[e]} onChange={(v) => setC((o) => ({ ...o, emirates: v }))} />
          </div>
          {c.emirates.map((e) => (
            <div className="em-col" key={e}>
              <div className="em-h">{EM_LABEL[e]}</div>
              {EM_FIELDS.map((f) => (
                <ListField
                  key={f.key}
                  label={f.label}
                  kind={f.kind}
                  values={[c.emFees[e][f.key]]}
                  onChange={(v) => setC((o) => ({ ...o, emFees: { ...o.emFees, [e]: { ...o.emFees[e], [f.key]: v[0] } } }))}
                />
              ))}
            </div>
          ))}
        </div>
      </details>

      <details className="group">
        <summary>
          <span>What is counted</span>
        </summary>
        <div className="notes">
          <p>
            <b>Cost of renting</b>: rent, housing fee, agent fee and moving costs every few years, minus what your unspent
            money earned at the chosen return (the down payment and buying fees you kept, plus each month's saving while
            renting is cheaper).
          </p>
          <p>
            <b>Cost of buying then selling</b>: down payment, transfer fee, agent + VAT, trustee and mortgage fees, moving
            in, mortgage payments, service charges, maintenance, insurance and housing fee; then minus the sale price, plus
            the selling agent + VAT, NOC, early settlement fee (1% of the loan left, max AED 10k) and the loan payoff;
            minus what the owner's own monthly savings earned once owning is cheaper than renting.
          </p>
          <p>No property tax or capital gains tax in the UAE. Not counted: security deposit, off-plan payment plans, Golden Visa.</p>
        </div>
      </details>

      <button className="reset" onClick={() => setC(() => structuredClone(DEFAULT_CONFIG))}>
        Reset everything
      </button>
    </div>
  );
}
