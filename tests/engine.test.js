// Run with:  node tests/engine.test.js
const assert = require('assert');
const JR = require('../src/engine.js');
const fresh = () => JSON.parse(JSON.stringify(require('../src/config.js')));
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('✓', name); };

test('same seed gives the same customers', () => {
  const cfg = fresh();
  assert.deepStrictEqual(JR.makeCustomers(cfg, 42, 50), JR.makeCustomers(cfg, 42, 50));
});

test('persona weights add up to 100%', () => {
  const s = JR.personaWeights(fresh()).reduce((a, x) => a + x[1], 0);
  assert.ok(Math.abs(s - 1) < 1e-9, s);
});

test('rice adds up: cooked = eaten + plate waste + unsold (every setting)', () => {
  const cfg = fresh(), cs = JR.makeCustomers(cfg, 7, 200);
  for (const s of ['today', 'justright', 'shortcut']) {
    const d = JR.runDay(cfg, cs, s);
    assert.ok(Math.abs(d.cookedG - (d.eatenG + d.plateWasteG + d.unsoldG)) < 1e-6, s);
  }
});

test('Today never sells a Small plate; Just Right does', () => {
  const cfg = fresh(), cs = JR.makeCustomers(cfg, 9, 200);
  assert.strictEqual(JR.runDay(cfg, cs, 'today').smallOrders, 0);
  assert.ok(JR.runDay(cfg, cs, 'justright').smallOrders > 0);
});

test('break-even: a Small plate at the break-even discount earns the same profit as a Regular', () => {
  const cfg = fresh();
  cfg.params.discount.value = JR.breakEvenDiscount(cfg);
  const c = JR.makeCustomers(cfg, 1, 1)[0];
  const one = a => JR.runDay(cfg, [c], 'justright', [a]).profit;
  assert.ok(Math.abs(one('small') - one('regular')) < 1e-9);
});

test('a rusher never eats more than the rush cap', () => {
  const cfg = fresh(), R = cfg.params.regularRiceG.value;
  JR.makeCustomers(cfg, 3, 500).filter(c => c.rusher).forEach(c => {
    assert.ok(JR.meal(c, 'more', cfg, 'today').eaten <= R * cfg.params.rushEatCap.value + 1e-9);
  });
});

test('clean-platers never leave food', () => {
  const cfg = fresh();
  JR.makeCustomers(cfg, 5, 500).filter(c => c.persona === 'clean').forEach(c => {
    assert.strictEqual(JR.meal(c, 'more', cfg, 'today').leftover, 0);
  });
});

test('shortcut: rating falls below Today and customers drop by day 3', () => {
  const r = JR.runRatingDays(fresh(), 2026, 3);
  assert.ok(r.shortcut[0].rating < r.today[0].rating);
  assert.ok(r.shortcut[2].customers < r.today[2].customers);
});

test('walk-aways earn nothing and count as 2 stars', () => {
  const cfg = fresh(), cs = JR.makeCustomers(cfg, 11, 3);
  const d = JR.runDay(cfg, cs, 'today', [null, null, null]);
  assert.strictEqual(d.revenue, 0); assert.strictEqual(d.walkaways, 3); assert.strictEqual(d.rating, 2);
});

test('calibration: about a third of Today meals leave food (25–45%)', () => {
  const cfg = fresh(); let left = 0, n = 0;
  for (let s = 1; s <= 40; s++) { const d = JR.runDay(cfg, JR.makeCustomers(cfg, s, 80), 'today'); left += d.leftFood; n += 80; }
  assert.ok(left / n > 0.25 && left / n < 0.45, left / n);
});

console.log(`\n${pass} tests passed`);
