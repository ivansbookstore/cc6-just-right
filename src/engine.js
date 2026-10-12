/* Just Right: game engine. No screen code here, so it can be tested on its own.
   One engine, two settings:
     'today'    : one size; "less rice" requests get a smaller scoop at the same price
     'justright': Regular and Small on the menu board, Small cheaper
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

  // ---------- persona mix (survey shares, big eaters added on top)
  function personaWeights(cfg) {
    const big = v(cfg, 'shareBig'), scale = 1 - big;
    const light = v(cfg, 'shareLight') * scale, never = v(cfg, 'shareNeverLeave') * scale, picky = v(cfg, 'sharePicky') * scale;
    const sp = v(cfg, 'lightSpeakUp'), cp = v(cfg, 'neverLeaveCleanPlater');
    return [['light', light * sp], ['quiet', light * (1 - sp)], ['clean', never * cp], ['usual', never * (1 - cp)], ['picky', picky], ['big', big]];
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
        rusher: key !== 'clean' && r() < v(cfg, 'rusherShare'),
        budget: r() < v(cfg, 'budgetShare'),
        tasteRoll: r(), sizeRoll: r(),
      });
    }
    return out;
  }

  // ---------- what the customer asks for
  function order(c, cfg, setting) {
    if (setting === 'justright') {
      if (c.persona === 'big') return 'more';
      const cut = v(cfg, 'smallShare') / 0.85;              // Small still leaves them "just right" (not hungry)
      const fitsSmall = c.appetite <= cut || (c.budget && c.appetite <= 0.95);   // budget-minded stretch to Small a little further
      const nearLine = Math.abs(c.appetite - cut) < 0.15;     // only people near the line pick the wrong size
      const right = !nearLine || c.sizeRoll < v(cfg, 'chooseRightSize');
      return (fitsSmall === right) ? 'small' : 'regular';
    }
    if (c.persona === 'big') return 'more';
    if (c.persona === 'light' && c.appetite <= v(cfg, 'lessRiceShare') / 0.85) return 'less';   // only asks when less still leaves them full
    return 'regular';                                       // today and shortcut: no size choice
  }
  function lineFor(c, cfg, setting) {
    const p = cfg.personas[c.persona];
    let line = setting === 'justright' ? p.jrLine : p.line;
    if (setting === 'justright' && order(c, cfg, setting) === 'small' && c.persona !== 'quiet') line = 'One Small, please.';
    if (setting === 'justright' && order(c, cfg, setting) === 'regular' && (c.persona === 'light')) line = 'Regular, please.';
    if (setting === 'justright' && order(c, cfg, setting) === 'regular' && c.persona === 'quiet') line = '(points at Regular on the board)';
    if (setting !== 'justright' && c.persona === 'light' && order(c, cfg, setting) === 'regular') line = 'Normal portion, thanks.';
    if (c.rusher) line += ' ' + cfg.traitLines.rusher;
    if (c.budget && setting !== 'justright') line += ' ' + cfg.traitLines.budget;
    return line;
  }

  // ---------- actions a vendor can take, by setting
  const ACTIONS = {
    today: [['regular', 'Regular'], ['lessSame', 'Less rice, same price'], ['lessVeg', 'Less rice, add veg'], ['more', 'Add rice']],
    justright: [['regular', 'Regular'], ['small', 'Small'], ['more', 'Add rice']],
    shortcut: [['shrink', 'Regular (shrunk)']],
  };
  function standardAction(c, cfg, setting) {
    if (setting === 'shortcut') return c.persona === 'big' ? 'more' : 'shrink';
    const o = order(c, cfg, setting);
    if (o === 'less') return v(cfg, 'todayLessResponse');
    return o;                                               // regular / small / more
  }

  // ---------- one meal
  function meal(c, action, cfg, setting) {
    const R = v(cfg, 'regularRiceG'), P = v(cfg, 'regularPrice');
    const shares = { regular: 1, small: v(cfg, 'smallShare'), lessSame: v(cfg, 'lessRiceShare'), lessVeg: v(cfg, 'lessRiceShare'), more: v(cfg, 'addRiceShare'), shrink: v(cfg, 'smallShare') };
    const served = R * shares[action];
    const asked = order(c, cfg, setting);
    // Customers pay for what they ordered: on the Just Right board that is the price of the size they asked for.
    const price = setting === 'justright' ? (asked === 'small' ? P - v(cfg, 'discount') : P) : P;
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
    if (action === 'small' && asked === 'small') stars += 0.3;               // paid less for less
    if (action === 'lessSame' && asked === 'less') stars -= 0.3;            // less food, same price
    if (action === 'lessVeg' && asked === 'less') stars += 0.2;             // feels generous
    const wrongSize = setting === 'justright' && ((asked === 'small' && action !== 'small') || (asked !== 'small' && action === 'small'));
    if (wrongSize) { stars -= 0.5; notes.push('wrong'); }
    const ignored = asked === 'less' && (action === 'regular' || action === 'more');   // asked for less rice, did not get it
    if (ignored) { stars -= 0.5; notes.push('ignored'); }
    stars = clamp(stars, 1, 5);
    return { served, eaten, leftover, price, extraCost, fullness, stars, stingy, wrongSize, ignored, asked, action, letdown };
  }

  function bubble(m) {
    if (m.stingy) return 'Bit stingy leh…';
    if (m.wrongSize) return 'Eh, not what I ordered.';
    if (m.ignored) return 'I said less rice leh.';
    if (m.fullness === 'letdown') return 'Hmm… not what I expected.';
    if (m.fullness === 'rushed') return 'No time to finish, gotta run!';
    if (m.fullness === 'hungry') return 'Still hungry…';
    if (m.fullness === 'stuffed') return 'So full… food coma incoming.';
    if (m.leftover > 15) return 'Too much rice lah.';
    return 'Just nice!';
  }

  // ---------- a day of plates. actions: optional array of player actions (null = walked away)
  function runDay(cfg, customers, setting, actions) {
    const R = v(cfg, 'regularRiceG'), riceCostPerG = v(cfg, 'riceCostRegular') / R;
    const t = { setting, customers: customers.length, plates: 0, walkaways: 0, leftFood: 0, smallOrders: 0, hungry: 0, stuffed: 0,
      servedG: 0, eatenG: 0, plateWasteG: 0, cookedG: 0, unsoldG: 0, revenue: 0, riceCost: 0, otherCost: 0, profit: 0, starsSum: 0, rating: 0, meals: [] };
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
    });
    t.cookedG = t.servedG * (1 + v(cfg, 'cookBuffer'));     // vendor cooks to match what is served, plus a buffer
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
    return v(cfg, 'riceCostRegular') * (1 - v(cfg, 'smallShare')) * (1 + v(cfg, 'cookBuffer'));
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
      const options = [{ size: 'regular', label: x.hasSmall && weekNo >= 2 ? 'Regular' : 'One size', g, price }];
      if (x.hasSmall && weekNo >= 2) options.push({ size: 'small', label: 'Small', g: Math.round(R * v(cfg, 'smallShare')), price: round2(P - v(cfg, 'discount')) });
      // like the vendor game: at a normal-price stall you can ask for more rice at the same price
      if (x.share === 'regular') options.push({ size: 'more', label: 'Add rice', g: Math.round(R * v(cfg, 'addRiceShare')), price });
      return { ...x, options };
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
      money -= meal.price;
      const pm = afternoon(cfg, day, meal, money);
      money -= pm.snack;
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

  const API = { rng, makeCustomers, personaWeights, order, lineFor, ACTIONS, standardAction, meal, bubble, runDay, runRatingDays, breakEvenDiscount, round2,
    studentProfile, studentWeek, studentStalls, maxEatG, studentMeal, afternoon, runStudentWeek, bestFit, SKIP };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.JR = API;
})(typeof window !== 'undefined' ? window : globalThis);
