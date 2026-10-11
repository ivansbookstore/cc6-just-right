/* Just Right: screens. All maths lives in engine.js; this file only draws and listens. */
(function () {
  'use strict';
  const JR = window.JR, I = window.JR_ICON;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = x => (x < 0 ? '−' : '') + 'S$' + Math.abs(x).toFixed(2);
  const kg = g => (g / 1000).toFixed(2) + ' kg';
  const pct = x => Math.round(x * 100) + '%';
  const NAMES = { today: 'Today', justright: 'Just Right', shortcut: 'Shortcut' };
  const SEMESTER_DAYS = 5 * 13;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- settings: start from config, keep the player's edits on this device only
  const STORE = 'jr-params-v1';
  const freshCfg = () => JSON.parse(JSON.stringify(window.JR_CONFIG));
  let cfg = freshCfg();
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    for (const k in saved) if (cfg.params[k]) cfg.params[k].value = saved[k];
  } catch (e) { /* storage blocked: defaults are fine */ }
  function saveParams() {
    try {
      const out = {};
      for (const k in cfg.params) if (cfg.params[k].value !== window.JR_CONFIG.defaults[k].value) out[k] = cfg.params[k].value;
      localStorage.setItem(STORE, JSON.stringify(out));
    } catch (e) { /* ignore */ }
  }
  const P = k => cfg.params[k].value;

  const S = { setting: 'today', seed: 20261012, all: [], rush: [], actions: [], idx: 0, timer: null, left: 0, prev: 'start', showing: false, nextTimer: null };

  // ---------- small pieces
  function stars(r) {
    const n = Math.round(r);
    let h = '';
    for (let i = 0; i < 5; i++) h += I('star-fill', i < n ? '' : 'off');
    return `<span class="stars" role="img" aria-label="${r.toFixed(1)} out of 5 stars">${h}</span>`;
  }
  function plateSVG(grams, label, size) {
    const R = P('regularRiceG'), w = size || 110, h = Math.round(w * 0.72);
    const rx = grams <= 0 ? 0 : 10 + 26 * Math.sqrt(Math.min(grams, R * 1.5) / (R * 1.5));
    return `<figure><svg width="${w}" height="${h}" viewBox="0 0 110 80" role="img" aria-label="${esc(label)}: ${Math.round(grams)} grams of rice">
      <ellipse cx="55" cy="46" rx="50" ry="28" fill="var(--plate)" stroke="var(--plate-edge)" stroke-width="2"/>
      <ellipse cx="55" cy="46" rx="38" ry="20" fill="none" stroke="var(--plate-edge)" stroke-width="1" opacity=".6"/>
      ${rx ? `<ellipse cx="55" cy="${44 - rx * 0.15}" rx="${rx}" ry="${rx * 0.55}" fill="var(--rice)" stroke="var(--rice-edge)" stroke-width="1.5"/>` : ''}
    </svg><figcaption>${esc(label)}: ${Math.round(grams)} g</figcaption></figure>`;
  }

  // ---------- static labels with icons
  $('#brandmark').innerHTML = I('bowl-food') + 'Just Right';
  $('#go-vendor').innerHTML = `${I('storefront')}<span><b>Be the vendor</b><span class="muted">Serve a lunch rush, then read the closing report.</span></span>${I('arrow-left', 'flip')}`;
  $('#go-vendor .flip').style.transform = 'scaleX(-1)';
  $('#how-link').innerHTML = I('question') + 'How this works, and where every number comes from';
  $('#back-home').innerHTML = I('arrow-left') + 'Home';
  $('#back-how').innerHTML = I('arrow-left') + 'Back';

  // ---------- live preview on the start screen: one real customer from the model, served both ways
  function renderPreview() {
    const cs = JR.makeCustomers(cfg, S.seed, 80);
    const c = cs.find(x => x.persona === 'quiet' && !x.rusher && x.appetite < 0.85) || cs[0];
    const t = JR.meal(c, JR.standardAction(c, cfg, 'today'), cfg, 'today');
    const j = JR.meal(c, JR.standardAction(c, cfg, 'justright'), cfg, 'justright');
    $('#preview').innerHTML = `
      <div class="row" style="gap:12px"><div class="avatar" style="width:52px;height:52px;margin:0">${I(cfg.personas[c.persona].icon)}</div>
        <div><h2>${esc(c.name)}</h2><p class="muted small" style="margin:0">One customer from today's queue, served both ways.</p></div></div>
      <div class="compare">
        <div><b>Today</b>${plateSVG(t.leftover, 'Came back', 120)}<p class="small muted">Paid ${money(t.price)}</p></div>
        <div><b>Just Right</b>${plateSVG(j.leftover, 'Came back', 120)}<p class="small muted">Paid ${money(j.price)}</p></div>
      </div>
      <p class="small muted" style="margin-top:10px">Model output from our survey data and stated assumptions.</p>`;
  }
  renderPreview();

  // ---------- navigation
  function go(id) {
    const cur = document.querySelector('.screen.on');
    if (id === 'back') id = S.prev || 'start';
    if (cur && cur.id !== 'how' && id === 'how') S.prev = cur.id;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    if (id === 'how') renderHow();
    if (id === 'setup') renderSetup();
    if (id === 'start') renderPreview();
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b) { stopTimers(); go(b.getAttribute('data-go')); }
  });
  $('#go-vendor').addEventListener('click', () => go('setup'));

  // ---------- setup
  const FMT = { smallShare: x => pct(x) + ' of Regular', discount: x => money(x) + ' off', riceCostRegular: x => money(x) + ' per Regular plate' };
  function slider(key) {
    const p = cfg.params[key];
    return `<div class="slider"><label for="s-${key}"><span>${esc(p.label)}</span><span id="v-${key}">${FMT[key](p.value)}</span></label>
      <input type="range" id="s-${key}" data-key="${key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}"></div>`;
  }
  function renderSetup() {
    document.querySelectorAll('.toggle button').forEach(b => {
      const on = b.dataset.setting === S.setting;
      b.classList.toggle('sel', on); b.setAttribute('aria-checked', on);
    });
    let html = '';
    if (S.setting === 'justright') html += slider('smallShare') + slider('discount');
    html += slider('riceCostRegular');
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
      n = `<div class="note ${diff < 0 ? 'warn' : 'good'}">Rice saved on one Small plate: <b>${money(be)}</b>. Your discount: <b>${money(d)}</b>.
        ${diff >= 0 ? `Each Small plate earns you ${money(diff)} more than a Regular.` : `Each Small plate earns you ${money(-diff)} less than a Regular, so you need more customers or a better rating to make it up.`}</div>`;
    } else {
      const resp = P('todayLessResponse') === 'lessVeg' ? 'give less rice and add some vegetables, which is what most vendors told us they do' : 'give less rice at the same price';
      n = `<div class="note">When a student asks for less rice, you decide. Standard play is to ${resp}. Students who say nothing get a Regular plate.</div>`;
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
    S.timer = setInterval(() => {
      S.left -= 0.1;
      const frac = Math.max(0, S.left / P('patienceSec'));
      const el = $('#patience');
      if (el) { el.firstElementChild.style.width = (frac * 100) + '%'; el.classList.toggle('low', frac < 0.3); }
      if (S.left <= 0) serve(null);
    }, 100);
  }
  function renderRush() {
    const c = S.rush[S.idx], set = S.setting;
    const so = JR.runDay(cfg, S.rush.slice(0, S.idx), set, S.actions);
    const hs = $('#hud-setting');
    hs.className = 'chip' + (set === 'justright' ? ' jr' : '');
    hs.textContent = set === 'today' ? 'Today: one size' : 'Just Right: Regular and Small';
    $('#hud-count').textContent = `Customer ${Math.min(S.idx + 1, S.rush.length)} of ${S.rush.length}`;
    $('#hud-rating').innerHTML = I('star-fill') + (S.idx ? so.rating.toFixed(1) : 'none yet');
    $('#hud-cash').textContent = money(so.revenue);
    const next = S.rush.slice(S.idx + 1, S.idx + 6);
    $('#queue').innerHTML = `<span class="lbl">${next.length ? 'Next' : 'Last customer'}</span>` +
      next.map(q => `<span class="qp" title="${esc(q.name)}">${I(cfg.personas[q.persona].icon)}</span>`).join('');
    const traits = [];
    if (c.rusher) traits.push(I('timer') + 'In a rush');
    if (c.budget) traits.push(I('coins') + 'Budget-minded');
    const cust = $('#customer');
    cust.innerHTML = `<div class="avatar">${I(cfg.personas[c.persona].icon)}</div>
      <div class="name">${esc(c.name)}</div>
      <div class="traits">${traits.map(t => `<span class="trait">${t}</span>`).join('')}</div>
      <div class="speech">“${esc(JR.lineFor(c, cfg, set))}”</div>
      <div class="patience" id="patience" role="progressbar" aria-label="Patience"><div></div></div>`;
    cust.style.display = ''; cust.classList.remove('enter'); void cust.offsetWidth; cust.classList.add('enter');
    $('#feedback').className = 'feedback'; $('#feedback').innerHTML = '';
    const acts = JR.ACTIONS[set];
    const box = $('#actions');
    box.className = 'actions n' + acts.length; box.style.display = '';
    box.innerHTML = acts.map(([k, lab], i) => {
      const price = k === 'small' ? P('regularPrice') - P('discount') : P('regularPrice');
      return `<button data-act="${k}"><span><span class="key">${i + 1}</span>${esc(lab)}</span><span class="price">${money(price)}</span></button>`;
    }).join('');
    box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => serve(b.dataset.act)));
    const R = P('regularRiceG');
    $('#board').innerHTML = `<div class="title">${I('bowl-food')}Menu board</div>` + (set === 'justright'
      ? `<div class="item"><span>Regular, ${R} g rice</span><span>${money(P('regularPrice'))}</span></div>
         <div class="item"><span>Small, ${Math.round(R * P('smallShare'))} g rice</span><span>${money(P('regularPrice') - P('discount'))}</span></div>`
      : `<div class="item"><span>Economy rice</span><span>${money(P('regularPrice'))}</span></div><p class="small muted" style="margin:4px 0 0">One size only.</p>`);
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
      html = `<div class="avatar gone">${I('person-simple-walk')}</div><div class="bub">${esc(c.name)} walked away.</div>
        <p class="muted">Lost sale. The queue was too slow.</p>`;
    } else {
      const m = JR.meal(c, action, cfg, S.setting);
      html = `<div class="plates">${plateSVG(m.served, 'Served')}${plateSVG(m.leftover, 'Came back')}</div>
        <div class="bub">“${esc(JR.bubble(m))}”</div>
        ${stars(m.stars)}
        <p class="muted small">Paid ${money(m.price)}${m.extraCost ? `. Extra vegetables cost you ${money(m.extraCost)}` : ''}.</p>`;
    }
    const last = S.idx + 1 >= S.rush.length;
    html += `<button class="primary btn-ic" id="next-btn" style="margin-top:10px">${last ? 'Close the stall' : 'Next customer'} <span class="kbd">(Space)</span></button>`;
    const fb = $('#feedback');
    fb.innerHTML = html; fb.className = 'feedback on pop';
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
  // pause the patience timer while the tab is hidden, restart it on return
  document.addEventListener('visibilitychange', () => {
    if (!$('#rush').classList.contains('on') || S.showing) return;
    if (document.hidden) stopTimers(); else startTimer();
  });
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
  const grp = (label, cols) => `<tr class="group"><td colspan="${cols}">${label}</td></tr>`;
  function finish() {
    stopTimers();
    const set = S.setting, other = set === 'today' ? 'justright' : 'today', n = S.rush.length;
    const you = JR.runDay(cfg, S.rush, set, S.actions);
    const oth = JR.runDay(cfg, S.rush, other);
    const T = JR.runDay(cfg, S.all, 'today'), J = JR.runDay(cfg, S.all, 'justright');
    const days = JR.runRatingDays(cfg, S.seed, 3);
    const N = S.all.length, be = JR.breakEvenDiscount(cfg);
    const r2 = (label, a, b) => `<tr><td>${label}</td><td class="num">${a}</td><td class="num">${b}</td></tr>`;
    const r3 = (label, a, b, d) => `<tr><td>${label}</td><td class="num">${a}</td><td class="num">${b}</td><td class="num">${d}</td></tr>`;
    const maxC = Math.max(...['today', 'justright', 'shortcut'].flatMap(k => days[k].map(d => d.customers)));
    const semWaste = ((J.plateWasteG + J.unsoldG) - (T.plateWasteG + T.unsoldG)) * SEMESTER_DAYS;
    const semProfit = (J.profit - T.profit) * SEMESTER_DAYS;
    const leftDrop = T.leftFood - J.leftFood;
    const tomorrow = r => Math.round(P('platesPerDay') * Math.max(0.5, Math.min(1.2, 1 + P('ratingSensitivity') * (r - T.rating))));
    $('#report-body').innerHTML = `
      <div class="report-head">
        <h1 style="font-size:clamp(32px,5vw,46px)">Closing time</h1>
        <p class="lede">A simulation built on our survey data and stated assumptions. It shows what would happen if they hold, not real sales.</p>
      </div>

      <div class="card">
        <h2>A full day, ${N} plates</h2>
        <p class="muted small">The same customers under both menus, served the standard way.</p>
        <div class="kpis">
          <div class="kpi"><div class="v">${leftDrop >= 0 ? leftDrop : -leftDrop} ${leftDrop >= 0 ? 'fewer' : 'more'}</div><div class="l">plates with food left under Just Right (${T.leftFood} today, ${J.leftFood} with Just Right)</div></div>
          <div class="kpi"><div class="v">${kg(Math.abs((T.plateWasteG + T.unsoldG) - (J.plateWasteG + J.unsoldG)))}</div><div class="l">${(J.plateWasteG + J.unsoldG) <= (T.plateWasteG + T.unsoldG) ? 'less' : 'more'} rice wasted in the day</div></div>
          <div class="kpi"><div class="v">${money(J.profit - T.profit)}</div><div class="l">change in the vendor's profit</div></div>
        </div>
        <div class="tablewrap"><table>
          <tr><th></th><th class="num">Today</th><th class="num">Just Right</th><th class="num">Change</th></tr>
          ${grp('Environment', 4)}
          ${r3('Rice left on plates', kg(T.plateWasteG), kg(J.plateWasteG), cmp(T.plateWasteG, J.plateWasteG, true, kg))}
          ${r3('Rice cooked but not served', kg(T.unsoldG), kg(J.unsoldG), cmp(T.unsoldG, J.unsoldG, true, kg))}
          ${grp('Society', 4)}
          ${r3('Meals with food left', `${T.leftFood} of ${N}`, `${J.leftFood} of ${N}`, cmp(T.leftFood, J.leftFood, true, x => x))}
          ${r3('Customers who overate', T.stuffed, J.stuffed, cmp(T.stuffed, J.stuffed, true, x => x))}
          ${r3('Customers still hungry', T.hungry, J.hungry, cmp(T.hungry, J.hungry, true, x => x))}
          ${grp('Economy', 4)}
          ${r3('Takings', money(T.revenue), money(J.revenue), cmp(T.revenue, J.revenue, false, money))}
          ${r3('Rice cost', money(T.riceCost), money(J.riceCost), cmp(T.riceCost, J.riceCost, true, money))}
          ${r3('Profit', money(T.profit), money(J.profit), cmp(T.profit, J.profit, false, money))}
          ${r3('Average rating', T.rating.toFixed(2), J.rating.toFixed(2), cmp(T.rating, J.rating, false, x => x.toFixed(2)))}
        </table></div>
        <div class="note ${semProfit < 0 ? 'warn' : 'good'}">Over a 13-week semester at this one stall, Just Right means
          <b>${kg(Math.abs(semWaste))} ${semWaste <= 0 ? 'less' : 'more'} rice wasted</b> and <b>${money(Math.abs(semProfit))} ${semProfit >= 0 ? 'more' : 'less'} profit</b>.
          The Small plate discount is ${money(P('discount'))}; the rice it saves is worth ${money(be)}.</div>
      </div>

      <div class="grid2">
        <div class="card">
          <h2>Your lunch rush</h2>
          <p class="muted small">Your ${n} customers as you served them (${NAMES[set]}), next to the same ${n} served the standard way with ${NAMES[other]}.</p>
          <div class="tablewrap"><table>
            <tr><th></th><th class="num">You, ${NAMES[set]}</th><th class="num">${NAMES[other]}</th></tr>
            ${r2('Served / walked away', `${you.plates} / ${you.walkaways}`, `${oth.plates} / ${oth.walkaways}`)}
            ${r2('Customers who left food', `${you.leftFood} of ${n}`, `${oth.leftFood} of ${n}`)}
            ${r2('Rice left on plates', `${Math.round(you.plateWasteG)} g`, `${Math.round(oth.plateWasteG)} g`)}
            ${r2('Overate / still hungry', `${you.stuffed} / ${you.hungry}`, `${oth.stuffed} / ${oth.hungry}`)}
            ${r2('Small plates sold', you.smallOrders, oth.smallOrders)}
            ${r2('Profit', money(you.profit), money(oth.profit))}
            ${r2('Average rating', you.rating.toFixed(2), oth.rating.toFixed(2))}
            ${r2('Customers tomorrow at this rating', tomorrow(you.rating), tomorrow(oth.rating))}
          </table></div>
          <p class="muted small">Tomorrow's customers use the same rule as the shortcut panel: ${pct(P('ratingSensitivity'))} more or fewer customers per star above or below Today's standard rating (${T.rating.toFixed(2)}).</p>
        </div>
        <div class="card">
          <h2>How ratings drop</h2>
          <p class="muted small">The shortcut: quietly cut every plate to ${pct(P('smallShare'))} of the rice and keep the price. Tomorrow's customers follow today's rating.</p>
          <div class="days">
            ${[0, 1, 2].map(d => `<div class="dayrow"><span>Day ${d + 1}</span><div class="daybars">
              ${['today', 'justright', 'shortcut'].map(k => `<div class="bar ${k === 'today' ? 'today' : k === 'shortcut' ? 'short' : ''}" style="width:${(days[k][d].customers / maxC) * 100}%" title="${NAMES[k]}: ${days[k][d].customers} customers, ${days[k][d].rating.toFixed(1)} stars, ${money(days[k][d].profit)} profit"></div>`).join('')}
            </div></div>`).join('')}
          </div>
          <div class="legend"><span><i style="background:var(--muted)"></i>Today</span><span><i style="background:var(--accent)"></i>Just Right</span><span><i style="background:var(--bad)"></i>Shortcut</span></div>
          <p class="small" style="margin-top:12px">Shortcut: ${days.shortcut[0].customers} customers and ${money(days.shortcut[0].profit)} profit on day 1, then ${days.shortcut[2].customers} customers and ${money(days.shortcut[2].profit)} by day 3, at ${days.shortcut[2].rating.toFixed(1)} stars.</p>
        </div>
      </div>

      <div class="card" style="margin-top:12px">
        <h2>What this does not show</h2>
        <ul class="plain">
          <li>Food left because it tasted bad, or because a student was rushing, is not fixed by a smaller plate. The Picky One still leaves food under Just Right.</li>
          <li>Profit depends heavily on the rice cost per plate (${money(P('riceCostRegular'))} here) and the discount. Our vendor answers on cost are unclear, so try other values on the setup screen.</li>
          <li>How fast ratings change the number of customers is an assumption, used to illustrate the idea.</li>
          <li>Players are not real customers. A pilot at a real stall is what tests this.</li>
        </ul>
      </div>

      <div class="actionsbar">
        <button class="primary btn-ic" id="r-same">${I('arrow-counter-clockwise')}Replay with ${NAMES[other]}</button>
        <button class="btn-ic" id="r-new">${I('calendar-plus')}New day</button>
        <button class="btn-ic" data-go="how">${I('question')}How this works</button>
        <button class="btn-ic" data-go="start">${I('house')}Home</button>
      </div>`;
    $('#r-same').addEventListener('click', () => { S.setting = other; startRush(true); });
    $('#r-new').addEventListener('click', () => { S.seed += 1; go('setup'); });
    go('report');
  }

  // =====================================================================
  // STUDENT MODE
  // =====================================================================
  const ST = { answers: { appetite: 'average', breakfast: 'sometimes', budget: 40 }, profile: null, week: [], weekNo: 1, dayIdx: 0,
    money: 0, choices: [], cur: null, results: {} };
  const QUIZ = [
    ['appetite', 'How much of a normal plate of rice do you usually finish?', [['light', 'About three quarters'], ['average', 'All of it'], ['big', 'All of it, and I could eat more']]],
    ['breakfast', 'How often do you eat breakfast?', [['always', 'Every day'], ['sometimes', 'Some days'], ['rarely', 'Rarely']]],
    ['budget', 'Your food budget for the week', [[30, 'S$30'], [40, 'S$40'], [50, 'S$50']]],
  ];
  $('#go-student').innerHTML = `${I('student')}<span><b>Be the student</b><span class="muted">A week of lunches with a hunger bar and a budget.</span></span>${I('arrow-left', 'flip')}`;
  $('#go-student .flip').style.transform = 'scaleX(-1)';
  $('#s-back-home').innerHTML = I('arrow-left') + 'Home';
  $('#go-student').addEventListener('click', () => { renderQuiz(); go('s-setup'); });
  function renderQuiz() {
    $('#s-quiz').innerHTML = QUIZ.map(([key, q, opts]) => `<fieldset class="quiz"><legend>${esc(q)}</legend><div class="choices">
      ${opts.map(([val, lab]) => `<button type="button" class="choice${ST.answers[key] === val ? ' sel' : ''}" data-q="${key}" data-v="${val}" aria-pressed="${ST.answers[key] === val}">${esc(lab)}</button>`).join('')}
    </div></fieldset>`).join('');
    document.querySelectorAll('#s-quiz .choice').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.q; ST.answers[k] = k === 'budget' ? Number(b.dataset.v) : b.dataset.v; renderQuiz();
    }));
  }
  $('#s-start').addEventListener('click', () => {
    ST.profile = JR.studentProfile(cfg, ST.answers);
    ST.results = {};
    startWeek(1);
  });
  function startWeek(n) {
    ST.weekNo = n; ST.week = JR.studentWeek(cfg, ST.profile); ST.dayIdx = 0; ST.money = ST.profile.budget; ST.choices = []; ST.cur = null;
    go('s-day'); renderDay();
  }
  const BREAKFAST = { skipped: 'You skipped breakfast, so you are hungrier than usual.', normal: 'You had a normal breakfast.', big: 'You had a big breakfast, so you are less hungry.' };
  function sHud() {
    const d = ST.week[ST.dayIdx];
    $('#s-hud').innerHTML = `<span class="chip${ST.weekNo === 2 ? ' jr' : ''}">Week ${ST.weekNo}${ST.weekNo === 2 ? ': Just Right has Small' : ''}</span>
      <span class="chip">${d.day}, day ${ST.dayIdx + 1} of 5</span><span class="spacer"></span>
      <span class="chip">${I('coins')}${money(ST.money)} left</span>`;
  }
  function hungerBar(eaten, need) {
    const max = 1.5, w = x => Math.min(100, (x / max) * 100);
    const r = eaten / need;
    const state = eaten <= 0 ? 'Hungry for lunch' : r < 0.85 ? 'Still hungry' : r > 1.15 ? 'Stuffed' : 'Just right';
    return `<div class="hunger" role="meter" aria-label="Fullness" aria-valuemin="0" aria-valuemax="150" aria-valuenow="${Math.round(r * 100)}" aria-valuetext="${state}">
      <div class="zone" style="left:${w(0.85)}%;width:${w(1.15) - w(0.85)}%"></div>
      <div class="fill ${r > 1.15 ? 'over' : ''}" style="width:${w(r)}%"></div>
      <div class="tick" style="left:${w(1)}%"></div>
    </div><div class="hunger-legend"><span>Empty</span><span>Just right</span><span>Stuffed</span></div>
    <p class="state ${r > 1.15 ? 'worse' : r >= 0.85 ? 'better' : ''}">${state}</p>`;
  }
  function renderDay() {
    sHud();
    const d = ST.week[ST.dayIdx], stalls = JR.studentStalls(cfg, ST.weekNo);
    const tags = [d.lecture ? `${I('student')}2 pm lecture` : '', d.rush ? `${I('timer')}Only ${cfg.student.rushWindowMin} minutes for lunch` : ''].filter(Boolean);
    $('#s-body').innerHTML = `
      <div class="card enter">
        <h2>${d.day}: where do you eat?</h2>
        <p class="muted">${BREAKFAST[d.breakfast]}</p>
        <div class="traits" style="justify-content:flex-start">${tags.map(t => `<span class="trait">${t}</span>`).join('')}</div>
        ${hungerBar(0, d.needG)}
      </div>
      <div class="stalls">${stalls.map(s => `
        <div class="card stallcard">
          <div class="row" style="gap:10px;align-items:flex-start"><div class="avatar sm">${I(s.icon)}</div>
            <div style="flex:1"><b>${esc(s.name)}</b><p class="muted small" style="margin:2px 0">${esc(s.blurb)}</p>
            <p class="small" style="margin:0">${I('star-fill')} ${s.stars.toFixed(1)}  ·  ${I('timer')} ${s.queueMin} min queue</p></div></div>
          <div class="opts">${s.options.map(o => `<button class="btn-ic" data-stall="${s.id}" data-size="${o.size}" ${o.price > ST.money + 1e-9 ? 'disabled' : ''}>
            <span>${esc(o.label)}, ${o.g} g${o.size === 'small' ? ' <span class="newtag">New</span>' : ''}</span><span class="price">${money(o.price)}</span></button>`).join('')}</div>
        </div>`).join('')}</div>
      <p style="margin-top:12px"><button class="link" id="s-skip">Skip lunch today</button></p>`;
    document.querySelectorAll('#s-body [data-stall]').forEach(b => b.addEventListener('click', () => order(b.dataset.stall, b.dataset.size)));
    $('#s-skip').addEventListener('click', () => { ST.cur = { stall: JR.SKIP, option: JR.SKIP.options[0], eaten: 0, cap: 0 }; stopEating(); });
    window.scrollTo(0, 0);
  }
  function order(stallId, size) {
    const d = ST.week[ST.dayIdx], stall = JR.studentStalls(cfg, ST.weekNo).find(s => s.id === stallId);
    const option = stall.options.find(o => o.size === size);
    if (option.price > ST.money + 1e-9) return;
    ST.money = round2(ST.money - option.price);
    ST.cur = { stall, option, eaten: 0, cap: Math.min(option.g, JR.maxEatG(cfg, d, stall)) };
    renderEat();
  }
  const round2 = x => Math.round(x * 100) / 100;
  function renderEat(msg) {
    sHud();
    const d = ST.week[ST.dayIdx], c = ST.cur, onPlate = c.option.g - c.eaten;
    const timeLeft = d.rush ? Math.max(0, Math.round((c.cap - c.eaten) / cfg.student.biteG)) : null;
    $('#s-body').innerHTML = `
      <div class="card eat">
        <h2>${esc(c.stall.name)}: ${esc(c.option.label.toLowerCase())}, ${c.option.g} g</h2>
        <div class="plates" style="margin:8px 0">${plateSVG(onPlate, 'On your plate', 150)}</div>
        ${hungerBar(c.eaten, d.needG)}
        ${d.rush ? `<p class="small">${I('timer')} ${timeLeft} ${timeLeft === 1 ? 'minute' : 'minutes'} of eating time left.</p>` : ''}
        ${msg ? `<p class="note">${esc(msg)}</p>` : ''}
        <div class="eat-actions">
          <button class="primary btn-ic" id="bite" ${c.eaten >= c.cap - 1e-9 ? 'disabled' : ''}>${I('plus')}Take a bite <span class="kbd">(Space)</span></button>
          <button class="btn-ic" id="finish" ${c.eaten >= c.cap - 1e-9 ? 'disabled' : ''}>Finish the plate</button>
          <button class="btn-ic" id="stop">${I('check')}Stop eating <span class="kbd">(Enter)</span></button>
        </div>
      </div>`;
    $('#bite').addEventListener('click', bite);
    $('#finish').addEventListener('click', () => { c.eaten = c.cap; afterBite(); });
    $('#stop').addEventListener('click', stopEating);
  }
  function bite() { const c = ST.cur; if (!c) return; c.eaten = Math.min(c.cap, c.eaten + cfg.student.biteG); afterBite(); }
  function afterBite() {
    const d = ST.week[ST.dayIdx], c = ST.cur;
    if (c.eaten >= c.cap - 1e-9 && c.cap < c.option.g) return renderEat(d.rush ? 'Time is up. Class starts, so you leave the rest.' : '');
    if (c.eaten >= c.option.g - 1e-9) return renderEat('Plate finished.');
    renderEat();
  }
  function stopEating() {
    const d = ST.week[ST.dayIdx], c = ST.cur;
    const meal = JR.studentMeal(cfg, d, c.stall, c.option, c.eaten);
    const pm = JR.afternoon(cfg, d, meal, ST.money);
    ST.money = round2(ST.money - pm.snack);
    ST.choices.push({ stallId: c.stall.id, size: c.option.size, eatenG: c.eaten });
    ST.cur = null;
    sHud();
    const last = ST.dayIdx === 4;
    $('#s-body').innerHTML = `
      <div class="card pop">
        <h2>${d.day} afternoon</h2>
        <div class="plates" style="margin:8px 0">${plateSVG(meal.left, 'Left on the plate', 130)}</div>
        <p class="bub" style="font-size:19px;font-weight:620;text-align:center">${esc(pm.text)}</p>
        <div class="kpis k3">
          <div class="kpi"><div class="v">${pct(meal.ratio)}</div><div class="l">of what you needed</div></div>
          <div class="kpi"><div class="v">${Math.round(meal.left)} g</div><div class="l">rice left</div></div>
          <div class="kpi"><div class="v">${pm.focus}</div><div class="l">focus out of 100</div></div>
        </div>
        ${pm.snack ? `<p class="muted small">Snack: ${money(pm.snack)}.</p>` : ''}
        <button class="primary" id="s-next" style="width:100%;margin-top:10px">${last ? 'See your week' : 'Next day'} <span class="kbd">(Space)</span></button>
      </div>`;
    $('#s-next').addEventListener('click', nextDay);
    $('#s-next').focus({ preventScroll: true });
  }
  function nextDay() {
    if (ST.dayIdx < 4) { ST.dayIdx++; renderDay(); return; }
    ST.results[ST.weekNo] = JR.runStudentWeek(cfg, ST.profile, ST.weekNo, ST.choices);
    renderWeekReport();
  }
  document.addEventListener('keydown', e => {
    if (!$('#s-day').classList.contains('on')) return;
    if (ST.cur && e.key === ' ') { e.preventDefault(); if (!$('#bite').disabled) bite(); return; }
    if (ST.cur && e.key === 'Enter') { e.preventDefault(); stopEating(); return; }
    if (!ST.cur && (e.key === ' ' || e.key === 'Enter') && $('#s-next')) { e.preventDefault(); nextDay(); }
  });
  function renderWeekReport() {
    const w1 = ST.results[1], w2 = ST.results[2];
    const row = (label, f, fmt, lowerBetter) => `<tr><td>${label}</td><td class="num">${fmt(f(w1))}</td>${w2 ? `<td class="num">${fmt(f(w2))}</td><td class="num">${cmp(f(w1), f(w2), lowerBetter, fmt)}</td>` : ''}</tr>`;
    const id = x => x, g = x => Math.round(x) + ' g', of5 = x => x + ' of 5';
    const dayList = r => r.days.map(d => `<tr><td>${d.day.day}</td><td>${esc(d.stall)}${d.size === 'small' ? ', Small' : ''}</td><td class="num">${Math.round(d.meal.left)} g</td><td>${d.meal.fullness === 'right' ? 'Just right' : d.meal.fullness === 'hungry' ? 'Still hungry' : 'Stuffed'}</td></tr>`).join('');
    $('#s-report-body').innerHTML = `
      <div class="report-head"><h1 style="font-size:clamp(32px,5vw,46px)">${w2 ? 'Week 1 against week 2' : 'Your week'}</h1>
        <p class="lede">${w2 ? 'The same five days. In week 2 the Just Right stall offered a Small plate.' : 'Five lunches. Here is what they added up to.'}</p></div>
      <div class="card">
        <div class="tablewrap"><table>
          <tr><th></th><th class="num">Week 1</th>${w2 ? '<th class="num">Week 2</th><th class="num">Change</th>' : ''}</tr>
          ${grp('Waste', w2 ? 4 : 2)}
          ${row('Meals with food left', r => r.leftMeals, of5, true)}
          ${row('Rice left over the week', r => r.leftG, g, true)}
          ${grp('You', w2 ? 4 : 2)}
          ${row('Lunches that were just right', r => r.right, of5, false)}
          ${row('Days you overate', r => r.stuffed, of5, true)}
          ${row('Days you were still hungry', r => r.hungry, of5, true)}
          ${row('Average afternoon focus', r => Math.round(r.focus), id, false)}
          ${grp('Money', w2 ? 4 : 2)}
          ${row('Spent, including snacks', r => r.spent, money, true)}
        </table></div>
      </div>
      <div class="grid2">
        <div class="card"><h2>Week ${w2 ? 2 : 1}, day by day</h2><div class="tablewrap"><table>
          <tr><th>Day</th><th>Where</th><th class="num">Left</th><th>Afterwards</th></tr>${dayList(w2 || w1)}</table></div></div>
        <div class="card">${w2 ? `
          <h2>Now the real you</h2>
          <p>Of your last 5 canteen meals, on how many did you leave rice or noodles?</p>
          <div class="choices" id="real-you">${[0, 1, 2, 3, 4, 5].map(n => `<button class="choice" data-n="${n}">${n}</button>`).join('')}</div>
          <p class="muted small" id="real-you-out">Nothing you tap here is saved or sent.</p>` : `
          <h2>Try the same week again</h2>
          <p>Same days, same appetite, same budget. This time the Just Right stall also sells a Small plate for ${money(P('regularPrice') - P('discount'))}.</p>
          <p class="muted small">Not every leftover is about size. A rushed lunch or a long queue still costs you.</p>`}
        </div>
      </div>
      <div class="actionsbar">
        ${w2 ? `<button class="primary btn-ic" id="s-again">${I('arrow-counter-clockwise')}Play the week again</button>` : `<button class="primary btn-ic" id="s-week2">${I('arrow-counter-clockwise')}Replay with Just Right</button>`}
        <button class="btn-ic" id="s-new">${I('calendar-plus')}New answers</button>
        <button class="btn-ic" data-go="how">${I('question')}How this works</button>
        <button class="btn-ic" data-go="start">${I('house')}Home</button>
      </div>`;
    if ($('#s-week2')) $('#s-week2').addEventListener('click', () => startWeek(2));
    if ($('#s-again')) $('#s-again').addEventListener('click', () => { ST.results = {}; startWeek(1); });
    $('#s-new').addEventListener('click', () => { renderQuiz(); go('s-setup'); });
    document.querySelectorAll('#real-you .choice').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#real-you .choice').forEach(x => x.classList.toggle('sel', x === b));
      const n = Number(b.dataset.n);
      $('#real-you-out').textContent = `You said ${n} of 5 in real life. In the game you left food on ${w1.leftMeals} of 5 days in week 1 and ${w2.leftMeals} of 5 in week 2. Nothing you tap here is saved or sent.`;
    }));
    go('s-report');
  }

  // ---------- how this works
  function fmtVal(p) {
    if (p.unit === 'choice') return (p.options.find(o => o[0] === p.value) || [, p.value])[1];
    if (p.unit === '%') return pct(p.value);
    if (p.unit === 'S$') return money(p.value);
    return `${Math.round(p.value * 100) / 100}${p.unit ? ' ' + p.unit : ''}`;
  }
  const GROUPS = [
    ['survey', 'From our student survey', 'Wave 1, 22 responses.'],
    ['vendor', 'From our vendor survey', 'Early answers. To confirm before quoting.'],
    ['assumption', 'Assumptions', 'No data yet. The pilot and photo audit should replace these.'],
  ];
  function renderHow() {
    const ps = cfg.params;
    const paramRow = k => {
      const p = ps[k];
      let ctl = '';
      if (p.editable && p.unit === 'choice') ctl = `<select data-key="${k}" aria-label="${esc(p.label)}">${p.options.map(o => `<option value="${o[0]}" ${o[0] === p.value ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
      else if (p.editable) ctl = `<input type="range" data-key="${k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}" aria-label="${esc(p.label)}">`;
      return `<div class="param"><div>${esc(p.label)}</div><div><span class="val" id="hv-${k}">${fmtVal(p)}</span>${ctl}</div><div class="muted small">${esc(p.source)}</div></div>`;
    };
    const groups = GROUPS.map(([st, title, sub]) => {
      const keys = Object.keys(ps).filter(k => ps[k].status === st);
      return `<div class="paramgroup"><h3><span class="status ${st}">${keys.length}</span>${title}</h3><p class="muted small" style="margin-top:0">${sub}</p>${keys.map(paramRow).join('')}</div>`;
    }).join('');
    const pers = Object.values(cfg.personas).map(p => `<li>${I(p.icon)} <b>${esc(p.name)}</b> wants ${pct(p.appetite[0])} to ${pct(p.appetite[1])} of a Regular plate${p.cleanPlater ? ' and finishes everything' : ''}.</li>`).join('');
    const w = JR.personaWeights(cfg).map(([k, x]) => `${cfg.personas[k].name} ${pct(x)}`).join(', ');
    $('#how-body').innerHTML = `
      <h1 style="font-size:clamp(32px,5vw,46px);margin-top:8px">How this works</h1>
      <div class="grid2">
        <div class="card">
          <h2>The model</h2>
          <p>Every customer has a hidden appetite. They eat what they want and leave the rest, unless they are a Clean-Plater, who finishes everything and overeats instead. Taste letdowns and rushing make people leave food whatever the plate size.</p>
          <p><b>Today</b> has one size: light eaters who speak up ask for less rice, quiet ones get a Regular. <b>Just Right</b> puts Regular and Small on the board, so everyone can point at the size that fits. Both use exactly the same customers, so any difference comes from the menu, not luck.</p>
          <p>Profit is takings minus rice cost minus everything else on the plate. A Small plate breaks even when the discount is no more than the rice it saves: rice cost × (1 − Small share) × (1 + cooking buffer), which is <b>${money(JR.breakEvenDiscount(cfg))}</b> with the current settings.</p>
          <p>Customers score each meal from 1 to 5 stars: up for "just nice", down for still hungry, overeating, a taste letdown, or feeling short-changed. In the shortcut, tomorrow's customers rise or fall with today's rating.</p>
          <p class="muted small">${esc(cfg.calibration)}</p>
        </div>
        <div class="card">
          <h2>The customers</h2>
          <p class="small muted">Mix from our survey, with big eaters added: ${esc(w)}.</p>
          <ul class="plain small">${pers}</ul>
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <h2>Student mode</h2>
        <p class="small">You have a hidden appetite: ${Object.entries(cfg.student.appetite).map(([k, x]) => `${k} ${pct(x)}`).join(', ')} of a Regular plate. Breakfast changes it: skipped ${pct(cfg.student.breakfastEffect.skipped)}, normal ${pct(cfg.student.breakfastEffect.normal)}, big ${pct(cfg.student.breakfastEffect.big)}. A lunch is just right between 85% and 115% of what you need; below that you are still hungry and buy a ${money(cfg.student.snackPrice)} snack if you can; above it you are stuffed, which hurts most on a 2 pm lecture day. On Thursday you have ${cfg.student.rushWindowMin} minutes for lunch, so a long queue leaves less time to eat.</p>
        <div class="tablewrap"><table>
          <tr><th>Stall</th><th class="num">Plate</th><th class="num">Price</th><th class="num">Queue</th><th class="num">Stars</th></tr>
          ${JR.studentStalls(cfg, 2).map(x => `<tr><td>${esc(x.name)}</td><td class="num">${x.options.map(o => o.g + ' g').join(', ')}</td><td class="num">${x.options.map(o => money(o.price)).join(', ')}</td><td class="num">${x.queueMin} min</td><td class="num">${x.stars.toFixed(1)}</td></tr>`).join('')}
        </table></div>
        <p class="muted small">All student-mode numbers are assumptions for the game, not survey data. The Standard and Just Right use the vendor settings below, so both modes agree.</p>
      </div>
      <div class="card" style="margin-top:12px">
        <h2>Every number</h2>
        <p class="muted small">Sliders change the game on this device only.</p>
        ${groups}
        <button id="reset" class="btn-ic" style="margin-top:12px">${I('arrow-counter-clockwise')}Reset to defaults</button>
      </div>`;
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
