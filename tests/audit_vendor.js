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
    const allowed = JR.actionsFor(cfg, s).map(a => a[0]).concat(s === 'shortcut' ? ['more'] : []);
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
    const AS = JR.actionsFor(cfg, s); const acts = cs.map(() => r() < 0.1 ? null : AS[Math.floor(r() * AS.length)][0]);
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
  // one mistake, one penalty: a Small for someone who asked for Regular is "stingy", not also "wrong size"
  const m5 = JR.meal(usual, 'small', cfg, 'justright'), m6 = JR.meal(usual, 'lessSame', cfg, 'today');
  ok(m5.stingy && !m5.wrongSize && Math.abs(m5.stars - m6.stars) < 1e-9, `Regular asked, Small served: one penalty, same stars as a short scoop today (${m5.stars} vs ${m6.stars})`);
  // a light eater who skips the Small asks for less rice, says so, and is happy to get the Small at the Small price
  const lightNo = { ...light, smallNeed: Infinity };
  ok(JR.order(lightNo, cfg, 'justright') === 'less', 'a light eater who will not take a Small asks for less rice');
  ok(cfg.personas.light.line.includes(JR.lineFor(lightNo, cfg, 'justright')), `and says a less-rice line ("${JR.lineFor(lightNo, cfg, 'justright')}")`);
  const m7 = JR.meal(lightNo, 'small', cfg, 'justright');
  ok(!m7.wrongSize && !m7.stingy && m7.price === cfg.params.regularPrice.value - cfg.params.discount.value, 'asked less rice, got the Small: no penalty, pays the Small price');
  ok(JR.standardAction(lightNo, cfg, 'justright') === cfg.params.todayLessResponse.value, 'Just Right handles less rice the same way as today');
  // the less-rice scoop follows the Small slider
  const c2 = fresh(); c2.params.smallShare.value = 0.6;
  ok(Math.abs(JR.meal(light, 'lessVeg', c2, 'today').served - 0.6 * c2.params.regularRiceG.value) < 1e-9, 'a less-rice scoop is always the Small size');
}

console.log('6. Big appetites (gym, one meal a day, athletes, late lunch, quiet big eaters)');
{
  const cfg = fresh();
  const bigKeys = Object.keys(cfg.personas).filter(k => cfg.personas[k].bigGroup);
  ok(bigKeys.length === 5, 'five big-appetite customer types');
  const w = JR.personaWeights(cfg), tot = w.reduce((a, x) => a + x[1], 0);
  ok(Math.abs(tot - 1) < 1e-9, 'customer mix adds up to 100%');
  ok(Math.abs(w.filter(x => bigKeys.includes(x[0])).reduce((a, x) => a + x[1], 0) - cfg.params.shareBig.value) < 1e-9, 'big appetites make up exactly shareBig');
  const cs = JR.makeCustomers(cfg, 7, 5000), seen = new Set(cs.map(c => c.persona));
  bigKeys.forEach(k => ok(seen.has(k), `${k} appears in a long day`));
  const bigShare = cs.filter(c => bigKeys.includes(c.persona)).length / cs.length;
  ok(Math.abs(bigShare - cfg.params.shareBig.value) < 0.02, `big appetites drawn at about ${cfg.params.shareBig.value} (got ${bigShare.toFixed(3)})`);
  for (const c of cs.filter(c => bigKeys.includes(c.persona))) {
    for (const s of ['today', 'justright']) ok(!['small', 'less'].includes(JR.order(c, cfg, s)), `${c.persona} never orders Small or less rice (${s})`);
    if (c.persona === 'late') ok(c.rusher, 'Late Luncher is always rushed');
    if (c.persona === 'quietbig' && !c.rusher) {
      for (const s of ['today', 'justright']) {
        const reg = JR.meal(c, 'regular', cfg, s), more = JR.meal(c, 'more', cfg, s);
        ok(reg.fullness === 'hungry' || reg.fullness === 'letdown', `quiet big eater served Regular stays hungry (${s})`);
        if (!reg.letdown) ok(more.stars > reg.stars && !more.stingy && !more.wrongSize, `spotting a quiet big eater and adding rice is rewarded (${s})`);
        ok(more.price === reg.price, `adding rice is free (${s})`);
      }
    }
    if (c.persona === 'late' && !JR.meal(c, 'regular', cfg, 'justright').letdown) {
      const reg = JR.meal(c, 'regular', cfg, 'justright'), sm = JR.meal(c, 'small', cfg, 'justright');
      ok(reg.leftover > 0 && sm.stars < reg.stars, 'Late Luncher leaves food from time, and a Small plate does not help');
    }
  }
  const d1 = (sb) => { const c2 = fresh(); c2.params.shareBig.value = sb; let gap = 0, prof = 0; for (let s = 1; s <= 200; s++) { const x = JR.makeCustomers(c2, s, 80); const t = JR.runDay(c2, x, 'today'), j = JR.runDay(c2, x, 'justright'); gap += t.leftFood / t.plates - j.leftFood / j.plates; prof += t.profit; } return { gap: gap / 200, prof: prof / 200 }; };
  const lo = d1(0.1), hi = d1(0.3);
  ok(hi.gap > 0, 'Just Right still cuts meals with food left at 30% big appetites');
  ok(hi.prof < lo.prof, 'more big appetites with free Add rice lowers profit');
  console.log(`   waste gap, Today minus Just Right: ${(lo.gap * 100).toFixed(1)} points at 10% big, ${(hi.gap * 100).toFixed(1)} at 30%`);
}

console.log(`\n${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
