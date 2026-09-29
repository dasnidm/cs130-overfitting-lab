# Sales Forecast Lab

[Open the live app](https://cs130-overfitting-lab.vercel.app) · [Source code](https://github.com/dasnidm/cs130-overfitting-lab)

An interactive CS130 Component 2 demonstration of overfitting, using **synthetic** discount and daily revenue observations. Inspired by the HUMANA promotion question in Component 1. No internal or observed HUMANA sales records are included. The simulated relationship is not a business estimate or a recommendation for an optimal discount.

## Run

Open the deployed app, or run locally with Node.js 22 or newer:

```sh
npm start
```

Open `http://127.0.0.1:4173`. There are no package dependencies, API keys, external chart services, or installation steps. `npm run build` copies the static application into `dist/`. `npm test` runs the numerical checks.

Move **Model complexity** from degree 1 to 12 while keeping the other controls fixed. Compare the fitted curve, training RMSE, and independent test RMSE. The sample remains unchanged as degree changes. Adjust **Training observations** or **Random variation**, or choose **New sample**, to explore different conditions. The **50-sample average** switch changes only the error comparison and reported RMSE; the fitted curve still displays the first sample. Use **Reset** to restore the defaults. Zero noise is a useful counterexample to an inevitable U-shape.

**Copy this experiment** saves the settings and random seed in a shareable URL. **Download run** saves a JSON artifact with those settings, the displayed sample's complete training/test data, fitted coefficients, and both RMSE tables. The independent test set has 2,000 observations, even though the optional test overlay shows only its first 80 points. The exact-values table is available below the plots. For very large errors, switch the RMSE plot to a log scale; values below €0.01 then share the bottom plotting position, while the table and export retain the computed values.

## Statistical design

The assumed data-generating process is

```text
discount ~ Uniform(10, 80)          # percentage points
z = (discount - 45) / 35
mean revenue = 2200 + 400z - 950z²
revenue = mean revenue + ε
ε ~ Normal(0, σ²), independent across observations
```

The quadratic mean is selected as a transparent teaching assumption. Revenue is generated with additive Gaussian noise and is not clipped at zero. Unconstrained polynomial predictions may be negative or extreme; the app preserves these in RMSE calculations. Parts of the fitted line outside the plot's revenue range are clipped visually and identified by a caption.

For each fixed training sample, unregularized ordinary least squares models of degrees 1 through 12 form nested model spaces. Training residual sum of squares, and therefore training RMSE, cannot increase as terms are added, except for floating-point rounding. A flexible model can follow sample noise, which is absent from independently generated test outcomes. Test RMSE can then increase even while training RMSE decreases. The test set never enters the fit.

The implementation uses a Legendre polynomial basis on the scaled input, and QR fitting via modified Gram-Schmidt with a second orthogonalization pass. These are the same polynomial model spaces as powers of the input, with better numerical scaling. No regularization or hand-shaped error curves are used. The displayed RMSE is `sqrt(sum((observed - predicted)^2) / sampleSize)`, in euros, without a degrees-of-freedom correction. It is prediction error, not an estimate of residual standard deviation.

The average view is the arithmetic mean of the per-sample RMSE over 50 training/test pairs, rather than the square root of pooled MSE. Seeds are deterministic, starting with the displayed seed and incrementing by `0x6D2B79F5` modulo 2³² for each repetition. Within a repetition, all model degrees use identical observations. Training and test streams use distinct seeds.

The U-shape is not guaranteed for every finite sample, noise level, or complexity range. At zero noise, a degree-2 polynomial represents the assumed truth, so added terms need not worsen predictions. Small samples can produce severe instability, especially near the ends of the discount range. Changing the distribution of future campaigns would challenge this demonstration's identical-distribution assumption. The test curve is used for educational comparison; selecting a real model based on it would require a further untouched evaluation set or a separate validation procedure.

## Connection to the business question

The demonstration supports checking a proposed HUMANA sales model on later campaigns, rather than judging it solely by how closely it fits earlier sales. It does not establish which actual discount schedule is best, and it does not show that a changed discount causes higher revenue. Actual forecasting requires the store's transaction, promotion, and inventory records.

## Source layout

- `public/stats.js`: seeded simulation, polynomial regression, and RMSE.
- `public/worker.js`: computation outside the main interface thread.
- `public/charts.js`: accessible SVG charts, with an accompanying data table.
- `public/app.js`: controls, reproducible URLs, and run export.
- `public/index.html`, `public/style.css`: interface and explanations.
- `tests/stats.test.mjs`: polynomial recovery, nested-model monotonicity, independent test data, deterministic replay, zero-noise behavior, and repeated results.
- `vercel.json`: static build and response headers.

## Reference

James, G., Witten, D., Hastie, T., & Tibshirani, R. (2021). *An introduction to statistical learning: With applications in R* (2nd ed., §2.2, pp. 31–36). Springer. https://doi.org/10.1007/978-1-0716-1418-1

## AI use

ChatGPT assisted with the simulation design, implementation, interface, explanations, and automated checks. All sales data are synthetic. This repository does not contain Component 3 audit questions or claim that the student has completed the audit or submitted the assignment.
