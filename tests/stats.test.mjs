import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, cleanConfig, simulate, repeatSimulation, fitModels, predict, rmse, trueRevenue } from '../public/stats.js';

test('OLS recovers a known noiseless quadratic, including unseen points', () => {
  const data = Array.from({ length: 30 }, (_, i) => ({ x: 10 + 70 * i / 29, y: trueRevenue(10 + 70 * i / 29) }));
  const models = fitModels(data);
  for (const x of [12.3, 27, 46.4, 71.2]) assert.ok(Math.abs(predict(models[2], x) - trueRevenue(x)) < 1e-8);
  assert.ok(rmse(data, models[1]) > 100);
  assert.ok(rmse(data, models[12]) < 1e-8);
});

test('nested OLS training error never increases on the same observations', () => {
  for (const n of [20, 40, 160]) for (const noise of [0, 140, 250]) for (const seed of [0, 130, 912]) {
    const result = simulate({ n, noise, seed });
    result.metrics.forEach((metric, j) => {
      assert.ok(Number.isFinite(metric.test));
      if (j) assert.ok(metric.train <= result.metrics[j - 1].train + 1e-7);
    });
  }
});

test('sample, test set, and fitted sweep are independent of the degree control', () => {
  assert.deepEqual(simulate({ ...DEFAULTS, degree: 1 }), simulate({ ...DEFAULTS, degree: 12 }));
  const a = simulate(DEFAULTS), b = simulate(DEFAULTS);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.train[0], a.test[0]);
  assert.equal(a.test.length, 2000);
});

test('zero noise eliminates the expected overfitting pattern once truth is representable', () => {
  const result = simulate({ ...DEFAULTS, noise: 0 });
  for (const metric of result.metrics.slice(1)) assert.ok(metric.test < 1e-6);
});

test('repeat summary averages RMSE, and the default simulation demonstrates the claim', () => {
  const average = repeatSimulation(DEFAULTS);
  assert.ok(average[1].test < average[0].test);
  assert.ok(average[11].test > average[1].test);
  assert.ok(average[11].train < average[1].train);
  const one = repeatSimulation(DEFAULTS, 1);
  assert.deepEqual(one, simulate(DEFAULTS).metrics);
});

test('URL inputs are finite, bounded, and cannot inject markup', () => {
  const config = cleanConfig({ n: -100, degree: 'Infinity', noise: 999, seed: '<script>', mode: '<img>', log: '1' });
  assert.equal(config.n, 20);
  assert.equal(config.degree, DEFAULTS.degree);
  assert.equal(config.noise, 250);
  assert.equal(config.seed, DEFAULTS.seed);
  assert.equal(config.mode, 'single');
  assert.equal(config.log, true);
});
