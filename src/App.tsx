import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { breakEvenOf } from './engine';
import { FIELD, MAX_LINES, NOW, lines, readConfig, writeConfig, type Config, type LineCount, type LineDef } from './config';
import { encoding, type Encoding } from './encoding';
import { Settings, useCount } from './Settings';
import { Swatch, fmtValue, useVisualViewport } from './ui';
import { abbr } from './format';

export default function App() {
  const [c, setC] = useState<Config>(readConfig);
  useEffect(() => writeConfig(c), [c]);
  useVisualViewport();
  const res = useMemo(() => lines(c), [c]);
  const cnt = useCount(c);
  const enc = useMemo(() => encoding(cnt.varying), [cnt.varying]);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartVisible, setChartVisible] = useState(true);
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setChartVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Rent or buy, UAE</h1>
        <ShareButton />
      </header>
      <div className="layout">
        <main className="main">
          <div ref={chartRef} className="card chart-card">
            <Equation cnt={cnt} onTap={() => document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth' })} />
            <Graph c={c} setC={setC} lines={res.lines} enc={enc} />
          </div>
        </main>
        <aside className="side">
          <Settings c={c} setC={setC} cnt={cnt} enc={enc} />
        </aside>
      </div>
      <footer className="foot">
        Not financial advice. 2026 estimates, every value editable. <a href="https://github.com/Zboule/rent-vs-buy-uae">How it works</a>
      </footer>
      {!chartVisible && (
        <button className="pill" onClick={() => chartRef.current?.scrollIntoView({ behavior: 'smooth' })}>
          {cnt.total} line{cnt.total === 1 ? '' : 's'} · See graph ↑
        </button>
      )}
    </div>
  );
}

function ShareButton() {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: 'Rent or buy, UAE', url });
      else {
        await navigator.clipboard.writeText(url);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }
    } catch { /* cancelled */ }
  };
  return (
    <button className="icon-btn share" onClick={share} aria-label="Share this view">
      {done ? (
        <span className="small">Link copied</span>
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path d="M9 11V2M5.5 5.5L9 2l3.5 3.5M3.5 9v5.5a1 1 0 001 1h9a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ equation */

function Equation({ cnt, onTap }: { cnt: LineCount; onTap: () => void }) {
  const d = cnt.dropped;
  const drops = d.cash + d.trend + d.other;
  const parts = cnt.varying.map((v) => `${v.values.length} ${v.noun}`);
  let sub: string;
  if (!parts.length) sub = 'Tap + on any option to compare values';
  else {
    sub = parts.join(' × ');
    if (drops) {
      const why = d.cash >= d.trend && d.cash >= d.other ? 'cash buyer repeats (no mortgage)' : d.trend >= d.other ? 'repeats (only Constant trend uses this)' : 'repeats (option not used)';
      sub += ` = ${cnt.product}, minus ${drops} ${why}`;
    }
  }
  const over = cnt.total > MAX_LINES;
  return (
    <button className="equation" onClick={onTap}>
      <span className={over ? 'eq-n warn' : 'eq-n'}>
        {over ? `${MAX_LINES} of ${cnt.total} lines shown` : `${cnt.total} line${cnt.total === 1 ? '' : 's'}`}
      </span>
      <span className="eq-s">{over ? 'Remove a value to see them all' : sub}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ graph + readout */

function niceTicks(lo: number, hi: number, target = 5): number[] {
  const raw = Math.max(1, hi - lo) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw)!;
  const out: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= Math.ceil(hi / step) * step + step / 2; t += step) out.push(Math.round(t));
  return out;
}

interface Styled extends LineDef { color: string; dash: string }

const CHART_H = 300;
const PLOT_TOP = 8;
const PLOT_BOTTOM = CHART_H - 30; // x axis height

function Graph({ c, setC, lines: ls, enc }: { c: Config; setC: (f: (o: Config) => Config) => void; lines: LineDef[]; enc: Encoding }) {
  const order = [enc.colorKey, enc.dashKey];
  const styled: Styled[] = ls.map((l) => ({
    ...l,
    ...enc.line(l.combo),
    name:
      [...order.filter((k) => k && l.parts[k]).map((k) => l.parts[k]), ...Object.keys(l.parts).filter((k) => !order.includes(k)).map((k) => l.parts[k])].join(' · ') ||
      'Your assumptions',
  }));

  const [fk, fv] = c.focus ? c.focus.split(':') : [null, null];
  const inFocus = (l: Styled) => !fk || String(l.combo[fk]) === fv;
  const [pinned, setPinned] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const active = pinned ?? hover;

  const buys = c.lists.buyYear;
  const minBuy = Math.min(...buys);
  const maxBuy = Math.max(...buys);
  const years: number[] = [];
  for (let y = minBuy + 1; y <= maxBuy + c.horizon; y++) years.push(NOW + y);
  const sellYear = c.sell != null && years.includes(c.sell) ? c.sell : years[years.length - 1];
  const setSell = (y: number) => setC((o) => ({ ...o, sell: y === years[years.length - 1] ? null : y }));

  const valueAt = (l: Styled, year: number) => l.rows.find((r) => NOW + r.sellYear === year)?.advantage;
  const data = years.map((year) => {
    const d: Record<string, number | null> = { year };
    for (const l of styled) d[l.id] = valueAt(l, year) ?? null;
    return d;
  });

  const visible = styled.filter(inFocus);
  const vals = visible.flatMap((l) => l.rows.map((r) => r.advantage));
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];

  const onMove = (e: { activeLabel?: string | number; chartY?: number } | null, pick: boolean) => {
    if (!e || e.activeLabel == null) return;
    const year = Number(e.activeLabel);
    setSell(year);
    if (e.chartY != null) {
      const v = y1 - ((e.chartY - PLOT_TOP) / (PLOT_BOTTOM - PLOT_TOP)) * (y1 - y0);
      let best: Styled | null = null;
      let bd = Infinity;
      for (const l of visible) {
        const a = valueAt(l, year);
        if (a != null && Math.abs(a - v) < bd) { bd = Math.abs(a - v); best = l; }
      }
      if (pick) setPinned(best && best.id !== pinned ? best.id : null);
      else setHover(best?.id ?? null);
    }
  };

  const rows = visible
    .map((l) => ({ l, r: l.rows.find((x) => NOW + x.sellYear === sellYear) }))
    .filter((x) => x.r)
    .sort((a, b) => b.r!.advantage - a.r!.advantage);

  if (!styled.length) return <p className="empty">Nothing to draw. Tick at least one scenario and one emirate.</p>;

  const idx = years.indexOf(sellYear);
  const tokenLabel = (key: string, value: string) =>
    key === 'cycle' || key === 'emirate' ? styled.find((l) => String(l.combo[key]) === value)?.parts[key] ?? value : fmtValue(FIELD[key], Number(value));

  return (
    <>
      <div className="horizon">
        <span className="hz-l">Show</span>
        <div className="hz-chips" role="radiogroup" aria-label="Years to show">
          {[3, 6, 10, 15, 25].map((h) => (
            <button key={h} role="radio" aria-checked={c.horizon === h} className={c.horizon === h ? 'hz on' : 'hz'} onClick={() => setC((o) => ({ ...o, horizon: h, sell: null }))}>
              {h}y
            </button>
          ))}
          <input
            className="hz-in"
            inputMode="numeric"
            aria-label="Custom number of years"
            value={c.horizon}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              if (n >= 1 && n <= 35) setC((o) => ({ ...o, horizon: n, sell: null }));
            }}
          />
        </div>
      </div>

      <div className="plot" onMouseLeave={() => setHover(null)}>
        <div className="y-title">Renting cost minus buying cost, AED</div>
        <ResponsiveContainer width="100%" height={CHART_H}>
          <LineChart
            data={data}
            margin={{ top: PLOT_TOP, right: 12, left: 0, bottom: 0 }}
            onMouseMove={(e) => onMove(e as never, false)}
            onClick={(e) => onMove(e as never, true)}
          >
            <ReferenceArea y1={0} y2={y1} fill="var(--buy)" fillOpacity={0.07} ifOverflow="hidden" label={{ value: 'Buying cheaper', position: 'insideTopLeft', fill: 'var(--buy)', fontSize: 11, fontWeight: 600 }} />
            <ReferenceArea y1={y0} y2={0} fill="var(--rent)" fillOpacity={0.08} ifOverflow="hidden" label={{ value: 'Renting cheaper', position: 'insideBottomLeft', fill: 'var(--rent)', fontSize: 11, fontWeight: 600 }} />
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="year" tick={{ fill: 'var(--label2)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={10} height={30} />
            <YAxis domain={[y0, y1]} ticks={ticks} tickFormatter={(x) => abbr(x)} tick={{ fill: 'var(--label2)', fontSize: 11 }} width={50} tickLine={false} axisLine={false} allowDataOverflow />
            <ReferenceLine y={0} stroke="var(--label3)" strokeWidth={1.5} />
            <ReferenceLine x={sellYear} stroke="var(--label2)" strokeDasharray="3 3" />
            {styled.map((l) => {
              const on = inFocus(l);
              const hi = active === l.id;
              const op = !on ? 0.06 : active ? (hi ? 1 : 0.15) : 1;
              return (
                <Line
                  key={l.id}
                  dataKey={l.id}
                  stroke={l.color}
                  strokeWidth={hi ? 3.5 : 2.25}
                  strokeDasharray={l.dash || undefined}
                  strokeOpacity={op}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
        <div className="x-title">Year you sell</div>
      </div>

      <div className="readout">
        <div className="ro-head">
          <button className="round" disabled={idx <= 0} onClick={() => setSell(years[idx - 1])} aria-label="Previous year">‹</button>
          <div className="ro-title">
            If you sell in <b>{sellYear}</b>
          </div>
          <button className="round" disabled={idx >= years.length - 1} onClick={() => setSell(years[idx + 1])} aria-label="Next year">›</button>
        </div>
        {fk && (
          <div className="focus-pill">
            <button onClick={() => setC((o) => ({ ...o, focus: null }))}>
              Only: {tokenLabel(fk, fv!)} <span aria-hidden>×</span>
            </button>
          </div>
        )}
        <ul className="ro-list">
          {rows.map(({ l, r }) => {
            const a = r!.advantage;
            const be = breakEvenOf(l.rows, (x) => x.advantage);
            const even = Math.abs(a) < (l.combo.price as number) * 0.01;
            const hi = active === l.id;
            const tokens = [enc.colorKey, enc.dashKey, ...Object.keys(l.parts)].filter((k, i, arr) => k && l.parts[k] && arr.indexOf(k) === i);
            return (
              <li key={l.id} id={`row-${l.id}`} className={hi ? 'ro hi' : active ? 'ro dim' : 'ro'}>
                <button className="ro-hit" onClick={() => setPinned(pinned === l.id ? null : l.id)} aria-pressed={pinned === l.id} aria-label={`Highlight ${l.name}`} />
                <Swatch color={l.color} dash={l.dash} w={22} width={3} />
                <div className="ro-mid">
                  <div className="ro-name">
                    {tokens.length ? (
                      tokens.map((k) => (
                        <button
                          key={k}
                          className="tok"
                          onClick={() => setC((o) => ({ ...o, focus: o.focus === `${k}:${l.combo[k]}` ? null : `${k}:${l.combo[k]}` }))}
                        >
                          {l.parts[k]}
                        </button>
                      ))
                    ) : (
                      <span>{l.name}</span>
                    )}
                  </div>
                  <div className="ro-cap">
                    {be != null ? `Buying wins after ${be} year${be === 1 ? '' : 's'}` : `Not within ${l.rows.length} years`}
                    {' · '}
                    {l.paymentYear > 0 ? `Mortgage ${abbr(l.paymentYear)} vs rent ${abbr(l.rentYear)} in year 1` : `Cash purchase, rent ${abbr(l.rentYear)} in year 1`}
                  </div>
                </div>
                <div className="ro-val">
                  <span className={even ? 'amt' : a >= 0 ? 'amt buy' : 'amt rent'}>
                    {a >= 0 ? '+' : '−'}
                    {abbr(Math.abs(a))}
                  </span>
                  <span className="verdict">{even ? 'about even' : a >= 0 ? 'buying cheaper' : 'renting cheaper'}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
