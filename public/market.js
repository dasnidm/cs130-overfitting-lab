// All parameters and behavioral rules are teaching assumptions, not HUMANA estimates.
export const STOCK = 120;
export const CUSTOMERS = 180;
export const START_PRICE = 6;
export const RISK_SCALE = 10;

export function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function score(random) {
  let z;
  do {
    z = 5.5 + 1.5 * Math.sqrt(-2 * Math.log(Math.max(Number.MIN_VALUE, random()))) * Math.cos(2 * Math.PI * random());
  } while (z < 1 || z > 10);
  return Math.round(z);
}

export function waitingWeight(random) {
  // A ratio of independent Gamma(2,1) draws has a Beta(2,2) distribution.
  const gamma2 = () => -Math.log(Math.max(Number.MIN_VALUE, random())) - Math.log(Math.max(Number.MIN_VALUE, random()));
  const a = gamma2(), b = gamma2();
  return a / (a + b);
}

export function schedule(markdown, duration) {
  return Array.from({ length: duration }, (_, t) => START_PRICE * (1 - markdown / 100 * t / (duration - 1)));
}

export function buyNow(weight, remaining, price, nextPrice) {
  if (!remaining) return false;
  if (nextPrice == null) return true;
  const risk = RISK_SCALE / (RISK_SCALE + remaining);
  const saving = (price - nextPrice) / price;
  return (1 - weight) * risk >= weight * saving;
}

export function simulateCampaign(markdown, duration, seed, trace = false) {
  const random = rng(seed);
  const prices = schedule(markdown, duration);
  const stock = Array(11).fill(0);
  const inventory = trace ? [] : null;
  const bins = trace ? Array.from({ length: 11 }, () => []) : null;
  for (let id = 0; id < STOCK; id++) {
    const attractiveness = score(random);
    stock[attractiveness]++;
    if (trace) { inventory.push({ id, attractiveness }); bins[attractiveness].push(id); }
  }
  const customers = Array.from({ length: CUSTOMERS }, (_, id) => ({
    id, threshold: score(random), weight: waitingWeight(random), firstDay: Math.floor(random() * duration), done: false
  }));
  const days = [], purchases = trace ? [] : null;
  let revenue = 0, soldTotal = 0;
  for (let t = 0; t < duration; t++) {
    const active = customers.filter(c => !c.done && c.firstDay <= t);
    for (let i = active.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [active[i], active[j]] = [active[j], active[i]];
    }
    let sold = 0, waiting = 0, lost = 0;
    for (const customer of active) {
      let acceptable = 0, best = 0;
      for (let a = customer.threshold; a <= 10; a++) {
        acceptable += stock[a];
        if (stock[a]) best = a;
      }
      if (!acceptable) { customer.done = true; lost++; continue; }
      if (buyNow(customer.weight, acceptable, prices[t], prices[t + 1])) {
        stock[best]--; customer.done = true; sold++; soldTotal++;
        if (trace) purchases.push({ day: t + 1, customerId: customer.id, itemId: bins[best].pop(), attractiveness: best, threshold: customer.threshold, price: prices[t], acceptableBefore: acceptable, risk: RISK_SCALE / (RISK_SCALE + acceptable) });
      } else waiting++;
    }
    const dailyRevenue = prices[t] * sold;
    revenue += dailyRevenue;
    if (trace) days.push({ day: t + 1, price: prices[t], arrivals: customers.filter(c => c.firstDay === t).length, sold, waiting, lost, revenue: dailyRevenue, stock: [...stock], remaining: STOCK - soldTotal });
  }
  const result = { x: markdown, y: revenue, seed, sold: soldTotal, remaining: STOCK - soldTotal };
  if (trace) Object.assign(result, { prices, days, inventory, customers, purchases });
  return result;
}
