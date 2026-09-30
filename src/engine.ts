// Rent vs buy, UAE edition.
//
// The question: "If I keep renting until year X, then buy, and sell at year Y, how much
// richer (or poorer) am I at Y than if I had kept renting the whole time?"
//
// Both paths are identical until X (same rent, same savings), so only X..Y matters.
// At X both paths hold the same cash: the buyer spends it on the down payment and all
// purchase costs; the renter invests that same amount instead. Then, every month,
// whichever side spends less on housing invests the difference, so both paths always
// have the same total outflow. At Y the owner sells (paying selling costs and clearing
// the mortgage) and adds the sale proceeds to their portfolio. The renter just has
// their portfolio. Owner wealth minus renter wealth is the advantage of buying.

export type Emirate = 'DXB' | 'AUH';

export interface Params {
  emirate: Emirate;
  // --- property & mortgage ---
  price: number; // today's price, AED (the price at year X follows the market path)
  downPct: number; // fraction of price paid in cash (1 = cash buyer)
  fixedRate: number; // mortgage rate during the fixed period
  fixedYears: number;
  varRate: number; // reversion rate after the fixed period (EIBOR + margin)
  term: number; // years
  // --- buying costs (fractions of price or loan, or AED) ---
  transferPct: number; // DLD 4% / Abu Dhabi DMT 2%
  buyAgentPct: number; // + VAT
  regFixed: number; // title deed + trustee office etc, AED incl. VAT
  mortgageRegPct: number; // of loan
  mortgageRegFixed: number; // AED
  bankFeePct: number; // arrangement fee, of loan, + VAT
  valuation: number; // AED incl. VAT
  moveInCost: number; // AED: movers, furniture gaps, DEWA/ADDC connection, snagging
  // --- owning, yearly ---
  serviceCharge: number; // AED/yr, today's figure for this property
  serviceChargeGrowth: number;
  maintenancePct: number; // of current value per year
  insurancePct: number; // home/contents insurance, of current value per year
  lifeInsPct: number; // mortgage life insurance, of outstanding balance per year
  ownerHousingFeePct: number; // of the equivalent annual rent
  // --- selling ---
  sellAgentPct: number; // + VAT
  sellFixed: number; // NOC, mortgage release, AED
  earlySettlePct: number; // of outstanding balance...
  earlySettleCap: number; // ...capped at this AED amount (CBUAE: 1% or AED 10k)
  // --- renting ---
  rent: number; // today's annual rent for an equivalent home, AED
  rentGrowth: number;
  renterHousingFeePct: number; // Dubai housing fee / Abu Dhabi municipality fee
  moveEveryYears: number; // 0 = never moves
  rentAgentPct: number; // agent fee, of annual rent, + VAT, paid on each move
  moveCost: number; // AED per move (movers, Ejari/Tawtheeq, reconnection)
  // --- market ---
  priceGrowth: number; // base yearly price change
  scenario: ScenarioKey;
  rentFollows: number; // how much of the scenario's shocks also hit rents (0..1)
  // --- money ---
  investReturn: number; // yearly return on invested cash
  investTax: number; // tax on that return (0 for most UAE residents)
  inflation: number; // only for the "today's money" view
  maxBuyYear: number; // X = 0..maxBuyYear
  maxHold: number; // Y - X = 1..maxHold
}

export const VAT = 0.05;

export type ScenarioKey = 'trend' | 'veryGood' | 'good' | 'neutral' | 'bad' | 'veryBad' | 'chaos' | 'bleed';

export interface Scenario {
  key: ScenarioKey;
  label: string;
  note: string;
  /** yearly price change, year 0 = the coming year */
  path: number[];
  /** yearly price change after the path runs out */
  tail: number;
}

// Full price paths, researched Sept 2026. Context: prices already 4-7% off the 2025 peak after
// the Iran war; 150-210k units handing over 2025-27 (Fitch: correction up to 15%, Moody's: modest
// correction from 2026). History: 2008-09 fell 45-60% peak to trough in ~18 months; 2014-2020 slid
// 25-30% over ~6 years. Rents follow price swings partly (see rentFollows).
export const SCENARIOS: Scenario[] = [
  {
    key: 'veryGood', label: 'Very good: boom resumes',
    note: 'Conflict ends fast, inflows of wealthy residents return, supply is absorbed. About +45% in 6 years.',
    path: [0.07, 0.08, 0.07, 0.06, 0.05, 0.05], tail: 0.04,
  },
  {
    key: 'good', label: 'Good: soft landing',
    note: 'A small dip as the supply wave lands, then steady growth. About +19% in 6 years.',
    path: [-0.02, 0.02, 0.04, 0.05, 0.05, 0.04], tail: 0.035,
  },
  {
    key: 'neutral', label: 'Neutral: Fitch correction, recovery',
    note: 'The 10-15% correction the rating agencies expect over 2 years, then back to normal growth. About -13% by year 3, -3% in 6 years.',
    path: [-0.07, -0.06, 0.0, 0.03, 0.04, 0.04], tail: 0.03,
  },
  {
    key: 'bad', label: 'Bad: -20% then slow decline',
    note: 'Like 2014-2020: a 20% fall over 3 years, then years of drift lower before a weak recovery. About -25% in 6 years.',
    path: [-0.1, -0.07, -0.05, -0.03, -0.02, -0.01, 0.0, 0.01, 0.02], tail: 0.025,
  },
  {
    key: 'veryBad', label: 'Very bad: 2008-style crash',
    note: 'Prices fall ~45% within 2 years, then a slow rebuild. Still about -39% after 6 years.',
    path: [-0.25, -0.22, -0.04, 0.0, 0.03, 0.05, 0.06, 0.06], tail: 0.04,
  },
  {
    key: 'chaos', label: 'Regional chaos: lost decade',
    note: 'The conflict drags on, expats leave, no recovery for 10 years. About -35% in 6 years, -37% in 10.',
    path: [-0.12, -0.1, -0.07, -0.05, -0.04, -0.03, -0.02, -0.01, -0.01, 0.0], tail: 0.01,
  },
  {
    key: 'bleed', label: 'Slow bleed: -2% a year for good',
    note: 'No crash, just a long structural decline (oversupply that never clears). About -11% in 6 years.',
    path: [], tail: -0.02,
  },
  {
    key: 'trend', label: 'Constant trend (your %)',
    note: 'The price change per year you enter, every year.',
    path: [], tail: 0,
  },
];

/** the long-run growth rents are measured against: at this price change rents grow at rentGrowth */
export const NEUTRAL_GROWTH = 0.03;

export const PRESETS: Record<Emirate, Partial<Params>> = {
  DXB: {
    transferPct: 0.04,
    regFixed: 580 + 4000 * (1 + VAT),
    mortgageRegPct: 0.0025,
    mortgageRegFixed: 290,
    renterHousingFeePct: 0.05,
    ownerHousingFeePct: 0.05,
    rentAgentPct: 0.05,
  },
  AUH: {
    transferPct: 0.02,
    regFixed: 0,
    mortgageRegPct: 0.001,
    mortgageRegFixed: 0,
    renterHousingFeePct: 0.05,
    ownerHousingFeePct: 0,
    rentAgentPct: 0.05,
  },
};

export const DEFAULTS: Params = {
  emirate: 'DXB',
  price: 2_000_000,
  downPct: 0.2,
  fixedRate: 0.0395,
  fixedYears: 3,
  varRate: 0.0595,
  term: 25,
  transferPct: 0.04,
  buyAgentPct: 0.02,
  regFixed: 580 + 4000 * (1 + VAT),
  mortgageRegPct: 0.0025,
  mortgageRegFixed: 290,
  bankFeePct: 0.005,
  valuation: 3150,
  moveInCost: 15_000,
  serviceCharge: 25_000,
  serviceChargeGrowth: 0.03,
  maintenancePct: 0.005,
  insurancePct: 0.0005,
  lifeInsPct: 0.003,
  ownerHousingFeePct: 0.05,
  sellAgentPct: 0.02,
  sellFixed: 3_500,
  earlySettlePct: 0.01,
  earlySettleCap: 10_000,
  rent: 130_000,
  rentGrowth: 0.03,
  renterHousingFeePct: 0.05,
  moveEveryYears: 3,
  rentAgentPct: 0.05,
  moveCost: 8_000,
  priceGrowth: 0.03,
  scenario: 'trend',
  rentFollows: 0.6,
  investReturn: 0.07,
  investTax: 0,
  inflation: 0.025,
  maxBuyYear: 10,
  maxHold: 25,
};

/** Yearly price and rent growth for years 0..n-1 from today. */
export function marketPath(p: Params, _custom: number[], n: number) {
  const sc = SCENARIOS.find((s) => s.key === p.scenario) ?? SCENARIOS[SCENARIOS.length - 1];
  const price: number[] = [];
  const rent: number[] = [];
  for (let y = 0; y < n; y++) {
    if (sc.key === 'trend') {
      price.push(p.priceGrowth);
      rent.push(p.rentGrowth);
    } else {
      const g = sc.path[y] ?? sc.tail;
      price.push(g);
      rent.push(p.rentGrowth + (g - NEUTRAL_GROWTH) * p.rentFollows);
    }
  }
  return { price, rent };
}

/** Cumulative index at every month 0..n*12 from yearly growth rates (monthly geometric). */
function monthlyIndex(growth: number[]): number[] {
  const out = [1];
  let v = 1;
  for (const g of growth) {
    const m = Math.pow(1 + g, 1 / 12);
    for (let i = 0; i < 12; i++) out.push((v *= m));
  }
  return out;
}

function payment(balance: number, monthlyRate: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return balance / months;
  return (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export interface BuyCosts {
  down: number;
  loan: number;
  transfer: number;
  agent: number;
  registration: number;
  mortgageFees: number;
  moveIn: number;
  total: number; // everything except the down payment
  upfront: number; // down payment + total
}

export function buyCosts(p: Params, price: number): BuyCosts {
  const down = price * Math.min(1, p.downPct);
  const loan = price - down;
  const transfer = price * p.transferPct;
  const agent = price * p.buyAgentPct * (1 + VAT);
  // Dubai trustee fee is AED 2,000 (not 4,000) under AED 500k
  const registration = p.emirate === 'DXB' && price < 500_000 ? Math.max(0, p.regFixed - 2000 * (1 + VAT)) : p.regFixed;
  const mortgageFees =
    loan > 0 ? loan * p.mortgageRegPct + p.mortgageRegFixed + loan * p.bankFeePct * (1 + VAT) + p.valuation : 0;
  const total = transfer + agent + registration + mortgageFees + p.moveInCost;
  return { down, loan, transfer, agent, registration, mortgageFees, moveIn: p.moveInCost, total, upfront: down + total };
}

export interface SellRow {
  sellYear: number; // Y (years from today)
  held: number; // Y - X
  salePrice: number;
  sellCosts: number;
  loanLeft: number;
  netProceeds: number; // sale - costs - loan payoff
  ownerPortfolio: number; // surplus the owner invested along the way
  ownerWealth: number;
  renterWealth: number;
  advantage: number; // owner - renter, nominal AED at Y
  advantageReal: number; // in today's AED
  // the same result told as costs: renting costs rent minus what the unspent cash earned,
  // buying costs everything paid out minus the net sale and what the owner's savings earned.
  // rentNet - buyNet === advantage.
  rentPaid: number; // rent + housing fee + agent fees and moves
  renterGains: number; // investment gains on the down payment, fees and monthly savings not spent
  rentNet: number;
  buyPaid: number; // down payment + purchase fees + mortgage + running costs
  ownerGains: number; // gains on the owner's monthly savings (once owning is cheaper than renting)
  buyNet: number; // buyPaid - netProceeds - ownerGains
  // cumulative spend X..Y, for the breakdown
  paidInterest: number;
  paidPrincipal: number;
  paidOwnerCosts: number; // service charge, maintenance, insurance, housing fee
  paidRent: number; // rent + housing fee + moving
}

export interface BuyResult {
  buyYear: number;
  price: number;
  rent: number; // annual rent at X
  costs: BuyCosts;
  monthlyPayment: number; // first payment
  rows: SellRow[];
  breakEven: number | null; // first holding period (years) where buying wins, and keeps winning
}

/** Buy at year X; returns the comparison for every sell year X+1 .. X+maxHold. */
export function simulateBuy(p: Params, X: number, custom: number[]): BuyResult {
  const n = X + p.maxHold;
  const mkt = marketPath(p, custom, n);
  const pIdx = monthlyIndex(mkt.price);
  const rIdxYear = [1];
  for (let y = 0; y < n; y++) rIdxYear.push(rIdxYear[y] * (1 + mkt.rent[y]));

  const price = p.price * pIdx[X * 12];
  const costs = buyCosts(p, price);
  const invMonthly = Math.pow(1 + p.investReturn * (1 - p.investTax), 1 / 12) - 1;
  const termMonths = p.term * 12;
  const fixedMonths = p.fixedYears * 12;

  let balance = costs.loan;
  let rate = p.fixedRate / 12;
  let pay = payment(balance, rate, termMonths);
  const firstPay = pay;
  let owner = 0;
  let renter = costs.upfront;
  let paidInterest = 0, paidPrincipal = 0, paidOwnerCosts = 0, paidRent = 0;
  let ownerCash = costs.upfront;
  let renterIn = costs.upfront, ownerIn = 0; // cash put into each portfolio
  const rows: SellRow[] = [];

  for (let m = 0; m < p.maxHold * 12; m++) {
    const t = X * 12 + m; // absolute month from today
    const yr = Math.floor(t / 12);
    if (m === fixedMonths && balance > 0) {
      rate = p.varRate / 12;
      pay = payment(balance, rate, termMonths - m);
    }
    const annualRent = p.rent * rIdxYear[yr];
    const value = p.price * pIdx[t];

    // owner's month
    let mortgage = 0;
    if (balance > 0.005 && m < termMonths) {
      const interest = balance * rate;
      const principal = Math.min(balance, pay - interest);
      balance -= principal;
      mortgage = interest + principal;
      paidInterest += interest;
      paidPrincipal += principal;
    }
    const running =
      (p.serviceCharge * Math.pow(1 + p.serviceChargeGrowth, yr)) / 12 +
      (value * (p.maintenancePct + p.insurancePct)) / 12 +
      (balance * p.lifeInsPct) / 12 +
      (annualRent * p.ownerHousingFeePct) / 12;
    paidOwnerCosts += running;
    const ownerOut = mortgage + running;

    // renter's month
    let renterOut = (annualRent * (1 + p.renterHousingFeePct)) / 12;
    if (p.moveEveryYears > 0 && m > 0 && m % (p.moveEveryYears * 12) === 0) {
      renterOut += annualRent * p.rentAgentPct * (1 + VAT) + p.moveCost;
    }
    paidRent += renterOut;
    ownerCash += ownerOut;

    // both portfolios grow, then whoever spent less invests the difference
    owner *= 1 + invMonthly;
    renter *= 1 + invMonthly;
    const diff = ownerOut - renterOut;
    if (diff > 0) { renter += diff; renterIn += diff; }
    else { owner -= diff; ownerIn -= diff; }

    if ((m + 1) % 12 === 0) {
      const Y = (t + 1) / 12;
      const salePrice = p.price * pIdx[t + 1];
      const settle = balance > 0 ? Math.min(balance * p.earlySettlePct, p.earlySettleCap) : 0;
      const sellCosts = salePrice * p.sellAgentPct * (1 + VAT) + p.sellFixed + settle;
      const netProceeds = salePrice - sellCosts - balance;
      const ownerWealth = owner + netProceeds;
      const advantage = ownerWealth - renter;
      const renterGains = renter - renterIn;
      const ownerGains = owner - ownerIn;
      rows.push({
        sellYear: Y,
        held: Y - X,
        salePrice,
        sellCosts,
        loanLeft: balance,
        netProceeds,
        ownerPortfolio: owner,
        ownerWealth,
        renterWealth: renter,
        advantage,
        advantageReal: advantage / Math.pow(1 + p.inflation, Y),
        rentPaid: paidRent,
        renterGains,
        rentNet: paidRent - renterGains,
        buyPaid: ownerCash,
        ownerGains,
        buyNet: ownerCash - netProceeds - ownerGains,
        paidInterest,
        paidPrincipal,
        paidOwnerCosts,
        paidRent,
      });
    }
  }

  let breakEven: number | null = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].advantage > 0) breakEven = rows[i].held;
    else break;
  }
  return { buyYear: X, price, rent: p.rent * rIdxYear[X], costs, monthlyPayment: firstPay, rows, breakEven };
}

/** First holding period from which buying wins and keeps winning, or null. */
export function breakEvenOf(rows: SellRow[], f: (r: SellRow) => number): number | null {
  let be: number | null = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (f(rows[i]) > 0) be = rows[i].held;
    else break;
  }
  return be;
}

export function simulateAll(p: Params, custom: number[]): BuyResult[] {
  const out: BuyResult[] = [];
  for (let X = 0; X <= p.maxBuyYear; X++) out.push(simulateBuy(p, X, custom));
  return out;
}
