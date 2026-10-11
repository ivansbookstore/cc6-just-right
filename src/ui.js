/* Just Right — screens. All maths lives in engine.js; this file only draws and listens. */
(function () {
  'use strict';
  const JR = window.JR;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = x => (x < 0 ? '−' : '') + 'S$' + Math.abs(x).toFixed(2);
  const kg = g => (g / 1000).toFixed(2) + ' kg';
  const pct = x => Math.round(x * 100) + '%';
  const starStr = r => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  const NAMES = { today: 'Today', justright: 'Just Right', shortcut: 'Shortcut' };
  const SEMESTER_DAYS = 5 * 13;

  // ---------- settings: start from config, keep the player's edits on this device only
  const STORE = 'jr-params-v1';
  function freshCfg() { return JSON.parse(JSON.stringify(window.JR_CONFIG)); }
  let cfg = freshCfg();
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    for (const k in saved) if (cfg.params[k]) cfg.params[k].value = saved[k];
  } catch (e) { /* storage blocked — defaults are fine */ }
  function saveParams() {
    try {
      const out = {};
      for (const k in cfg.params) if (cfg.params[k].value !== window.JR_CONFIG.defaults[k].value) out[k] = cfg.params[k].value;
      localStorage.setItem(STORE, JSON.stringify(out));
    } catch (e) { /* ignore */ }
  }
  const P = k => cfg.params[k].value;

  // ---------- state
  const S = { setting: 'today', seed: 20261012, all: [], rush: [], actions: [], idx: 0, timer: null, left: 0, prev: 'start', showing: false, nextTimer: null };

  // ---------- navigation
  function go(id) {
    const cur = document.querySelector('.screen.on');
    if (id === 'back') id = S.prev || 'start';
    if (cur && cur.id !== 'how' && id === 'how') S.prev = cur.id;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    if (id === 'how') renderHow();
    if (id === 'setup') renderSetup();
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b) { stopTimers(); go(b.getAttribute('data-go')); }
  });
  $('#go-vendor').addEventListener('click', () => go('setup'));

  // ---------- setup
  function slider(key, fmt) {
    const p = cfg.params[key];
    return `<div class="slider"><label for="s-${key}"><span>${esc(p.label)}</span><span id="v-${key}">${fmt(p.value)}</span></label>
      <input type="range" id="s-${key}" data-key="${key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}"></div>`;
  }
  const FMT = { smallShare: x => pct(x) + ' of Regular', discount: x => money(x) + ' off', riceCostRegular: x => money(x) + ' per Regular plate' };
  function renderSetup() {
    document.querySelectorAll('.toggle button').forEach(b => {
      const on = b.dataset.setting === S.setting;
      b.classList.toggle('sel', on); b.setAttribute('aria-checked', on);
    });
    let html = '';
    if (S.setting === 'justright') html += slider('smallShare', FMT.smallShare) + slider('discount', FMT.discount);
    html += slider('riceCostRegular', FMT.riceCostRegular);
    $('#setup-sliders').innerHTML = html;
    document.querySelectorAll('#setup-sliders input').forEach(inp => inp.addEventListener('input', () => {
      const k = inp.dataset.key; cfg.params[k].value = parseFloat(inp.value);
      $('#v-' + k).textContent = FMT[k](cfg.params[k].value); saveParams(); renderSetupNote();
    }));
    renderSetupNote();
  }
  function renderSetupNote() {
    const be = JR.breakEvenDiscount(cfg), d = P('discount');
    let n;
    if (S.setting === 'justright') {
      const diff = be - d;
      n = `<div class="note ${diff < 0 ? 'warn' : ''}">Rice saved on one Small plate: <b>${money(be)}</b>. Your discount: <b>${money(d)}</b>.
        ${diff >= 0 ? `Each Small plate earns you ${money(diff)} more than a Regular.` : `Each Small plate earns you ${money(-diff)} less than a Regular — you need more customers or a better rating to make up for it.`}</div>`;
    } else {
      const resp = P('todayLessResponse') === 'lessVeg' ? 'give less rice and add some vegetables (what most vendors told us they do)' : 'give less rice at the same price';
      n = `<div class="note">When a student asks for less rice, you choose. The standard play is to ${resp}. Students who say nothing get a Regular plate.</div>`;
    }
    $('#setup-note').innerHTML = n;
  }
  document.querySelectorAll('.toggle button').forEach(b => b.addEventListener('click', () => { S.setting = b.dataset.setting; renderSetup(); }));
  $('#start-rush').addEventListener('click', () => startRush());

  // ---------- rush
  function startRush(sameCustomers) {
    if (!sameCustomers) S.all = JR.makeCustomers(cfg, S.seed, P('platesPerDay'));
    S.rush = S.all.slice(0, P('rushCustomers'));
    S.actions = []; S.idx = 0; S.showing = false;
    go('rush'); renderRush(); startTimer();
  }
  function stopTimers() { clearInterval(S.timer); clearTimeout(S.nextTimer); S.timer = null; }
  function startTimer() {
    stopTimers();
    S.left = P('patienceSec');
    const bar = $('#patience');
    S.timer = setInterval(() => {
      S.left -= 0.1;
      const frac = Math.max(0, S.left / P('patienceSec'));
      const el = $('#patience');
      if (el) { el.firstElementChild.style.width = (frac * 100) + '%'; el.classList.toggle('low', frac < 0.3); }
      if (S.left <= 0) serve(null);
    }, 100);
  }
  function plateSVG(grams, label) {
    const R = P('regularRiceG');
    const rx = grams <= 0 ? 0 : 10 + 26 * Math.sqrt(Math.min(grams, R * 1.5) / (R * 1.5));
    return `<figure><svg width="110" height="80" viewBox="0 0 110 80" role="img" aria-label="${esc(label)}: ${Math.round(grams)} grams">
      <ellipse cx="55" cy="46" rx="50" ry="28" fill="var(--plate)" stroke="var(--plate-edge)" stroke-width="2"/>
      <ellipse cx="55" cy="46" rx="38" ry="20" fill="none" stroke="var(--plate-edge)" stroke-width="1" opacity=".6"/>
      ${rx ? `<ellipse cx="55" cy="${44 - rx * 0.15}" rx="${rx}" ry="${rx * 0.55}" fill="var(--rice)" stroke="var(--rice-edge)" stroke-width="1.5"/>` : ''}
    </svg><figcaption>${esc(label)}: ${Math.round(grams)} g</figcaption></figure>`;
  }
  function renderRush() {
    const c = S.rush[S.idx], set = S.setting;
    const so = JR.runDay(cfg, S.rush.slice(0, S.idx), set, S.actions);
    $('#hud-setting').className = 'chip ' + (set === 'today' ? 'today' : 'jr');
    $('#hud-setting').textContent = set === 'today' ? 'Today · one size' : 'Just Right · Regular + Small';
    $('#hud-count').textContent = `Customer ${Math.min(S.idx + 1, S.rush.length)} of ${S.rush.length}`;
    $('#hud-rating').textContent = S.idx ? `★ ${so.rating.toFixed(1)}` : '★ –';
    $('#hud-cash').textContent = money(so.revenue);
    $('#queue').innerHTML = S.rush.slice(S.idx + 1, S.idx + 5).map(q => `<div class="qp" title="${esc(q.name)}">${q.icon}</div>`).join('') || '<span class="muted small">Last customer!</span>';
    const traits = [];
    if (c.rusher) traits.push('In a rush');
    if (c.budget) traits.push('Budget-minded');
    $('#customer').innerHTML = `<div class="face" aria-hidden="true">${c.icon}</div>
      <div class="name">${esc(c.name)}</div>
      <div class="traits">${traits.map(t => `<span class="trait">${t}</span>`).join('')}</div>
      <div class="speech">“${esc(JR.lineFor(c, cfg, set))}”</div>
      <div class="patience" id="patience"><div></div></div>`;
    $('#customer').style.display = ''; $('#feedback').className = 'feedback'; $('#feedback').innerHTML = '';
    $('#actions').style.display = '';
    $('#actions').innerHTML = JR.ACTIONS[set].map(([k, lab], i) => {
      let price = k === 'small' ? P('regularPrice') - P('discount') : P('regularPrice');
      return `<button data-act="${k}"><span class="key">${i + 1}</span>${esc(lab)}<br><span class="muted small">${money(price)}</span></button>`;
    }).join('');
    $('#actions').querySelectorAll('button').forEach(b => b.addEventListener('click', () => serve(b.dataset.act)));
    const R = P('regularRiceG');
    $('#board').innerHTML = `<div class="title">Menu board</div>` + (set === 'justright'
      ? `<div class="item"><span>Regular (${R} g rice)</span><span>${money(P('regularPrice'))}</span></div>
         <div class="item"><span>Small (${Math.round(R * P('smallShare'))} g rice)</span><span>${money(P('regularPrice') - P('discount'))}</span></div>`
      : `<div class="item"><span>Economy rice</span><span>${money(P('regularPrice'))}</span></div>`);
    $('#tally').innerHTML = `<div><span>Served</span><b>${so.plates}</b></div>
      <div><span>Walked away</span><b>${so.walkaways}</b></div>
      <div><span>Left food</span><b>${so.leftFood}</b></div>
      <div><span>Rice on plates</span><b>${Math.round(so.plateWasteG)} g</b></div>
      ${set === 'justright' ? `<div><span>Small plates</span><b>${so.smallOrders}</b></div>` : ''}`;
  }
  function serve(action) {
    if (S.showing) return;
    stopTimers();
    S.showing = true;
    const c = S.rush[S.idx];
    S.actions.push(action);
    $('#actions').style.display = 'none';
    $('#customer').style.display = 'none';
    let html;
    if (action === null) {
      html = `<div class="face" style="font-size:44px" aria-hidden="true">🚶</div><div class="bub">${esc(c.name)} walked away.</div>
        <p class="muted">Lost sale — the queue was too slow.</p>`;
    } else {
      const m = JR.meal(c, action, cfg, S.setting);
      html = `<div class="plates">${plateSVG(m.served, 'Served')}${plateSVG(m.leftover, 'Came back')}</div>
        <div class="bub">${c.icon} “${esc(JR.bubble(m))}”</div>
        <div class="stars" aria-label="${m.stars.toFixed(1)} stars">${starStr(m.stars)}</div>
        <p class="muted small">Paid ${money(m.price)}${m.extraCost ? ` · extra veg cost you ${money(m.extraCost)}` : ''}</p>`;
    }
    const last = S.idx + 1 >= S.rush.length;
    html += `<button class="primary" id="next-btn" style="margin-top:8px">${last ? 'Close the stall' : 'Next customer'} <span class="kbd">(Space)</span></button>`;
    $('#feedback').innerHTML = html; $('#feedback').className = 'feedback on';
    $('#next-btn').addEventListener('click', next);
    $('#next-btn').focus({ preventScroll: true });
    S.nextTimer = setTimeout(next, action === null ? 2200 : 2600);
  }
  function next() {
    clearTimeout(S.nextTimer);
    if (!S.showing) return;
    S.showing = false;
    S.idx++;
    if (S.idx >= S.rush.length) return finish();
    renderRush(); startTimer();
  }
  $('#auto-rest').addEventListener('click', () => {
    stopTimers(); S.showing = false;
    for (let i = S.actions.length; i < S.rush.length; i++) S.actions.push(JR.standardAction(S.rush[i], cfg, S.setting));
    finish();
  });
  document.addEventListener('keydown', e => {
    if (!$('#rush').classList.contains('on')) return;
    if (S.showing && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); next(); return; }
    if (!S.showing && /^[1-4]$/.test(e.key)) {
      const a = JR.ACTIONS[S.setting][parseInt(e.key, 10) - 1];
      if (a) { e.preventDefault(); serve(a[0]); }
    }
  });

  // ---------- report
  function cmp(a, b, lowerBetter, fmt) {
    if (Math.abs(a - b) < 1e-9) return '<span class="muted">same</span>';
    const better = lowerBetter ? b < a : b > a;
    return `<span class="${better ? 'better' : 'worse'}">${b > a ? '+' : '−'}${fmt(Math.abs(b - a))}</span>`;
  }
  function finish() {
    stopTimers();
    const set = S.setting, other = set === 'today' ? 'justright' : 'today', n = S.rush.length;
    const you = JR.runDay(cfg, S.rush, set, S.actions);
    const oth = JR.runDay(cfg, S.rush, other);
    const T = JR.runDay(cfg, S.all, 'today'), J = JR.runDay(cfg, S.all, 'justright');
    const days = JR.runRatingDays(cfg, S.seed, 3);
    const N = S.all.length, be = JR.breakEvenDiscount(cfg);
    const row = (label, a, b, pill) => `<tr><td>${label}${pill ? `<span class="pill">${pill}</span>` : ''}</td><td class="num">${a}</td><td class="num">${b}</td></tr>`;
    const row3 = (label, pill, a, b, diff) => `<tr><td>${label}<span class="pill">${pill}</span></td><td class="num">${a}</td><td class="num">${b}</td><td class="num">${diff}</td></tr>`;
    const maxC = Math.max(...['today', 'justright', 'shortcut'].map(k => days[k][2].customers));
    const semWaste = ((J.plateWasteG + J.unsoldG) - (T.plateWasteG + T.unsoldG)) * SEMESTER_DAYS;
    const semProfit = (J.profit - T.profit) * SEMESTER_DAYS;
    $('#report-body').innerHTML = `
      <h1>Closing time</h1>
      <p class="muted">Every result here comes from a simulation built on our survey data and stated assumptions. It shows what <i>would</i> happen if those assumptions hold — not real sales.</p>

      <div class="card"><h2>Your lunch rush</h2>
        <p class="muted small">The same ${n} customers, served by you (${NAMES[set]}) and by standard play in the other setting (${NAMES[other]}).</p>
        <div class="tablewrap"><table>
          <tr><th></th><th class="num">You<br>${NAMES[set]}</th><th class="num">${NAMES[other]}<br>standard play</th></tr>
          ${row('Served / walked away', `${you.plates} / ${you.walkaways}`, `${oth.plates} / ${oth.walkaways}`)}
          ${row('Customers who left food', `${you.leftFood} of ${n}`, `${oth.leftFood} of ${n}`, 'Society')}
          ${row('Rice left on plates', `${Math.round(you.plateWasteG)} g`, `${Math.round(oth.plateWasteG)} g`, 'Environment')}
          ${row('Overate (food coma)', you.stuffed, oth.stuffed, 'Society')}
          ${row('Still hungry', you.hungry, oth.hungry, 'Society')}
          ${row('Small plates sold', you.smallOrders, oth.smallOrders)}
          ${row('Takings', money(you.revenue), money(oth.revenue), 'Economy')}
          ${row('Profit', money(you.profit), money(oth.profit), 'Economy')}
          ${row('Average rating', `${you.rating.toFixed(2)} ★`, `${oth.rating.toFixed(2)} ★`)}
        </table></div>
      </div>

      <div class="card" style="margin-top:12px"><h2>A full day: ${N} plates, standard play</h2>
        <p class="muted small">Same ${N} customers. Change = Just Right minus Today. Green is better, red is worse.</p>
        <div class="tablewrap"><table>
          <tr><th></th><th class="num">Today</th><th class="num">Just<br>Right</th><th class="num">Change</th></tr>
          ${row3('Meals with food left', 'Society', `${T.leftFood} (${pct(T.leftFood / N)})`, `${J.leftFood} (${pct(J.leftFood / N)})`, cmp(T.leftFood, J.leftFood, true, x => x))}
          ${row3('Rice left on plates', 'Environment', kg(T.plateWasteG), kg(J.plateWasteG), cmp(T.plateWasteG, J.plateWasteG, true, kg))}
          ${row3('Rice cooked but not served', 'Environment', kg(T.unsoldG), kg(J.unsoldG), cmp(T.unsoldG, J.unsoldG, true, kg))}
          ${row3('Customers who overate', 'Society', T.stuffed, J.stuffed, cmp(T.stuffed, J.stuffed, true, x => x))}
          ${row3('Customers still hungry', 'Society', T.hungry, J.hungry, cmp(T.hungry, J.hungry, true, x => x))}
          ${row3('Takings', 'Economy', money(T.revenue), money(J.revenue), cmp(T.revenue, J.revenue, false, money))}
          ${row3('Rice cost', 'Economy', money(T.riceCost), money(J.riceCost), cmp(T.riceCost, J.riceCost, true, money))}
          ${row3('Profit', 'Economy', money(T.profit), money(J.profit), cmp(T.profit, J.profit, false, money))}
          ${row3('Average rating', 'Economy', T.rating.toFixed(2) + ' ★', J.rating.toFixed(2) + ' ★', cmp(T.rating, J.rating, false, x => x.toFixed(2)))}
        </table></div>
        <div class="note ${semProfit < 0 ? 'warn' : ''}">Over a 13-week semester (5 days a week) at this one stall, Just Right would mean
          <b>${kg(Math.abs(semWaste))} ${semWaste <= 0 ? 'less' : 'more'} rice wasted</b> and <b>${money(Math.abs(semProfit))} ${semProfit >= 0 ? 'more' : 'less'} profit</b>.
          The Small plate discount is ${money(P('discount'))}; the rice it saves is worth ${money(be)}.</div>
      </div>

      <div class="card" style="margin-top:12px"><h2>How ratings drop: the shortcut</h2>
        <p>What if the vendor quietly cut <b>every</b> plate to ${pct(P('smallShare'))} of the rice and kept the price? Tomorrow's customers follow today's rating.</p>
        <div class="tablewrap"><table>
          <tr><th></th><th class="num">Day 1</th><th class="num">Day 2</th><th class="num">Day 3</th></tr>
          ${['today', 'justright', 'shortcut'].map(k => `<tr><td><b>${NAMES[k]}</b></td>${days[k].map(d => `<td class="num">${d.customers} customers<br>${d.rating.toFixed(1)} ★ · ${money(d.profit)}</td>`).join('')}</tr>`).join('')}
        </table></div>
        <h3>Customers on day 3</h3>
        <div class="bars">${['today', 'justright', 'shortcut'].map(k => `<span>${NAMES[k]}</span><div><div class="bar ${k === 'today' ? 'today' : k === 'shortcut' ? 'short' : ''}" style="width:${(days[k][2].customers / maxC) * 100}%"></div></div>`).join('')}</div>
        <p class="muted small" style="margin-top:8px">The shortcut wastes the least rice and earns the most on day 1 — then customers feel short-changed, the rating falls, and the stall loses them. Letting customers choose keeps them.</p>
      </div>

      <div class="card" style="margin-top:12px"><h2>What this does not show</h2>
        <ul>
          <li>Food left because it tasted bad, or because a student was rushing, is not fixed by a smaller plate. The Picky One still leaves food under Just Right.</li>
          <li>Profit depends heavily on the rice cost per plate (${money(P('riceCostRegular'))} here) and the discount. Our vendor answers on cost are unclear — try other values on the setup screen.</li>
          <li>How fast ratings change the number of customers is an assumption, used to illustrate the idea.</li>
          <li>Players are not real customers. The pilot at a real stall is what tests this.</li>
        </ul>
      </div>

      <div class="row" style="margin-top:14px">
        <button class="primary grow" id="r-same">Same customers, ${NAMES[other]}</button>
        <button class="grow" id="r-new">New day, new customers</button>
        <button class="grow" data-go="how">How this works</button>
        <button class="grow" data-go="start">Home</button>
      </div>`;
    $('#r-same').addEventListener('click', () => { S.setting = other; startRush(true); });
    $('#r-new').addEventListener('click', () => { S.seed += 1; go('setup'); });
    go('report');
  }

  // ---------- how this works
  function fmtVal(p) {
    if (p.unit === 'choice') return (p.options.find(o => o[0] === p.value) || [, p.value])[1];
    if (p.unit === '%') return pct(p.value);
    if (p.unit === 'S$') return money(p.value);
    return `${Math.round(p.value * 100) / 100}${p.unit ? ' ' + p.unit : ''}`;
  }
  function renderHow() {
    const ps = cfg.params;
    const items = Object.keys(ps).map(k => {
      const p = ps[k];
      let ctl = '';
      if (p.editable && p.unit === 'choice') ctl = `<select data-key="${k}">${p.options.map(o => `<option value="${o[0]}" ${o[0] === p.value ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
      else if (p.editable) ctl = `<input type="range" data-key="${k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}" aria-label="${esc(p.label)}">`;
      return `<div class="param"><div>${esc(p.label)}<br><span class="status ${p.status}">${p.status}</span></div>
        <div><span class="val" id="hv-${k}">${fmtVal(p)}</span>${ctl}</div><div class="muted small">${esc(p.source)}</div></div>`;
    }).join('');
    const pers = Object.values(cfg.personas).map(p => `<li>${p.icon} <b>${esc(p.name)}</b> — wants ${pct(p.appetite[0])}–${pct(p.appetite[1])} of a Regular plate${p.cleanPlater ? '; finishes everything' : ''}.</li>`).join('');
    const w = JR.personaWeights(cfg).map(([k, x]) => `${cfg.personas[k].name} ${pct(x)}`).join(' · ');
    $('#how-body').innerHTML = `
      <h1>How this works</h1>
      <div class="card">
        <h2>The idea</h2>
        <p>Every customer has a hidden appetite. They eat what they want and leave the rest — unless they are a Clean-Plater, who finishes everything and overeats instead. Taste letdowns and rushing make people leave food whatever the plate size.</p>
        <p><b>Today</b>: one size. Light eaters who speak up ask for less rice; quiet ones get a Regular. <b>Just Right</b>: Regular and Small are on the board, so everyone can point at the size that fits. Both settings use exactly the same customers, so any difference comes from the menu, not luck.</p>
        <p>Profit = takings − rice cost − everything else on the plate. A Small plate breaks even when the discount is no more than the rice it saves: rice cost × (1 − Small share) × (1 + cooking buffer) = <b>${money(JR.breakEvenDiscount(cfg))}</b> with the current settings.</p>
        <p>Ratings: customers score their meal from 1 to 5 stars — up for "just nice", down for still hungry, overeating, a taste letdown, or feeling short-changed. In the shortcut challenge, tomorrow's customers rise or fall with today's rating.</p>
        <p class="muted small">${esc(cfg.calibration)}</p>
        <h3>Customer mix (from our survey, big eaters added)</h3>
        <p class="small">${esc(w)}</p>
        <ul class="small">${pers}</ul>
      </div>
      <div class="card" style="margin-top:12px">
        <h2>Every number</h2>
        <p class="muted small"><span class="status survey">survey</span> our student survey · <span class="status vendor">vendor</span> our vendor survey, to confirm · <span class="status assumption">assumption</span> no data yet.
        Sliders change your game on this device only.</p>
        ${items}
        <div class="row" style="margin-top:12px"><button id="reset">Reset to defaults</button></div>
      </div>
      <p class="muted small" style="margin-top:12px">Game version ${esc(cfg.version)}. Code and data are open source on GitHub.</p>`;
    document.querySelectorAll('#how-body [data-key]').forEach(inp => inp.addEventListener('input', () => {
      const k = inp.dataset.key, p = cfg.params[k];
      p.value = p.unit === 'choice' ? inp.value : parseFloat(inp.value);
      $('#hv-' + k).textContent = fmtVal(p); saveParams();
    }));
    $('#reset').addEventListener('click', () => {
      cfg = freshCfg(); try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
      renderHow();
    });
  }
})();
