// Golden outputs: the engine's results for a few fixed configs. `--write` records them;
// without it, compares and fails loudly if any number moved (UX refactors must not).
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { DEFAULTS, PRESETS, simulateBuy, type Params } from '../src/engine.ts';

const base = { ...DEFAULTS, price: 3_000_000, rent: 240_000, rentGrowth: 0.05, maxHold: 15 } as Params;
const cases: Record<string, [Params, number]> = {
  dubai_trend_20down: [{ ...base, scenario: 'trend', priceGrowth: 0.03, investReturn: 0.06 }, 0],
  abudhabi_bad_20y: [{ ...base, ...PRESETS.AUH, emirate: 'AUH', scenario: 'bad', investReturn: 0.055, term: 20 }, 0],
  dubai_cash_neutral: [{ ...base, scenario: 'neutral', investReturn: 0.06, downPct: 1 }, 0],
  abudhabi_crash_buy_in_2y: [{ ...base, ...PRESETS.AUH, emirate: 'AUH', scenario: 'veryBad', investReturn: 0.03 }, 2],
  dubai_chaos_50down_15y: [{ ...base, scenario: 'chaos', investReturn: 0.06, downPct: 0.5, term: 15 }, 0],
};
const out: Record<string, number[]> = {};
for (const [k, [p, X]] of Object.entries(cases)) out[k] = simulateBuy(p, X, []).rows.map((r) => Math.round(r.advantage));
const file = new URL('./golden.json', import.meta.url);
if (process.argv.includes('--write') || !existsSync(file)) {
  writeFileSync(file, JSON.stringify(out, null, 1));
  console.log('golden written');
} else {
  const want = JSON.parse(readFileSync(file, 'utf8'));
  let bad = 0;
  for (const k of Object.keys(want)) {
    const diff = want[k].map((v: number, i: number) => Math.abs(v - out[k][i])).reduce((a: number, b: number) => Math.max(a, b), 0);
    console.log(`${diff <= 1 ? 'PASS' : 'FAIL'} golden ${k} (max diff ${diff})`);
    if (diff > 1) bad++;
  }
  process.exit(bad ? 1 : 0);
}
