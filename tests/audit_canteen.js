// God Mode audit. Run with:  node tests/audit_canteen.js
const C = require('../src/canteen.js');
const c0ids = () => require('../src/config.js').student.stalls.map(s => s.id);
const BASE = require('../src/config.js');
const fresh = () => JSON.parse(JSON.stringify(BASE));
let checks = 0, fails = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; if (fails < 40) console.log('  FAIL', msg); } };
const eps = 1e-6, finite = x => typeof x === 'number' && isFinite(x);

function invariants(cfg, st, d, label) {
  const ct = cfg.canteen, T = d.totals;
  ok(d.students.length === T.students && T.plates === T.students, `${label}: every student gets one plate`);
  for (const s of d.students) {
    const L = `${label} student ${s.i}`;
    ok(s.t0 <= s.tAt && s.tAt <= s.tStart + eps && s.tStart < s.tServed && s.tServed <= s.tSeat + eps && s.tSeat < s.tDone && s.tDone <= s.tBin && s.tBin < s.tExit, `${L}: timeline in order`);
    ok(Math.abs(s.eaten + s.leftover - s.served) < eps && s.eaten >= -eps && s.leftover >= -eps, `${L}: eaten + left = served`);
    ok(['right', 'hungry', 'stuffed'].includes(s.fullness) && s.stars >= 1 && s.stars <= 5, `${L}: outcome and stars valid`);
    ok([s.served, s.price, s.profit, s.need].every(finite) && s.price > 0, `${L}: numbers valid`);
    if (d.setting === 'today') ok(s.size !== 'small', `${L}: no Small today`);
    if (d.setting === 'justright' && s.size === 'less') ok(s.persona === 'light', `${L}: with Just Right only a light eater who skips the Small asks for less rice`);
    if (cfg.personas[s.persona].bigGroup) ok(s.size !== 'small' && s.size !== 'less', `${L}: big appetite never orders smaller`);
    if (s.rusher) ok(s.tDone <= s.t0 + ct.rushLeaveMin + 1 + eps || s.tSeat >= s.t0 + ct.rushLeaveMin - 2 * ct.walkMin - 1, `${L}: rusher leaves on time`);
  }
  // one plate at a time at each counter
  st.forEach((_, k) => {
    const list = d.students.filter(s => s.stall === k).sort((a, b) => a.tStart - b.tStart);
    for (let i = 1; i < list.length; i++) ok(list[i].tStart >= list[i - 1].tServed - eps, `${label}: stall ${k} serves one at a time`);
  });
  // one student per seat at a time
  const seats = {};
  d.students.forEach(s => (seats[s.seat] = seats[s.seat] || []).push(s));
  ok(Object.keys(seats).every(k => +k >= 0 && +k < ct.seats), `${label}: seats exist`);
  for (const k in seats) { const l = seats[k].sort((a, b) => a.tSeat - b.tSeat); for (let i = 1; i < l.length; i++) ok(l[i].tSeat >= l[i - 1].tDone - eps, `${label}: seat ${k} never shared`); }
  // the books
  ok(Math.abs(T.wasteG - d.students.reduce((a, s) => a + s.leftover, 0)) < 1e-3, `${label}: bin = all leftovers`);
  ok(Math.abs(T.profit - (T.revenue - T.riceCost - T.otherCost)) < 1e-6, `${label}: profit = sales - rice - other costs`);
  ok(Math.abs(T.profit - d.students.reduce((a, s) => a + s.profit, 0)) < 1e-6, `${label}: per-plate profits add up to the total`);
  ok(Math.abs(T.cookedG - T.servedG - T.unsoldG) < 1e-6, `${label}: rice cooked = served + unsold`);
  ok(T.right + T.hungry + T.stuffed === T.students, `${label}: everyone has one outcome`);
  ok(Math.abs(['portion', 'taste', 'time'].reduce((a, k) => a + T.wasteWhy[k], 0) - d.students.filter(s => s.why).reduce((a, s) => a + s.leftover, 0)) < 1e-3, `${label}: waste reasons add up`);
}

console.log('1. Same seed, same lunch; same students under both settings');
{
  const cfg = fresh(), st = C.canteenStalls(cfg);
  const a = C.canteenDay(cfg, st, 'today', 11), b = C.canteenDay(cfg, st, 'today', 11), j = C.canteenDay(cfg, st, 'justright', 11);
  ok(JSON.stringify(a) === JSON.stringify(b), 'replaying a seed gives the identical lunch');
  ok(a.students.every((s, i) => s.persona === j.students[i].persona && s.need === j.students[i].need && s.t0 === j.students[i].t0), 'Today and Just Right see the same students arriving at the same times');
}

console.log('2. Invariants over many lunches, both settings, small and large crowds');
for (const n of [50, 200, 400]) for (let seed = 1; seed <= 12; seed++) for (const set of ['today', 'justright']) {
  const cfg = fresh(), st = C.canteenStalls(cfg);
  invariants(cfg, st, C.canteenDay(cfg, st, set, seed, { students: n }), `${set}/${n}/${seed}`);
}

console.log('3. Extreme stall settings never break the model');
{
  const cases = [
    { all: { g: 80, price: 2, riceCost: 0.3, serveSec: 15, stars: 2.5 } },
    { all: { g: 400, price: 10, riceCost: 4, serveSec: 90, stars: 5 } },
    { one: { standard: { price: 2 } } },
  ];
  for (const c of cases) for (const set of ['today', 'justright']) {
    const cfg = fresh(); const ids = cfg.student.stalls.map(s => s.id);
    const edits = c.all ? Object.fromEntries(ids.map(id => [id, c.all])) : c.one;
    const st = C.canteenStalls(cfg, edits);
    invariants(cfg, st, C.canteenDay(cfg, st, set, 5, { students: 300 }), `extreme ${JSON.stringify(c).slice(0, 40)} ${set}`);
  }
  const cfg = fresh();
  const st = C.canteenStalls(cfg, { smallcheap: { price: 2, discount: 1.5 } });
  ok(C.canteenDay(cfg, st, 'justright', 3).students.every(s => s.price >= 1), 'a Small never costs less than S$1');
}

console.log('4. Direction checks over 30 lunches');
{
  const avg = (cfg, set, f) => { const st = C.canteenStalls(cfg); let x = 0; for (let s = 1; s <= 30; s++) x += f(C.canteenDay(cfg, st, set, s).totals); return x / 30; };
  const cfg = fresh();
  const wT = avg(cfg, 'today', t => t.wasteG), wJ = avg(cfg, 'justright', t => t.wasteG);
  ok(wJ < wT, `Just Right puts less food in the bin (${(wT / 1000).toFixed(2)} kg vs ${(wJ / 1000).toFixed(2)} kg)`);
  const pT = avg(cfg, 'today', t => t.wasteWhy.portion), pJ = avg(cfg, 'justright', t => t.wasteWhy.portion);
  ok(pJ < pT, 'the cut comes from plates that were too big');
  const prT = avg(cfg, 'today', t => t.profit), prJ = avg(cfg, 'justright', t => t.profit);
  ok(prJ > prT, `with each stall's discount within its rice saving (the default rule), Just Right raises profit (S$${prT.toFixed(2)} vs S$${prJ.toFixed(2)})`);
  const avgE = (edits, set, f) => { const c = fresh(), st2 = C.canteenStalls(c, edits); let x = 0; for (let s = 1; s <= 30; s++) x += f(C.canteenDay(c, st2, set, s).totals); return x / 30; };
  const dearE = Object.fromEntries(c0ids().map(id => [id, { discount: 1.0 }]));
  ok(avgE(dearE, 'justright', t => t.profit) < avgE({}, 'today', t => t.profit), 'with a S$1.00 discount everywhere, Just Right lowers profit');
  const sameE = Object.fromEntries(c0ids().map(id => [id, { discount: 0 }]));
  ok(avgE(sameE, 'justright', t => t.profit) >= prT - 1e-9 && avgE(sameE, 'justright', t => t.wasteG) < wT, '"same price, less rice" at every stall: profit not lower, still less waste');
  const more = fresh(), few = fresh(); more.canteen.students = 400; few.canteen.students = 100;
  ok(avg(more, 'today', t => t.avgWait) > avg(few, 'today', t => t.avgWait), 'a bigger crowd means longer queues');
  const slow = fresh(); slow.canteen.jrExtraSec = 20;
  ok(avg(slow, 'justright', t => t.avgWait) > avg(fresh(), 'justright', t => t.avgWait), 'if two sizes slowed serving, queues would grow');
  console.log(`   30 lunches of 200: bin ${(wT / 1000).toFixed(2)} kg Today vs ${(wJ / 1000).toFixed(2)} kg Just Right; profit S$${prT.toFixed(2)} vs S$${prJ.toFixed(2)}`);
  // God Mode's own rules, checked directly
  const cd = fresh(), sd = C.canteenStalls(cd);
  for (let s = 1; s <= 10; s++) for (const set of ['today', 'justright']) {
    const d = C.canteenDay(cd, sd, set, s);
    d.students.forEach(x => {
      ok(Math.abs(x.split.portion + x.split.taste + x.split.time - x.leftover) < 1e-6, 'each leftover is split across reasons with nothing lost');
      const again = C.outcome(cd, { size: x.size, served: x.served, need: x.need, price: x.price, extraCost: x.size === 'less' && cd.params.todayLessResponse.value === 'lessVeg' ? cd.params.extraVegCost.value : 0 }, x.eaten, x.split.time > 0 && x.why !== 'taste' ? 'time' : x.split.taste > 0 ? 'taste' : (x.why === 'time' ? 'time' : null));
      ok(Math.abs(again.stars - x.stars) < 1e-9, `stars always match how the meal ended (${x.persona}, ${x.why})`);
      if (cd.personas[x.persona].asks === 'more') ok(x.size !== 'more' || x.need > sd[x.stall].g, 'a big eater only asks for more rice when the plate is not already enough');
    });
  }
  const e400 = C.canteenStalls(cd, { generous: { g: 400 } }), g0 = C.canteenStalls(cd).find(s => s.id === 'generous');
  ok(Math.abs(e400.find(s => s.id === 'generous').riceCost - g0.riceCost * 400 / g0.g) < 0.01, 'a bigger plate costs more rice');
}

console.log('5. The Just Right defaults are a best case: less waste, profit and rating not lower, in both models');
{
  const JR = require('../src/engine.js');
  const cfg = fresh(), st = C.canteenStalls(cfg);
  let v = { tw: 0, jw: 0, tp: 0, jp: 0, tr: 0, jr: 0 };
  for (let s = 1; s <= 200; s++) { const cs = JR.makeCustomers(cfg, s, 80), t = JR.runDay(cfg, cs, 'today'), j = JR.runDay(cfg, cs, 'justright');
    v.tw += t.plateWasteG; v.jw += j.plateWasteG; v.tp += t.profit; v.jp += j.profit; v.tr += t.rating; v.jr += j.rating; }
  ok(v.jw < v.tw && v.jp >= v.tp && v.jr >= v.tr - 1e-9, `one stall: waste ${(v.tw / 200).toFixed(0)} g -> ${(v.jw / 200).toFixed(0)} g, profit S$${(v.tp / 200).toFixed(2)} -> S$${(v.jp / 200).toFixed(2)}, rating not lower`);
  let g = { tw: 0, jw: 0, tp: 0, jp: 0, tr: 0, jr: 0 };
  for (let s = 1; s <= 24; s++) { const t = C.canteenDay(cfg, st, 'today', s).totals, j = C.canteenDay(cfg, st, 'justright', s).totals;
    g.tw += t.wasteG; g.jw += j.wasteG; g.tp += t.profit; g.jp += j.profit; g.tr += t.rating; g.jr += j.rating; }
  ok(g.jw < g.tw && g.jp >= g.tp && g.jr >= g.tr - 1e-9, `whole canteen: bin ${(g.tw / 24000).toFixed(2)} kg -> ${(g.jw / 24000).toFixed(2)} kg, profit S$${(g.tp / 24).toFixed(2)} -> S$${(g.jp / 24).toFixed(2)}, rating not lower`);
  ok(cfg.params.discount.value <= JR.breakEvenDiscount(cfg) + 1e-9, 'the default discount is no bigger than the rice a Small saves at the Standard stall');
  ok(C.canteenStalls(cfg).every(s => C.effectiveDiscount(s) <= C.smallBreakEven(cfg, s) + 1e-9), 'every stall\'s default discount is within its rice saving');
  ok(C.canteenStalls(cfg).find(s => s.id === 'standard').discount === cfg.params.discount.value, 'the Standard stall in God Mode matches vendor mode');
  console.log(`   one stall: ${(v.tw / 200).toFixed(0)} g -> ${(v.jw / 200).toFixed(0)} g plate waste a day, profit S$${(v.tp / 200).toFixed(2)} -> S$${(v.jp / 200).toFixed(2)}; canteen: ${(g.tw / 24000).toFixed(2)} -> ${(g.jw / 24000).toFixed(2)} kg, S$${(g.tp / 24).toFixed(2)} -> S$${(g.jp / 24).toFixed(2)}`);
}

console.log('6. The kiosk: nutrition values, calorie-label calibration, order data');
{
  const JR = require('../src/engine.js'), cfg = fresh(), k = cfg.kiosk;
  for (const st of C.canteenStalls(cfg)) {
    const base = C.dishBaseG(cfg, st.id), d = k.dishes[st.id];
    const reg = JR.kioskFactsAt(cfg, st.id, base, base);
    ok(['kcal', 'protein', 'fat', 'carbs'].every(n => Math.abs(reg[n] - d[n]) < 1e-9), `${st.id}: the Regular shows the published plate values (${d.kcal} kcal)`);
    const small = JR.kioskFactsAt(cfg, st.id, base, Math.round(base * 0.75)), more = JR.kioskFactsAt(cfg, st.id, base, Math.round(base * 1.25));
    ok(small.kcal < reg.kcal && reg.kcal < more.kcal, `${st.id}: calories rise with the grams chosen`);
    ok(Math.abs((reg.kcal - small.kcal) - (base - Math.round(base * 0.75)) * k.perG[d.staple].kcal) < 1e-6, `${st.id}: only the ${d.staple} changes between sizes`);
    ok(['kcal', 'protein', 'fat', 'carbs'].every(n => JR.kioskFactsAt(cfg, st.id, base, 0)[n] >= 0), `${st.id}: no negative nutrition`);
  }
  // the optional calorie panel effect in God Mode matches the Cochrane estimate (1.8% fewer calories selected)
  const sel = (on) => { const st = C.canteenStalls(cfg); let kc = 0, n = 0; for (let s = 1; s <= 40; s++) { const t = C.canteenDay(cfg, st, 'justright', s, { labelsOn: on }).totals; kc += t.kcalServed; n += t.plates; } return kc / n; };
  const off = sel(false), on = sel(true), cut = 1 - on / off;
  ok(Math.abs(cut - k.labelEffectTarget) < 0.004, `calorie panel switch: ${(cut * 100).toFixed(2)}% fewer calories selected (target ${(k.labelEffectTarget * 100).toFixed(1)}%)`);
  ok(JR.cookBufferFor(cfg, 'justright') < JR.cookBufferFor(cfg, 'today') && Math.abs(JR.cookBufferFor(cfg, 'justright') - cfg.params.cookBuffer.value * (1 - k.forecastCut)) < 1e-12, 'kiosk order data trims the extra rice cooked under Just Right only');
  const cs = JR.makeCustomers(cfg, 3, 400), t = JR.runDay(cfg, cs, 'today'), j = JR.runDay(cfg, cs, 'justright');
  ok(j.kcalServed / j.plates < t.kcalServed / t.plates && j.kcalWasted < t.kcalWasted, 'one stall: Just Right serves and bins fewer calories');
  console.log(`   calorie panel: ${(cut * 100).toFixed(2)}% fewer kcal selected; one stall kcal/plate ${(t.kcalServed / t.plates).toFixed(0)} -> ${(j.kcalServed / j.plates).toFixed(0)}`);
}

console.log(`\n${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
