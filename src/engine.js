/* Just Right: game engine. No screen code here, so it can be tested on its own.
   One engine, two settings:
     'today'    : one size; "less rice" requests get a smaller scoop at the same price
     'justright': Small, Regular and Add rice on the stall's kiosk, in grams with nutrition; Small cheaper
   plus 'shortcut': the vendor quietly shrinks every plate (used to show how ratings drop). */
(function (root) {
  // ---------- seeded random numbers, so the same day can be replayed exactly
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const v = (cfg, k) => cfg.params[k].value;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const round2 = x => Math.round(x * 100) / 100;
  // a "less rice" scoop is the same size as the Small plate (config says so; this keeps them tied when the Small slider moves)
  const lessShare = cfg => v(cfg, 'smallShare');
  // each stall's Small discount: the biggest survey price step (Q10) that the rice saved on one Small still covers,
  // so a Small never earns the stall less than a Regular. 0 means "same price, less rice".
  function riceSaved(cfg, riceCostPlate) { return riceCostPlate * (1 - v(cfg, 'smallShare')) * (1 + cookBufferFor(cfg, 'justright')); }   // a Small is only sold under Just Right
  function smallDiscountFor(cfg, riceCostPlate) {
    const saved = riceSaved(cfg, riceCostPlate), steps = cfg.smallDiscountSteps || [0, 0.2, 0.3, 0.5];
    return steps.filter(d => d <= saved + 1e-9).reduce((a, d) => Math.max(a, d), 0);
  }

  // ---------- persona mix (survey shares, big eaters added on top)
  function personaWeights(cfg) {
    const big = v(cfg, 'shareBig'), scale = 1 - big;
    const light = v(cfg, 'shareLight') * scale, never = v(cfg, 'shareNeverLeave') * scale, picky = v(cfg, 'sharePicky') * scale;
    const sp = v(cfg, 'lightSpeakUp'), cp = v(cfg, 'neverLeaveCleanPlater');
    const bigKeys = Object.keys(cfg.personas).filter(k => cfg.personas[k].bigGroup);
    return [['light', light * sp], ['quiet', light * (1 - sp)], ['clean', never * cp], ['usual', never * (1 - cp)], ['picky', picky],
      ...bigKeys.map(k => [k, big / bigKeys.length])];
  }

  // ---------- customers: everything random is drawn here, once, so both settings see identical people
  function makeCustomers(cfg, seed, n) {
    const r = rng(seed), w = personaWeights(cfg), total = w.reduce((a, x) => a + x[1], 0);
    const out = [];
    for (let i = 0; i < n; i++) {
      let u = r() * total, key = w[w.length - 1][0];
      for (const [k, wt] of w) { if (u < wt) { key = k; break; } u -= wt; }
      const p = cfg.personas[key];
      const appetite = p.appetite[0] + r() * (p.appetite[1] - p.appetite[0]);
      out.push({
        id: i + 1, persona: key, name: p.name, icon: p.icon, appetite,
        rusher: key !== 'clean' && (r() < v(cfg, 'rusherShare') || !!p.alwaysRusher),
        budget: r() < v(cfg, 'budgetShare'),
        tasteRoll: r(), sizeRoll: r(),
      });
      // look and feel only (drawn last so they never change who eats what): name, which line they say, patience
      const o = out[out.length - 1], names = cfg.names || [], sp = cfg.patienceSpread || [1, 1];
      o.first = names.length ? names[Math.floor(r() * names.length)] : '';
      o.lineRoll = r();
      const pr = r(), lo = sp[0], hi = o.rusher ? (sp[0] + sp[1]) / 2 : sp[1];
      o.patience = lo + pr * (hi - lo);
      // the discount this student needs before they take a Small (survey Q10). Drawn last, so it changes nothing else.
      const q = cfg.smallDiscountNeeded;
      if (q) { const tot = q.answers.reduce((a, x) => a + x[1], 0); let u = r() * tot; o.smallNeed = q.answers[q.answers.length - 1][0];
        for (const [d, n] of q.answers) { if (u < n) { o.smallNeed = d; break; } u -= n; }
        if (o.smallNeed === null) o.smallNeed = Infinity; }
      o.labelRoll = r();                                      // does the kiosk's nutrition panel tip them to the Small? (Just Right only)
    }
    return out;
  }

  // ---------- the kiosk: nutrition for a plate, and the calorie-label nudge
  function kioskFactsAt(cfg, stallId, regularG, servedG) {
    const k = cfg.kiosk; if (!k || !k.dishes[stallId]) return null;
    const d = k.dishes[stallId], s = k.perG[d.staple];
    const at = g => ({ kcal: s.kcal * g, protein: s.protein * g, fat: s.fat * g, carbs: s.carbs * g });
    const base = at(regularG), now = at(servedG), out = { name: d.name, staple: d.staple, grams: servedG };
    ['kcal', 'protein', 'fat', 'carbs'].forEach(n => { out[n] = Math.max(0, d[n] - base[n]) + now[n]; });   // the rest of the plate stays; the staple scales
    return out;
  }
  // c.labelRoll is drawn per customer; appetite is a share of the plate they are choosing from; cut = Small share / 0.85
  function labelNudge(cfg, c, appetite, cut) {
    const k = cfg.kiosk; if (!k || c.labelRoll == null || c.smallNeed === Infinity) return false;
    return appetite <= cut && c.labelRoll < k.labelSwitch;            // only people a Small would still fill
  }
  // under Just Right, kiosk order data trims the extra rice cooked (Champions 12.3: measured kitchens cut waste 26%)
  function cookBufferFor(cfg, setting) { return v(cfg, 'cookBuffer') * (setting === 'justright' && cfg.kiosk ? 1 - cfg.kiosk.forecastCut : 1); }

  // ---------- what the customer asks for
  const asksMore = (c, cfg) => cfg.personas[c.persona].asks === 'more';
  const isBigGroup = (c, cfg) => !!cfg.personas[c.persona].bigGroup;
  function order(c, cfg, setting) {
    if (isBigGroup(c, cfg)) return asksMore(c, cfg) ? 'more' : 'regular';   // big appetites never pick Small or less rice
    if (setting === 'justright') {
      const cut = v(cfg, 'smallShare') / 0.85;              // Small still leaves them "just right" (not hungry)
      const fitsSmall = c.appetite <= cut || (c.budget && c.appetite <= 0.95);   // budget-minded stretch to Small a little further
      const nearLine = Math.abs(c.appetite - cut) < 0.15;     // only people near the line pick the wrong size
      const right = !nearLine || c.sizeRoll < v(cfg, 'chooseRightSize');
      const wantsSmall = fitsSmall === right;
      // only if the discount is big enough for them (survey Q10); a customer object without the draw keeps the old behaviour
      if (wantsSmall && !(v(cfg, 'discount') + 1e-9 < (c.smallNeed == null ? 0 : c.smallNeed))) return 'small';
      // the kiosk shows calories for each size: a few people near the line switch to the Small (calorie-label effect, Clarke et al. 2025)
      if (labelNudge(cfg, c, c.appetite, cut)) return 'small';
      // the Small is not worth it to them: a light eater still asks for less rice, as they would today
      if (c.persona === 'light' && c.appetite <= lessShare(cfg) / 0.85) return 'less';
      return 'regular';
    }
    if (c.persona === 'light' && c.appetite <= lessShare(cfg) / 0.85) return 'less';   // only asks when less still leaves them full
    return 'regular';                                       // today and shortcut: no size choice
  }
  // pick one of several lines with the customer's own roll, so the same customer always says the same thing
  const pick = (x, roll) => Array.isArray(x) ? x[Math.min(x.length - 1, Math.floor((roll || 0) * x.length))] : x;
  function lineFor(c, cfg, setting) {
    const p = cfg.personas[c.persona], ol = cfg.orderLines || {}, roll = c.lineRoll;
    let line = pick(setting === 'justright' ? p.jrLine : p.line, roll);
    const o = order(c, cfg, setting);
    if (setting === 'justright' && o === 'less') line = pick(p.line, roll);
    if (setting === 'justright' && o === 'small' && c.persona !== 'quiet') line = pick(ol.small || 'One Small, please.', roll);
    if (setting === 'justright' && o === 'regular' && c.persona === 'light') line = pick(ol.regular || 'Regular, please.', roll);
    if (setting === 'justright' && o === 'regular' && c.persona === 'quiet') line = pick(ol.quietRegular || '(taps Regular on the kiosk)', roll);
    if (setting !== 'justright' && c.persona === 'light' && o === 'regular') line = pick(ol.normalToday || 'Normal portion, thanks.', roll);
    if (c.rusher && !p.alwaysRusher) line += ' ' + pick(cfg.traitLines.rusher, roll);
    if (c.budget && setting !== 'justright') line += ' ' + pick(cfg.traitLines.budget, roll);
    return line;
  }

  // ---------- actions a vendor can take, by setting
  const ACTIONS = {
    today: [['regular', 'Regular'], ['lessSame', 'Less rice, same price'], ['lessVeg', 'Less rice, add veg'], ['more', 'Add rice']],
    justright: [['regular', 'Regular'], ['small', 'Small'], ['lessVeg', 'Less rice, add veg'], ['more', 'Add rice']],
    shortcut: [['shrink', 'Regular (shrunk)']],
  };
  // the buttons a vendor has; under Just Right the "less rice" button is whatever this vendor does today
  function actionsFor(cfg, setting) {
    if (setting !== 'justright') return ACTIONS[setting];
    const lr = v(cfg, 'todayLessResponse'), lab = ACTIONS.today.find(a => a[0] === lr)[1];
    return ACTIONS.justright.map(a => a[0] === 'lessVeg' ? [lr, lab] : a);
  }
  function standardAction(c, cfg, setting) {
    if (setting === 'shortcut') return asksMore(c, cfg) ? 'more' : 'shrink';
    const o = order(c, cfg, setting);
    if (o === 'less') return v(cfg, 'todayLessResponse');
    return o;                                               // regular / small / more
  }

  // ---------- one meal
  function meal(c, action, cfg, setting) {
    const R = v(cfg, 'regularRiceG'), P = v(cfg, 'regularPrice');
    const shares = { regular: 1, small: v(cfg, 'smallShare'), lessSame: lessShare(cfg), lessVeg: lessShare(cfg), more: v(cfg, 'addRiceShare'), shrink: v(cfg, 'smallShare') };
    const served = R * shares[action];
    const asked = order(c, cfg, setting);
    // Customers pay for what they ordered: on the Just Right board that is the price of the size they asked for.
    const smallPrice = (asked === 'small' || (asked === 'less' && action === 'small'));
    const price = setting === 'justright' && smallPrice ? P - v(cfg, 'discount') : P;
    const extraCost = action === 'lessVeg' ? v(cfg, 'extraVegCost') : 0;
    const want = R * c.appetite;
    const letdown = c.tasteRoll < (c.persona === 'picky' ? v(cfg, 'tasteLetdownPicky') : v(cfg, 'tasteLetdownOther'));
    const clean = !!cfg.personas[c.persona].cleanPlater;
    let eaten;
    if (clean) eaten = served;
    else {
      eaten = Math.min(served, want * (letdown ? 0.6 : 1));
      if (c.rusher) eaten = Math.min(eaten, R * v(cfg, 'rushEatCap'));
    }
    const leftover = served - eaten;
    const ratio = eaten / want;
    let fullness = ratio < 0.85 ? 'hungry' : ratio > 1.15 ? 'stuffed' : 'right';
    if (letdown && !clean && leftover > 1) fullness = 'letdown';
    if (c.rusher && !clean && leftover > 1 && fullness === 'hungry' && !letdown) fullness = 'rushed';
    // satisfaction
    let stars = 4;
    const notes = [];
    if (fullness === 'right') { stars += 0.5; }
    if (fullness === 'hungry') { stars -= 1.5; notes.push('hungry'); }
    if (fullness === 'stuffed') { stars -= 0.7; notes.push('stuffed'); }
    if (fullness === 'letdown') { stars -= 1; }
    if (fullness === 'rushed') { stars -= 0.3; }
    const gotLessThanAsked = (asked === 'regular' || asked === 'more') && served < R * 0.95;
    const stingy = gotLessThanAsked;
    if (stingy) { stars -= 1.5; notes.push('stingy'); }
    if (action === 'small' && (asked === 'small' || asked === 'less')) stars += 0.3;   // paid less for less
    if (action === 'lessSame' && asked === 'less') stars -= 0.3;            // less food, same price
    if (action === 'lessVeg' && asked === 'less') stars += 0.2;             // feels generous
    const wrongSize = !stingy && setting === 'justright' && ((asked === 'small' && action !== 'small') || (asked !== 'small' && asked !== 'less' && action === 'small'));   // never on top of "stingy"
    if (wrongSize) { stars -= 0.5; notes.push('wrong'); }
    const ignored = asked === 'less' && (action === 'regular' || action === 'more');   // asked for less rice, did not get it
    if (ignored) { stars -= 0.5; notes.push('ignored'); }
    stars = clamp(stars, 1, 5);
    const quietMore = !!cfg.personas[c.persona].quietMore;
    return { served, eaten, leftover, price, extraCost, fullness, stars, stingy, wrongSize, ignored, asked, action, letdown, quietMore };
  }

  function bubble(m) {
    if (m.stingy) return 'Bit stingy leh…';
    if (m.wrongSize) return 'Eh, not what I ordered.';
    if (m.ignored) return 'I said less rice leh.';
    if (m.fullness === 'letdown') return 'Hmm… not what I expected.';
    if (m.fullness === 'rushed') return 'No time to finish, gotta run!';
    if (m.fullness === 'hungry') return m.quietMore ? '(still hungry, but says nothing)' : 'Still hungry…';
    if (m.quietMore && m.action === 'more') return '(nods, clears the plate)';
    if (m.fullness === 'stuffed') return 'So full… food coma incoming.';
    if (m.leftover > 15) return 'Too much rice lah.';
    return 'Just nice!';
  }

  // ---------- a day of plates. actions: optional array of player actions (null = walked away)
  function runDay(cfg, customers, setting, actions) {
    const R = v(cfg, 'regularRiceG'), riceCostPerG = v(cfg, 'riceCostRegular') / R;
    const t = { setting, customers: customers.length, plates: 0, walkaways: 0, leftFood: 0, smallOrders: 0, hungry: 0, stuffed: 0,
      servedG: 0, eatenG: 0, plateWasteG: 0, cookedG: 0, unsoldG: 0, kcalServed: 0, kcalWasted: 0, revenue: 0, riceCost: 0, otherCost: 0, profit: 0, starsSum: 0, rating: 0, meals: [] };
    customers.forEach((c, i) => {
      const a = actions ? actions[i] : standardAction(c, cfg, setting);
      if (a === null) { t.walkaways++; t.starsSum += 2; t.meals.push(null); return; }
      const m = meal(c, a, cfg, setting);
      t.meals.push(m);
      t.plates++; t.servedG += m.served; t.eatenG += m.eaten; t.plateWasteG += m.leftover;
      if (m.leftover > v(cfg, 'leftThresholdG')) t.leftFood++;
      if (a === 'small') t.smallOrders++;
      if (m.fullness === 'hungry') t.hungry++;
      if (m.fullness === 'stuffed') t.stuffed++;
      t.revenue += m.price; t.otherCost += v(cfg, 'toppingCost') + m.extraCost; t.starsSum += m.stars;
      const f = kioskFactsAt(cfg, 'standard', R, m.served);     // calories on the plate (vendor mode is The Standard's dish)
      if (f) { m.kcal = f.kcal; m.kcalWasted = m.leftover * cfg.kiosk.perG[f.staple].kcal; t.kcalServed += f.kcal; t.kcalWasted += m.kcalWasted; }
    });
    t.cookedG = t.servedG * (1 + cookBufferFor(cfg, setting));   // vendor cooks to match what is served, plus a buffer (smaller with kiosk data)
    t.unsoldG = t.cookedG - t.servedG;
    t.riceCost = t.cookedG * riceCostPerG;
    t.profit = t.revenue - t.riceCost - t.otherCost;
    t.rating = customers.length ? t.starsSum / customers.length : 0;
    return t;
  }

  // ---------- the shortcut challenge: three days, tomorrow's customers follow today's rating
  function runRatingDays(cfg, seed, days) {
    const N0 = v(cfg, 'platesPerDay'), k = v(cfg, 'ratingSensitivity');
    const out = {};
    let ref = null;
    for (const setting of ['today', 'justright', 'shortcut']) {
      let n = N0; out[setting] = [];
      for (let d = 0; d < days; d++) {
        const day = runDay(cfg, makeCustomers(cfg, seed + 1000 * (d + 1), n), setting);
        if (setting === 'today' && d === 0) ref = day.rating;
        out[setting].push({ day: d + 1, customers: n, rating: day.rating, profit: day.profit, wasteG: day.plateWasteG + day.unsoldG });
        n = Math.round(N0 * clamp(1 + k * (day.rating - ref), 0.5, 1.2));
      }
    }
    return out;
  }

  function breakEvenDiscount(cfg) {
    return riceSaved(cfg, v(cfg, 'riceCostRegular'));
  }

  // =====================================================================
  // STUDENT MODE: a week of lunches. Pure functions; the screen only calls these.
  // =====================================================================
  function studentProfile(cfg, answers) {
    const st = cfg.student;
    const fromQ5 = st.appetiteFromQ5 && answers.q5 in st.appetiteFromQ5;
    return {
      q5: fromQ5 ? answers.q5 : null,
      appetiteKey: fromQ5 ? 'q5:' + answers.q5 : (answers.appetite in st.appetite ? answers.appetite : 'average'),
      appetite: fromQ5 ? st.appetiteFromQ5[answers.q5] : (st.appetite[answers.appetite] || st.appetite.average),
      habit: answers.breakfast in st.breakfastHabits ? answers.breakfast : 'sometimes',
      budget: st.budgets.includes(answers.budget) ? answers.budget : st.defaultBudget,
    };
  }
  // the same five days for week 1 and the replay, so the comparison is fair
  function studentWeek(cfg, profile) {
    const st = cfg.student, R = v(cfg, 'regularRiceG');
    return st.days.map(day => {
      const breakfast = st.breakfastHabits[profile.habit][day];
      return { day, breakfast, lecture: st.lectureDays.includes(day), rush: st.rushDays.includes(day),
        needG: R * profile.appetite * st.breakfastEffect[breakfast] };
    });
  }
  // what each stall sells this week. weekNo 1: Just Right sells Regular only; weekNo 2: Regular and Small.
  function studentStalls(cfg, weekNo) {
    const R = v(cfg, 'regularRiceG'), P = v(cfg, 'regularPrice');
    return cfg.student.stalls.map(x => {
      const g = x.share === 'regular' ? R : Math.round(R * x.share);
      const price = x.price === 'regular' ? P : x.price;
      // week 2: Just Right across the whole canteen. Every stall adds a Small: its own plate cut by the Small share, its own price less the discount.
      const jr = weekNo >= 2;
      const options = [{ size: 'regular', label: jr || x.share === 'regular' ? 'Regular' : 'One size', g, price }];
      const disc = smallDiscountFor(cfg, v(cfg, 'riceCostRegular') * g / R);
      if (jr) options.push({ size: 'small', label: disc > 0 ? 'Small' : 'Small, same price', g: Math.round(g * v(cfg, 'smallShare')), price: round2(Math.max(1, price - disc)), discount: disc });
      // like the vendor game: at a normal-price stall you can ask for more rice at the same price
      if (x.share === 'regular') options.push({ size: 'more', label: 'Add rice', g: Math.round(R * v(cfg, 'addRiceShare')), price });
      // what the kiosk shows: in week 2 (Just Right) every option carries its grams and its nutrition
      options.forEach(o => { o.facts = kioskFactsAt(cfg, x.id, g, o.g); });
      const dish = cfg.kiosk && cfg.kiosk.dishes[x.id];
      return { ...x, options, dish: dish ? dish.name : '', staple: dish ? dish.staple : 'rice', kiosk: jr };
    });
  }
  // skipping lunch is always possible, so a student who runs out of money is never stuck
  const SKIP = { id: 'skip', name: 'Skipped lunch', queueMin: 0, options: [{ size: 'none', label: 'Skip lunch', g: 0, price: 0 }] };
  // most rice a student can eat in the time they have (rush days only)
  function maxEatG(cfg, day, stall) {
    if (!day.rush) return Infinity;
    const st = cfg.student;
    const minutes = Math.max(0, st.rushWindowMin - stall.queueMin);
    return (minutes / st.minutesPerBite) * st.biteG;
  }
  // one lunch: eatenG is what the player chose to eat (capped by plate and time)
  function studentMeal(cfg, day, stall, option, eatenG) {
    const cap = Math.min(option.g, maxEatG(cfg, day, stall));
    const eaten = clamp(eatenG, 0, cap);
    const left = option.g - eaten;
    const ratio = day.needG > 0 ? eaten / day.needG : 1;
    const fullness = ratio < 0.85 ? 'hungry' : ratio > 1.15 ? 'stuffed' : 'right';
    return { served: option.g, eaten, left, ratio, fullness, price: option.price, timeCapped: eatenG > cap && cap < option.g };
  }
  // the afternoon after lunch
  function afternoon(cfg, day, meal, moneyAfterLunch) {
    const st = cfg.student, f = st.focus;
    if (meal.fullness === 'right') return { snack: 0, focus: f.right, text: day.lecture ? 'Just right. Sharp in your 2 pm lecture.' : 'Just right. A good afternoon.' };
    if (meal.fullness === 'hungry') {
      if (moneyAfterLunch >= st.snackPrice) return { snack: st.snackPrice, focus: f.hungrySnack, text: 'Still hungry at 4 pm, so you bought bubble tea.' };
      return { snack: 0, focus: f.hungry, text: 'Still hungry, and no money left for a snack. Hard to focus.' };
    }
    return { snack: 0, focus: day.lecture ? f.stuffedLecture : f.stuffed, text: day.lecture ? 'Food coma in the 2 pm lecture. Half of it is a blur.' : 'Too full. A sluggish afternoon.' };
  }
  // replay a whole week from the player's choices: [{ stallId, size, eatenG }]. Used for the report and the tests.
  function runStudentWeek(cfg, profile, weekNo, choices) {
    const week = studentWeek(cfg, profile), stalls = studentStalls(cfg, weekNo);
    let money = profile.budget;
    const days = week.map((day, i) => {
      const ch = choices[i];
      const stall = ch.stallId === 'skip' ? SKIP : stalls.find(x => x.id === ch.stallId);
      const option = stall.options.find(o => o.size === ch.size) || stall.options[0];
      const meal = studentMeal(cfg, day, stall, option, ch.eatenG);
      money = round2(money - meal.price);                  // cents, exactly as the screen counts them
      const pm = afternoon(cfg, day, meal, money);
      money = round2(money - pm.snack);
      return { day, stall: stall.name, size: option.size, meal, pm, moneyAfter: money };
    });
    const t = days.reduce((a, d) => {
      a.spent += d.meal.price + d.pm.snack; a.snacks += d.pm.snack;
      a.leftG += d.meal.left; a.leftMeals += d.meal.left > v(cfg, 'leftThresholdG') ? 1 : 0;
      a.hungry += d.meal.fullness === 'hungry' ? 1 : 0; a.stuffed += d.meal.fullness === 'stuffed' ? 1 : 0;
      a.right += d.meal.fullness === 'right' ? 1 : 0; a.focus += d.pm.focus / days.length;
      return a;
    }, { spent: 0, snacks: 0, leftG: 0, leftMeals: 0, hungry: 0, stuffed: 0, right: 0, focus: 0 });
    return { days, ...t, moneyLeft: money, budget: profile.budget };
  }
  // the size that fits best at a stall (used by tests and the "model student")
  function bestFit(cfg, day, stall) {
    let best = null;
    for (const o of stall.options) {
      const cap = Math.min(o.g, maxEatG(cfg, day, stall));
      const eaten = Math.min(cap, day.needG);
      const score = Math.abs(eaten / day.needG - 1) + (o.g - eaten) / day.needG;
      if (!best || score < best.score) best = { option: o, eaten, score };
    }
    return best;
  }

  const API = { rng, makeCustomers, personaWeights, order, lineFor, ACTIONS, actionsFor, riceSaved, smallDiscountFor, standardAction, kioskFactsAt, labelNudge, cookBufferFor, meal, bubble, runDay, runRatingDays, breakEvenDiscount, round2,
    studentProfile, studentWeek, studentStalls, maxEatG, studentMeal, afternoon, runStudentWeek, bestFit, SKIP };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.JR = API;
})(typeof window !== 'undefined' ? window : globalThis);
