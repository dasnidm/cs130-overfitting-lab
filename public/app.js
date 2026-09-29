import { DEFAULTS, REPEATS, TEST_SIZE, cleanConfig } from './stats.js';
import { renderFit, renderErrors } from './charts.js';
const $ = id => document.getElementById(id);
const state = cleanConfig(Object.fromEntries(new URLSearchParams(location.search)));
const money = n => '€'+ (n<0.005?'0.00':n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}));
let sample = null, average = null, worker = null, timer = null, job = 0;

function syncControls() {
  $('sample-size').value=state.n; $('degree').value=state.degree; $('noise').value=state.noise;
  $('n-value').textContent=state.n; $('degree-value').textContent=state.degree;
  $('noise-value').textContent=`€${state.noise}`; $('seed-value').textContent=state.seed;
  $('degree-pill').textContent=`Degree ${state.degree}`;
  $('log-scale').checked=state.log;
  $('single-mode').setAttribute('aria-pressed',String(state.mode==='single'));
  $('average-mode').setAttribute('aria-pressed',String(state.mode==='average'));
  const params=new URLSearchParams({n:state.n,degree:state.degree,noise:state.noise,seed:state.seed,mode:state.mode,log:state.log?'1':'0'});
  history.replaceState(null,'',`${location.pathname}?${params}`);
}

function render() {
  syncControls();
  if(!sample)return;
  $('clipping-note').textContent=renderFit($('fit-chart'),sample,state.degree,$('show-test').checked);
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
  if(state.noise===0&&state.degree>=2){
    message='With no random noise, degree 2 already represents the true pattern. Extra terms need not make predictions worse.';
  } else if(state.degree===1){
    message=`A straight line cannot capture the assumed curved pattern. ${scope}, degree 2 has a test RMSE of ${money(quadratic.test)}.`;
  } else if(state.degree===2){
    message='A quadratic can represent the assumed true pattern. Increase the degree to see whether fitting more detail helps on new days.';
  } else if(current.test>quadratic.test*1.02 && current.train<=quadratic.train+1e-6){
    message=`${scope}, degree ${state.degree} fits training days more closely than degree 2, but test RMSE rises from ${money(quadratic.test)} to ${money(current.test)}.`;
  } else {
    message=`${scope}, this degree does not clearly worsen test error relative to degree 2 (${money(quadratic.test)}). Try another sample or compare the 50-sample average.`;
  }
  $('interpretation').textContent=message;
  $('mode-note').textContent=(state.mode==='average'?'Mean RMSE across 50 training/test pairs. The fitted curve on the left shows one sample.':'Same training days and same 2,000 test days at every degree. Lower RMSE is better.')+(state.log?' Values below €0.01 are drawn at the bottom of the log axis; exact values are in the table.':'');
  $('table-caption').textContent=`${state.mode==='average'?'Mean RMSE across 50 samples':'One-sample RMSE'} by polynomial degree (€). Selected degree is highlighted.`;
  $('metric-table').innerHTML=metrics.map(m=>`<tr${m.degree===state.degree?' class="selected"':''}><th scope="row">${m.degree}</th><td>${m.train.toPrecision(7)}</td><td>${m.test.toPrecision(7)}</td></tr>`).join('');
}

function calculate() {
  clearTimeout(timer); worker?.terminate(); const thisJob=++job;
  sample=null; average=null;
  $('download').disabled=true; $('error-message').hidden=true;
  $('status').textContent='Calculating new samples…';
  $('train-metric').textContent='—'; $('test-metric').textContent='—';
  $('fit-chart').replaceChildren(); $('error-chart').replaceChildren(); $('metric-table').replaceChildren();
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
    if(data.type==='average'){average=data.result; $('status').textContent=`${state.n} training days · ${TEST_SIZE.toLocaleString()} test days · reproducible seed`; $('download').disabled=false;worker.terminate();}
    render();
  };
  worker.postMessage({...state});
}

for(const [id,key] of [['sample-size','n'],['noise','noise']])$(id).addEventListener('input',event=>{
  state[key]=Number(event.target.value);
  // Invalidate previous jobs immediately; never display old results with new settings.
  job++;worker?.terminate();sample=null;average=null;
  syncControls();$('download').disabled=true;$('status').textContent='Updating simulation…';
  $('train-metric').textContent='—';$('test-metric').textContent='—';
  $('fit-chart').replaceChildren();$('error-chart').replaceChildren();$('metric-table').replaceChildren();
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
    app:'Sales Forecast Lab',version:'1.0.0',createdAt:new Date().toISOString(),url:location.href,
    synthetic:true,config:{...state},testSize:TEST_SIZE,repeats:REPEATS,
    dataGeneratingProcess:'discount ~ Uniform(10,80); z=(discount-45)/35; y=2200+400*z-950*z^2+Normal(0,noise^2)',
    coefficientBasis:'Legendre polynomials in z; index j is degree j; models array includes degree 0',
    repeatSeedRule:'(seed + imul(repeatIndex, 0x6D2B79F5)) >>> 0, indices 0..49',
    singleSample:sample,meanRmse:average,
    note:'Synthetic demonstration, not HUMANA sales estimates. Mean RMSE is the arithmetic mean of 50 per-sample RMSE values.'
  };
  const blob=new Blob([JSON.stringify(artifact,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');
  link.href=url;link.download=`CS130-A01-run-seed-${state.seed}-n-${state.n}-degree-${state.degree}.json`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('status').textContent='Run downloaded with settings, observations, coefficients, and RMSE tables.';
});
calculate();
