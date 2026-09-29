import { DEFAULTS, REPEATS, TEST_SIZE, cleanConfig } from './stats.js';
import { renderFit, renderErrors, renderDistribution } from './charts.js';
const $ = id => document.getElementById(id);
const state = cleanConfig(Object.fromEntries(new URLSearchParams(location.search)));
const money = n => '€'+ (n<0.005?'0.00':n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}));
let sample = null, average = null, worker = null, timer = null, job = 0;

function syncControls() {
  $('sample-size').value=state.n; $('degree').value=state.degree; $('duration').value=state.duration;
  $('n-value').textContent=state.n; $('degree-value').textContent=state.degree;
  $('duration-value').textContent=`${state.duration} days`; $('seed-value').textContent=state.seed;
  $('degree-pill').textContent=`Degree ${state.degree}`;
  $('log-scale').checked=state.log;
  $('single-mode').setAttribute('aria-pressed',String(state.mode==='single'));
  $('average-mode').setAttribute('aria-pressed',String(state.mode==='average'));
  const params=new URLSearchParams({n:state.n,degree:state.degree,duration:state.duration,seed:state.seed,mode:state.mode,log:state.log?'1':'0'});
  history.replaceState(null,'',`${location.pathname}?${params}`);
}

function render() {
  syncControls();
  if(!sample)return;
  $('clipping-note').textContent=renderFit($('fit-chart'),sample,state.degree,$('show-test').checked);
  renderCampaign();
  const metrics=state.mode==='average'?average:sample.metrics;
  if(!metrics){
    $('error-chart').innerHTML='';
    $('train-metric').textContent='—'; $('test-metric').textContent='—';
    $('interpretation').textContent='Computing 50 independent samples…';
    $('metric-table').replaceChildren();
    return;
  }
  renderErrors($('error-chart'),metrics,state.degree,state.log);
  const current=metrics[state.degree-1], quadratic=metrics[1];
  $('train-metric').textContent=money(current.train);
  $('test-metric').textContent=money(current.test);
  const scope=state.mode==='average'?'Across 50 samples':'In this sample';
  let message;
  if(state.degree===1){
    message=`${scope}, a straight line has test RMSE ${money(current.test)}; degree 2 has ${money(quadratic.test)}. Compare the full curve before interpreting either result.`;
  } else if(state.degree===2){
    message='This quadratic is a fitted approximation. Revenue comes from customer decisions. Increase the degree to see whether more detail helps on new campaigns.';
  } else if(current.test>quadratic.test*1.02 && current.train<=quadratic.train+1e-6){
    message=`${scope}, degree ${state.degree} fits training campaigns more closely than degree 2, but test RMSE rises from ${money(quadratic.test)} to ${money(current.test)}.`;
  } else {
    message=`${scope}, this degree does not clearly worsen test error relative to degree 2 (${money(quadratic.test)}). Try another sample or compare the 50-sample average.`;
  }
  $('interpretation').textContent=message;
  $('mode-note').textContent=(state.mode==='average'?'Mean RMSE across 50 training/test pairs. The fitted curve on the left shows one sample.':'Same training campaigns and same 2,000 test campaigns at every degree. Lower RMSE is better.')+(state.log?' Values below €0.01 are drawn at the bottom of the log axis; exact values are in the table.':'');
  $('table-caption').textContent=`${state.mode==='average'?'Mean RMSE across 50 samples':'One-sample RMSE'} by polynomial degree (€). Selected degree is highlighted.`;
  $('metric-table').innerHTML=metrics.map(m=>`<tr${m.degree===state.degree?' class="selected"':''}><th scope="row">${m.degree}</th><td>${m.train.toPrecision(7)}</td><td>${m.test.toPrecision(7)}</td></tr>`).join('');
}

function renderCampaign() {
  const e = sample.example;
  $('campaign-summary').textContent=`${state.duration} days · 120 items · 180 customers · ${e.sold} sold · ${money(e.y)} revenue`;
  $('campaign-table').innerHTML=e.days.map(d=>`<tr><th scope="row">${d.day}</th><td>${money(d.price)}</td><td>${d.arrivals}</td><td>${d.sold}</td><td>${d.waiting}</td><td>${d.lost}</td><td>${d.remaining}</td><td>${money(d.revenue)}</td></tr>`).join('');
  const inventory=Array(10).fill(0), thresholds=Array(10).fill(0), weights=Array(10).fill(0);
  e.inventory.forEach(i=>inventory[i.attractiveness-1]++);
  e.customers.forEach(c=>{thresholds[c.threshold-1]++;weights[Math.min(9,Math.floor(c.weight*10))]++;});
  renderDistribution($('scores-chart'),[{name:'Items',values:inventory,color:'#184d3d'},{name:'Customers',values:thresholds,color:'#b9572c'}],Array.from({length:10},(_,i)=>i+1),'Attractiveness / minimum acceptable score','scores');
  renderDistribution($('waiting-chart'),[{name:'Customers',values:weights,color:'#184d3d'}],Array.from({length:10},(_,i)=>(i/10+.05).toFixed(2)),'Waiting weight (bin midpoint)','waiting');
}

function calculate() {
  clearTimeout(timer); worker?.terminate(); const thisJob=++job;
  sample=null; average=null;
  $('download').disabled=true; $('error-message').hidden=true;
  $('status').textContent='Calculating new samples…';
  $('train-metric').textContent='—'; $('test-metric').textContent='—';
  $('fit-chart').replaceChildren(); $('error-chart').replaceChildren(); $('metric-table').replaceChildren();
  $('campaign-table').replaceChildren();$('scores-chart').replaceChildren();$('waiting-chart').replaceChildren();$('campaign-summary').textContent='Simulating customer choices…';
  $('interpretation').textContent='Calculating…';
  syncControls();
  worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  const fail=message=>{
    if(thisJob!==job)return;
    $('error-message').hidden=false; $('error-message').textContent=message+' Try a new sample or reset.';
    $('status').textContent='Simulation could not finish.'; $('download').disabled=true;
    worker?.terminate();
  };
  worker.onerror=()=>fail('The simulation could not be loaded.');
  worker.onmessage=({data})=>{
    if(thisJob!==job)return;
    if(data.type==='error'){fail(data.message);return;}
    if(data.type==='single'){sample=data.result; $('status').textContent='One sample ready · computing 50-sample average…';}
    if(data.type==='average'){average=data.result; $('status').textContent=`${state.n} training campaigns · ${TEST_SIZE.toLocaleString()} test campaigns · reproducible seed`; $('download').disabled=false;worker.terminate();}
    render();
  };
  worker.postMessage({...state});
}

for(const [id,key] of [['sample-size','n'],['duration','duration']])$(id).addEventListener('input',event=>{
  state[key]=Number(event.target.value);
  // Invalidate previous jobs immediately; never display old results with new settings.
  job++;worker?.terminate();sample=null;average=null;
  syncControls();$('download').disabled=true;$('status').textContent='Updating simulation…';
  $('train-metric').textContent='—';$('test-metric').textContent='—';
  $('fit-chart').replaceChildren();$('error-chart').replaceChildren();$('metric-table').replaceChildren();
  $('campaign-table').replaceChildren();$('scores-chart').replaceChildren();$('waiting-chart').replaceChildren();$('campaign-summary').textContent='Simulating customer choices…';
  $('interpretation').textContent='Updating simulation…';
  clearTimeout(timer);timer=setTimeout(calculate,100);
});
$('degree').addEventListener('input',event=>{state.degree=Number(event.target.value);render();});
$('resample').addEventListener('click',()=>{state.seed=(state.seed+1)>>>0;calculate();});
$('reset').addEventListener('click',()=>{Object.assign(state,DEFAULTS);$('show-test').checked=false;calculate();});
$('single-mode').addEventListener('click',()=>{state.mode='single';render();});
$('average-mode').addEventListener('click',()=>{state.mode='average';render();});
$('log-scale').addEventListener('change',event=>{state.log=event.target.checked;render();});
$('show-test').addEventListener('change',render);
$('share').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(location.href);$('status').textContent='Experiment link copied. It includes your settings and seed.';}
  catch{$('status').textContent='Copy the address from your browser: it includes your settings and seed.';}
});
$('download').addEventListener('click',()=>{
  if(!sample||!average)return;
  const artifact={
    app:'Sales Forecast Lab',version:'2.0.0',createdAt:new Date().toISOString(),url:location.href,
    synthetic:true,config:{...state},testSize:TEST_SIZE,repeats:REPEATS,
    dataGeneratingProcess:{stock:120,customers:180,score:'Round Normal(5.5,1.5²) after rejecting values outside [1,10]',weight:'Beta(2,2)',arrivals:'Each customer first arrives on a uniform random campaign day; non-buyers return daily while eligible stock exists',schedule:'d ~ Uniform(10,80); p_t=6[1-(d/100)(t-1)/(T-1)]',choice:'q=10/(10+S); s=(p_t-p_(t+1))/p_t; buy the highest-score eligible item if (1-w)q >= ws; otherwise wait. Buy on the final day if eligible stock remains.',revenue:'Sum of price × units actually sold over all campaign days',assumptions:'One item per customer, sufficient budget, shared product ranking, no replenishment, known schedule; randomized daily queue. Risk is an assumed perception, not an estimated stockout probability.'},
    coefficientBasis:'Legendre polynomials in z; index j is degree j; models array includes degree 0',
    repeatSeedRule:'(seed + imul(repeatIndex, 0x6D2B79F5)) >>> 0, indices 0..49',
    singleSample:sample,meanRmse:average,
    note:'Synthetic demonstration, not HUMANA sales estimates. Mean RMSE is the arithmetic mean of 50 per-sample RMSE values. A separate illustrative campaign uses final markdown 200/3%, with its full customer and purchase trace.'
  };
  const blob=new Blob([JSON.stringify(artifact,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');
  link.href=url;link.download=`CS130-A01-run-seed-${state.seed}-n-${state.n}-degree-${state.degree}.json`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('status').textContent='Run downloaded with settings, observations, coefficients, and RMSE tables.';
});
calculate();
