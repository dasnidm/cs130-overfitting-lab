import { predict, trueRevenue } from './stats.js';
const GREEN = '#184d3d', ORANGE = '#b9572c', GREY = '#98a28f';
const W = 550, H = 318, L = 61, R = 16, T = 21, B = 48;
const PW = W - L - R, PH = H - T - B;
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const short = x => Math.abs(x) >= 1000000 ? `${+(x / 1000000).toPrecision(3)}m` : Math.abs(x) >= 1000 ? `${+(x / 1000).toPrecision(3)}k` : `${+x.toPrecision(3)}`;
const text = (x, y, label, anchor = 'middle', extra = '') => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#798376" font-family="Segoe UI,Arial,sans-serif" font-size="11" ${extra}>${esc(label)}</text>`;
const line = (x1, y1, x2, y2, color = '#e7ebe2', extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" ${extra}/>`;
const path = (points, color, extra = '') => `<path d="${points.map(([x,y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}" stroke="${color}" stroke-width="2.3" fill="none" ${extra}/>`;
const circle = (x, y, color, radius = 3, extra = '') => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" ${extra}/>`;
function svg(title, body, id) { return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-title"><title id="${id}-title">${esc(title)}</title><defs><clipPath id="${id}-clip"><rect x="${L}" y="${T}" width="${PW}" height="${PH}"/></clipPath></defs>${body}</svg>`; }
function grid(xticks, yticks, sx, sy, xlabel, ylabel) {
  let body = text(L, 10, ylabel, 'start');
  for (const tick of yticks) body += line(L, sy(tick), W - R, sy(tick)) + text(L - 10, sy(tick) + 4, short(tick), 'end');
  for (const tick of xticks) body += text(sx(tick), H - B + 21, tick);
  return body + text(L + PW / 2, H - 6, xlabel);
}

export function renderFit(target, sample, degree, showTest) {
  const visible = showTest ? [...sample.train, ...sample.test.slice(0,80)] : sample.train;
  const ymin = Math.min(0, Math.floor(Math.min(...visible.map(p=>p.y)) / 500) * 500);
  const ymax = Math.max(3000, Math.ceil(Math.max(...visible.map(p=>p.y)) / 500) * 500);
  const sx = x => L + (x - 10) / 70 * PW;
  const sy = y => T + PH * (1 - (y - ymin) / (ymax - ymin));
  const xticks = [10,20,30,40,50,60,70,80];
  const yticks = Array.from({length:5},(_,i)=>ymin+(ymax-ymin)*i/4);
  let body = grid(xticks,yticks,sx,sy,'Discount (%)','Daily revenue (€)');
  const xs = Array.from({length:401},(_,i)=>10+70*i/400);
  const predictions = xs.map(x=>predict(sample.models[degree],x));
  const clipped = predictions.some(y=>y<ymin||y>ymax);
  body += `<g clip-path="url(#fit-clip)">`;
  if (showTest) for (const point of sample.test.slice(0,80)) body += circle(sx(point.x),sy(point.y),'none',2.5,`stroke="${ORANGE}" opacity=".45"`);
  body += path(xs.map(x=>[sx(x),sy(trueRevenue(x))]), GREY, 'stroke-dasharray="3 5"');
  for (const point of sample.train) body += circle(sx(point.x),sy(point.y),GREEN,3,'opacity=".65"');
  // Clamp only SVG coordinates far outside the viewport; never alter predictions or RMSE.
  body += path(xs.map((x,i)=>[sx(x),Math.max(-5000,Math.min(5000,sy(predictions[i])))]),GREEN);
  body += '</g>';
  target.innerHTML = svg(`Degree ${degree} polynomial fitted to ${sample.train.length} synthetic training days. Discounts from 10 to 80 percent; revenue in euros. Dashed grey line is the assumed true relationship.`,body,'fit');
  return clipped ? `Curve extends beyond the visible revenue range. Errors still use every full prediction.` : 'The dotted line is the assumed truth, known only because this is a simulation.';
}

export function renderErrors(target, metrics, degree, log) {
  const sx = x => L+(x-1)/11*PW;
  const maximum = Math.max(...metrics.flatMap(m=>[m.train,m.test]));
  let sy, yticks;
  if (log) {
    const low = -2;
    const high = Math.max(1,Math.ceil(Math.log10(Math.max(maximum,1))));
    sy = value => T+PH*(1-(Math.log10(Math.max(10**low,value))-low)/(high-low));
    yticks = Array.from({length:high-low+1},(_,i)=>10**(low+i));
    if (yticks.length>7) yticks=yticks.filter((_,i)=>i%Math.ceil(yticks.length/7)===0 || i===yticks.length-1);
  } else {
    const step = 10**Math.floor(Math.log10(Math.max(maximum,1)/4));
    const ymax = Math.ceil(Math.max(maximum,1)/4/step)*step*4;
    sy = value => T+PH*(1-value/ymax);
    yticks = Array.from({length:5},(_,i)=>ymax*i/4);
  }
  let body=grid(metrics.map(m=>m.degree),yticks,sx,sy,'Polynomial degree',log?'RMSE (€ · log scale)':'RMSE (€)');
  body+=line(sx(degree),T,sx(degree),H-B,'#cdd5c5','stroke-dasharray="4 4"');
  body+=path(metrics.map(m=>[sx(m.degree),sy(m.train)]),GREEN);
  body+=path(metrics.map(m=>[sx(m.degree),sy(m.test)]),ORANGE,'stroke-dasharray="6 4"');
  for(const m of metrics){
    for(const key of ['train','test'])body+=circle(sx(m.degree),sy(m[key]),key==='train'?GREEN:ORANGE,m.degree===degree?5:2.8,`stroke="white" stroke-width="1.5"`);
  }
  target.innerHTML=svg(`Training and test RMSE for degrees 1 to 12. Degree ${degree} is selected. ${log?'Logarithmic':'Linear'} vertical scale. Exact results are in the table below.`,body,'errors');
}
