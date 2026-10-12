// Student-mode audit. Run with:  node tests/audit_student.js
const JR = require('../src/engine.js');
const BASE = require('../src/config.js');
const fresh = () => JSON.parse(JSON.stringify(BASE));
let checks = 0, fails = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL', msg); } };
const cfg = fresh();
const R = cfg.params.regularRiceG.value, P = cfg.params.regularPrice.value;
const APPS = Object.keys(cfg.student.appetite), HABITS = Object.keys(cfg.student.breakfastHabits), BUDGETS = cfg.student.budgets;

console.log('1. Set-up and the week');
{
  const p = JR.studentProfile(cfg, { appetite: 'nonsense', breakfast: 'x', budget: 7 });
  ok(p.appetiteKey === 'average' && p.habit === 'sometimes' && p.budget === cfg.student.defaultBudget, 'bad answers fall back to defaults');
  for (const a of APPS) for (const h of HABITS) {
    const pr = JR.studentProfile(cfg, { appetite: a, breakfast: h, budget: 40 });
    const w1 = JR.studentWeek(cfg, pr), w2 = JR.studentWeek(cfg, pr);
    ok(JSON.stringify(w1) === JSON.stringify(w2), `${a}/${h}: replay week is identical`);
    ok(w1.length === 5 && w1.every(d => d.needG > 0), `${a}/${h}: five days, positive hunger`);
    ok(w1.filter(d => d.rush).length === 1 && w1.filter(d => d.lecture).length === 2, `${a}/${h}: one rush day, two lecture days`);
  }

  // the game's set-up now asks survey question 5; each answer must map to an appetite
  for (const q5 of Object.keys(cfg.student.appetiteFromQ5)) {
    const pr = JR.studentProfile(cfg, { q5, breakfast: 'sometimes', budget: 40 });
    ok(pr.q5 === q5 && pr.appetite === cfg.student.appetiteFromQ5[q5], `Q5 ${q5}: appetite ${pr.appetite}`);
  }
  const order = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'].map(k => cfg.student.appetiteFromQ5[k]);
  ok(order.every((x, i) => i === 0 || x < order[i - 1]), 'Q5: the more often the portion is too big, the smaller the appetite');
  const SV = require('../src/survey.js');
  ok(Object.keys(cfg.student.appetiteFromQ5).join() === SV.questions.q5.options.map(o => o[0]).join(), 'Q5 answers in the game match the survey options');
  for (const [k, q] of Object.entries(SV.questions)) {
    const tot = q.options.reduce((a, o) => a + o[1], 0);
    ok(q.kind === 'multi' ? tot >= SV.n : tot === SV.n, `survey ${k}: counts add up (${tot} of ${SV.n})`);
  }
}

console.log('2. Stalls');
{
  const s1 = JR.studentStalls(cfg, 1), s2 = JR.studentStalls(cfg, 2);
  ok(s1.every(s => s.options.every(o => o.size !== 'small')), 'week 1: no stall sells a Small plate');
  ok(s2.every(s => s.options.some(o => o.size === 'small') && s.options.some(o => o.size === 'regular')), 'week 2: every stall sells Regular and Small (Just Right canteen-wide)');
  ok(s1.filter(s => s.share === 'regular').every(s => s.options.some(o => o.size === 'more' && o.price === P)), 'normal-price stalls let you add rice at the same price, as in vendor mode');
  for (const st of s2) {
    const reg = st.options.find(o => o.size === 'regular'), sm = st.options.find(o => o.size === 'small');
    ok(sm.g === Math.round(reg.g * cfg.params.smallShare.value), `${st.id}: Small is the Small share of its own plate (${sm.g} g of ${reg.g} g)`);
    const rule = JR.smallDiscountFor(cfg, cfg.params.riceCostRegular.value * reg.g / R);
    ok(sm.price <= reg.price && sm.price >= 1 && Math.abs(sm.price - Math.max(1, reg.price - rule)) < 1e-9 && rule <= JR.riceSaved(cfg, cfg.params.riceCostRegular.value * reg.g / R) + 1e-9, `${st.id}: Small costs its own discount less (S$${rule.toFixed(2)} off, within the rice saved)`);
    const w1 = s1.find(x => x.id === st.id).options.find(o => o.size === 'regular');
    ok(w1.g === reg.g && w1.price === reg.price, `${st.id}: Regular plate unchanged between weeks`);
  }
  const stdSmall = s2.find(s => s.id === 'standard').options.find(o => o.size === 'small');
  ok(stdSmall.g === Math.round(R * cfg.params.smallShare.value) && Math.abs(stdSmall.price - (P - cfg.params.discount.value)) < 1e-9, `The Standard's Small matches the vendor Small plate (${stdSmall.g} g, S$${stdSmall.price.toFixed(2)})`);
  // the end-of-week report counts money in cents like the screen, so a S$4.00 snack is bought when exactly S$4.00 is left
  {
    const pr = JR.studentProfile(cfg, { q5: 'Sometimes', breakfast: 'sometimes', budget: 30 });
    const ch = [['generous', 'regular', 280], ['standard', 'regular', 200], ['smallcheap', 'regular', 140], ['standard', 'regular', 200], ['smallpricey', 'small', 105]].map(([stallId, size, eatenG]) => ({ stallId, size, eatenG }));
    const r = JR.runStudentWeek(cfg, pr, 2, ch);
    ok(r.days.every(d => Math.abs(d.moneyAfter * 100 - Math.round(d.moneyAfter * 100)) < 1e-6), 'money is always whole cents');
    const last = r.days[4]; const before = last.moneyAfter + last.pm.snack;
    ok(!(Math.abs(before - cfg.student.snackPrice) < 1e-9 && last.meal.fullness === 'hungry') || last.pm.snack === cfg.student.snackPrice, 'exactly S$4.00 left and hungry: the snack is bought');
  }
  const std = s1.find(s => s.id === 'standard').options[0];
  ok(std.g === R && std.price === P, 'The Standard Regular matches the vendor Regular plate');
}

console.log('3. One lunch and its afternoon');
{
  const pr = JR.studentProfile(cfg, { appetite: 'average', breakfast: 'sometimes', budget: 40 });
  const week = JR.studentWeek(cfg, pr);
  for (const day of week) for (const stall of JR.studentStalls(cfg, 2)) for (const o of stall.options) for (let e = -20; e <= o.g + 60; e += 20) {
    const m = JR.studentMeal(cfg, day, stall, o, e);
    const cap = Math.min(o.g, JR.maxEatG(cfg, day, stall));
    ok(m.eaten >= 0 && m.eaten <= cap + 1e-9, `${day.day} ${stall.id}: eaten within plate and time`);
    ok(Math.abs(m.left - (m.served - m.eaten)) < 1e-9 && m.left >= 0, `${day.day} ${stall.id}: leftover = served minus eaten`);
    const band = m.ratio < 0.85 ? 'hungry' : m.ratio > 1.15 ? 'stuffed' : 'right';
    ok(band === m.fullness, `${day.day} ${stall.id}: fullness band`);
    for (const money of [0, 3.99, 4, 20]) {
      const pm = JR.afternoon(cfg, day, m, money);
      ok(pm.snack === 0 || money >= pm.snack, 'snack only when affordable');
      ok(pm.focus > 0 && pm.focus <= 100, 'focus between 0 and 100');
    }
  }
  const thu = week.find(d => d.rush);
  ok(JR.maxEatG(cfg, thu, JR.studentStalls(cfg, 1).find(s => s.id === 'bigbowl')) < JR.maxEatG(cfg, thu, JR.studentStalls(cfg, 1).find(s => s.id === 'smallpricey')), 'longer queue leaves less eating time on the rush day');
  ok(JR.maxEatG(cfg, week[0], JR.studentStalls(cfg, 1)[0]) === Infinity, 'no time limit on normal days');
  const lec = week.find(d => d.lecture), nolec = week.find(d => !d.lecture);
  const stuffed = { fullness: 'stuffed' };
  ok(JR.afternoon(cfg, lec, stuffed, 10).focus < JR.afternoon(cfg, nolec, stuffed, 10).focus, 'food coma hurts more on a lecture day');
}

// ---------- simulated players
const strategies = {
  'Standard, finish the plate':       (day, stalls) => pick(stalls, 'standard', 'regular', o => o.g),
  'Standard, stop when full':         (day, stalls) => pick(stalls, 'standard', 'regular', o => Math.min(o.g, day.needG)),
  'Standard, best size, stop when full': (day, stalls) => { const s = stalls.find(x => x.id === 'standard'); const b = JR.bestFit(cfg, day, s); return { stallId: s.id, size: b.option.size, eatenG: snap(b.eaten) }; },
  'Uncle Generous, finish the plate': (day, stalls) => pick(stalls, 'generous', 'regular', o => o.g),
  'Small and Cheap, finish the plate':(day, stalls) => pick(stalls, 'smallcheap', 'regular', o => o.g),
  'Just Right, best size, stop when full': (day, stalls) => { const s = stalls.find(x => x.id === 'standard'); const b = JR.bestFit(cfg, day, s); return { stallId: s.id, size: b.option.size, eatenG: snap(b.eaten) }; },
};
const snap = g => Math.round(g / cfg.student.biteG) * cfg.student.biteG;   // the player eats in bites
function pick(stalls, id, size, eat) { const s = stalls.find(x => x.id === id); const o = s.options.find(x => x.size === size) || s.options[0]; return { stallId: id, size: o.size, eatenG: snap(eat(o)) }; }
function play(profile, weekNo, strat) {
  const week = JR.studentWeek(cfg, profile), stalls = JR.studentStalls(cfg, weekNo);
  let money = profile.budget; const choices = [];
  for (const day of week) {
    let ch = strat(day, stalls);
    let st = stalls.find(s => s.id === ch.stallId), o = st.options.find(x => x.size === ch.size);
    if (o.price > money + 1e-9) {   // cannot afford: cheapest plate they can afford, or skip lunch, as a player would have to
      const cheap = stalls.flatMap(s => s.options.map(x => ({ s, x }))).filter(c => c.x.price <= money + 1e-9).sort((a, b) => a.x.price - b.x.price)[0];
      if (cheap) { ch = { stallId: cheap.s.id, size: cheap.x.size, eatenG: snap(Math.min(cheap.x.g, day.needG)) }; o = cheap.x; st = cheap.s; }
      else { ch = { stallId: 'skip', size: 'none', eatenG: 0 }; o = JR.SKIP.options[0]; st = JR.SKIP; }
    }
    money -= o.price;
    const m = JR.studentMeal(cfg, day, st, o, ch.eatenG);
    money -= JR.afternoon(cfg, day, m, money).snack;
    choices.push(ch);
  }
  return JR.runStudentWeek(cfg, profile, weekNo, choices);
}

console.log('4. Simulated players: every appetite (old set-up and survey Q5 answers), breakfast habit and budget');
{
  const rows = [];
  const ANS = [...APPS.map(a => ({ a, ans: { appetite: a } })), ...Object.keys(cfg.student.appetiteFromQ5).map(q => ({ a: 'Q5 ' + q, ans: { q5: q } }))];
  for (const { a, ans } of ANS) for (const h of HABITS) for (const b of BUDGETS) {
    const pr = JR.studentProfile(cfg, { ...ans, breakfast: h, budget: b });
    const res = {};
    for (const [name, f] of Object.entries(strategies)) {
      const r = play(pr, name.startsWith('Just Right') ? 2 : 1, f);
      res[name] = r;
      ok(r.moneyLeft >= -1e-9, `${a}/${h}/S$${b} ${name}: never below zero`);
      ok(Math.abs(r.spent - (r.budget - r.moneyLeft)) < 1e-9, `${a}/${h}/S$${b} ${name}: spending adds up`);
      ok(r.right + r.hungry + r.stuffed === 5, `${a}/${h}/S$${b} ${name}: every day has one outcome`);
    }
    const base = res['Standard, best size, stop when full'], jr = res['Just Right, best size, stop when full'];
    ok(jr.leftG <= base.leftG + 1e-9, `${a}/${h}/S$${b}: Just Right with the right size never wastes more than the Standard`);
    ok(jr.right >= base.right, `${a}/${h}/S$${b}: Just Right is never less often just right`);
    ok(jr.spent <= base.spent + 1e-9, `${a}/${h}/S$${b}: Just Right never costs more`);
    if (a === 'big' || pr.appetite >= 1.2) ok(jr.leftG === base.leftG && jr.right === base.right, `${a}/${h}/S$${b}: big eaters gain nothing from Small (they buy Regular or Add rice)`);
    // canteen-wide: at every stall, picking the best size in week 2 never wastes more or costs more than week 1
    for (const st of JR.studentStalls(cfg, 1).map(x => x.id)) {
      // money set aside here (a broke player falls back to the cheapest plate anywhere, which is a different test)
      const best = (wk) => play({ ...pr, budget: 999 }, wk, (day, stalls) => { const s = stalls.find(x => x.id === st); const bf = JR.bestFit(cfg, day, s); return { stallId: st, size: bf.option.size, eatenG: snap(bf.eaten) }; });
      const r1 = best(1), r2 = best(2);
      ok(r2.leftG <= r1.leftG + 1e-9 && r2.spent <= r1.spent + 1e-9, `${a}/${h}/S$${b} ${st}: two sizes never waste or cost more`);
    }
    const skipW = JR.runStudentWeek(cfg, pr, 1, [0, 1, 2, 3, 4].map(() => ({ stallId: 'skip', size: 'none', eatenG: 0 })));
    ok(skipW.spent <= b && skipW.hungry === 5 && skipW.leftG === 0, `${a}/${h}/S$${b}: skipping every lunch is handled`);
    if (b === 40) rows.push([a, h, ...Object.values(res).map(r => `${r.leftMeals}/5 left, ${Math.round(r.leftG)} g, ${r.right} right, ${r.stuffed} stuffed, ${r.hungry} hungry, S$${r.spent.toFixed(2)}`)]);
  }
  console.log('\n   Budget S$40. Columns: ' + Object.keys(strategies).join(' | '));
  rows.forEach(r => console.log('   ' + r[0].padEnd(13) + r[1].padEnd(10) + r.slice(2).join(' | ')));
}

console.log(`\n${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
