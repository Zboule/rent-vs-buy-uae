# Rent or Buy, UAE

**If I buy in year X and sell in year Y, am I richer or poorer than if I had kept renting?**

Try it: **<https://zboule.github.io/rent-vs-buy-uae/>**

A rent vs buy calculator tailored to Dubai and Abu Dhabi: DLD / DMT transfer fees, trustee and
mortgage registration, agent commission with VAT, the Central Bank early settlement cap, the
housing / municipality fee, service charges, fixed-then-variable mortgages, and market scenarios
modelled on the UAE's real cycles. Every value is editable and every scenario is a shareable URL.

## What you see

One graph plus your assumptions. The headline answers the question for the selected sell year
("Buying wins in 3 of 7 scenarios by 2032"). **Every option can take several values**: tap
**Compare** on any option, pick or type a value, and the button previews the result
("Add 3% · 21 → 42 lines"). Every combination is one line; the counter explains the product in
plain words ("21 lines: 7 scenarios × 3 ways to buy"), merging options that only apply to some
lines (a cash buyer has no mortgage rate, so it draws once).

Line identity is deterministic: colour = scenario, dash = down payment, a lighter/thinner stroke =
the next compared option. Below the chart, the readout is the legend: a list when one option
varies, a scenario × way-to-buy matrix otherwise. Tap a scenario or a column to isolate its lines,
tap a value or the chart to highlight a line, step the sell year with ‹ ›. The whole view,
including focus and sell year, lives in the URL hash.

**Scenarios** bundle a yearly property price path and the return earned on the money not
spent on the home (invested globally). Five weighted Abu Dhabi scenarios for a 6-year view
(Oct 2026, war ongoing): boom (10%, haven rebound, 7%), tension (35%, priced-in conflict like
Israel, 6%), bust (35%, Gulf cycle correction about -25% by 2030, 5.5%), broken haven (17%,
expat exodus like Hong Kong, 6%: money abroad is unaffected), invasion (3%, Kuwait 1990 tail, 3%).
Every return is editable; a "constant trend" scenario takes your own % values. A cash buyer ignores the
mortgage options, so it does not multiply lines.

## What the number means

**Difference = cost of renting − cost of buying then selling**, at each sell year.

- **Cost of renting** = rent + housing fee + agent fees and moves, minus what your unspent cash
  earned while invested (the down payment and buying fees you kept, plus each month's saving
  while renting is cheaper).
- **Cost of buying** = down payment + every purchase fee + mortgage payments + service charge,
  maintenance, insurance and housing fee, minus the net sale proceeds (after agent, fees and
  loan payoff), minus what the owner's own monthly savings earned (once owning is cheaper).

Positive = buying then selling was cheaper. This is algebraically the same as owner wealth minus
renter wealth (checked in `scripts/check.ts`).

## The math

Both paths are identical until year X, so the comparison starts at X with the market's price and
rent at that point.

1. At X the buyer pays the down payment plus every purchase cost. The renter invests the same
   amount instead.
2. Every month (monthly amortisation, fixed rate then reversion rate re-amortised over the
   remaining term), the owner spends mortgage + service charge + maintenance + insurance + life
   cover + housing fee, and the renter spends rent + housing fee (+ agent fee and moving costs
   every N years). **Whoever spends less invests the difference**, so both paths always have the
   same total outflow. Portfolios compound at the investment return, net of an optional tax.
3. At Y the owner sells: sale price − agent commission (+VAT) − NOC/release fees − early
   settlement fee (min(1% of balance, AED 10k)) − outstanding loan, plus their own portfolio.
4. **Advantage = owner wealth − renter wealth.** "Today's money" divides by inflation to today.

Checks (`node --experimental-strip-types scripts/check.ts`): with no fees, no rent and
appreciation equal to the investment return, the advantage is exactly 0 for every sell year,
cash or leveraged; selling after one year loses roughly the buy + sell costs.

## Default assumptions (2026)

| | Dubai | Abu Dhabi |
|---|---|---|
| Transfer fee | 4% DLD | 2% DMT |
| Title deed + trustee | AED 580 + 4,000 (+VAT) | 0 |
| Mortgage registration | 0.25% of loan + AED 290 | 0.1% of loan |
| Tenant housing / municipality fee | 5% of rent | 5% of rent |
| Owner-occupier housing fee | 5% of rental value | 0 (edit if charged) |

Both: agent 2% + VAT on buying and on selling, bank fee 0.5% of loan + VAT, valuation AED 3,150,
price AED 2M, 20% down, 4.25% fixed for 3 years then 5.5%, 25-year term, rent AED 130k (+3%/yr),
prices +3%/yr, service charge AED 25k/yr, maintenance 0.5% of value, investments 7%/yr.

Not modelled: security deposit, off-plan payment plans, renting the property out, Golden Visa
(AED 2M+ property), the flexibility of renting.
