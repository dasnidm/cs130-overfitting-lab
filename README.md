# Sales Forecast Lab

[Open the live app](https://cs130-overfitting-lab.vercel.app) · [Source code](https://github.com/dasnidm/cs130-overfitting-lab)

CS130 Component 2: overfitting with synthetic countdown sales. Version 2 generates revenue from customer decisions and finite inventory. No HUMANA sales records are used; parameter values and behavioral rules are teaching assumptions.

## Run and compare

With Node.js 22 or newer, run `npm start` and open `http://127.0.0.1:4173`. No dependencies or API keys are needed. `npm run build` creates the static `dist/` site; `npm test` verifies distributions, purchase rules, conservation, reproducibility, numerical fitting, and prediction error.

Change **Model complexity** (degrees 1–12) while keeping the data fixed. Compare training and test RMSE. **Training campaigns** controls sample size (20–160), and **Sale duration** controls the number of days (2–10). A duration change regenerates the experiment with different markdown steps and arrival timing, holding 180 potential customers constant.

**50-sample average** shows the arithmetic mean of 50 separate RMSE values at each degree; the fitted curve and example still display the first sample. **New sample** changes the seed; **Reset** restores defaults. **Copy this experiment** shares settings and seed. **Download run** saves the complete displayed training/test data, fitted coefficients, error tables, and the example campaign's people, items, and transactions as JSON. All 2,000 test campaigns are scored; the optional overlay displays the first 80.

## Data generation

### Inventory and customers

- Start each campaign with 120 items and 180 potential customers.
- Draw each item's attractiveness and each customer's minimum acceptable score independently from Normal(5.5, 1.5²), reject draws outside [1, 10], and round to an integer. Thus 5 and 6 are the population modes.
- Each customer has an independent, fixed waiting weight `w ~ Beta(2,2)`. The generator uses a ratio of two independent Gamma(2,1) draws.
- Independently assign each customer's first arrival uniformly across the campaign days. Waiting customers return each following day; active customers are shuffled each day.
- All customers share the product ranking, can afford €6, and buy at most one item. There is no replenishment.

### Prices and decisions

For each campaign, independently draw final markdown `d ~ Uniform(10,80)`, in percentage points. For duration T and day t=1,...,T:

```text
p_t = 6[1 - (d/100)(t-1)/(T-1)]
S = remaining items with attractiveness >= this customer's threshold
q = 10/(10+S)
s = (p_t - p_(t+1))/p_t
buy now if (1-w)q >= ws; otherwise return tomorrow
```

The value q is an assumed perception of the risk of finding no acceptable item tomorrow. It rises with scarcity; the scale 10 is a fixed illustration parameter, not an estimated stockout probability. Recompute S at each customer's turn. A buyer selects the highest-scoring acceptable item, and that item is immediately removed. A customer with S=0 leaves permanently. On the final day, a customer with S>0 buys.

Daily revenue equals price times actual purchases; campaign revenue is the sum across days. Prices are computed without cent rounding, with two decimals used only for display. Random inventory, preferences, arrivals, and queue order produce revenue variation. There is no imposed revenue curve or added Gaussian revenue noise.

The separate inspector uses final markdown 200/3%, giving **€6 → €5 → €4 → €3 → €2** at the default five-day duration. This is an illustrative schedule, not a claimed historical HUMANA promotion. Histograms show the actual example draw, which need not exactly match its population distribution.

## Regression and evaluation

One observation is one whole campaign: final markdown is x, total revenue is y. Fit ordinary least squares polynomials of degrees 1–12 to n campaigns and evaluate on 2,000 fresh campaigns from the same process. A Legendre basis with z=(x-45)/35 and twice-orthogonalized modified Gram-Schmidt QR spans the same polynomial spaces as powers of x. No regularization or test outcomes enter the fit.

Nested OLS training error cannot increase on fixed data, apart from rounding. A higher degree can fit random customer variation and predict independent campaigns less accurately. There is no guarantee of a U-shaped test curve for every seed or duration. Unconstrained predictions can be negative or extreme; all full predictions enter RMSE. The fitted line is visually clipped to the plot bounds when needed, with a notice. A log axis plots values below €0.01 at the floor; the table and export retain full values.

At seed 130, n=80, T=5:

| Degree | Training RMSE | Test RMSE |
| --- | ---: | ---: |
| 1 | €27.55 | €28.70 |
| 2 | €21.85 | €23.66 |
| 12 | €19.26 | €29.55 |

Across 50 samples, degrees 2 and 12 have mean test RMSE €22.77 and €28.95, respectively. These are simulation results, not HUMANA business estimates or a user-completed AI audit.

The test curve is for teaching. Choosing degree after inspecting it requires another untouched test set for a final assessment. Real campaigns may differ in customer behavior, inventory, budgets, and arrivals, so this simulation cannot select a real optimal promotion.

## Reproducibility and files

`public/market.js` generates the customer market. `public/stats.js` fits and evaluates models. `public/worker.js` calculates off the UI thread; `public/app.js` handles controls and exports; `public/charts.js` renders SVG.

The seeded PRNG is Mulberry32. In each split, campaign seeds are (splitSeed + i) modulo 2³²; markdowns use a separate PRNG initialized by splitSeed XOR 0xA341316C. Test splitSeed is seed XOR 0x80000000, making campaign seeds disjoint within a run. The illustrative campaign uses seed XOR 0xC8013EA4. Repeated experiment r=0,...,49 uses (seed + imul(r,0x6D2B79F5)) modulo 2³². Changing degree never changes data. Saved settings, seeds, and the source version reproduce all repeated pairs.

## Reference and AI disclosure

James, G., Witten, D., Hastie, T., & Tibshirani, R. (2021). *An introduction to statistical learning: With applications in R* (2nd ed., Section 2.2, pp. 31–36). Springer. https://doi.org/10.1007/978-1-0716-1418-1

ChatGPT assisted with the simulation design, code, interface, tests, and explanations. All sales data are synthetic.
