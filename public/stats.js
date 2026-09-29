export const MAX_DEGREE = 12;
export const TEST_SIZE = 2000;
export const REPEATS = 50;
export const DEFAULTS = Object.freeze({ n: 80, degree: 8, noise: 140, seed: 130, mode: 'single', log: false });

export function cleanConfig(input = {}) {
  const integer = (value, fallback, min, max) => {
    const n = Number(value);
    return value == null || value === '' || !Number.isFinite(n) ? fallback : Math.max(min, Math.min(max, Math.round(n)));
  };
  return {
    n: integer(input.n, DEFAULTS.n, 20, 160),
    degree: integer(input.degree, DEFAULTS.degree, 1, MAX_DEGREE),
    noise: integer(input.noise, DEFAULTS.noise, 0, 250),
    seed: integer(input.seed, DEFAULTS.seed, 0, 4294967295),
    mode: input.mode === 'average' ? 'average' : 'single',
    log: input.log === true || input.log === '1'
  };
}

export function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  return Math.sqrt(-2 * Math.log(Math.max(Number.MIN_VALUE, random()))) * Math.cos(2 * Math.PI * random());
}

// An assumed relationship for teaching, not an estimate of HUMANA's sales.
export function trueRevenue(discount) {
  const z = (discount - 45) / 35;
  return 2200 + 400 * z - 950 * z * z;
}

export function generateData(n, noise, seed) {
  const xRandom = rng(seed ^ 0xA341316C);
  const eRandom = rng(seed ^ 0xC8013EA4);
  return Array.from({ length: n }, () => {
    const x = 10 + 70 * xRandom();
    return { x, y: trueRevenue(x) + noise * gaussian(eRandom) };
  });
}

// Legendre polynomials span exactly the same nested spaces as 1, x, x², ...,
// with better scaling. All fitting is unregularized ordinary least squares.
export function basis(discount, degree) {
  const z = (discount - 45) / 35;
  const values = [1];
  if (degree > 0) values.push(z);
  for (let j = 2; j <= degree; j++) values.push(((2 * j - 1) * z * values[j - 1] - (j - 1) * values[j - 2]) / j);
  return values;
}

export function predict(coefficients, discount) {
  return basis(discount, coefficients.length - 1).reduce((sum, x, j) => sum + x * coefficients[j], 0);
}

export function fitModels(data, maxDegree = MAX_DEGREE) {
  if (data.length <= maxDegree) throw new Error('More observations than polynomial coefficients are required.');
  const rows = data.map(({ x }) => basis(x, maxDegree));
  const q = [], r = Array.from({ length: maxDegree + 1 }, () => Array(maxDegree + 1).fill(0));
  const projected = [], models = [];
  for (let j = 0; j <= maxDegree; j++) {
    const column = rows.map(row => row[j]);
    // Reorthogonalized modified Gram-Schmidt avoids normal-equation inversion.
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < j; k++) {
        const dot = q[k].reduce((sum, value, i) => sum + value * column[i], 0);
        r[k][j] += dot;
        for (let i = 0; i < data.length; i++) column[i] -= dot * q[k][i];
      }
    }
    r[j][j] = Math.hypot(...column);
    if (r[j][j] < 1e-10) throw new Error('The design is numerically rank deficient. Choose a new sample or more observations.');
    q.push(column.map(value => value / r[j][j]));
    projected.push(q[j].reduce((sum, value, i) => sum + value * data[i].y, 0));
    const coefficients = Array(j + 1).fill(0);
    for (let k = j; k >= 0; k--) {
      let residual = projected[k];
      for (let l = k + 1; l <= j; l++) residual -= r[k][l] * coefficients[l];
      coefficients[k] = residual / r[k][k];
    }
    models.push(coefficients);
  }
  return models;
}

export function rmse(data, coefficients) {
  return Math.sqrt(data.reduce((sum, row) => sum + (row.y - predict(coefficients, row.x)) ** 2, 0) / data.length);
}

export function simulate(input) {
  const config = cleanConfig(input);
  const train = generateData(config.n, config.noise, config.seed);
  const test = generateData(TEST_SIZE, config.noise, (config.seed ^ 0x9E3779B9) >>> 0);
  const models = fitModels(train);
  const metrics = models.slice(1).map((coefficients, index) => ({
    degree: index + 1, train: rmse(train, coefficients), test: rmse(test, coefficients)
  }));
  return { train, test, models, metrics };
}

export function repeatSimulation(input, repeats = REPEATS) {
  const config = cleanConfig(input);
  const totals = Array.from({ length: MAX_DEGREE }, (_, j) => ({ degree: j + 1, train: 0, test: 0 }));
  for (let r = 0; r < repeats; r++) {
    const seed = (config.seed + Math.imul(r, 0x6D2B79F5)) >>> 0;
    const result = simulate({ ...config, seed });
    result.metrics.forEach((metric, j) => {
      totals[j].train += metric.train / repeats;
      totals[j].test += metric.test / repeats;
    });
  }
  return totals;
}
