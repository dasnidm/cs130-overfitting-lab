import { predict, summarizeErrors } from './stats.js';
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
  const ymin = 0;
  const ymax = Math.max(100, Math.ceil(Math.max(...visible.map(p=>p.y)) / 100) * 100);
  const sx = x => L + (x - 10) / 70 * PW;
  const sy = y => T + PH * (1 - (y - ymin) / (ymax - ymin));
  const xticks = [10,20,30,40,50,60,70,80];
  const yticks = Array.from({length:5},(_,i)=>ymin+(ymax-ymin)*i/4);
  let body = grid(xticks,yticks,sx,sy,'Final markdown from €6 (%)','Campaign revenue (€)');
  const xs = Array.from({length:401},(_,i)=>10+70*i/400);
  const predictions = xs.map(x=>predict(sample.models[degree],x));
  const clipped = predictions.some(y=>y<ymin||y>ymax);
  body += `<g clip-path="url(#fit-clip)">`;
  if (showTest) for (const point of sample.test.slice(0,80)) body += circle(sx(point.x),sy(point.y),'none',2.5,`stroke="${ORANGE}" opacity=".45"`);
  for (const point of sample.train) body += circle(sx(point.x),sy(point.y),GREEN,3,'opacity=".65"');
  // Clamp only SVG coordinates far outside the viewport; never alter predictions or RMSE.
  body += path(xs.map((x,i)=>[sx(x),Math.max(-5000,Math.min(5000,sy(predictions[i])))]),GREEN);
  body += '</g>';
  target.innerHTML = svg(`Degree ${degree} polynomial fitted to ${sample.train.length} synthetic campaigns. Final markdowns from 10 to 80 percent; total campaign revenue in euros.`,body,'fit');
  return clipped ? `Curve extends beyond the visible revenue range. Errors still use every full prediction.` : 'Each point is a complete simulated sale, with fresh inventory and customers.';
}

export function renderDistribution(target, series, labels, title, id) {
  const maximum = Math.max(...series.flatMap(s => s.values), 1);
  const ymax = Math.ceil(maximum / 10) * 10;
  const sx = i => L + (i + .5) / labels.length * PW;
  const sy = y => T + PH * (1 - y / ymax);
  let body = grid([], [0, ymax / 2, ymax], sx, sy, title, 'Count');
  const width = PW / labels.length * .65 / series.length;
  for (let i = 0; i < labels.length; i++) {
    body += text(sx(i), H - B + 21, labels[i]);
    series.forEach((s, j) => {
      const x = sx(i) - width * series.length / 2 + j * width;
      body += `<rect x="${x}" y="${sy(s.values[i])}" width="${width - 1}" height="${T + PH - sy(s.values[i])}" fill="${s.color}"><title>${esc(s.name)} · ${esc(labels[i])}: ${s.values[i]}</title></rect>`;
    });
  }
  target.innerHTML = svg(`${title}. ${series.map(s => `${s.name}: ${s.values.join(', ')}`).join('; ')}`, body, id);
}

export function renderErrors(target, metrics, degree, log, zoom = true) {
  const width = Math.max(280, Math.round(target.clientWidth || 700));
  const height = width < 600 ? 300 : 350;
  const left = 52, right = 18, top = 35, bottom = 51;
  const pw = width - left - right, ph = height - top - bottom;
  const sx = x => left+(x-1)/11*pw;
  const values = metrics.flatMap(m=>[m.train,m.test]);
  const minimum = Math.min(...values), maximum = Math.max(...values);
  const summary = summarizeErrors(metrics);
  let sy, yticks;
  if (log) {
    const low = -2;
    const high = Math.max(1,Math.ceil(Math.log10(Math.max(maximum,1))));
    sy = value => top+ph*(1-(Math.log10(Math.max(10**low,value))-low)/(high-low));
    yticks = Array.from({length:high-low+1},(_,i)=>10**(low+i));
    if (yticks.length>7) yticks=yticks.filter((_,i)=>i%Math.ceil(yticks.length/7)===0 || i===yticks.length-1);
  } else {
    const span = Math.max(maximum-minimum, 1);
    const ymin = zoom ? Math.max(0,minimum-span*.14) : 0;
    const ymax = Math.max(ymin+1, maximum+span*.12);
    sy = value => top+ph*(1-(value-ymin)/(ymax-ymin));
    yticks = Array.from({length:5},(_,i)=>ymin+(ymax-ymin)*i/4);
  }
  let body = text(left,14,`Lowest test error: degree ${summary.best.degree}`,'start','font-weight="600"');
  body += text(width-right,14,`Selected: ${degree}`,'end');
  if(summary.overfits) body += `<rect x="${sx(summary.best.degree)}" y="${top}" width="${width-right-sx(summary.best.degree)}" height="${ph}" fill="#fbf1eb"/>`;
  for(const tick of yticks) body += line(left,sy(tick),width-right,sy(tick))+text(left-9,sy(tick)+4,short(tick),'end');
  for(const m of metrics) body += text(sx(m.degree),height-bottom+21,m.degree);
  body += text(left+pw/2,height-6,'Model complexity (polynomial degree)');
  body += line(sx(degree),top,sx(degree),height-bottom,'#97a591','stroke-dasharray="3 4"');
  body += line(sx(summary.best.degree),top,sx(summary.best.degree),height-bottom,ORANGE,'stroke-dasharray="3 4" opacity=".65"');
  body+=path(metrics.map(m=>[sx(m.degree),sy(m.train)]),GREEN);
  body+=path(metrics.map(m=>[sx(m.degree),sy(m.test)]),ORANGE,'stroke-dasharray="6 4"');
  body+=circle(sx(summary.best.degree),sy(summary.best.test),'white',8,`stroke="${ORANGE}" stroke-width="2"`);
  for(const m of metrics){
    for(const key of ['train','test'])body+=circle(sx(m.degree),sy(m[key]),key==='train'?GREEN:ORANGE,m.degree===degree?5:2.8,`stroke="white" stroke-width="1.5"`);
  }
  const title=`Training and test RMSE in euros for degrees 1 to 12. Lowest test error at degree ${summary.best.degree}. Selected degree ${degree}. ${log?'Logarithmic':zoom?'Zoomed linear':'Linear from zero'} vertical scale. ${summary.uShape?'Test error falls and then rises.':'A full U-shape is not present in this run.'}`;
  target.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="errors-title"><title id="errors-title">${esc(title)}</title>${body}</svg>`;
}
