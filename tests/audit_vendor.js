// Vendor-mode audit. Run with:  node tests/audit_vendor.js
// Checks the model for impossible states across every persona, every setting, extreme settings and random play.
const JR = require('../src/engine.js');
const BASE = require('../src/config.js');
const fresh = () => JSON.parse(JSON.stringify(BASE));
let checks = 0, fails = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL', msg); } };
const finite = x => typeof x === 'number' && isFinite(x);

function invariants(d, label) {
  ok(Math.abs(d.cookedG - (d.eatenG + d.plateWasteG + d.unsoldG)) < 1e-6, label + ': rice adds up');
  ok(d.plates + d.walkaways === d.customers, label + ': every customer served or walked away');
  ok(d.rating >= 1 - 1e-9 && d.rating <= 5 + 1e-9, label + ': rating within 1 to 5');
  ok([d.revenue, d.riceCost, d.otherCost, d.profit, d.plateWasteG, d.unsoldG].every(finite), label + ': all totals are numbers');
  ok(d.plateWasteG >= -1e-9 && d.unsoldG >= -1e-9, label + ': no negative waste');
  d.meals.forEach((m, i) => { if (!m) return;
    ok(m.eaten <= m.served + 1e-9 && m.eaten >= 0, `${label} meal ${i}: eaten between 0 and served`);
    ok(m.stars >= 1 && m.stars <= 5, `${label} meal ${i}: stars 1 to 5`);
    ok(m.price > 0, `${label} meal ${i}: price positive`);
  });
}

console.log('1. Orders and standard play always map to a button that exists');
{
  const cfg = fresh();
  const cs = JR.makeCustomers(cfg, 1, 2000);
  for (const s of ['today', 'justright', 'shortcut']) {
    const allowed = JR.ACTIONS[s].map(a => a[0]).concat(s === 'shortcut' ? ['more'] : []);
    cs.forEach(c => ok(allowed.includes(JR.standardAction(c, cfg, s)), `${s}: ${c.persona} standard action ${JR.standardAction(c, cfg, s)} not a button`));
    cs.forEach(c => ok(typeof JR.lineFor(c, cfg, s) === 'string' && JR.lineFor(c, cfg, s).length > 0, `${s}: line for ${c.persona}`));
  }
  const quietReg = cs.find(c => c.persona === 'quiet' && JR.order(c, cfg, 'justright') === 'regular');
  if (quietReg) ok(/Regular/.test(JR.lineFor(quietReg, cfg, 'justright')), 'quiet customer ordering Regular points at Regular');
}

console.log('2. Every setting at its minimum and maximum');
{
  const keys = Object.keys(BASE.params).filter(k => typeof BASE.params[k].min === 'number');
  for (const k of keys) for (const end of ['min', 'max']) {
    const cfg = fresh(); cfg.params[k].value = cfg.params[k][end];
    const cs = JR.makeCustomers(cfg, 7, 120);
    for (const s of ['today', 'justright', 'shortcut']) invariants(JR.runDay(cfg, cs, s), `${k}=${end} ${s}`);
    const days = JR.runRatingDays(cfg, 7, 3);
    for (const s in days) days[s].forEach(d => ok(d.customers >= Math.round(cfg.params.platesPerDay.value * 0.5) && d.customers <= Math.round(cfg.params.platesPerDay.value * 1.2), `${k}=${end} ${s}: customer count within limits`));
  }
}

console.log('3. Random play: 300 rushes, random buttons and walk-aways');
{
  const cfg = fresh(); const r = JR.rng(99);
  for (let g = 0; g < 300; g++) {
    const s = r() < 0.5 ? 'today' : 'justright';
    const cs = JR.makeCustomers(cfg, 1000 + g, 20);
    const acts = cs.map(() => r() < 0.1 ? null : JR.ACTIONS[s][Math.floor(r() * JR.ACTIONS[s].length)][0]);
    invariants(JR.runDay(cfg, cs, s, acts), `random game ${g} ${s}`);
  }
}

console.log('4. Direction checks (does the model move the right way?)');
{
  const avg = (cfg, s, f) => { let t = 0; for (let i = 1; i <= 30; i++) t += f(JR.runDay(cfg, JR.makeCustomers(cfg, i, 80), s)); return t / 30; };
  const profitJR = d => { const c = fresh(); c.params.discount.value = d; return avg(c, 'justright', x => x.profit); };
  ok(profitJR(0.2) > profitJR(0.5) && profitJR(0.5) > profitJR(1.0), 'bigger discount lowers Just Right profit');
  const gap = rc => { const c = fresh(); c.params.riceCostRegular.value = rc; return avg(c, 'justright', x => x.profit) - avg(c, 'today', x => x.profit); };
  ok(gap(3.0) > gap(1.5) && gap(1.5) > gap(0.5), 'dearer rice makes Just Right relatively more profitable');
  const wasteToday = sp => { const c = fresh(); c.params.lightSpeakUp.value = sp; return avg(c, 'today', x => x.plateWasteG); };
  ok(wasteToday(1.0) < wasteToday(0.0), 'more light eaters speaking up means less waste today');
  const c0 = fresh();
  ok(avg(c0, 'justright', x => x.plateWasteG) < avg(c0, 'today', x => x.plateWasteG), 'Just Right leaves less rice on plates than Today (default settings)');
  ok(avg(c0, 'today', x => x.smallOrders) === 0, 'Today never sells Small');
  const big0 = fresh(); big0.params.shareBig.value = 0;
  ok(avg(big0, 'today', x => x.meals.filter(m => m && m.action === 'more').length) === 0, 'no big eaters means no Add rice');
  const days = JR.runRatingDays(fresh(), 2026, 3);
  ok(days.shortcut[0].profit > days.today[0].profit, 'shortcut earns more on day 1');
  ok(days.shortcut[2].customers < days.today[2].customers, 'shortcut has fewer customers by day 3');
}

console.log('5. Player mistakes are penalised the way a customer would react');
{
  const cfg = fresh();
  const base = { name: 'x', icon: 'repeat', rusher: false, budget: false, tasteRoll: 0.99, sizeRoll: 0 };
  const light = { ...base, persona: 'light', appetite: 0.75 };
  const usual = { ...base, persona: 'usual', appetite: 1.0 };
  const m1 = JR.meal(light, 'regular', cfg, 'today');
  ok(m1.ignored && JR.bubble(m1) === 'I said less rice leh.', 'ignoring "less rice" is noticed');
  const m2 = JR.meal(usual, 'lessSame', cfg, 'today');
  ok(m2.stingy && m2.stars < 4, 'giving a Usual less rice unasked feels stingy');
  const m3 = JR.meal({ ...base, persona: 'usual', appetite: 0.6 }, 'regular', cfg, 'justright');
  ok(m3.wrongSize && m3.price === cfg.params.regularPrice.value - cfg.params.discount.value, 'wrong size served: customer still pays the Small price');
  const m4 = JR.meal(usual, 'regular', cfg, 'today');
  ok(m4.stars >= 4 && JR.bubble(m4) === 'Just nice!', 'serving a Usual their Regular is fine');
}

console.log(`\n${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
