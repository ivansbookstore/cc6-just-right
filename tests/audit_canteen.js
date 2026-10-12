// God Mode audit. Run with:  node tests/audit_canteen.js
const C = require('../src/canteen.js');
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
    if (d.setting === 'justright') ok(s.size !== 'less', `${L}: no "less rice" with Just Right`);
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
  const cfg = fresh(); cfg.params.discount.value = 1.5;
  const st = C.canteenStalls(cfg, { smallcheap: { price: 2 } });
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
  const cheap = fresh(); cheap.params.discount.value = 0.30;
  const prT = avg(cheap, 'today', t => t.profit), prJ = avg(cheap, 'justright', t => t.profit);
  ok(prJ > prT, `with a discount below the rice saved, Just Right raises profit (S$${prT.toFixed(2)} vs S$${prJ.toFixed(2)})`);
  const dear = fresh(); dear.params.discount.value = 1.0;
  ok(avg(dear, 'justright', t => t.profit) < avg(dear, 'today', t => t.profit), 'with a S$1.00 discount, Just Right lowers profit');
  const more = fresh(), few = fresh(); more.canteen.students = 400; few.canteen.students = 100;
  ok(avg(more, 'today', t => t.avgWait) > avg(few, 'today', t => t.avgWait), 'a bigger crowd means longer queues');
  const slow = fresh(); slow.canteen.jrExtraSec = 20;
  ok(avg(slow, 'justright', t => t.avgWait) > avg(fresh(), 'justright', t => t.avgWait), 'if two sizes slowed serving, queues would grow');
  console.log(`   30 lunches of 200: bin ${(wT / 1000).toFixed(2)} kg Today vs ${(wJ / 1000).toFixed(2)} kg Just Right; profit at a S$0.30 discount S$${prT.toFixed(2)} vs S$${prJ.toFixed(2)}`);
}

console.log(`\n${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
