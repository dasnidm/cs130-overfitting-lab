import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, cleanConfig, simulate, repeatSimulation, fitModels, predict, rmse } from '../public/stats.js';
import { rng, score, waitingWeight, buyNow, simulateCampaign, STOCK, CUSTOMERS } from '../public/market.js';

test('bounded normal scores and Beta weights have the intended population shape', () => {
  const random=rng(1234), counts=Array(11).fill(0), weights=[];
  for(let i=0;i<50000;i++) {
    const a=score(random),w=waitingWeight(random);
    assert.ok(Number.isInteger(a)&&a>=1&&a<=10);
    assert.ok(w>0&&w<1); counts[a]++;weights.push(w);
  }
  const modes=counts.map((count,i)=>({count,i})).sort((a,b)=>b.count-a.count).slice(0,2).map(x=>x.i).sort();
  assert.deepEqual(modes,[5,6]);
  assert.ok(Math.abs(weights.reduce((a,b)=>a+b)/weights.length-.5)<.005);
  assert.ok(Math.abs(weights.reduce((a,b)=>a+(b-.5)**2,0)/weights.length-.05)<.002);
});

test('purchase decision responds to waiting preference, savings, stock scarcity, and the last day', () => {
  assert.equal(buyNow(0,100,6,5),true);
  assert.equal(buyNow(1,100,6,5),false);
  assert.equal(buyNow(.5,100,6,5),false);
  assert.equal(buyNow(.5,1,6,5),true);
  assert.equal(buyNow(.5,100,6,5.9),true);
  assert.equal(buyNow(1,1,2,undefined),true);
  assert.equal(buyNow(0,0,2,undefined),false);
});

test('customer trace conserves inventory, eligibility, queue accounting, and revenue', () => {
  for(const duration of [2,5,10]) for(const markdown of [10,200/3,80]) {
    const c=simulateCampaign(markdown,duration,130,true);
    assert.equal(c.sold+c.remaining,STOCK);
    assert.equal(new Set(c.purchases.map(p=>p.itemId)).size,c.sold);
    assert.equal(new Set(c.purchases.map(p=>p.customerId)).size,c.sold);
    assert.equal(c.purchases.length,c.sold);
    assert.ok(Math.abs(c.purchases.reduce((s,p)=>s+p.price,0)-c.y)<1e-8);
    const remaining=new Map(c.inventory.map(i=>[i.id,i.attractiveness]));
    for(const p of c.purchases) {
      const customer=c.customers[p.customerId];
      assert.ok(p.attractiveness>=customer.threshold);
      assert.ok(customer.firstDay<p.day);
      assert.equal(remaining.get(p.itemId),p.attractiveness);
      assert.equal(Math.max(...remaining.values()),p.attractiveness);
      assert.equal(buyNow(customer.weight,p.acceptableBefore,p.price,c.prices[p.day]),true);
      remaining.delete(p.itemId);
    }
    let previousWaiting=0,stock=STOCK,completed=0;
    for(const d of c.days) {
      assert.equal(d.arrivals+previousWaiting,d.sold+d.waiting+d.lost);
      assert.equal(d.remaining,stock-d.sold);
      assert.equal(d.stock.reduce((a,b)=>a+b),d.remaining);
      assert.equal(d.revenue,d.price*d.sold);
      previousWaiting=d.waiting;stock=d.remaining;completed+=d.sold+d.lost;
    }
    assert.equal(previousWaiting,0);
    assert.equal(completed,CUSTOMERS);
    assert.deepEqual(simulateCampaign(markdown,duration,130),{x:c.x,y:c.y,seed:c.seed,sold:c.sold,remaining:c.remaining});
  }
});

test('OLS recovers a known polynomial independently of the behavioral generator', () => {
  const truth=x=>2200+400*((x-45)/35)-950*((x-45)/35)**2;
  const data=Array.from({length:30},(_,i)=>({x:10+70*i/29,y:truth(10+70*i/29)}));
  const models=fitModels(data);
  for(const x of [12.3,27,46.4,71.2]) assert.ok(Math.abs(predict(models[2],x)-truth(x))<1e-8);
  assert.ok(rmse(data,models[1])>100);
  assert.ok(rmse(data,models[12])<1e-8);
});

test('nested OLS training error never increases, including boundary controls', () => {
  for(const n of [20,80,160]) for(const duration of [2,10]) {
    const result=simulate({n,duration,seed:130});
    result.metrics.forEach((m,j)=>{
      assert.ok(Number.isFinite(m.test));
      if(j) assert.ok(m.train<=result.metrics[j-1].train+1e-7);
    });
  }
});

test('degree keeps campaigns fixed; train and test have distinct campaign seeds', () => {
  const a=simulate({...DEFAULTS,degree:1}),b=simulate({...DEFAULTS,degree:12});
  assert.deepEqual(a,b);
  assert.deepEqual(a,simulate(DEFAULTS));
  assert.equal(a.test.length,2000);
  const trainSeeds=new Set(a.train.map(x=>x.seed));
  assert.ok(a.test.every(x=>!trainSeeds.has(x.seed)));
  assert.notDeepEqual(a.train,simulate({...DEFAULTS,duration:2}).train);
});

test('default single and repeated experiments show overfitting without a prescribed revenue curve', () => {
  const single=simulate(DEFAULTS).metrics,average=repeatSimulation(DEFAULTS);
  for(const result of [single,average]) {
    assert.ok(result[1].test<result[0].test);
    assert.ok(result[11].test>result[1].test);
    assert.ok(result[11].train<result[1].train);
  }
  assert.deepEqual(repeatSimulation(DEFAULTS,1),single);
});

test('URL inputs are finite and bounded', () => {
  const c=cleanConfig({n:-100,degree:'Infinity',duration:999,seed:'<script>',mode:'<img>',log:'1'});
  assert.equal(c.n,20);assert.equal(c.degree,DEFAULTS.degree);assert.equal(c.duration,10);
  assert.equal(c.seed,DEFAULTS.seed);assert.equal(c.mode,'single');assert.equal(c.log,true);
});
