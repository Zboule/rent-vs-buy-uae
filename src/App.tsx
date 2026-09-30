import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { breakEvenOf } from './engine';
import { CYCLES, MAX_LINES, NOW, describeCount, lines, readConfig, writeConfig, type Config, type LineCount, type LineDef } from './config';
import { encoding, type Encoding } from './encoding';
import { Settings, Stepper, useCount } from './Settings';
import { Sheet, Swatch, useVisualViewport } from './ui';
import { abbr } from './format';

type SetC = (f: (o: Config) => Config) => void;

export default function App() {
  const [c, setC] = useState<Config>(readConfig);
  useEffect(() => writeConfig(c), [c]);
  useVisualViewport();
  const res = useMemo(() => lines(c), [c]);
  const cnt = useCount(c);
  const enc = useMemo(() => encoding(cnt.varying), [cnt.varying]);

  // which part of the page is on screen, for the phone's bottom bar
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartVisible, setChartVisible] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  useEffect(() => {
    const chart = chartRef.current;
    const settings = document.getElementById('settings');
    if (!chart || !settings) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => (e.target === chart ? setChartVisible(e.isIntersecting) : setSettingsVisible(e.isIntersecting))),
      { threshold: 0.02 },
    );
    io.observe(chart);
    io.observe(settings);
    return () => io.disconnect();
  }, []);
  const toSettings = () => document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth' });
  const toChart = () => chartRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="app">
      <header className="topbar">
        <h1>Rent or buy, UAE</h1>
        <ShareButton />
      </header>
      <div className="layout">
        <main className="main">
          <div ref={chartRef} className="card chart-card">
            <Graph c={c} setC={setC} lines={res.lines} enc={enc} cnt={cnt} onCount={toSettings} />
          </div>
        </main>
        <aside className="side">
          <Settings c={c} setC={setC} cnt={cnt} enc={enc} />
        </aside>
      </div>
      <footer className="foot">
        Not financial advice. 2026 estimates, every value editable. <a href="https://github.com/Zboule/rent-vs-buy-uae">How it works</a>
      </footer>
      <div className="bottombar" aria-hidden={false}>
        {settingsVisible && !chartVisible ? (
          <button className="bb" onClick={toChart}>
            {cnt.total} line{cnt.total === 1 ? '' : 's'} · Back to graph <span aria-hidden>↑</span>
          </button>
        ) : !settingsVisible ? (
          <button className="bb" onClick={toSettings}>
            Assumptions{cnt.varying.length ? ` · ${cnt.varying.length} varying` : ''} <span aria-hidden>›</span>
          </button>
        ) : null}
      </div>
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

/* ------------------------------------------------------------------ helpers */

function niceTicks(lo: number, hi: number, target = 5): number[] {
  const raw = Math.max(1, hi - lo) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw)!;
  const out: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= Math.ceil(hi / step) * step + step / 2; t += step) out.push(Math.round(t));
  return out;
}

/** 2000000 -> "2M", 1500000 -> "1.5M", 250000 -> "250k" (no trailing zeros) */
const compact = (a: number) =>
  a >= 1e6 ? `${+(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${Math.round(a / 1e3)}k` : String(Math.round(a));
const signed = (v: number) => (Math.round(v) === 0 ? '0' : `${v > 0 ? '+' : '−'}${compact(Math.abs(v))}`);
const shortScenario = (key: string) => CYCLES.find((x) => x.key === key)?.label.split(':')[0] ?? key;

interface Styled extends LineDef { color: string; dash: string }

const CHART_H = 290;
const PLOT_TOP = 10;
const PLOT_BOTTOM = CHART_H - 28;
const PRESETS = [3, 6, 10, 15, 25];
const DENSE = 12; // above this many lines, lines draw lighter until one is focused

/* ------------------------------------------------------------------ graph */

function Graph({ c, setC, lines: ls, enc, cnt, onCount }: {
  c: Config; setC: SetC; lines: LineDef[]; enc: Encoding; cnt: LineCount; onCount: () => void;
}) {
  const styled: Styled[] = ls.map((l) => ({ ...l, ...enc.line(l.combo) }));
  const [fk, fv] = c.focus ? c.focus.split(':') : [null, null];
  const inFocus = (l: Styled) => !fk || String(l.combo[fk]) === fv;
  const [pinned, setPinned] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [customHz, setCustomHz] = useState(false);
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
    if (e.chartY == null) return;
    const v = y1 - ((e.chartY - PLOT_TOP) / (PLOT_BOTTOM - PLOT_TOP)) * (y1 - y0);
    let best: Styled | null = null;
    let bd = Infinity;
    for (const l of visible) {
      const a = valueAt(l, year);
      if (a != null && Math.abs(a - v) < bd) { bd = Math.abs(a - v); best = l; }
    }
    if (pick) setPinned(best && best.id !== pinned ? best.id : null);
    else setHover(best?.id ?? null);
  };

  if (!styled.length) return <p className="empty">Nothing to draw. Tick at least one scenario and one emirate.</p>;

  const atSell = visible.map((l) => ({ l, a: valueAt(l, sellYear) })).filter((x): x is { l: Styled; a: number } => x.a != null);
  const wins = atSell.filter((x) => x.a > 0).length;
  const desc = describeCount(c, cnt);
  const over = cnt.total > MAX_LINES;

  // headline: the answer, not the chart's anatomy
  let headline: string;
  if (atSell.length === 1) {
    const a = atSell[0].a;
    headline = Math.abs(a) < 1000 ? `About even if you sell in ${sellYear}` : `${a > 0 ? 'Buying' : 'Renting'} is cheaper by AED ${compact(Math.abs(a))} if you sell in ${sellYear}`;
  } else if (wins === atSell.length) headline = `Buying wins in all ${atSell.length} cases by ${sellYear}`;
  else if (wins === 0) headline = `Renting wins in all ${atSell.length} cases by ${sellYear}`;
  else headline = `Buying wins in ${wins} of ${atSell.length} cases by ${sellYear}`;

  // readout rows, grouped by scenario when the scenario and something else both vary
  const group = enc.colorKey === 'cycle' && cnt.varying.length > 1;
  // inside a scenario group the order is fixed (the line style is the identity), groups keep their order
  const lineIdx = (l: Styled) => ls.findIndex((x) => x.id === l.id);
  const ordered = group
    ? CYCLES.flatMap((s) => atSell.filter((x) => x.l.combo.cycle === s.key).sort((a, b) => lineIdx(a.l) - lineIdx(b.l)))
    : [...atSell].sort((a, b) => b.a - a.a);
  // collapse per group, never hiding a whole group (the bad news stays visible)
  const groupSize = (sc: string) => ordered.filter((x) => x.l.combo.cycle === sc).length;
  const collapse = group && ordered.length > DENSE;
  const shown = collapse
    ? ordered.filter((x, i) => openGroups[String(x.l.combo.cycle)] || i === 0 || ordered[i - 1].l.combo.cycle !== x.l.combo.cycle)
    : ordered;
  const dense = visible.length > DENSE;
  const idx = years.indexOf(sellYear);
  const rank = (k: string) => {
    const i = [enc.colorKey, enc.dashKey, enc.shadeKey].indexOf(k);
    return i < 0 ? 9 : i;
  };
  const nameOf = (l: Styled, skipScenario: boolean) =>
    Object.entries(l.parts)
      .filter(([k]) => !(skipScenario && k === 'cycle'))
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([k, v]) => (k === 'cycle' ? v.split(':')[0] : v));
  const isCustomHz = !PRESETS.includes(c.horizon);

  return (
    <>
      <div className="hero">
        <h2 className="verdict-h">{headline}</h2>
        <button className="count" onClick={onCount}>
          <span className={over ? 'warn' : ''}>
            {over ? `${MAX_LINES} of ${cnt.total} lines shown` : `${cnt.total} line${cnt.total === 1 ? '' : 's'}`}
            {desc.factors.length > 0 && !over && `: ${desc.factors.join(' × ')}`}
            {desc.skipped > 0 && !over && ` (${desc.skipped} repeats skipped)`}
            {!desc.factors.length && ' · tap Compare on any option to add lines'}
          </span>
          <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden className="count-chev"><path d="M2 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        </button>
        {desc.detail && <div className="count-detail">{desc.detail}</div>}
      </div>

      <div className="seg-hz" role="radiogroup" aria-label="Years to show">
        {PRESETS.map((h) => (
          <button key={h} role="radio" aria-checked={c.horizon === h} className={c.horizon === h ? 'on' : ''} onClick={() => setC((o) => ({ ...o, horizon: h, sell: null }))}>
            {h}y
          </button>
        ))}
        <button role="radio" aria-checked={isCustomHz} className={isCustomHz ? 'on' : ''} onClick={() => setCustomHz(true)} aria-label="Custom number of years">
          {isCustomHz ? `${c.horizon}y` : 'Custom'}
        </button>
      </div>
      <Sheet open={customHz} onClose={() => setCustomHz(false)} title="Years to show" subtitle="How far ahead the graph goes after buying.">
        <div className="center-row">
          <Stepper value={c.horizon} min={1} max={35} fmt={(v) => `${v} years`} label="Years to show" onChange={(v) => setC((o) => ({ ...o, horizon: v, sell: null }))} />
        </div>
      </Sheet>

      <div className="plot" onMouseLeave={() => setHover(null)}>
        <div className="y-title">How much buying saves you, AED</div>
        <ResponsiveContainer width="100%" height={CHART_H}>
          <LineChart
            data={data}
            margin={{ top: PLOT_TOP, right: 16, left: 0, bottom: 0 }}
            onMouseMove={(e) => onMove(e as never, false)}
            onClick={(e) => onMove(e as never, true)}
          >
            <ReferenceArea y1={0} y2={y1} fill="var(--buy)" fillOpacity={0.06} ifOverflow="hidden" label={{ value: 'Buying cheaper', position: 'insideTopLeft', fill: 'var(--buy-ink)', fontSize: 12, fontWeight: 600 }} />
            <ReferenceArea y1={y0} y2={0} fill="var(--rent)" fillOpacity={0.07} ifOverflow="hidden" label={{ value: 'Renting cheaper', position: 'insideBottomLeft', fill: 'var(--rent-ink)', fontSize: 12, fontWeight: 600 }} />
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="year" tick={{ fill: 'var(--label2)', fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={8} height={28} />
            <YAxis domain={[y0, y1]} ticks={ticks} tickFormatter={signed} tick={{ fill: 'var(--label2)', fontSize: 12 }} width={48} tickLine={false} axisLine={false} allowDataOverflow />
            <ReferenceLine y={0} stroke="var(--label3)" strokeWidth={1.5} />
            <ReferenceLine x={sellYear} stroke="var(--label2)" strokeDasharray="3 3" />
            {styled.map((l) => {
              const on = inFocus(l);
              const hi = active === l.id;
              const focusGroup = fk === 'cycle';
              const op = !on ? 0.06 : active ? (hi ? 1 : 0.14) : dense && !focusGroup ? 0.6 : 1;
              return (
                <Line
                  key={l.id}
                  dataKey={l.id}
                  stroke={l.color}
                  strokeWidth={hi ? 3.5 : 2.25}
                  strokeDasharray={l.dash || undefined}
                  strokeOpacity={op}
                  dot={(p: { cx?: number; cy?: number; payload?: { year: number }; index?: number }) =>
                    on && p.payload?.year === sellYear && p.cx != null && p.cy != null && (active ? hi : !dense || fk) ? (
                      <circle key={`${l.id}-d`} cx={p.cx} cy={p.cy} r={hi ? 5 : 3.5} fill={l.color} stroke="var(--surface)" strokeWidth={1.5} />
                    ) : (
                      <g key={`${l.id}-${p.index}`} />
                    )
                  }
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
          <div className="ro-title">If you sell in <b>{sellYear}</b></div>
          <button className="round" disabled={idx >= years.length - 1} onClick={() => setSell(years[idx + 1])} aria-label="Next year">›</button>
        </div>
        {fk && (
          <div className="focus-pill">
            <button onClick={() => setC((o) => ({ ...o, focus: null }))}>
              Only {fk === 'cycle' ? shortScenario(fv!) : fv} <span aria-hidden>×</span>
            </button>
          </div>
        )}
        <ul className="ro-list">
          {shown.map(({ l, a }, i) => {
            const prev = shown[i - 1];
            const header = group && (!prev || prev.l.combo.cycle !== l.combo.cycle);
            const be = breakEvenOf(l.rows, (x) => x.advantage);
            const even = Math.abs(a) < (l.combo.price as number) * 0.01;
            const hi = active === l.id;
            const tokens = nameOf(l, group);
            const title = tokens[0] ?? 'Your assumptions';
            const rest = tokens.slice(1);
            const sc = String(l.combo.cycle);
            return (
              <li key={l.id} className="ro-li">
                {header && (
                  <button
                    className="ro-group"
                    onClick={() => setC((o) => ({ ...o, focus: o.focus === `cycle:${sc}` ? null : `cycle:${sc}` }))}
                    aria-pressed={c.focus === `cycle:${sc}`}
                  >
                    <span className="dot" style={{ background: enc.colorOf('cycle', sc) ?? 'var(--label3)' }} />
                    {shortScenario(sc)}
                    <span className="ro-group-hint">{c.focus === `cycle:${sc}` ? 'Show all' : 'Show only'}</span>
                  </button>
                )}
                <button className={`${hi ? 'ro hi' : active ? 'ro dim' : 'ro'}${header ? ' first' : ''}`} onClick={() => setPinned(pinned === l.id ? null : l.id)} aria-pressed={pinned === l.id}>
                  <Swatch color={l.color} dash={l.dash} w={22} width={3} />
                  <span className="ro-mid">
                    <span className="ro-name">{title}</span>
                    <span className="ro-sub">
                      {rest.map((t) => <span key={t}>{t}</span>)}
                      <span className="ro-be">{be != null ? `Buying wins after ${be} year${be === 1 ? '' : 's'}` : `Not within ${l.rows.length} years`}</span>
                    </span>
                    {hi && (
                      <span className="ro-extra">
                        {l.paymentYear > 0 ? `Mortgage AED ${abbr(l.paymentYear)} vs rent AED ${abbr(l.rentYear)} in year 1` : `Cash purchase, rent AED ${abbr(l.rentYear)} in year 1`}
                      </span>
                    )}
                  </span>
                  <span className="ro-val">
                    <span className={even ? 'amt' : a >= 0 ? 'amt buy' : 'amt rent'}>{even ? '≈0' : signed(a)}</span>
                    <span className="verdict">{even ? 'about even' : a >= 0 ? 'buying cheaper' : 'renting cheaper'}</span>
                  </span>
                </button>
                {collapse && header && groupSize(sc) > 1 && (
                  <button className="ro-more" onClick={() => setOpenGroups((o) => ({ ...o, [sc]: !o[sc] }))} aria-expanded={!!openGroups[sc]}>
                    {openGroups[sc] ? 'Show less' : `+${groupSize(sc) - 1} more`}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
