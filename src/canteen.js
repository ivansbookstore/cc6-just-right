/* Just Right: God Mode engine. One lunch in a whole canteen, worked out in full before anything moves on screen.
   The screen only replays the timeline. Same seed = same students, so Today and Just Right can be compared fairly.
   Customers, appetites, size choices and meals follow the vendor-mode rules; stalls come from student mode. */
(function (root) {
  const JR = root.JR || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const v = (cfg, k) => cfg.params[k].value;
  const round2 = x => Math.round(x * 100) / 100;

  // ---------- the stalls before opening: defaults from config, then the player's edits
  function canteenStalls(cfg, edits) {
    const R = v(cfg, 'regularRiceG'), P = v(cfg, 'regularPrice'), cR = v(cfg, 'riceCostRegular'), ct = cfg.canteen;
    return cfg.student.stalls.map(x => {
      const g = x.share === 'regular' ? R : Math.round(R * x.share);
      const d = {
        id: x.id, name: x.name, icon: x.icon,
        g, price: x.price === 'regular' ? P : x.price, stars: x.stars,
        riceCost: round2(cR * g / R),                         // rice in one of its own plates, same cost per gram as the vendor survey answer
        otherCost: round2(P > 0 ? v(cfg, 'toppingCost') * (x.price === 'regular' ? P : x.price) / P : v(cfg, 'toppingCost')),   // same share of price as vendor mode
        serveSec: ct.serveSec[x.id] || 35,
      };
      return Object.assign(d, (edits && edits[x.id]) || {});
    });
  }

  // what this student orders at this stall, and what lands on the plate
  function orderAt(c, cfg, st, setting) {
    const p = cfg.personas[c.persona], need = c.appetite * v(cfg, 'regularRiceG');
    const smallG = Math.round(st.g * v(cfg, 'smallShare')), lessG = Math.round(st.g * v(cfg, 'lessRiceShare'));
    const moreG = Math.round(st.g * v(cfg, 'addRiceShare')), smallPrice = round2(Math.max(1, st.price - v(cfg, 'discount')));
    let size;
    if (p.bigGroup) size = p.asks === 'more' ? 'more' : 'regular';
    else if (setting === 'justright') {
      const cut = smallG / 0.85;                                 // a Small that still leaves them "just right"
      const fits = need <= cut || (c.budget && need <= 0.95 * st.g);
      const near = Math.abs(need - cut) < 0.15 * st.g;
      const right = !near || c.sizeRoll < v(cfg, 'chooseRightSize');
      size = fits === right ? 'small' : 'regular';
    } else {
      size = c.persona === 'light' && need <= lessG / 0.85 ? 'less' : 'regular';
      if (size === 'regular' && need > st.g * 1.15 && p.asks === 'more') size = 'more';
    }
    if (size === 'regular' && p.bigGroup && p.asks === 'more') size = 'more';
    const served = { regular: st.g, small: smallG, less: lessG, more: moreG }[size];
    const price = size === 'small' ? smallPrice : st.price;
    const extraCost = size === 'less' && v(cfg, 'todayLessResponse') === 'lessVeg' ? v(cfg, 'extraVegCost') : 0;
    return { size, served, price, extraCost, need };
  }

  // eating, with the same rules as vendor mode
  function eat(c, cfg, o) {
    const p = cfg.personas[c.persona];
    const letdown = c.tasteRoll < (c.persona === 'picky' ? v(cfg, 'tasteLetdownPicky') : v(cfg, 'tasteLetdownOther'));
    let eaten;
    if (p.cleanPlater) eaten = o.served;
    else {
      eaten = Math.min(o.served, o.need * (letdown ? 0.6 : 1));
      if (c.rusher) eaten = Math.min(eaten, v(cfg, 'regularRiceG') * v(cfg, 'rushEatCap'));
    }
    const leftover = o.served - eaten, ratio = eaten / o.need;
    let fullness = ratio < 0.85 ? 'hungry' : ratio > 1.15 ? 'stuffed' : 'right';
    let why = null;
    if (letdown && !p.cleanPlater && leftover > 1) why = 'taste';
    else if (c.rusher && !p.cleanPlater && leftover > 1 && eaten < o.need) why = 'time';
    else if (leftover > v(cfg, 'leftThresholdG')) why = 'portion';
    let stars = 4;
    if (fullness === 'right') stars += 0.5;
    if (fullness === 'hungry') stars -= why === 'time' ? 0.3 : 1.5;
    if (fullness === 'stuffed') stars -= 0.7;
    if (why === 'taste') stars -= 1;
    if (o.size === 'small') stars += 0.3;
    if (o.size === 'less' && v(cfg, 'todayLessResponse') === 'lessSame') stars -= 0.3;
    if (o.size === 'less' && v(cfg, 'todayLessResponse') === 'lessVeg') stars += 0.2;
    stars = Math.max(1, Math.min(5, stars));
    return { eaten, leftover, fullness, why, stars };
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
    const people = JR.makeCustomers(cfg, seed, n);
    const r = JR.rng((seed ^ 0x9E3779B9) >>> 0);
    const times = arrivals(r, n, ct);
    const noise = people.map(() => stalls.map(() => (r() - 0.5) * 2));        // personal taste, drawn once for both settings
    const seatFree = new Array(ct.seats).fill(0);
    const S = stalls.map(st => ({ id: st.id, busyUntil: 0, plates: 0, revenue: 0, riceCost: 0, otherCost: 0, profit: 0, servedG: 0, cookedG: 0, unsoldG: 0,
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
          + (c.persona === 'picky' ? ch.pickyStars : ch.stars) * (st.stars - 4) + ch.noise * noise[i][k];
        if (u > bestU) { bestU = u; best = k; bestO = o; }
      });
      const st = stalls[best], T = S[best], o = bestO;
      const serveMin = (st.serveSec + (setting === 'justright' ? ct.jrExtraSec : 0)) / 60;
      const tStart = Math.max(tAt, T.busyUntil), tServed = tStart + serveMin;
      T.busyUntil = tServed;
      let m = eat(c, cfg, o);
      // seat: the first free one, or wait for the next to free up
      let si = -1;
      const from = (i * 37) % seatFree.length;                 // students spread out over the tables
      for (let j = 0; j < seatFree.length; j++) { const k = (from + j) % seatFree.length; if (seatFree[k] <= tServed + w) { si = k; break; } }
      if (si < 0) { si = 0; for (let k = 1; k < seatFree.length; k++) if (seatFree[k] < seatFree[si]) si = k; }
      const tSeat = Math.max(tServed + w, seatFree[si]);
      let eatMin = ct.eatBaseMin + m.eaten / ct.eatGPerMin;
      if (c.rusher) {                                           // must leave on time: eat what fits in the minutes left
        const left = t0 + ct.rushLeaveMin - 2 * w - tSeat;
        if (eatMin > left) {
          const can = Math.max(0, (Math.max(left, 1) - ct.eatBaseMin) * ct.eatGPerMin);
          if (can < m.eaten) { m = eat(c, cfg, o); m.eaten = Math.max(0, can); m.leftover = o.served - m.eaten; m.why = 'time';
            const ratio = m.eaten / o.need; m.fullness = ratio < 0.85 ? 'hungry' : ratio > 1.15 ? 'stuffed' : 'right'; }
          eatMin = Math.max(1, left);
        }
      }
      const tDone = tSeat + eatMin; seatFree[si] = tDone + 0.2;
      const tBin = tDone + w * 0.6, tExit = tBin + w;
      // the stall's books
      const costG = st.riceCost / st.g, cooked = o.served * (1 + v(cfg, 'cookBuffer'));
      T.plates++; T.revenue += o.price; T.servedG += o.served; T.cookedG += cooked; T.unsoldG += cooked - o.served;
      T.riceCost += cooked * costG; T.otherCost += st.otherCost + o.extraCost; T.wasteG += m.leftover;
      if (m.leftover > v(cfg, 'leftThresholdG')) T.leftFood++;
      if (o.size === 'small') T.small++; if (o.size === 'less') T.less++; if (o.size === 'more') T.more++;
      T.starsSum += m.stars; T[m.fullness]++; T.waitSum += tStart - tAt;
      const mealProfit = o.price - cooked * costG - st.otherCost - o.extraCost;
      out.push({ i, persona: c.persona, name: p.name, profit: mealProfit, first: c.first, icon: p.icon, budget: c.budget, rusher: c.rusher, stall: best, size: o.size, served: o.served, price: o.price,
        need: o.need, eaten: m.eaten, leftover: m.leftover, fullness: m.fullness, why: m.why, stars: m.stars, seat: si,
        t0, tAt, tStart, tServed, tSeat, tDone, tBin, tExit });
    });
    S.forEach(T => { T.profit = T.revenue - T.riceCost - T.otherCost; T.rating = T.plates ? T.starsSum / T.plates : 0; });
    const sum = k => S.reduce((a, T) => a + T[k], 0);
    const totals = { students: n, plates: sum('plates'), revenue: sum('revenue'), riceCost: sum('riceCost'), otherCost: sum('otherCost'), profit: sum('profit'),
      wasteG: sum('wasteG'), unsoldG: sum('unsoldG'), cookedG: sum('cookedG'), servedG: sum('servedG'), leftFood: sum('leftFood'), small: sum('small'), less: sum('less'), more: sum('more'),
      right: sum('right'), hungry: sum('hungry'), stuffed: sum('stuffed'), rating: sum('starsSum') / n, avgWait: sum('waitSum') / n,
      endMin: Math.max(...out.map(s => s.tExit)),
      wasteWhy: ['portion', 'taste', 'time'].reduce((a, k) => (a[k] = out.filter(s => s.why === k).reduce((x, s) => x + s.leftover, 0), a), {}) };
    return { setting, seed, stalls: S, students: out, totals };
  }

  // rice saved on one Small at this stall, against the discount (the break-even discount)
  const smallBreakEven = (cfg, st) => round2((st.riceCost * (1 - v(cfg, 'smallShare'))) * (1 + v(cfg, 'cookBuffer')));

  const API = { canteenStalls, canteenDay, orderAt, smallBreakEven };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.JR_CANTEEN = API;
})(typeof window !== 'undefined' ? window : globalThis);
