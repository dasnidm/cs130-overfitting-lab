import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeErrors, cleanConfig } from '../public/stats.js';
import { renderErrors } from '../public/charts.js';

const rows=tests=>tests.map((test,i)=>({degree:i+1,train:10-i/2,test}));

test('curve labels distinguish a U-shape from rising, falling, and flat errors',()=>{
  const u=summarizeErrors(rows([15,10,11,14]));
  assert.equal(u.best.degree,2);assert.equal(u.uShape,true);assert.equal(u.overfits,true);
  const rising=summarizeErrors(rows([10,12,14]));
  assert.equal(rising.uShape,false);assert.equal(rising.rises,true);assert.equal(rising.falls,false);
  const falling=summarizeErrors(rows([14,12,10]));
  assert.equal(falling.uShape,false);assert.equal(falling.rises,false);assert.equal(falling.best.degree,3);
  assert.equal(summarizeErrors(rows([10,10,10])).rises,false);
});

test('chart is responsive and labels the actual minimum and axis choice',()=>{
  const metrics=rows([29,23,23.1,23.3,23.5,24,24.2,24.5,25,26,27,29]);
  for(const width of [290,1000])for(const log of [false,true])for(const zoom of [false,true]){
    const target={clientWidth:width,innerHTML:''};
    renderErrors(target,metrics,8,log,zoom);
    assert.ok(target.innerHTML.includes(`viewBox="0 0 ${width} `));
    assert.ok(target.innerHTML.includes('Lowest test error: degree 2'));
    assert.ok(target.innerHTML.includes(log?'Logarithmic':zoom?'Zoomed linear':'Linear from zero'));
    assert.ok(!/NaN|Infinity/.test(target.innerHTML));
  }
});

test('display defaults are average and zoom, while shared explicit options survive',()=>{
  assert.equal(cleanConfig().mode,'average');assert.equal(cleanConfig().zoom,true);
  assert.equal(cleanConfig({mode:'single',zoom:'0'}).mode,'single');
  assert.equal(cleanConfig({mode:'single',zoom:'0'}).zoom,false);
});
