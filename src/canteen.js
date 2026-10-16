/* Just Right: God Mode engine. One lunch in a whole canteen, worked out in full before anything moves on screen.
   The screen only replays the timeline. Same seed = same students, so Today and Just Right can be compared fairly.
   Customers, appetites, size choices and meals follow the vendor-mode rules; stalls come from student mode. */
(function (root) {
  const JR = root.JR || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const v = (cfg, k) => cfg.params[k].value;
  const round2 = x => Math.round(x * 100) / 100;

  // ---------- the stalls before opening: defaults from config, then the player's edits.
  // Costs follow the (edited) plate size and price unless the player set them directly.
  // discount: each stall's own Small discount. Default = the rice-saving rule; 0 = "same price, less rice".
  function canteenStalls(cfg, edits) {
    const R = v(cfg, 'regularRiceG'), P = v(cfg, 'regularPrice'), cR = v(cfg, 'riceCostRegular'), ct = cfg.canteen;
    return cfg.student.stalls.map(x => {
      const e = (edits && edits[x.id]) || {};
      const g = e.g != null ? e.g : (x.share === 'regular' ? R : Math.round(R * x.share));
      const price = e.price != null ? e.price : (x.price === 'regular' ? P : x.price);
      const riceCost = e.riceCost != null ? e.riceCost : round2(cR * g / R);             // same cost per gram as the vendor survey answer
      return {
        id: x.id, name: x.name, icon: x.icon, g, price, riceCost,
        stars: e.stars != null ? e.stars : x.stars,
        otherCost: e.otherCost != null ? e.otherCost : round2(P > 0 ? v(cfg, 'toppingCost') * price / P : v(cfg, 'toppingCost')),   // same share of price as vendor mode
        serveSec: e.serveSec != null ? e.serveSec : (ct.serveSec[x.id] || 35),
        discount: e.discount != null ? e.discount : JR.smallDiscountFor(cfg, riceCost),
      };
    });
  }
  // the dish's own plate (before the player edits grams): the nutrition source plate is treated as this size
  const dishBaseG = (cfg, id) => { const x = cfg.student.stalls.find(s => s.id === id); return !x ? v(cfg, 'regularRiceG') : x.share === 'regular' ? v(cfg, 'regularRiceG') : Math.round(v(cfg, 'regularRiceG') * x.share); };
  const smallPriceAt = st => round2(Math.max(1, st.price - st.discount));
  const effectiveDiscount = st => round2(st.price - smallPriceAt(st));

  // what this student orders at this stall, and what lands on the plate
  function orderAt(c, cfg, st, setting) {
    const p = cfg.personas[c.persona], need = c.appetite * v(cfg, 'regularRiceG');
    const smallG = Math.round(st.g * v(cfg, 'smallShare')), lessG = smallG;           // a "less rice" scoop is the Small size
    const moreG = Math.round(st.g * v(cfg, 'addRiceShare'));
    const lightAsksLess = c.persona === 'light' && need <= lessG / 0.85;
    let size;
    if (p.bigGroup) size = p.asks === 'more' && need > st.g ? 'more' : 'regular';   // only asks for more if this stall's plate is not already enough
    else if (setting === 'justright') {
      const cut = smallG / 0.85;                                 // a Small that still leaves them "just right"
      const fits = need <= cut || (c.budget && need <= 0.95 * st.g);
      const near = Math.abs(need - cut) < 0.15 * st.g;
      const right = !near || c.sizeRoll < v(cfg, 'chooseRightSize');
      const priceOk = effectiveDiscount(st) + 1e-9 >= (c.smallNeed == null ? 0 : c.smallNeed);   // survey Q10: is this discount enough for them?
      size = fits === right && priceOk ? 'small' : lightAsksLess ? 'less' : 'regular';   // no Small for them: ask for less rice, as today
    } else size = lightAsksLess ? 'less' : 'regular';
    const served = { regular: st.g, small: smallG, less: lessG, more: moreG }[size];
    const facts = JR.kioskFactsAt(cfg, st.id, dishBaseG(cfg, st.id), served);   // what the kiosk shows for this plate
    const price = size === 'small' ? smallPriceAt(st) : st.price;
    const extraCost = size === 'less' && v(cfg, 'todayLessResponse') === 'lessVeg' ? v(cfg, 'extraVegCost') : 0;
    return { size, served, price, extraCost, need, kcal: facts ? facts.kcal : 0, staple: facts ? facts.staple : 'rice' };
  }

  // how a meal ends, once we know how much was eaten and why it stopped. One place, so nothing is counted twice.
  // Stars follow vendor mode: a taste letdown costs 1 star (not also "hungry"); running out of time costs 0.3.
  function outcome(cfg, o, eaten, cause) {
    const leftover = Math.max(0, o.served - eaten), ratio = eaten / o.need;
    const fullness = ratio < 0.85 ? 'hungry' : ratio > 1.15 ? 'stuffed' : 'right';
    // split the leftover: the part beyond what they needed is "too much on the plate"; the rest is the cause that stopped them
    const excess = Math.max(0, o.served - o.need), portionPart = Math.min(leftover, excess);
    const split = { portion: portionPart, taste: 0, time: 0 };
    if (cause) split[cause] = leftover - portionPart; else split.portion = leftover;
    const why = leftover <= 1e-9 ? null : cause && split[cause] >= portionPart ? cause : 'portion';   // the main reason, for the screen
    let stars = 4;
    if (cause === 'taste') stars -= 1;
    else if (cause === 'time' && fullness === 'hungry') stars -= 0.3;
    else if (fullness === 'hungry') stars -= 1.5;
    if (fullness === 'right') stars += 0.5;
    if (fullness === 'stuffed') stars -= 0.7;
    if (o.size === 'small') stars += 0.3;
    if (o.size === 'less') stars += o.extraCost > 0 ? 0.2 : -0.3;
    return { eaten, leftover, fullness, why, split, stars: Math.max(1, Math.min(5, stars)) };
  }
  // what they would eat with all the time in the world (taste and clean-plating, as in vendor mode)
  function wantToEat(c, cfg, o) {
    const p = cfg.personas[c.persona];
    const letdown = !p.cleanPlater && c.tasteRoll < (c.persona === 'picky' ? v(cfg, 'tasteLetdownPicky') : v(cfg, 'tasteLetdownOther'));
    const eaten = p.cleanPlater ? o.served : Math.min(o.served, o.need * (letdown ? 0.6 : 1));
    return { eaten, cause: letdown && eaten < o.served - 1e-9 ? 'taste' : null };
  }

  // arrival times: a triangle from the door opening, busiest at peakMin, last arrival at 75% of lunch
  function arrivals(r, n, ct) {
    const a = 0, b = ct.lunchMin * 0.75, m = Math.min(ct.peakMin, b), F = (m - a) / (b - a), out = [];
    for (let i = 0; i < n; i++) {
      const u = r();
      out.push(u < F ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m)));
    }
    return out.sort((x, y) => x - y);
  }

  function canteenDay(cfg, stalls, setting, seed, opts) {
    const ct = cfg.canteen, n = (opts && opts.students) || ct.students, w = ct.walkMin, ch = ct.choice;
    const labelsOn = !!(opts && opts.labelsOn && cfg.kiosk);   // off by default: no proven effect on portion size or plate waste
    const people = JR.makeCustomers(cfg, seed, n);
    const r = JR.rng((seed ^ 0x9E3779B9) >>> 0);
    const times = arrivals(r, n, ct);
    const noise = people.map(() => stalls.map(() => (r() - 0.5) * 2));        // personal taste, drawn once for both settings
    const seatFree = new Array(ct.seats).fill(0);
    const S = stalls.map(st => ({ id: st.id, busyUntil: 0, plates: 0, revenue: 0, riceCost: 0, otherCost: 0, profit: 0, servedG: 0, cookedG: 0, unsoldG: 0, kcalServed: 0, kcalWasted: 0,
      wasteG: 0, leftFood: 0, small: 0, less: 0, more: 0, starsSum: 0, right: 0, hungry: 0, stuffed: 0, waitSum: 0 }));
    const out = [];
    people.forEach((c, i) => {
      const t0 = times[i], tAt = t0 + w, p = cfg.personas[c.persona];
      // pick a stall
      let best = -1, bestU = -Infinity, bestO = null;
      stalls.forEach((st, k) => {
        const o = orderAt(c, cfg, st, setting);
        const wait = Math.max(0, S[k].busyUntil - tAt);
        // students fear going hungry more than they mind a big plate (that is how plates end up half-finished)
        const under = Math.max(0, o.need - o.served) / o.need, over = Math.max(0, Math.min(o.served, o.need * 1.6) - o.need) / o.need;
        const u = -ch.under * under - ch.over * over - (c.budget ? ch.budgetPrice : ch.price) * (o.price - 5) / 5 - (c.rusher ? ch.rushWait : ch.wait) * wait
          + (c.persona === 'picky' ? ch.pickyStars : ch.stars) * (st.stars - 4) + ch.noise * noise[i][k]
          - (setting === 'justright' && labelsOn ? cfg.kiosk.labelWeight * (o.kcal - 600) / 600 : 0);   // optional: calorie panel sways dish choice (Clarke et al. 2025)
        if (u > bestU) { bestU = u; best = k; bestO = o; }
      });
      const st = stalls[best], T = S[best], o = bestO;
      const serveMin = (st.serveSec + (setting === 'justright' ? ct.jrExtraSec : 0)) / 60;
      const tStart = Math.max(tAt, T.busyUntil), tServed = tStart + serveMin;
      T.busyUntil = tServed;
      const want = wantToEat(c, cfg, o);
      let eaten = want.eaten, cause = want.cause;
      // seat: a free one (students spread out over the tables), or wait for the next to free up
      let si = -1;
      const from = (i * 37) % seatFree.length;
      for (let j = 0; j < seatFree.length; j++) { const k = (from + j) % seatFree.length; if (seatFree[k] <= tServed + w) { si = k; break; } }
      if (si < 0) { si = 0; for (let k = 1; k < seatFree.length; k++) if (seatFree[k] < seatFree[si]) si = k; }
      const tSeat = Math.max(tServed + w, seatFree[si]);
      let eatMin = ct.eatBaseMin + eaten / ct.eatGPerMin;
      if (c.rusher) {                                           // the clock is their only limit: eat what fits before they must go
        const left = t0 + ct.rushLeaveMin - 1.6 * w - tSeat;    // minus the walks to the bin (0.6) and out (1.0)
        if (eatMin > left) {
          const can = Math.max(0, (Math.max(left, 1) - ct.eatBaseMin) * ct.eatGPerMin);
          if (can < eaten) { eaten = can; cause = 'time'; }
          eatMin = Math.max(1, left);
        }
      }
      const m = outcome(cfg, o, eaten, cause);
      const tDone = tSeat + eatMin; seatFree[si] = tDone + 0.2;
      const tBin = tDone + w * 0.6, tExit = tBin + w;
      // the stall's books
      const costG = st.riceCost / st.g, cooked = o.served * (1 + JR.cookBufferFor(cfg, setting));
      const perG = cfg.kiosk ? cfg.kiosk.perG[o.staple].kcal : 0;
      T.kcalServed += o.kcal; T.kcalWasted += m.leftover * perG;
      T.plates++; T.revenue += o.price; T.servedG += o.served; T.cookedG += cooked; T.unsoldG += cooked - o.served;
      T.riceCost += cooked * costG; T.otherCost += st.otherCost + o.extraCost; T.wasteG += m.leftover;
      if (m.leftover > v(cfg, 'leftThresholdG')) T.leftFood++;
      if (o.size === 'small') T.small++; if (o.size === 'less') T.less++; if (o.size === 'more') T.more++;
      T.starsSum += m.stars; T[m.fullness]++; T.waitSum += tStart - tAt;
      const mealProfit = o.price - cooked * costG - st.otherCost - o.extraCost;
      out.push({ i, persona: c.persona, name: p.name, profit: mealProfit, first: c.first, icon: p.icon, budget: c.budget, rusher: c.rusher, stall: best, size: o.size, served: o.served, price: o.price, kcal: o.kcal, kcalWasted: m.leftover * perG,
        need: o.need, eaten: m.eaten, leftover: m.leftover, fullness: m.fullness, why: m.why, split: m.split, stars: m.stars, seat: si,
        t0, tAt, tStart, tServed, tSeat, tDone, tBin, tExit });
    });
    S.forEach(T => { T.profit = T.revenue - T.riceCost - T.otherCost; T.rating = T.plates ? T.starsSum / T.plates : 0; });
    const sum = k => S.reduce((a, T) => a + T[k], 0);
    const totals = { students: n, plates: sum('plates'), revenue: sum('revenue'), riceCost: sum('riceCost'), otherCost: sum('otherCost'), profit: sum('profit'),
      wasteG: sum('wasteG'), unsoldG: sum('unsoldG'), cookedG: sum('cookedG'), servedG: sum('servedG'), leftFood: sum('leftFood'), small: sum('small'), less: sum('less'), more: sum('more'),
      right: sum('right'), hungry: sum('hungry'), stuffed: sum('stuffed'), rating: sum('starsSum') / n, avgWait: sum('waitSum') / n,
      endMin: Math.max(...out.map(s => s.tExit)),
      kcalServed: sum('kcalServed'), kcalWasted: sum('kcalWasted'),
      wasteWhy: ['portion', 'taste', 'time'].reduce((a, k) => (a[k] = out.reduce((x, s) => x + s.split[k], 0), a), {}) };   // adds up to the whole bin
    return { setting, seed, stalls: S, students: out, totals };
  }

  // rice saved on one Small at this stall (what the discount should not exceed)
  const smallBreakEven = (cfg, st) => round2(JR.riceSaved(cfg, st.riceCost));

  const API = { canteenStalls, canteenDay, orderAt, smallBreakEven, smallPriceAt, effectiveDiscount, outcome, dishBaseG };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.JR_CANTEEN = API;
})(typeof window !== 'undefined' ? window : globalThis);
