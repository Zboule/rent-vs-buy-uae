import { useEffect, useMemo, useState } from 'react';
import { NEUTRAL_GROWTH, SCENARIOS, type Emirate, type ScenarioKey } from './engine';
import {
  CYCLES, DEFAULT_CONFIG, EMIRATES, EM_FIELDS, EM_LABEL, FIELD, FIELDS, GROUPS, MAX_LINES, NOW, clampValue, countLines, suggestions,
  type Config, type FieldDef, type Kind, type LineCount,
} from './config';
import type { Encoding } from './encoding';
import { COLORS, shade } from './encoding';
import { Chevron, PlusIcon, Sheet, Swatch, fmtValue, parseOne, toInput } from './ui';

type SetC = (f: (o: Config) => Config) => void;

const LOAN_KEYS = ['fixedRate', 'fixedYears', 'varRate', 'term', 'bankFeePct', 'valuation', 'lifeInsPct', 'earlySettlePct', 'earlySettleCap'];
const ESSENTIALS = ['price', 'rent', 'rentGrowth', 'downPct', 'fixedRate'];

/* ------------------------------------------------------------------ inputs */

export function NumInput({ kind, value, onCommit, label, disabled }: { kind: Kind; value: number; onCommit: (v: number) => void; label: string; disabled?: boolean }) {
  const [txt, setTxt] = useState(toInput(kind, value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setTxt(toInput(kind, value));
  }, [value, kind, focus]);
  return (
    <span className={disabled ? 'num disabled' : 'num'}>
      {kind === 'aed' && <span className="num-unit pre">AED</span>}
      <input
        aria-label={label}
        inputMode="decimal"
        enterKeyHint="done"
        disabled={disabled}
        value={txt}
        onFocus={(e) => { setFocus(true); e.target.select(); }}
        onBlur={() => setFocus(false)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        onChange={(e) => {
          setTxt(e.target.value);
          const v = parseOne(e.target.value, kind);
          if (v != null) onCommit(v);
        }}
      />
      {kind === 'pct' && <span className="num-unit">%</span>}
    </span>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, fmt, label, disabled }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; fmt: (v: number) => string; label: string; disabled?: boolean;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, +v.toFixed(4))));
  return (
    <span className={disabled ? 'stepper disabled' : 'stepper'} role="group" aria-label={label}>
      <button disabled={disabled || value <= min} onClick={() => set(value - step)} aria-label={`Decrease ${label}`}>−</button>
      <output>{fmt(value)}</output>
      <button disabled={disabled || value >= max} onClick={() => set(value + step)} aria-label={`Increase ${label}`}>+</button>
    </span>
  );
}

/* ------------------------------------------------------------------ option rows */

interface SheetState { key: string; mode: 'add' | 'edit'; value?: number }

function Chip({ label, color, dash, shadePct, onClick, onRemove }: {
  label: string; color?: string | null; dash?: string | null; shadePct?: number | null; onClick: () => void; onRemove?: () => void;
}) {
  return (
    <span className={onRemove ? 'vchip rm' : 'vchip'}>
      <button className="vchip-b" onClick={onClick}>
        {color && <span className="dot" style={{ background: color }} />}
        {dash != null && !color && <Swatch color="var(--label)" dash={dash} w={18} width={2} />}
        {shadePct != null && !color && dash == null && <Swatch color={shade('var(--label)', shadePct)} w={18} width={3} />}
        {label}
      </button>
      {onRemove && (
        <button className="vchip-x" onClick={onRemove} aria-label={`Remove ${label}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      )}
    </span>
  );
}

function OptionRow({ f, c, setC, enc, openSheet, note, disabled }: {
  f: FieldDef; c: Config; setC: SetC; enc: Encoding; openSheet: (s: SheetState) => void; note?: string; disabled?: boolean;
}) {
  const values = c.lists[f.key];
  const many = values.length > 1;
  const setOne = (v: number) => setC((o) => ({ ...o, lists: { ...o.lists, [f.key]: [clampValue(f, v)] } }));
  let control = null;
  if (!many) {
    control =
      f.kind === 'yrs' ? (
        <Stepper value={values[0]} onChange={setOne} min={f.min ?? 0} max={f.max ?? 40} fmt={(v) => fmtValue(f, v)} label={f.label} disabled={disabled} />
      ) : (
        <NumInput kind={f.kind} value={values[0]} onCommit={setOne} label={f.label} disabled={disabled} />
      );
  }
  return (
    <div id={`opt-${f.key}`} className={`opt${many ? ' varying' : ''}${disabled ? ' off' : ''}`}>
      <div className="opt-main">
        <div className="opt-text">
          <span className="opt-label">
            {f.label}
            {many && <span className="times">{values.length} values</span>}
          </span>
          {(note || f.hint) && <span className="opt-hint">{note ?? f.hint}</span>}
        </div>
        {control}
        <button className="plus" disabled={disabled} onClick={() => openSheet({ key: f.key, mode: 'add' })} aria-label={`Compare values for ${f.label}`}>
          <PlusIcon />
          <span className="plus-t">{many ? 'Add' : 'Compare'}</span>
        </button>
      </div>
      {many && (
        <div className="chips">
          {values.map((v) => (
            <Chip
              key={v}
              label={fmtValue(f, v)}
              color={enc.colorOf(f.key, v)}
              dash={enc.dashOf(f.key, v)}
              shadePct={enc.shadeOf(f.key, v)}
              onClick={() => openSheet({ key: f.key, mode: 'edit', value: v })}
              onRemove={disabled ? undefined : () => setC((o) => ({ ...o, lists: { ...o.lists, [f.key]: o.lists[f.key].filter((x) => x !== v) } }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ValueSheet({ s, c, setC, onClose }: { s: SheetState | null; c: Config; setC: SetC; onClose: () => void }) {
  const f = s ? FIELD[s.key] : null;
  const values = f ? c.lists[f.key] : [];
  const [txt, setTxt] = useState('');
  useEffect(() => {
    if (s && f) setTxt(s.mode === 'edit' && s.value != null ? toInput(f.kind, s.value) : '');
  }, [s, f]);
  if (!s || !f) return null;
  const parsed = parseOne(txt, f.kind);
  const v = parsed == null ? null : clampValue(f, parsed);
  const now = countLines(c).total;
  const nextList = s.mode === 'add' ? (v == null || values.includes(v) ? values : [...values, v]) : values.map((x) => (x === s.value && v != null ? v : x));
  const next = countLines({ ...c, lists: { ...c.lists, [f.key]: [...new Set(nextList)] } }).total;
  const apply = () => {
    if (v == null) return;
    setC((o) => ({ ...o, lists: { ...o.lists, [f.key]: [...new Set(nextList)] } }));
    onClose();
  };
  const remove = () => {
    setC((o) => ({ ...o, lists: { ...o.lists, [f.key]: values.filter((x) => x !== s.value) } }));
    onClose();
  };
  const sugg = suggestions(f, values);
  const valid = v != null && (s.mode === 'edit' || !values.includes(v));
  return (
    <Sheet
      open
      onClose={onClose}
      title={s.mode === 'add' ? `Compare ${f.label.toLowerCase()}` : f.label}
      subtitle={s.mode === 'add' ? 'Each value you add draws its own set of lines.' : `Editing ${fmtValue(f, s.value!)}`}
      footer={
        <div className="sheet-actions">
          {s.mode === 'edit' && values.length > 1 && (
            <button className="btn danger" onClick={remove}>Remove this value</button>
          )}
          <button className="btn primary" disabled={!valid} onClick={apply}>
            {s.mode === 'add' ? (valid ? `Add ${fmtValue(f, v!)} · ${now} → ${Math.min(next, MAX_LINES)} lines` : 'Pick or type a value') : 'Save'}
          </button>
        </div>
      }
    >
      {s.mode === 'add' && (
        <>
          <div className="now-values">
            <span className="muted">Now</span>
            {values.map((x) => <span key={x} className="vchip static">{fmtValue(f, x)}</span>)}
          </div>
          {sugg.length > 0 && (
            <div className="sugg">
              {sugg.map((x) => (
                <button key={x} className={v === x ? 'vchip sel' : 'vchip'} onClick={() => setTxt(toInput(f.kind, x))}>
                  {fmtValue(f, x)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <label className="field-big">
        <span>{s.mode === 'add' ? 'Or type a value' : 'Value'}</span>
        <span className="num big">
          {f.kind === 'aed' && <span className="num-unit pre">AED</span>}
          <input
            autoFocus={s.mode === 'edit'}
            inputMode="decimal"
            enterKeyHint="done"
            placeholder={f.kind === 'aed' ? 'e.g. 2.5M' : f.kind === 'pct' ? 'e.g. 5' : 'e.g. 3'}
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && valid && apply()}
          />
          {f.kind === 'pct' && <span className="num-unit">%</span>}
          {f.kind === 'yrs' && <span className="num-unit">{f.key === 'buyYear' ? 'years from now' : 'years'}</span>}
        </span>
        {v != null && values.includes(v) && s.mode === 'add' && <span className="opt-hint">Already compared.</span>}
      </label>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ scenarios */

function pathOf(k: ScenarioKey, c: Config, n: number): number[] {
  const sc = SCENARIOS.find((x) => x.key === k)!;
  return Array.from({ length: n }, (_, y) => (k === 'trend' ? c.lists.priceGrowth[0] : sc.path[y] ?? sc.tail));
}
const cum = (p: number[], n: number) => p.slice(0, n).reduce((v, g) => v * (1 + g), 1) - 1;
const pctS = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(Math.round(x * 100))}%`;

function Sparkline({ path, color }: { path: number[]; color: string }) {
  const W = 132, H = 40;
  const idx = [1];
  for (const g of path) idx.push(idx[idx.length - 1] * (1 + g));
  const lo = Math.min(0.5, ...idx), hi = Math.max(1.6, ...idx);
  const x = (i: number) => (i / (idx.length - 1)) * (W - 6) + 2;
  const y = (v: number) => H - 3 - ((v - lo) / (hi - lo)) * (H - 6);
  return (
    <svg width={W} height={H} className="spark" aria-hidden>
      <line x1="2" x2={W - 2} y1={y(1)} y2={y(1)} className="spark-base" />
      <polyline points={idx.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(idx.length - 1)} cy={y(idx[idx.length - 1])} r="2.5" fill={color} />
    </svg>
  );
}

function ScenarioEditor({ open, onClose, c, setC, enc, openSheet }: {
  open: boolean; onClose: () => void; c: Config; setC: SetC; enc: Encoding; openSheet: (s: SheetState) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const years = 10;
  const follows = c.lists.rentFollows[0];
  const rg = c.lists.rentGrowth[0];
  const toggle = (k: ScenarioKey) =>
    setC((o) => {
      const on = o.cycles.includes(k);
      if (on && o.cycles.length === 1) return o;
      return { ...o, cycles: CYCLES.map((x) => x.key).filter((x) => (x === k ? !on : o.cycles.includes(x))) };
    });
  return (
    <Sheet open={open} onClose={onClose} tall title="Scenarios" subtitle="Each sets property prices year by year and what your savings earn. Every ticked scenario draws its own lines.">
      <div className="scards">
        {CYCLES.map((sc, i) => {
          const on = c.cycles.includes(sc.key);
          const path = pathOf(sc.key, c, years);
          const color = (on && enc.colorOf('cycle', sc.key)) || COLORS[i % COLORS.length];
          const trend = sc.key === 'trend';
          const last = on && c.cycles.length === 1;
          return (
            <div key={sc.key} className={on ? 'scard on' : 'scard'}>
              <button className="scard-head" onClick={() => toggle(sc.key)} aria-pressed={on} title={last ? 'Keep at least one scenario' : undefined}>
                <span className={on ? 'check on' : 'check'} aria-hidden>
                  {on && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.2l2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <span className="scard-t">
                  <span className="scard-name">{on && <span className="dot" style={{ background: color }} />}{sc.label}</span>
                  <span className="scard-note">{sc.note}</span>
                </span>
                {!trend && (
                  <span className="spark-wrap">
                    <Sparkline path={path} color={on ? color : 'var(--label3)'} />
                    <span className="spark-l">{pctS(cum(path, years))}<small> in {years}y</small></span>
                  </span>
                )}
              </button>
              {!trend && (
                <div className="scard-body">
                  <div className="scard-facts">
                    <span>Prices {pctS(cum(path, 3))} in 3 years, {pctS(cum(path, 6))} in 6</span>
                  </div>
                  <div className="scard-ret">
                    <span>Your savings earn</span>
                    <Stepper
                      value={c.scenRet[sc.key]}
                      step={0.005}
                      min={-0.05}
                      max={0.2}
                      fmt={(v) => `${+(v * 100).toFixed(1)}% a year`}
                      label={`${sc.label} investment return`}
                      onChange={(v) => setC((o) => ({ ...o, scenRet: { ...o.scenRet, [sc.key]: v } }))}
                    />
                  </div>
                  <button className="disclose" onClick={() => setExpanded(expanded === sc.key ? null : sc.key)} aria-expanded={expanded === sc.key}>
                    Year by year <Chevron open={expanded === sc.key} />
                  </button>
                  {expanded === sc.key && (
                    <div className="ytable-wrap">
                      <table className="ytable">
                        <thead>
                          <tr><th />{path.map((_, y) => <th key={y}>'{String(NOW + y + 1).slice(2)}</th>)}<th>after</th></tr>
                        </thead>
                        <tbody>
                          <tr><th>Price</th>{path.map((g, y) => <td key={y}>{pctS(g)}</td>)}<td>{pctS(sc.tail)}</td></tr>
                          <tr className="muted"><th>Rent</th>{path.map((g, y) => <td key={y}>{pctS(rg + (g - NEUTRAL_GROWTH) * follows)}</td>)}<td>{pctS(rg + (sc.tail - NEUTRAL_GROWTH) * follows)}</td></tr>
                        </tbody>
                      </table>
                      <p className="opt-hint">
                        Rent follows prices by {Math.round(follows * 100)}% on a {+(rg * 100).toFixed(1)}% a year base
                        {c.lists.rentFollows.length > 1 || c.lists.rentGrowth.length > 1 ? ' (first value)' : ''}.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {trend && (
                <div className={on ? 'scard-body' : 'scard-body dim'}>
                  {!on && <p className="opt-hint">Turn on to set your own trend.</p>}
                  <div className="group inset">
                    <OptionRow f={FIELD.priceGrowth} c={c} setC={setC} enc={enc} openSheet={openSheet} disabled={!on} />
                    <OptionRow f={FIELD.investReturn} c={c} setC={setC} enc={enc} openSheet={openSheet} disabled={!on} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ settings */

export function Settings({ c, setC, cnt, enc }: { c: Config; setC: SetC; cnt: LineCount; enc: Encoding }) {
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [scen, setScen] = useState(false);
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [hintSeen, setHintSeen] = useState(() => {
    try { return localStorage.getItem('rvb-hint') === '1'; } catch { return false; }
  });
  const dismissHint = () => {
    setHintSeen(true);
    try { localStorage.setItem('rvb-hint', '1'); } catch { /* private mode */ }
  };

  const allCash = c.lists.downPct.every((v) => v >= 1);
  const someCash = c.lists.downPct.some((v) => v >= 1);
  const noteFor = (f: FieldDef) => {
    if (LOAN_KEYS.includes(f.key)) {
      if (allCash) return 'Not used: every line is a cash buyer';
      if (someCash) return 'Cash buyer lines ignore this';
    }
    if (f.key === 'rentFollows' && c.cycles.length === 1 && c.cycles[0] === 'trend') return 'Not used by Constant trend';
    if ((f.key === 'rentAgentPct' || f.key === 'moveCost') && c.lists.moveEveryYears.every((v) => v === 0)) return 'Not used: the renter never moves';
    return undefined;
  };
  const row = (f: FieldDef) => (
    <OptionRow key={f.key} f={f} c={c} setC={setC} enc={enc} openSheet={setSheet} note={noteFor(f)} disabled={LOAN_KEYS.includes(f.key) && allCash} />
  );

  const vset = new Set(cnt.varying.map((d) => d.key));
  const q = query.trim().toLowerCase();
  const more = FIELDS.filter((f) => !ESSENTIALS.includes(f.key) && f.group !== 'Constant trend' && !vset.has(f.key));
  const matches = q ? FIELDS.filter((f) => f.group !== 'Constant trend' && `${f.label} ${f.group} ${f.hint ?? ''}`.toLowerCase().includes(q)) : [];
  const selectedScen = CYCLES.filter((x) => c.cycles.includes(x.key));
  const values = (n: number) => <span className="times">{n} values</span>;

  const scenRow = (
    <div id="opt-cycle" key="cycle" className={`opt${selectedScen.length > 1 ? ' varying' : ''}`}>
      <div className="opt-main">
        <div className="opt-text">
          <span className="opt-label">Scenario{selectedScen.length > 1 && values(selectedScen.length)}</span>
          <span className="opt-hint">Property prices year by year + what your savings earn</span>
        </div>
        <button className="plus" onClick={() => setScen(true)} aria-label="Choose scenarios">
          <PlusIcon />
          <span className="plus-t">{selectedScen.length > 1 ? 'Edit' : 'Compare'}</span>
        </button>
      </div>
      <div className="chips">
        {selectedScen.map((x) => (
          <Chip
            key={x.key}
            label={x.label.split(':')[0]}
            color={enc.colorOf('cycle', x.key)}
            onClick={() => setScen(true)}
            onRemove={selectedScen.length > 1 ? () => setC((o) => ({ ...o, cycles: o.cycles.filter((k) => k !== x.key) })) : undefined}
          />
        ))}
      </div>
    </div>
  );

  const emMany = c.emirates.length > 1;
  const emRow = (
    <div id="opt-emirate" key="emirate" className={`opt${emMany ? ' varying' : ''}`}>
      <div className="opt-main">
        <div className="opt-text">
          <span className="opt-label">Emirate{emMany && values(2)}</span>
          <span className="opt-hint">Sets purchase and housing fees</span>
        </div>
        {!emMany && (
          <span className="seg">
            {EMIRATES.map((e) => (
              <button key={e} className={c.emirates[0] === e ? 'on' : ''} aria-pressed={c.emirates[0] === e} onClick={() => setC((o) => ({ ...o, emirates: [e] }))}>
                {EM_LABEL[e]}
              </button>
            ))}
          </span>
        )}
        {!emMany && (
          <button className="plus" onClick={() => setC((o) => ({ ...o, emirates: [...EMIRATES] }))} aria-label="Compare both emirates">
            <PlusIcon />
            <span className="plus-t">Compare</span>
          </button>
        )}
      </div>
      {emMany && (
        <div className="chips">
          {EMIRATES.map((e) => (
            <Chip
              key={e}
              label={EM_LABEL[e]}
              color={enc.colorOf('emirate', e)}
              dash={enc.dashOf('emirate', e)}
              shadePct={enc.shadeOf('emirate', e)}
              onClick={() => {}}
              onRemove={() => setC((o) => ({ ...o, emirates: o.emirates.filter((x) => x !== e) }))}
            />
          ))}
        </div>
      )}
    </div>
  );

  const comparing = [
    ...(selectedScen.length > 1 ? [scenRow] : []),
    ...(emMany ? [emRow] : []),
    ...FIELDS.filter((f) => vset.has(f.key)).map(row),
  ];

  return (
    <section className="settings" id="settings" aria-label="Your assumptions">
      <h2 className="settings-title">Your assumptions</h2>

      {!hintSeen && (
        <div className="hintcard">
          <span>Tap <b>Compare</b> on any option to try several values. Each combination draws one line.</span>
          <button className="icon-btn" onClick={dismissHint} aria-label="Dismiss">
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}

      {comparing.length > 0 && (
        <>
          <h3 className="group-title">Comparing <span className="gt-sub">each value draws its own lines</span></h3>
          <div className="group">{comparing}</div>
        </>
      )}

      <h3 className="group-title">{comparing.length ? 'Fixed' : 'Essentials'}</h3>
      <div className="group">
        {selectedScen.length <= 1 && scenRow}
        {!emMany && emRow}
        {ESSENTIALS.filter((k) => !vset.has(k)).map((k) => row(FIELD[k]))}
      </div>

      <h3 className="group-title">More options</h3>
      <div className="search">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        <input type="search" placeholder="Search options" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search options" />
      </div>
      {q ? (
        <div className="group">
          {matches.length ? matches.map(row) : <p className="empty">No option matches “{query}”</p>}
        </div>
      ) : (
        <div className="group">
          {GROUPS.map((g) => {
            const fs = more.filter((f) => f.group === g);
            if (!fs.length) return null;
            const open = openGroups[g] ?? false;
            return (
              <div key={g} className="collapsible">
                <button className="group-head" onClick={() => setOpenGroups((o) => ({ ...o, [g]: !open }))} aria-expanded={open}>
                  <span className="gh-t">{g}</span>
                  <span className="gh-s">{fs.length} option{fs.length > 1 ? 's' : ''}</span>
                  <Chevron open={open} />
                </button>
                {open && fs.map(row)}
              </div>
            );
          })}
          <EmirateFees c={c} setC={setC} open={openGroups.fees ?? false} toggle={() => setOpenGroups((o) => ({ ...o, fees: !(o.fees ?? false) }))} />
        </div>
      )}

      <details className="counted">
        <summary>What is counted <Chevron /></summary>
        <p>
          <b>Cost of renting</b>: rent, housing fee, agent fee and moving costs every few years, minus what your savings earned (the
          down payment and fees you did not spend, plus each month's gap while renting is cheaper).
        </p>
        <p>
          <b>Cost of buying then selling</b>: down payment, transfer fee, agent + VAT, trustee and mortgage fees, moving in, mortgage
          payments, service charges, maintenance, insurance and housing fee; minus the sale price, plus the selling agent + VAT, NOC,
          early settlement fee (1% of the loan left, max AED 10k) and the loan payoff; minus what the owner's savings earned once
          owning is cheaper than renting.
        </p>
        <p>No property tax or capital gains tax in the UAE. Not counted: security deposit, off-plan payment plans, Golden Visa.</p>
      </details>

      <button className="btn plain reset" onClick={() => setC(() => structuredClone(DEFAULT_CONFIG))}>Reset everything</button>

      <ValueSheet s={sheet} c={c} setC={setC} onClose={() => setSheet(null)} />
      <ScenarioEditor open={scen} onClose={() => setScen(false)} c={c} setC={setC} enc={enc} openSheet={setSheet} />
    </section>
  );
}

function EmirateFees({ c, setC, open, toggle }: { c: Config; setC: SetC; open: boolean; toggle: () => void }) {
  return (
    <div className="collapsible">
      <button className="group-head" onClick={toggle} aria-expanded={open}>
        <span className="gh-t">Fees by emirate</span>
        <span className="gh-s">{c.emirates.map((e) => EM_LABEL[e]).join(' + ')}</span>
        <Chevron open={open} />
      </button>
      {open &&
        c.emirates.map((e: Emirate) => (
          <div key={e}>
            <div className="sub-head">{EM_LABEL[e]}</div>
            {EM_FIELDS.map((f) => (
              <div key={f.key} className="opt">
                <div className="opt-main">
                  <div className="opt-text"><span className="opt-label">{f.label}</span></div>
                  <NumInput
                    kind={f.kind}
                    label={`${EM_LABEL[e]} ${f.label}`}
                    value={c.emFees[e][f.key]}
                    onCommit={(v) => setC((o) => ({ ...o, emFees: { ...o.emFees, [e]: { ...o.emFees[e], [f.key]: v } } }))}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

export function useCount(c: Config) {
  return useMemo(() => countLines(c), [c]);
}
