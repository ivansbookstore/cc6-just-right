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

  // ---------- settings: every visit starts from our defaults. Slider changes last until the page is reloaded,
  // so one Showcase visitor's settings never carry over to the next. (Older builds saved them; clear that copy.)
  const STORE = 'jr-params-v1';
  const freshCfg = () => JSON.parse(JSON.stringify(window.JR_CONFIG));
  let cfg = freshCfg();
  try { localStorage.removeItem(STORE); } catch (e) { /* storage blocked: nothing to clear */ }
  function saveParams() { /* kept for the callers; settings are deliberately not stored */ }
  const P = k => cfg.params[k].value;

  // a new queue every game: ?seed=123 in the address replays a given queue
  const newSeed = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0; } catch (e) { return Math.floor(Math.random() * 4294967295); } };
  const urlSeed = (() => { try { const x = parseInt(new URLSearchParams(location.search).get('seed'), 10); return isFinite(x) ? x >>> 0 : null; } catch (e) { return null; } })();
  const S = { setting: 'today', seed: urlSeed != null ? urlSeed : newSeed(), all: [], rush: [], actions: [], idx: 0, timer: null, left: 0, prev: 'start', showing: false, nextTimer: null };

  // ---------- small pieces
  function stars(r) {
    const n = Math.round(r);
    let h = '';
    for (let i = 0; i < 5; i++) h += `<span class="st" style="--i:${i}">${I('star-fill', i < n ? '' : 'off')}</span>`;
    return `<span class="stars" role="img" aria-label="${r.toFixed(1)} out of 5 stars">${h}</span>`;
  }
  const rxOf = g => { const R = P('regularRiceG'); return g <= 0 ? 0 : 10 + 26 * Math.sqrt(Math.min(g, R * 1.5) / (R * 1.5)); };
  // fromG: draw the heap at fromG and animate it shrinking to grams (someone eating it)
  function plateSVG(grams, label, size, fromG, quick) {
    const w = size || 110, h = Math.round(w * 0.72);
    const anim = fromG != null && fromG > grams;
    const rx = rxOf(anim ? fromG : grams), to = anim && rx ? rxOf(grams) / rx : 1;
    return `<figure><svg width="${w}" height="${h}" viewBox="0 0 110 80" role="img" aria-label="${esc(label)}: ${Math.round(grams)} grams of rice">
      <ellipse cx="55" cy="46" rx="50" ry="28" fill="var(--plate)" stroke="var(--plate-edge)" stroke-width="2"/>
      <ellipse cx="55" cy="46" rx="38" ry="20" fill="none" stroke="var(--plate-edge)" stroke-width="1" opacity=".6"/>
      ${rx ? `<ellipse class="heap${anim ? ' eat' + (quick ? ' quick' : '') : ''}" style="--to:${to.toFixed(3)}" cx="55" cy="${44 - rx * 0.15}" rx="${rx}" ry="${rx * 0.55}" fill="var(--rice)" stroke="var(--rice-edge)" stroke-width="1.5"/>` : ''}
    </svg><figcaption>${esc(label)}: ${Math.round(grams)} g</figcaption></figure>`;
  }

  // ---------- effects: sound, floating numbers, confetti, count-ups. All motion is skipped when the device asks for reduced motion.
  const SND = window.JR_SOUND || { play() {}, sfxOn: () => false, musicOn: () => false, setSfx() {}, setMusic() {} };
  const RM = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const later = (ms, f) => setTimeout(f, RM() ? 0 : ms);
  function floatText(anchor, text, bad) {
    if (!anchor || RM()) return;
    const r = anchor.getBoundingClientRect(), el = document.createElement('div');
    el.className = 'floaty' + (bad ? ' bad' : ''); el.textContent = text;
    el.style.left = (r.left + r.width / 2 + window.scrollX) + 'px'; el.style.top = (r.top + window.scrollY - 4) + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 1100);
  }
  function bump(el) { if (!el || RM()) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function confetti(anchor, n) {
    if (!anchor || RM()) return;
    const r = anchor.getBoundingClientRect(), cx = r.left + r.width / 2 + window.scrollX, cy = r.top + Math.min(r.height, 120) / 2 + window.scrollY;
    const colours = ['var(--accent)', 'var(--rice-edge)', 'var(--accent-line)', 'var(--muted)'];
    for (let i = 0; i < (n || 28); i++) {
      const el = document.createElement('div'), a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 120;
      el.className = 'confetti';
      el.style.left = cx + 'px'; el.style.top = cy + 'px';
      el.style.setProperty('--dx', Math.cos(a) * d + 'px'); el.style.setProperty('--dy', (Math.sin(a) * d - 40) + 'px');
      el.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg'); el.style.setProperty('--c', colours[i % colours.length]);
      document.body.appendChild(el); setTimeout(() => el.remove(), 1200);
    }
  }
  function countUp(root) {
    if (RM()) return;
    root.querySelectorAll('[data-count]').forEach(el => {
      const target = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), pre = el.dataset.pre || '', suf = el.dataset.suf || '', t0 = performance.now(), dur = 800;
      const tick = now => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = target * e;
        el.textContent = pre + Math.abs(v).toFixed(dec) + suf;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  // a soft click on ordinary buttons; buttons with their own sound are marked data-nosound
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && !b.disabled && !b.closest('[data-nosound]')) SND.play('click');
  }, true);
  // sound and music switches
  const bar = document.createElement('div');
  bar.className = 'soundbar';
  bar.innerHTML = `<button id="snd-sfx" data-nosound></button><button id="snd-music" data-nosound></button>`;
  document.body.appendChild(bar);
  function renderSoundbar() {
    const sf = $('#snd-sfx'), mu = $('#snd-music');
    sf.innerHTML = I(SND.sfxOn() ? 'speaker-high' : 'speaker-slash'); sf.setAttribute('aria-pressed', SND.sfxOn());
    sf.setAttribute('aria-label', 'Sound effects ' + (SND.sfxOn() ? 'on' : 'off')); sf.title = sf.getAttribute('aria-label');
    mu.innerHTML = I(SND.musicOn() ? 'music-notes' : 'music-notes-minus'); mu.setAttribute('aria-pressed', SND.musicOn());
    mu.setAttribute('aria-label', 'Music ' + (SND.musicOn() ? 'on' : 'off')); mu.title = mu.getAttribute('aria-label');
  }
  $('#snd-sfx').addEventListener('click', () => { SND.setSfx(!SND.sfxOn()); renderSoundbar(); });
  $('#snd-music').addEventListener('click', () => { SND.setMusic(!SND.musicOn()); renderSoundbar(); });
  renderSoundbar();

  // ---------- static labels with icons
  $('#brandmark').innerHTML = I('bowl-food') + 'Just Right';
  $('#go-vendor').innerHTML = `${I('storefront')}<span><b>Be the vendor</b><span class="muted">Serve a lunch rush, then read the closing report.</span></span>${I('arrow-left', 'flip')}`;
  $('#go-vendor .flip').style.transform = 'scaleX(-1)';
  $('#how-link').innerHTML = I('question') + 'How this works, and where every number comes from';
  $('#back-home').innerHTML = I('arrow-left') + 'Home';
  $('#back-how').innerHTML = I('arrow-left') + 'Back';

  // ---------- build label, bottom right. If the page and the scripts disagree, the browser is showing an old cached copy.
  (() => {
    const meta = document.querySelector('meta[name="jr-build"]'), page = meta ? meta.content : '?', js = cfg.build || '?';
    const el = document.createElement('div'); el.className = 'build'; el.setAttribute('aria-label', 'Build version');
    el.textContent = page === js ? `Build ${js}` : `Build ${page} / scripts ${js}: refresh`;
    if (page !== js) el.classList.add('stale');
    document.body.appendChild(el);
  })();

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
        <div><b>Today</b>${plateSVG(t.leftover, 'Came back', 120, t.served)}<p class="small muted">Paid ${money(t.price)}</p></div>
        <div><b>Just Right</b>${plateSVG(j.leftover, 'Came back', 120, j.served)}<p class="small muted">Paid ${money(j.price)}</p></div>
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
    document.dispatchEvent(new CustomEvent('jr:screen', { detail: id }));
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
  // the Just Right defaults: 150 g Small and a discount set by the rice-saving rule (see config.js)
  const isBestCase = () => ['smallShare', 'discount'].every(k => Math.abs(cfg.params[k].value - window.JR_CONFIG.defaults[k].value) < 1e-9);
  function bestCaseLine() {
    const D = window.JR_CONFIG.defaults;
    return isBestCase()
      ? `<p class="muted small">Our default: a Small of ${pct(D.smallShare.value)} of Regular, and a discount set by our rule: the biggest survey price step (S$0.20 or S$0.30) that the rice saved still covers. Here that is ${money(D.discount.value)}. Set it to S$0 for "same price, less rice".</p>`
      : `<p class="small"><button class="link small" id="best-case">${I('sparkle')}Back to our default (${pct(D.smallShare.value)} Small, ${money(D.discount.value)} off)</button></p>`;
  }
  function bindBestCase(after) {
    const b = document.getElementById('best-case');
    if (b) b.addEventListener('click', () => { ['smallShare', 'discount'].forEach(k => { cfg.params[k].value = window.JR_CONFIG.defaults[k].value; }); after(); });
  }
  function renderSetupNote() {
    const be = JR.breakEvenDiscount(cfg), d = P('discount');
    let n;
    if (S.setting === 'justright') {
      const diff = be - d;
      n = `<div class="note ${diff < 0 ? 'warn' : 'good'}">Rice saved on one Small plate: <b>${money(be)}</b>. Your discount: <b>${money(d)}</b>.
        ${diff >= 0 ? `Each Small plate earns you ${money(diff)} more than a Regular.` : `Each Small plate earns you ${money(-diff)} less than a Regular, so you need more customers or a better rating to make it up.`}</div>
        ${bestCaseLine()}`;
    } else {
      const resp = P('todayLessResponse') === 'lessVeg' ? 'give less rice and add some vegetables, which is what most vendors told us they do' : 'give less rice at the same price';
      n = `<div class="note">When a student asks for less rice, you decide. Standard play is to ${resp}. Students who say nothing get a Regular plate.</div>`;
    }
    $('#setup-note').innerHTML = n;
    bindBestCase(() => renderSetup());
  }
  document.querySelectorAll('.toggle button').forEach(b => b.addEventListener('click', () => { S.setting = b.dataset.setting; renderSetup(); }));
  $('#start-rush').addEventListener('click', () => startRush());

  // ---------- rush
  function startRush(sameCustomers) {
    if (!sameCustomers) {
      if (S.played && urlSeed == null) S.seed = newSeed();    // fresh customers every new game; replays keep the same queue
      S.played = true;
      S.all = JR.makeCustomers(cfg, S.seed, P('platesPerDay'));
    }
    S.rush = S.all.slice(0, P('rushCustomers'));
    S.actions = []; S.idx = 0; S.showing = false;
    go('rush'); renderRush(); startTimer();
  }
  function stopTimers() { clearInterval(S.timer); clearTimeout(S.nextTimer); S.timer = null; }
  function startTimer() {
    stopTimers();
    const c0 = S.rush[S.idx], full = P('patienceSec') * ((c0 && c0.patience) || 1);
    S.left = full;
    S.timer = setInterval(() => {
      S.left -= 0.1;
      const frac = Math.max(0, S.left / full);
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
      next.map(q => `<span class="qp" title="${esc((q.first ? q.first + ', ' : '') + q.name)}">${I(cfg.personas[q.persona].icon)}</span>`).join('');
    const traits = [];
    if (c.rusher) traits.push(I('timer') + 'In a rush');
    if (c.budget) traits.push(I('coins') + 'Budget-minded');
    const cust = $('#customer');
    cust.innerHTML = `<div class="avatar">${I(cfg.personas[c.persona].icon)}</div>
      <div class="name">${esc(c.first || c.name)}</div>${c.first ? `<div class="ptype">${esc(c.name)}</div>` : ''}
      <div class="traits">${traits.map(t => `<span class="trait">${t}</span>`).join('')}</div>
      <div class="speech">“${esc(JR.lineFor(c, cfg, set))}”</div>
      <div class="patience" id="patience" role="progressbar" aria-label="Patience"><div></div></div>`;
    cust.style.display = ''; cust.classList.remove('enter'); void cust.offsetWidth; cust.classList.add('enter');
    $('#feedback').className = 'feedback'; $('#feedback').innerHTML = '';
    const acts = JR.actionsFor(cfg, set);
    const box = $('#actions');
    box.className = 'actions n' + acts.length; box.style.display = ''; box.setAttribute('data-nosound', '');
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
    const cust = $('#customer');
    cust.classList.remove('enter'); cust.classList.add('leaving');
    let html, after;
    if (action === null) {
      html = `<div class="avatar gone">${I('person-simple-walk')}</div><div class="bub">${esc(c.first || c.name)} walked away.</div>
        <p class="muted">Lost sale. The queue was too slow.</p>`;
      SND.play('walk');
      after = () => { floatText($('#hud-rating'), 'Lost sale', true); };
    } else {
      const m = JR.meal(c, action, cfg, S.setting);
      html = `<div class="plates">${plateSVG(m.served, 'Served')}${plateSVG(m.leftover, 'Came back', 110, m.served)}</div>
        <div class="bub">“${esc(JR.bubble(m))}”</div>
        ${stars(m.stars)}
        <p class="muted small">Paid ${money(m.price)}${m.extraCost ? `. Extra vegetables cost you ${money(m.extraCost)}` : ''}.</p>`;
      SND.play('serve');
      const so = JR.runDay(cfg, S.rush.slice(0, S.idx + 1), S.setting, S.actions);
      after = () => {
        $('#hud-cash').textContent = money(so.revenue); bump($('#hud-cash'));
        floatText($('#hud-cash'), '+' + money(m.price));
        SND.play('coin');
        later(500, () => SND.play(m.stars >= 4.3 ? 'good' : m.stars >= 3 ? 'ok' : 'bad'));
      };
    }
    const last = S.idx + 1 >= S.rush.length;
    html += `<button class="primary btn-ic" id="next-btn" style="margin-top:10px">${last ? 'Close the stall' : 'Next customer'} <span class="kbd">(Space)</span></button>`;
    const token = S.idx;
    later(170, () => {
      if (S.idx !== token || !S.showing) return;      // player already moved on
      cust.style.display = 'none'; cust.classList.remove('leaving');
      const fb = $('#feedback');
      fb.innerHTML = html; fb.className = 'feedback on pop';
      $('#next-btn').addEventListener('click', next);
      $('#next-btn').focus({ preventScroll: true });
      after();
    });
    S.nextTimer = setTimeout(next, action === null ? 2400 : 2900);
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
      const a = JR.actionsFor(cfg, S.setting)[parseInt(e.key, 10) - 1];
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
    // baseline: the same rush customers served the standard way under Today, so standard play gives exactly today's customers
    const baseRating = JR.runDay(cfg, S.rush, 'today').rating;
    const tomorrow = r => Math.round(P('platesPerDay') * Math.max(0.5, Math.min(1.2, 1 + P('ratingSensitivity') * (r - baseRating))));
    $('#report-body').innerHTML = `
      <div class="report-head">
        <h1 style="font-size:clamp(32px,5vw,46px)">Closing time</h1>
        <p class="lede">A simulation built on our survey data and stated assumptions. It shows what would happen if they hold, not real sales.</p>
      </div>

      <div class="card">
        <h2>A full day, ${N} plates</h2>
        <p class="muted small">The same customers under both menus, served the standard way.</p>
        <div class="kpis">
          <div class="kpi"><div class="v"><span data-count="${Math.abs(leftDrop)}">${Math.abs(leftDrop)}</span> ${leftDrop >= 0 ? 'fewer' : 'more'}</div><div class="l">plates with food left under Just Right (${T.leftFood} today, ${J.leftFood} with Just Right)</div></div>
          <div class="kpi"><div class="v"><span data-count="${(Math.abs((T.plateWasteG + T.unsoldG) - (J.plateWasteG + J.unsoldG)) / 1000).toFixed(2)}" data-dec="2" data-suf=" kg">${kg(Math.abs((T.plateWasteG + T.unsoldG) - (J.plateWasteG + J.unsoldG)))}</span></div><div class="l">${(J.plateWasteG + J.unsoldG) <= (T.plateWasteG + T.unsoldG) ? 'less' : 'more'} rice wasted in the day</div></div>
          <div class="kpi"><div class="v"><span data-count="${Math.abs(J.profit - T.profit).toFixed(2)}" data-dec="2" data-pre="${J.profit - T.profit < 0 ? '−' : ''}S$">${money(J.profit - T.profit)}</span></div><div class="l">change in the vendor's profit</div></div>
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
          <p class="muted small">Tomorrow's customers: ${pct(P('ratingSensitivity'))} more or fewer per star above or below the rating these same ${S.rush.length} customers give under Today when served the standard way (${baseRating.toFixed(2)}).</p>
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
      </div>
      <p class="muted small" style="margin-top:10px">Queue number ${S.seed}. "New day" brings a fresh queue; "Replay" keeps these customers.</p>`;
    $('#r-same').addEventListener('click', () => { S.setting = other; startRush(true); });
    $('#r-new').addEventListener('click', () => go('setup'));
    go('report');
    SND.play('fanfare');
    countUp($('#report-body'));
    if (you.rating >= 4) later(250, () => confetti($('#report-body h1'), 34));
  }

  // =====================================================================
  // STUDENT MODE
  // =====================================================================
  const ST = { answers: { q5: 'Sometimes', breakfast: 'sometimes', budget: 40 }, real: {}, standFrom: 'start', profile: null, week: [], weekNo: 1, dayIdx: 0,
    money: 0, choices: [], cur: null, results: {} };
  const QUIZ = [
    ['q5', ((window.JR_SURVEY || {}).questions || {}).q5 ? window.JR_SURVEY.questions.q5.text + ' (from our survey)' : 'How often is the standard portion larger than what you need?', ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'].map(x => [x, x])],
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
    if (ST.profile.q5) ST.real.q5 = ST.profile.q5;          // "Where you stand" shows the answer you played with
    go('s-day'); renderDay();
  }
  const BREAKFAST = { skipped: 'You skipped breakfast, so you are hungrier than usual.', normal: 'You had a normal breakfast.', big: 'You had a big breakfast, so you are less hungry.' };
  function sHud() {
    const d = ST.week[ST.dayIdx];
    $('#s-hud').innerHTML = `<span class="chip${ST.weekNo === 2 ? ' jr' : ''}">Week ${ST.weekNo}${ST.weekNo === 2 ? ': every stall has Small' : ''}</span>
      <span class="chip">${d.day}, day ${ST.dayIdx + 1} of 5</span><span class="spacer"></span>
      <span class="chip">${I('coins')}${money(ST.money)} left</span>`;
  }
  function hungerBar(eaten, need, prev) {
    const max = 1.5, w = x => Math.min(100, (x / max) * 100);
    const r = eaten / need, r0 = prev == null || RM() ? r : prev / need;
    const state = eaten <= 0 ? 'Hungry for lunch' : r < 0.85 ? 'Still hungry' : r > 1.15 ? 'Stuffed' : 'Just right';
    return `<div class="hunger" role="meter" aria-label="Fullness" aria-valuemin="0" aria-valuemax="150" aria-valuenow="${Math.round(r * 100)}" aria-valuetext="${state}">
      <div class="zone" style="left:${w(0.85)}%;width:${w(1.15) - w(0.85)}%"></div>
      <div class="fill ${r > 1.15 ? 'over' : ''}" style="width:${w(r0)}%" data-to="${w(r)}%"></div>
      <div class="tick" style="left:${w(1)}%"></div>
    </div><div class="hunger-legend"><span>Empty</span><span>Just right</span><span>Stuffed</span></div>
    <p class="state ${r > 1.15 ? 'worse' : r >= 0.85 ? 'better' : ''}">${state}</p>`;
  }
  function animateFills() {
    document.querySelectorAll('.hunger .fill[data-to]').forEach(f => requestAnimationFrame(() => requestAnimationFrame(() => { f.style.width = f.dataset.to; })));
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
      <p style="margin-top:12px"><button class="link" id="s-skip" data-nosound>Skip lunch today</button></p>`;
    document.querySelectorAll('#s-body .opts').forEach(o => o.setAttribute('data-nosound', ''));
    document.querySelectorAll('#s-body [data-stall]').forEach(b => b.addEventListener('click', () => order(b.dataset.stall, b.dataset.size)));
    $('#s-skip').addEventListener('click', () => { ST.cur = { stall: JR.SKIP, option: JR.SKIP.options[0], eaten: 0, cap: 0 }; stopEating(); });
    window.scrollTo(0, 0);
  }
  function order(stallId, size) {
    const d = ST.week[ST.dayIdx], stall = JR.studentStalls(cfg, ST.weekNo).find(s => s.id === stallId);
    const option = stall.options.find(o => o.size === size);
    if (option.price > ST.money + 1e-9) return;
    ST.money = round2(ST.money - option.price);
    const timeCap = JR.maxEatG(cfg, d, stall);
    ST.cur = { stall, option, eaten: 0, cap: Math.min(option.g, timeCap), timeCap };
    SND.play('coin');
    renderEat();
    const chip = $('#s-hud .chip:last-child'); bump(chip); floatText(chip, '−' + money(option.price), true);
  }
  const round2 = x => Math.round(x * 100) / 100;
  function renderEat(msg, prevEaten) {
    sHud();
    const d = ST.week[ST.dayIdx], c = ST.cur, onPlate = c.option.g - c.eaten;
    const prevOnPlate = prevEaten == null ? null : c.option.g - prevEaten;
    // minutes of eating time left: from the clock, not from what is left on the plate
    const timeLeft = d.rush ? Math.max(0, Math.round((c.timeCap - c.eaten) / cfg.student.biteG * cfg.student.minutesPerBite)) : null;
    $('#s-body').innerHTML = `
      <div class="card eat">
        <h2>${esc(c.stall.name)}: ${esc(c.option.label.toLowerCase())}, ${c.option.g} g</h2>
        <div class="plates${prevEaten != null && !RM() ? ' chomp' : ''}" style="margin:8px 0">${plateSVG(onPlate, 'On your plate', 150, prevOnPlate, true)}</div>
        ${hungerBar(c.eaten, d.needG, prevEaten)}
        ${d.rush ? `<p class="small">${I('timer')} ${timeLeft} ${timeLeft === 1 ? 'minute' : 'minutes'} of eating time left.</p>` : ''}
        ${msg ? `<p class="note">${esc(msg)}</p>` : ''}
        <div class="eat-actions" data-nosound>
          <button class="primary btn-ic" id="bite" ${c.eaten >= c.cap - 1e-9 ? 'disabled' : ''}>${I('plus')}Take a bite <span class="kbd">(Space)</span></button>
          <button class="btn-ic" id="finish" ${c.eaten >= c.cap - 1e-9 ? 'disabled' : ''}>Finish the plate</button>
          <button class="btn-ic" id="stop">${I('check')}Stop eating <span class="kbd">(Enter)</span></button>
        </div>
      </div>`;
    $('#bite').addEventListener('click', bite);
    $('#finish').addEventListener('click', () => { const prev = c.eaten; c.eaten = c.cap; SND.play('bite'); later(120, () => SND.play('bite')); afterBite(prev); });
    $('#stop').addEventListener('click', stopEating);
    animateFills();
  }
  function bite() { const c = ST.cur; if (!c) return; const prev = c.eaten; c.eaten = Math.min(c.cap, c.eaten + cfg.student.biteG); SND.play('bite'); afterBite(prev); }
  function afterBite(prev) {
    const d = ST.week[ST.dayIdx], c = ST.cur;
    const r0 = prev / d.needG, r1 = c.eaten / d.needG;
    if (r0 < 0.85 && r1 >= 0.85 && r1 <= 1.15) later(90, () => SND.play('full'));
    if (r0 <= 1.15 && r1 > 1.15) later(90, () => SND.play('bad'));
    if (c.eaten >= c.cap - 1e-9 && c.cap < c.option.g) return renderEat(d.rush ? 'Time is up. Class starts, so you leave the rest.' : '', prev);
    if (c.eaten >= c.option.g - 1e-9) return renderEat('Plate finished.', prev);
    renderEat('', prev);
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
          <div class="kpi"><div class="v"><span data-count="${Math.round(meal.ratio * 100)}" data-suf="%">${pct(meal.ratio)}</span></div><div class="l">of what you needed</div></div>
          <div class="kpi"><div class="v"><span data-count="${Math.round(meal.left)}" data-suf=" g">${Math.round(meal.left)} g</span></div><div class="l">rice left</div></div>
          <div class="kpi"><div class="v"><span data-count="${pm.focus}">${pm.focus}</span></div><div class="l">focus out of 100</div></div>
        </div>
        ${pm.snack ? `<p class="muted small">Snack: ${money(pm.snack)}.</p>` : ''}
        <button class="primary" id="s-next" style="width:100%;margin-top:10px">${last ? 'See your week' : 'Next day'} <span class="kbd">(Space)</span></button>
      </div>`;
    $('#s-next').addEventListener('click', nextDay);
    $('#s-next').focus({ preventScroll: true });
    countUp($('#s-body'));
    later(150, () => {
      if (c.stall.id === 'skip' || meal.fullness === 'hungry') SND.play('sad');
      else if (meal.fullness === 'stuffed') SND.play('bad');
      else { SND.play('good'); confetti($('#s-body .bub'), 22); }
      if (pm.snack) { const chip = $('#s-hud .chip:last-child'); bump(chip); floatText(chip, '−' + money(pm.snack), true); }
    });
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
    const dayList = r => r.days.map(d => `<tr><td>${d.day.day}</td><td>${esc(d.stall)}${d.size === 'small' ? ', Small' : d.size === 'more' ? ', Add rice' : ''}</td><td class="num">${Math.round(d.meal.left)} g</td><td>${d.meal.fullness === 'right' ? 'Just right' : d.meal.fullness === 'hungry' ? 'Still hungry' : 'Stuffed'}</td></tr>`).join('');
    $('#s-report-body').innerHTML = `
      <div class="report-head"><h1 style="font-size:clamp(32px,5vw,46px)">${w2 ? 'Week 1 against week 2' : 'Your week'}</h1>
        <p class="lede">${w2 ? 'The same five days. In week 2 every stall offered a Regular and a Small plate.' : 'Five lunches. Here is what they added up to.'}</p></div>
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
          <h2>Where you stand</h2>
          <p>Answer some of our real survey questions and see how you compare with ${SV.n} NTU students. Your game week is on there too.</p>
          <button class="primary btn-ic" id="s-stand-card">${I('users')}See where you stand</button>` : `
          <h2>Try the same week again</h2>
          <p>Same days, same appetite, same budget. This time Just Right is canteen-wide: every stall sells a Regular and a Small plate. A Small has ${pct(1 - P('smallShare'))} less rice, and each stall sets its own discount (${(() => { const ds = JR.studentStalls(cfg, 2).map(s => (s.options.find(o => o.size === 'small') || {}).discount || 0); const lo = Math.min(...ds), hi = Math.max(...ds); return lo === hi ? money(lo) : money(lo) + ' to ' + money(hi); })()} off).</p>
          <p class="muted small">Not every leftover is about size. A rushed lunch or a long queue still costs you.</p>`}
        </div>
      </div>
      <div class="actionsbar">
        ${w2 ? `<button class="primary btn-ic" id="s-again">${I('arrow-counter-clockwise')}Play the week again</button>` : `<button class="primary btn-ic" id="s-week2">${I('arrow-counter-clockwise')}Replay with Just Right</button>`}
        ${w2 ? '' : `<button class="btn-ic" id="s-stand-btn">${I('users')}Where you stand</button>`}
        <button class="btn-ic" id="s-new">${I('calendar-plus')}New answers</button>
        <button class="btn-ic" data-go="how">${I('question')}How this works</button>
        <button class="btn-ic" data-go="start">${I('house')}Home</button>
      </div>`;
    if ($('#s-week2')) $('#s-week2').addEventListener('click', () => startWeek(2));
    if ($('#s-again')) $('#s-again').addEventListener('click', () => { ST.results = {}; startWeek(1); });
    $('#s-new').addEventListener('click', () => { renderQuiz(); go('s-setup'); });
    ['#s-stand-card', '#s-stand-btn'].forEach(id => { if ($(id)) $(id).addEventListener('click', () => openStand('s-report')); });
    go('s-report');
    SND.play('fanfare');
    countUp($('#s-report-body'));
    if (w2 && (w2.leftMeals < w1.leftMeals || w2.right > w1.right)) later(250, () => confetti($('#s-report-body h1'), 34));
  }


  // =====================================================================
  // WHERE YOU STAND: the player's answers against our real survey (counts only, nothing saved or sent)
  // =====================================================================
  const SV = window.JR_SURVEY || { n: 0, questions: {} };
  const STAND_QS = ['q2', 'q3', 'q4', 'q6', 'q8', 'q10', 'q11', 'q1'];
  const SCALE_WORDS = {
    q2: ['leave food less often than you', 'leave food more often than you'],
    q5: ['find the portion too big less often than you', 'find the portion too big more often than you'],
    q6: ['are less likely than you to choose a smaller, cheaper portion', 'are more likely than you to choose it'],
  };
  const gameBucket = left => left <= 0 ? 'Never' : left === 1 ? 'Rarely' : left <= 3 ? 'Sometimes' : left === 4 ? 'Often' : 'Always';
  $('#stand-link').innerHTML = I('users') + `Compare yourself with ${SV.n} NTU students`;
  $('#stand-link').addEventListener('click', () => openStand('start'));
  $('#stand-back').addEventListener('click', () => go(ST.standFrom));
  function openStand(from) {
    ST.standFrom = from;
    $('#stand-back').innerHTML = I('arrow-left') + (from === 's-report' ? 'Back to your week' : 'Home');
    if (ST.profile && ST.profile.q5 && !ST.real.q5) ST.real.q5 = ST.profile.q5;   // (startWeek keeps this current)
    renderStand(); go('s-stand');
  }
  function bars(q, mine, gameMark) {
    const max = Math.max(...q.options.map(o => o[1]), 1), sel = [].concat(mine == null ? [] : mine);
    return `<div class="sbars">${q.options.map(([lab, n]) => {
      const me = sel.includes(lab), game = gameMark === lab;
      return `<div class="srow${me ? ' me' : ''}${game ? ' game' : ''}"><span class="slab">${esc(q.low && lab === '1' ? '1 ' + q.low : q.high && lab === '5' ? '5 ' + q.high : lab)}${me ? ' <span class="youtag">You</span>' : ''}${game ? ' <span class="youtag game">Your game week</span>' : ''}</span>
        <span class="sbar"><i style="width:${(n / max) * 100}%"></i></span><span class="snum">${n} <span class="muted">(${pct(n / SV.n)})</span></span></div>`;
    }).join('')}</div>`;
  }
  function sentence(key, q, mine) {
    if (mine == null || (Array.isArray(mine) && !mine.length)) return '';
    if (q.kind === 'multi') return mine.map(m => { const n = (q.options.find(o => o[0] === m) || [, 0])[1]; return `${esc(m)}: ${n} of ${SV.n} (${pct(n / SV.n)}) ticked this too.`; }).join(' ');
    const i = q.options.findIndex(o => o[0] === mine), same = q.options[i][1];
    if (q.kind === 'scale') {
      const lower = q.options.slice(0, i).reduce((a, o) => a + o[1], 0), higher = q.options.slice(i + 1).reduce((a, o) => a + o[1], 0);
      const w = SCALE_WORDS[key] || ['answered lower', 'answered higher'];
      const parts = [lower ? `${pct(lower / SV.n)} ${w[0]}` : '', higher ? `${pct(higher / SV.n)} ${w[1]}` : ''].filter(Boolean);
      const edge = !lower ? ' Nobody answered lower.' : !higher ? ' Nobody answered higher.' : '';
      return `${same} of ${SV.n} (${pct(same / SV.n)}) gave the same answer. ${parts.join('; ')}.${edge}`;
    }
    const top = Math.max(...q.options.map(o => o[1]));
    return `${same} of ${SV.n} (${pct(same / SV.n)}) chose the same as you.${same === top ? ' That is the most common answer.' : ''}`;
  }
  function standCard(key, interactive) {
    const q = SV.questions[key]; if (!q) return '';
    const mine = ST.real[key];
    const opts = q.options.map(o => o[0]);
    const isSel = o => q.kind === 'multi' ? (mine || []).includes(o) : mine === o;
    return `<div class="card standcard" data-q="${key}">
      <h3 style="margin-top:0">${esc(q.text)}</h3>
      ${interactive ? `<div class="choices">${opts.map(o => `<button class="choice${isSel(o) ? ' sel' : ''}" data-k="${key}" data-v="${esc(o)}" aria-pressed="${isSel(o)}">${esc(q.low && o === '1' ? '1 ' + q.low : q.high && o === '5' ? '5 ' + q.high : o)}</button>`).join('')}</div>` : ''}
      ${mine != null && !(Array.isArray(mine) && !mine.length) ? `${bars(q, mine)}<p class="small" style="margin:8px 0 0">${sentence(key, q, mine)}</p>` : `<p class="muted small" style="margin:8px 0 0">${q.kind === 'multi' ? 'Tick all that apply to see how others answered.' : 'Tap your answer to see how others answered.'}</p>`}
    </div>`;
  }
  function renderStand() {
    const res = ST.results[2] || ST.results[1];
    const gameCard = res ? (() => {
      const b = gameBucket(res.leftMeals), q = SV.questions.q2;
      return `<div class="card standcard">
        <h3 style="margin-top:0">Your game week</h3>
        <p class="small">You left food on <b>${res.leftMeals} of 5</b> days in week ${ST.results[2] ? 2 : 1}. We read that as "${b}" on question 2 (0 days Never, 1 Rarely, 2 to 3 Sometimes, 4 Often, 5 Always: our mapping).</p>
        ${bars(q, null, b)}
      </div>`;
    })() : '';
    $('#s-stand-body').innerHTML = `
      <div class="report-head"><h1 style="font-size:clamp(32px,5vw,46px)">Where you stand</h1>
        <p class="lede">Your answers next to ${SV.n} NTU students who took our survey (${esc(SV.collected)}). Nothing you tap is saved or sent.</p></div>
      <div class="stands">
        ${standCard('q5', true)}
        ${gameCard}
        ${STAND_QS.map(k => standCard(k, true)).join('')}
      </div>
      <p class="muted small" style="margin-top:12px">Counts from our Google Form. Questions with several answers count every box ticked, so they add up to more than ${SV.n}.</p>`;
  }
  // one listener for every answer button; a tapped card is rebuilt with the bars
  $('#s-stand-body').addEventListener('click', e => {
    const b = e.target.closest('.choice'); if (!b) return;
    const k = b.dataset.k, v = b.dataset.v, q = SV.questions[k];
    if (q.kind === 'multi') { const cur = new Set(ST.real[k] || []); cur.has(v) ? cur.delete(v) : cur.add(v); ST.real[k] = q.options.map(o => o[0]).filter(o => cur.has(o)); }
    else ST.real[k] = v;
    b.closest('.standcard').outerHTML = standCard(k, true);
    const fresh = document.querySelector(`#s-stand-body .standcard[data-q="${k}"] .sbars`);
    if (fresh) fresh.classList.add('grow-in');
  });

  // ---------- how this works
  function fmtVal(p) {
    if (p.unit === 'choice') return (p.options.find(o => o[0] === p.value) || [, p.value])[1];
    if (p.unit === '%') return pct(p.value);
    if (p.unit === 'S$') return money(p.value);
    return `${Math.round(p.value * 100) / 100}${p.unit ? ' ' + p.unit : ''}`;
  }
  const GROUPS = [
    ['survey', 'From our student survey', `${(window.JR_SURVEY || {}).n || 97} responses, ${(window.JR_SURVEY || {}).collected || '1 to 7 October 2026'}.`],
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
    const pers = Object.values(cfg.personas).map(p => `<li>${I(p.icon)} <b>${esc(p.name)}</b> wants ${pct(p.appetite[0])} to ${pct(p.appetite[1])} of a Regular plate${p.cleanPlater ? ' and finishes everything' : ''}${p.quietMore ? ', orders Regular and never asks for more' : ''}${p.alwaysRusher ? ', always short of time' : ''}${p.asks === 'more' ? ', asks for more rice' : ''}.</li>`).join('');
    const w = JR.personaWeights(cfg).map(([k, x]) => `${cfg.personas[k].name} ${pct(x)}`).join(', ');
    $('#how-body').innerHTML = `
      <h1 style="font-size:clamp(32px,5vw,46px);margin-top:8px">How this works</h1>
      <div class="grid2">
        <div class="card">
          <h2>The model</h2>
          <p>Every customer has a hidden appetite. They eat what they want and leave the rest, unless they are a Clean-Plater, who finishes everything and overeats instead. Taste letdowns and rushing make people leave food whatever the plate size.</p>
          <p class="small">With Just Right, a customer whose hunger fits the Small only takes it if the discount is big enough for them. How big comes from our survey question 10: ${(() => { const q = cfg.smallDiscountNeeded; return q ? q.answers.map(([d, n]) => `${n} of 97 ${d === null ? 'would not take it' : d === 0 ? 'would take it at the same price' : 'need ' + money(d) + (d === 0.8 ? ' (our reading of "more than 50 cents")' : '')}`).join(', ') : ''; })()}. Light eaters who skip the Small can still ask for less rice, as they do today.</p>
          <p><b>Today</b> has one size: light eaters who speak up ask for less rice, quiet ones get a Regular. <b>Just Right</b> puts Regular and Small on the board, so everyone can point at the size that fits. Both use exactly the same customers, so any difference comes from the menu, not luck.</p>
          <p>Profit is takings minus rice cost minus everything else on the plate. A Small plate breaks even when the discount is no more than the rice it saves: rice cost × (1 − Small share) × (1 + cooking buffer), which is <b>${money(JR.breakEvenDiscount(cfg))}</b> with the current settings.</p>
          <p>Customers score each meal from 1 to 5 stars: up for "just nice", down for still hungry, overeating, a taste letdown, or feeling short-changed. In the shortcut, tomorrow's customers rise or fall with today's rating.</p>
          <p class="muted small">${esc(cfg.calibration)}</p>
        </div>
        <div class="card">
          <h2>The customers</h2>
          <p class="small muted">Mix from our survey, with big appetites added on top (${pct(P('shareBig'))} in all, split equally, an assumption): ${esc(w)}.</p>
          <p class="small muted">"Add rice" is free, as vendors do today, so it costs the vendor rice. Big appetites never order Small. The Late Luncher leaves food because of time, whatever the plate size.</p>
          <ul class="plain small">${pers}</ul>
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <h2>Student mode</h2>
        <p class="small">Your answer to our survey question on portion size sets your hidden appetite: ${Object.entries(cfg.student.appetiteFromQ5).map(([k, x]) => `${k} ${pct(x)}`).join(', ')} of a Regular plate (our mapping, not data). Breakfast changes it: skipped ${pct(cfg.student.breakfastEffect.skipped)}, normal ${pct(cfg.student.breakfastEffect.normal)}, big ${pct(cfg.student.breakfastEffect.big)}. A lunch is just right between 85% and 115% of what you need; below that you are still hungry and buy a ${money(cfg.student.snackPrice)} snack if you can; above it you are stuffed, which hurts most on a 2 pm lecture day. On Thursday you have ${cfg.student.rushWindowMin} minutes for lunch, so a long queue leaves less time to eat.</p>
        <div class="tablewrap"><table>
          <tr><th>Stall</th><th class="num">Plate</th><th class="num">Price</th><th class="num">Queue</th><th class="num">Stars</th></tr>
          ${JR.studentStalls(cfg, 2).map(x => `<tr><td>${esc(x.name)}</td><td class="num">${x.options.map(o => o.g + ' g').join(', ')}</td><td class="num">${x.options.map(o => money(o.price)).join(', ')}</td><td class="num">${x.queueMin} min</td><td class="num">${x.stars.toFixed(1)}</td></tr>`).join('')}
        </table></div>
        <p class="muted small">All student-mode numbers are assumptions for the game, not survey data. The Standard uses the vendor Regular plate. In week 2 Just Right is canteen-wide: every stall adds a Small plate with the vendor Small share of its own rice, for the vendor discount less. So both modes agree.</p>
        <h3>God Mode</h3>
        <p class="small">A whole canteen at lunch: the five student-mode stalls, ${cfg.canteen.seats} seats, one food waste bin and ${cfg.canteen.students} students by default, drawn from the same customer mix as vendor mode. Students pick a stall by how hungry they are, the price, the queue and the rating, plus personal taste; they avoid plates too small for them more than plates too big (our assumption). They eat for ${cfg.canteen.eatBaseMin} minutes plus ${cfg.canteen.eatGPerMin} g of rice a minute, and students in a rush leave ${cfg.canteen.rushLeaveMin} minutes after walking in. Other ingredients cost the same share of the price as in vendor mode. Today and Just Right run with the very same students, so the difference is the menu alone.</p>
        <h3>Where you stand</h3>
        <p class="small">That screen compares your own answers with ${SV.n} NTU students who answered our Google Form (${esc(SV.collected)}). It shows counts only, with no individual responses, and nothing you tap is saved or sent. Your game week is placed on question 2 by days with food left: 0 Never, 1 Rarely, 2 to 3 Sometimes, 4 Often, 5 Always (our mapping).</p>
      </div>
      <div class="card" style="margin-top:12px">
        <h2>Every number</h2>
        <p class="muted small">Slider changes last until you reload the page. Every new visit starts from these defaults.</p>
        ${groups}
        <button id="reset" class="btn-ic" style="margin-top:12px">${I('arrow-counter-clockwise')}Reset to defaults</button>
      </div>`;
    document.querySelectorAll('#how-body [data-key]').forEach(inp => inp.addEventListener('input', () => {
      const k = inp.dataset.key, p = cfg.params[k];
      p.value = p.unit === 'choice' ? inp.value : parseFloat(inp.value);
      $('#hv-' + k).textContent = fmtVal(p); saveParams();
    }));
    $('#reset').addEventListener('click', () => {
      cfg = freshCfg();
      renderHow();
    });
  }
  // shared with God Mode (src/god.js)
  window.JR_UI = { go, getCfg: () => cfg, SND, I, money, pct, esc, newSeed, urlSeed, bestCaseLine, bindBestCase, reduceMotion: () => RM() };
})();
