import { DEFAULTS, simulateBuy, simulateAll, type Params } from '../src/engine.ts';
let fail = 0;
const ok = (c: boolean, msg: string) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fail++; };

// Invariant: cash buyer, no fees/costs, no rent, appreciation == investment return -> diff ~ 0
const zero: Params = { ...DEFAULTS, downPct: 1, transferPct: 0, buyAgentPct: 0, regFixed: 0, mortgageRegPct: 0, mortgageRegFixed: 0,
  bankFeePct: 0, valuation: 0, moveInCost: 0, serviceCharge: 0, maintenancePct: 0, insurancePct: 0, lifeInsPct: 0, ownerHousingFeePct: 0,
  sellAgentPct: 0, sellFixed: 0, rent: 0, renterHousingFeePct: 0, moveCost: 0, rentAgentPct: 0, priceGrowth: 0.07, investReturn: 0.07 };
for (const X of [0, 5]) {
  const r = simulateBuy(zero, X, []);
  const worst = Math.max(...r.rows.map((x) => Math.abs(x.advantage)));
  ok(worst < 1, `invariant X=${X}: max |diff| = ${worst.toFixed(4)}`);
}
// Mortgage variant: loan at rate == investment return, no other costs, rent 0 -> still ~0
const lev = { ...zero, downPct: 0.2, fixedRate: 12 * (Math.pow(1.07, 1 / 12) - 1), varRate: 12 * (Math.pow(1.07, 1 / 12) - 1), lifeInsPct: 0, earlySettlePct: 0 };
const rl = simulateBuy(lev, 0, []);
ok(Math.max(...rl.rows.map((x) => Math.abs(x.advantage))) < 5, `leveraged invariant max |diff| = ${Math.max(...rl.rows.map((x) => Math.abs(x.advantage))).toFixed(2)}`);

// Year-1 sanity with defaults but zero price growth: roughly -(buy + sell costs)
const d = { ...DEFAULTS, priceGrowth: 0 };
const r1 = simulateBuy(d, 0, []);
const y1 = r1.rows[0];
console.log('buy costs', Math.round(r1.costs.total), 'sell costs', Math.round(y1.sellCosts), 'year-1 adv', Math.round(y1.advantage));
ok(y1.advantage < 0, 'year-1 advantage negative');

const all = simulateAll(DEFAULTS, []);
for (const b of all.slice(0, 3)) console.log(`X=${b.buyYear} price=${Math.round(b.price)} rent=${Math.round(b.rent)} pay/mo=${Math.round(b.monthlyPayment)} breakEven=${b.breakEven}`,
  b.rows.filter((_, i) => [0, 2, 4, 9, 14, 24].includes(i)).map((x) => `${x.held}y:${Math.round(x.advantage / 1000)}k`).join(' '));
{
  const rows = simulateBuy({ ...DEFAULTS, price: 3e6, rent: 240000, rentGrowth: 0.05 }, 2, []).rows;
  const worst = Math.max(...rows.map((x) => Math.abs(x.rentNet - x.buyNet - x.advantage)));
  ok(worst < 1e-3, `rentNet - buyNet == advantage (max err ${worst})`);
}
process.exit(fail ? 1 : 0);
