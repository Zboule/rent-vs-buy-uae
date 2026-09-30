# Rent or Buy, UAE

**If I buy in year X and sell in year Y, am I richer or poorer than if I had kept renting?**

Try it: **<https://zboule.github.io/rent-vs-buy-uae/>**

A rent vs buy calculator tailored to Dubai and Abu Dhabi: DLD / DMT transfer fees, trustee and
mortgage registration, agent commission with VAT, the Central Bank early settlement cap, the
housing / municipality fee, service charges, fixed-then-variable mortgages, and market scenarios
modelled on the UAE's real cycles. Every value is editable and every scenario is a shareable URL.

## What you see

- **Presets compared**: tick price trends (optimistic to pessimistic), market cycles, investment returns,
  emirates and financing. Every combination is one curve on a single chart (colour = price trend x
  cycle, line style = return x emirate x financing), plus a break-even table.
- **Buy in X, sell in Y**: the advantage for every sell year, for the selected buy year.
- **Heatmap**: every buy year (rows) × every holding period (columns). The outlined cell is the
  break-even holding period.
- **Year-by-year table**: sale price, selling costs, loan left, net proceeds, both portfolios.

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
