/* Just Right: God Mode. A top-down canteen at lunch: set each stall up before opening, then watch students walk in,
   queue, order by hunger, eat, and scrape what is left into the food waste bin. A live dashboard counts it all.
   Run Today, then the same students under Just Right, and compare. All maths is in canteen.js; this file draws. */
(function () {
  'use strict';
  const U = window.JR_UI, C = window.JR_CANTEEN;
  if (!U || !C) return;
  const $ = s => document.querySelector(s);
  const { I, money, pct, esc, SND } = U;
  const cfg = () => U.getCfg();
  const P = k => cfg().params[k].value;
  const kg = g => (g / 1000).toFixed(2) + ' kg';
  const clock = m => { const t = Math.max(0, Math.floor(m)); const h = 12 + Math.floor(t / 60), mm = t % 60; return `${h > 12 ? h - 12 : h}:${String(mm).padStart(2, '0')}`; };
  const NAMES = { today: 'Today: one size', justright: 'Just Right: Regular and Small' };

  const G = { edits: {}, students: null, seed: U.urlSeed != null ? U.urlSeed : U.newSeed(), runs: {}, sig: '', open: {}, run: null, T: 0, speed: 3, playing: false, raf: 0, last: 0, dumped: 0, floats: [], pick: null };

  $('#go-god').innerHTML = `${I('map-trifold')}<span><b>God Mode: the whole canteen</b><span class="muted">Set up five stalls, open the doors, and watch the waste bin fill.</span></span>${I('arrow-left', 'flip')}`;
  $('#go-god .flip').style.transform = 'scaleX(-1)';
  $('#god-home').innerHTML = I('arrow-left') + 'Home';
  $('#go-god').addEventListener('click', () => { U.go('god'); });
  document.addEventListener('jr:screen', e => { document.body.classList.toggle('wide', e.detail === 'god'); if (e.detail === 'god') { stop(); showSetup(); } else stop(); });

  // ---------------------------------------------------------------- setup: before the canteen opens
  const FIELDS = [
    ['g', 'Regular plate', 'g', 80, 400, 10, x => `${x} g of rice`],
    ['price', 'Price', 'S$', 2, 10, 0.1, x => money(x)],
    ['riceCost', 'Rice cost in one plate', 'S$', 0.3, 4, 0.05, x => money(x)],
    ['serveSec', 'Time to serve one plate', 's', 15, 90, 5, x => `${x} s`],
    ['stars', 'Rating', '', 2.5, 5, 0.1, x => x.toFixed(1) + ' stars'],
    ['discount', 'Just Right: Small plate discount', 'S$', 0, 1.5, 0.05, x => x > 0 ? money(x) + ' off' : 'same price, less rice'],
  ];
  const stalls = () => C.canteenStalls(cfg(), G.edits);
  const nStudents = () => G.students || cfg().canteen.students;
  // every setting that changes the lunch: if any differs from the last run, the old run no longer counts as "the same students"
  const signature = () => JSON.stringify([stalls(), nStudents(), G.seed, !!G.labelsOn, Object.entries(cfg().params).map(([k, p]) => [k, p.value])]);
  function checkSig() { const s = signature(); if (s !== G.sig) { G.sig = s; G.runs = {}; } }

  function showSetup() {
    checkSig();
    $('#god-run').hidden = true; $('#god-setup').hidden = false;
    const ct = cfg().canteen, sts = stalls();
    const smallG = st => Math.round(st.g * P('smallShare'));
    $('#god-setup').innerHTML = `
      <div class="report-head"><h1 style="font-size:clamp(32px,5vw,46px)">God Mode</h1>
        <p class="lede">The whole canteen from above. Set up each stall before the doors open, then run lunch for ${nStudents()} students: first as today, then the same students with Just Right.</p></div>
      <div class="god-setup-grid">
        <div class="card">
          <h2>The lunch</h2>
          ${gSlider('students', 'Students coming to lunch', nStudents(), ct.studentsMin, ct.studentsMax, 10, x => `${x} students`)}
          ${gSlider('smallShare', 'Just Right: Small plate, share of each Regular', P('smallShare'), 0.5, 0.9, 0.05, x => pct(x))}
          <label class="switch small"><input type="checkbox" id="god-labels" ${G.labelsOn ? 'checked' : ''}> <span>Let the nutrition panel sway which dish students pick (Cochrane review: calorie labels cut energy selected by 1.8%). Off by default: studies found no added effect on portion size or plate waste.</span></label>
          <p class="muted small">Each stall sets its own Small price (Adjust a stall below). It starts at our rule: the biggest survey price step (S$0.20 or S$0.30) that the rice saved on one Small still covers, so a Small never earns the stall less than a Regular. A stall can also choose S$0: same price, less rice.</p>
          <p class="muted small">Students are drawn from our customer mix: ${pct(P('shareLight'))} light eaters and ${pct(P('shareNeverLeave'))} who never leave food (from our survey of ${(window.JR_SURVEY || {}).n || 97}), plus ${pct(P('shareBig'))} with big appetites (an assumption). <button class="link small" id="god-reseed">${I('arrow-counter-clockwise')}New set of students</button></p>
        </div>
        <div class="card">
          <h2>Before you open</h2>
          <p class="small">At each stall a Small saves some rice. If the discount is bigger than the rice saved, every Small costs the stall money.</p>
          <table class="small god-be"><tr><th>Stall</th><th class="num">Small</th><th class="num">Rice saved</th><th class="num">Discount</th><th class="num">Small price</th></tr>
          ${sts.map(st => { const be = C.smallBreakEven(cfg(), st), d = C.effectiveDiscount(st); return `<tr><td>${esc(st.name)}</td><td class="num">${smallG(st)} g</td><td class="num">${money(be)}</td><td class="num ${d > be + 1e-9 ? 'worse' : 'better'}">${d > 0 ? money(d) : 'same price'}</td><td class="num">${money(C.smallPriceAt(st))}</td></tr>`; }).join('')}
          </table>
          ${Object.values(G.edits).some(e => e.discount != null) ? `<p class="small"><button class="link small" id="god-rule">${I('sparkle')}Use the rice-saving rule for every stall</button></p>` : ''}
        </div>
      </div>
      <h2 style="margin-top:22px">The stalls</h2>
      <div class="god-stalls">${sts.map(st => stallCard(st)).join('')}</div>
      <div class="actionsbar" style="margin-top:16px">
        <button class="primary btn-ic" id="god-open-today">${I('sign-in')}Open the canteen: Today</button>
        <button class="btn-ic" id="god-open-jr">${I('sign-in')}Open with Just Right</button>
        <button class="btn-ic" id="god-reset">${I('arrow-counter-clockwise')}Reset stalls</button>
      </div>
      <p class="muted small" style="margin-top:8px">Run both with the same students to get the comparison. Changing anything here starts a fresh comparison. Student numbers: ${G.seed}.</p>`;
    bindSetup();
  }
  function gSlider(key, label, val, min, max, step, fmt) {
    return `<div class="slider"><label for="g-${key}"><span>${esc(label)}</span><span id="gv-${key}">${fmt(val)}</span></label>
      <input type="range" id="g-${key}" data-g="${key}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
  }
  const facts = (st, g) => JR.kioskFactsAt(cfg(), st.id, C.dishBaseG(cfg(), st.id), g);
  const summary = st => { const d = cfg().kiosk.dishes[st.id], f = facts(st, st.g), fs = facts(st, Math.round(st.g * P('smallShare')));
    return `${d ? d.name + ': ' : ''}${st.g} g ${d && d.staple === 'noodles' ? 'noodles' : 'rice'}, ${Math.round(f.kcal)} kcal (Small ${Math.round(fs.kcal)} kcal) · ${money(st.price)} · ${st.stars.toFixed(1)} stars · ${st.serveSec} s a plate · Small ${st.discount > 0 ? money(st.discount) + ' off' : 'same price'}`; };
  function stallCard(st) {
    const open = !!G.open[st.id];
    return `<div class="card god-stall" data-stall="${st.id}">
      <div class="row" style="gap:12px;align-items:center">
        <span class="avatar" style="width:44px;height:44px;margin:0">${I(st.icon)}</span>
        <div style="flex:1;min-width:0"><b>${esc(st.name)}</b><div class="muted small">${summary(st)}</div></div>
        <button class="small-btn" data-adjust="${st.id}" aria-expanded="${open}">${open ? 'Done' : 'Adjust'}</button>
      </div>
      ${open ? FIELDS.map(([k, lab, , min, max, step, fmt]) => `<div class="slider"><label for="gs-${st.id}-${k}"><span>${lab}</span><span id="gsv-${st.id}-${k}">${fmt(st[k])}</span></label>
        <input type="range" id="gs-${st.id}-${k}" data-st="${st.id}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${st[k]}"></div>`).join('') : ''}
    </div>`;
  }
  function bindSetup() {
    document.querySelectorAll('#god-setup [data-g]').forEach(inp => inp.addEventListener('input', () => {
      const k = inp.dataset.g, x = parseFloat(inp.value);
      if (k === 'students') { G.students = x; $('#gv-students').textContent = x + ' students'; }
      else { cfg().params[k].value = x; showSetup(); return; }
    }));
    document.querySelectorAll('#god-setup [data-st]').forEach(inp => inp.addEventListener('input', () => {
      const id = inp.dataset.st, k = inp.dataset.k, x = parseFloat(inp.value), f = FIELDS.find(F => F[0] === k);
      G.edits[id] = Object.assign({}, G.edits[id], { [k]: x });
      $(`#gsv-${id}-${k}`).textContent = f[6](x);
      const st = stalls().find(s => s.id === id);
      inp.closest('.god-stall').querySelector('.muted.small').textContent = summary(st);
    }));
    document.querySelectorAll('#god-setup [data-st]').forEach(inp => inp.addEventListener('change', () => showSetup()));
    document.querySelectorAll('#god-setup [data-adjust]').forEach(b => b.addEventListener('click', () => { G.open[b.dataset.adjust] = !G.open[b.dataset.adjust]; showSetup(); }));
    $('#god-reseed').addEventListener('click', () => { G.seed = U.newSeed(); showSetup(); });
    $('#god-labels').addEventListener('change', e => { G.labelsOn = e.target.checked; showSetup(); });
    if ($('#god-rule')) $('#god-rule').addEventListener('click', () => { Object.values(G.edits).forEach(e => delete e.discount); showSetup(); });
    $('#god-reset').addEventListener('click', () => { G.edits = {}; G.open = {}; showSetup(); });
    $('#god-open-today').addEventListener('click', () => start('today'));
    $('#god-open-jr').addEventListener('click', () => start('justright'));
  }

  // ---------------------------------------------------------------- the run
  function start(setting) {
    checkSig();
    const sts = stalls();
    G.stallsUsed = sts;
    G.run = C.canteenDay(cfg(), sts, setting, G.seed, { students: nStudents(), labelsOn: G.labelsOn });
    G.setting = setting; G.T = 0; G.dumped = 0; G.floats = []; G.pick = null; G.done = false;
    G.byStall = sts.map((_, k) => G.run.students.filter(s => s.stall === k).sort((a, b) => a.tStart - b.tStart));
    G.binSeries = [];
    $('#god-setup').hidden = true; $('#god-run').hidden = false; $('#god-after').innerHTML = ''; $('#god-pick').innerHTML = '';
    $('#god-mode-chip').textContent = NAMES[setting];
    $('#god-mode-chip').className = 'chip' + (setting === 'justright' ? ' jr' : '');
    setupCanvas();
    if (U.reduceMotion()) G.speed = Math.max(G.speed, 8);
    setSpeed(G.speed);
    window.scrollTo(0, 0);
    SND.play('serve');
    play();
  }
  function play() { G.playing = true; $('#god-pause').innerHTML = I('pause') + 'Pause'; G.last = performance.now(); cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(tick); }
  function pause() { G.playing = false; $('#god-pause').innerHTML = I('play') + 'Play'; cancelAnimationFrame(G.raf); }
  function stop() { G.playing = false; cancelAnimationFrame(G.raf); }
  function setSpeed(x) { G.speed = x; document.querySelectorAll('#god-run [data-speed]').forEach(b => b.classList.toggle('sel', +b.dataset.speed === x)); }
  $('#god-pause').addEventListener('click', () => { if (G.done) { start(G.setting); return; } G.playing ? pause() : play(); });
  document.querySelectorAll('#god-run [data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  $('#god-skip').addEventListener('click', () => { if (G.run && !G.done) finish(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.playing) pause(); });

  function tick(now) {
    if (!G.playing) return;
    const dt = Math.min(0.1, (now - G.last) / 1000); G.last = now;
    G.T += dt * G.speed;                      // 1x = one canteen minute per real second
    frame();
    if (G.T >= G.run.totals.endMin) { finish(); return; }
    G.raf = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- the map
  // two floor plans: wide for laptops, tall for phones (so text stays readable). Same canteen, same students.
  let W = 1000, H = 640, L = null;
  function layout(tall) {
    if (!tall) return { tall, W: 1000, H: 640,
      stall: k => ({ x: 16 + k * 196, y: 18, w: 186, h: 100 }),
      counter(k) { const s = this.stall(k); return { x: s.x + s.w / 2, y: s.y + s.h + 14 }; },
      queueSpot(k, i) { const c = this.counter(k); return { x: c.x + (i > 9 ? 14 : 0), y: c.y + 14 + Math.min(i, 9) * 11 }; },
      entrance: { x: 92, y: 612 }, exit: { x: 950, y: 612 }, bin: { x: 868, y: 262, w: 100, h: 150 },
      tables: { x0: 150, y0: 270, cols: 6, rows: 4, dx: 112, dy: 92 }, seatDx: 22, seatDy: 20, nameFont: 16, infoFont: 14 };
    return { tall, W: 520, H: 900,
      stall: k => ({ x: 10, y: 12 + k * 104, w: 210, h: 92 }),
      counter(k) { const s = this.stall(k); return { x: s.x + s.w + 14, y: s.y + s.h / 2 }; },
      queueSpot(k, i) { const c = this.counter(k); return { x: c.x + 14 + Math.min(i, 9) * 12, y: c.y + (i > 9 ? 13 : 0) }; },
      entrance: { x: 92, y: 872 }, exit: { x: 490, y: 872 }, bin: { x: 392, y: 150, w: 108, h: 170 },
      tables: { x0: 62, y0: 596, cols: 6, rows: 4, dx: 79, dy: 68 }, seatDx: 20, seatDy: 18, nameFont: 19, infoFont: 16 };
  }
  const counter = k => L.counter(k);
  const queueSpot = (k, i) => L.queueSpot(k, i);
  function seatPos(si) {
    const t = L.tables, table = Math.floor(si / 4) % (t.cols * t.rows), side = si % 4;
    const cx = t.x0 + (table % t.cols) * t.dx, cy = t.y0 + Math.floor(table / t.cols) * t.dy;
    return { x: cx + (side % 2 ? L.seatDx : -L.seatDx), y: cy + (side < 2 ? -L.seatDy : L.seatDy), cx, cy };
  }
  const binIn = () => ({ x: L.bin.x - 10, y: L.bin.y + L.bin.h / 2 });
  const lerp = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  const seg = (T, t0, t1) => Math.max(0, Math.min(1, (T - t0) / Math.max(1e-6, t1 - t0)));

  let cv, ctx, scale = 1, colors = {}, iconPaths = {};
  function setupCanvas() {
    cv = $('#god-map'); ctx = cv.getContext('2d');
    const resize = () => {
      const w = cv.parentElement.clientWidth - 2, dpr = window.devicePixelRatio || 1;
      L = layout(w < 640); W = L.W; H = L.H;
      scale = w / W; cv.style.width = w + 'px'; cv.style.height = (H * scale) + 'px';
      cv.width = Math.round(w * dpr); cv.height = Math.round(H * scale * dpr);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      frame();
    };
    if (!G.resizeBound) { window.addEventListener('resize', () => { if (!$('#god-run').hidden) resize(); }); G.resizeBound = true; }
    cv.onclick = e => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
      let best = null, bd = 18 * 18;
      for (const s of G.run.students) { const p = posOf(s, G.T); if (!p) continue; const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = s; } }
      G.pick = best; showPick(); frame();
    };
    readColors();
    resize();
    $('#god-legend').innerHTML = [['walk', 'Walking or queuing'], ['food', 'Has food'], ['right', 'Just right'], ['hungry', 'Still hungry'], ['stuffed', 'Stuffed']]
      .map(([k, l]) => `<span><i class="dot ${k}"></i>${l}</span>`).join('') + `<span class="muted">Tap a student to follow them.</span>`;
  }
  function readColors() {
    const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
    colors = { ink: g('--ink'), muted: g('--muted'), line: g('--line'), surface: g('--surface'), s2: g('--surface-2'), accent: g('--accent'), accentSoft: g('--accent-soft'),
      bad: g('--bad'), warn: g('--warn') || '#b26a00', bg: g('--bg') };
  }
  function path(name) {
    if (!iconPaths[name]) {
      const raw = (window.JR_ICON_PATHS || {})[name] || '';
      iconPaths[name] = [...raw.matchAll(/ d="([^"]+)"/g)].map(m => new Path2D(m[1]));
    }
    return iconPaths[name];
  }
  function drawIcon(name, x, y, size, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 256, size / 256); ctx.fillStyle = color;
    path(name).forEach(p => ctx.fill(p)); ctx.restore();
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  function posOf(s, T) {
    if (T < s.t0 || T >= s.tExit) return null;
    const k = s.stall;
    if (T < s.tAt) { const ahead = queueIndex(s, s.tAt); return lerp(L.entrance, queueSpot(k, ahead), seg(T, s.t0, s.tAt)); }
    if (T < s.tStart) return queueSpot(k, queueIndex(s, T));
    if (T < s.tServed) return counter(k);
    const seat = seatPos(s.seat);
    if (T < s.tSeat) {
      const arrive = s.tServed + cfg().canteen.walkMin, behind = { x: seat.x + (seat.x - seat.cx) * 0.7, y: seat.y + (seat.y - seat.cy) * 0.7 };
      if (s.tSeat > arrive + 1e-6) return T < arrive ? lerp(counter(k), behind, seg(T, s.tServed, arrive)) : behind;   // waiting for the seat to free up
      return lerp(counter(k), seat, seg(T, s.tServed, s.tSeat));
    }
    if (T < s.tDone) return seat;
    if (T < s.tBin) return lerp(seat, binIn(), seg(T, s.tDone, s.tBin));
    return lerp(binIn(), L.exit, seg(T, s.tBin, s.tExit));
  }
  function queueIndex(s, T) {                      // students at this stall, arrived before s, not yet served at time T
    const list = G.byStall[s.stall]; let n = 0;
    for (const o of list) { if (o === s) break; if (o.tAt <= T && o.tServed > T) n++; }
    return n;
  }
  function stateOf(s, T) {
    if (T < s.tServed) return 'walk';
    if (T < s.tDone) return 'food';
    return s.fullness;
  }

  function frame() {
    if (!ctx || !G.run) return;
    const T = G.T, run = G.run, sts = G.stallsUsed;
    ctx.clearRect(0, 0, W, H);
    // floor
    ctx.fillStyle = colors.s2; rr(0, 0, W, H, 18); ctx.fill();
    // stalls
    const live = liveStats(T);
    sts.forEach((st, k) => {
      const b = L.stall(k), F = L.nameFont, f = L.infoFont;
      ctx.fillStyle = colors.surface; ctx.strokeStyle = colors.line; ctx.lineWidth = 1.5; rr(b.x, b.y, b.w, b.h, 14); ctx.fill(); ctx.stroke();
      drawIcon(st.icon, b.x + 12, b.y + 12, F + 8, colors.accent);
      ctx.fillStyle = colors.ink; ctx.font = `640 ${F}px Geist, system-ui, sans-serif`; ctx.textBaseline = 'top';
      ctx.fillText(fit(st.name, b.w - F - 32), b.x + F + 28, b.y + 15);
      ctx.fillStyle = colors.muted; ctx.font = `520 ${f}px Geist, system-ui, sans-serif`;
      const sm = Math.round(st.g * P('smallShare'));
      ctx.fillText(fit(G.setting === 'justright' ? `${st.g} g / ${sm} g ${money(C.smallPriceAt(st))}` : `${st.g} g, ${money(st.price)}`, b.w - 24), b.x + 12, b.y + F + 26);
      ctx.fillStyle = colors.ink;
      ctx.fillText(fit(`${live.stalls[k].plates} sold, ${money(live.stalls[k].profit)}`, b.w - 24), b.x + 12, b.y + F + f + 34);
      // counter
      const c = counter(k); ctx.fillStyle = colors.line;
      if (L.tall) rr(b.x + b.w + 4, b.y + 16, 4, b.h - 32, 2); else rr(b.x + 20, b.y + b.h + 4, b.w - 40, 4, 2);
      ctx.fill();
    });
    // tables and seats
    const t = L.tables;
    for (let i = 0; i < t.cols * t.rows; i++) {
      const cx = t.x0 + (i % t.cols) * t.dx, cy = t.y0 + Math.floor(i / t.cols) * t.dy;
      ctx.fillStyle = colors.surface; ctx.strokeStyle = colors.line; ctx.lineWidth = 1.5; rr(cx - L.seatDx + 6, cy - L.seatDy + 8, 2 * L.seatDx - 12, 2 * L.seatDy - 16, 6); ctx.fill(); ctx.stroke();
    }
    // entrance, exit, bin
    ctx.fillStyle = colors.ink; ctx.font = `620 ${L.infoFont + 1}px Geist, system-ui, sans-serif`; ctx.textBaseline = 'middle';
    drawIcon('sign-in', L.entrance.x - 80, L.entrance.y - 12, 24, colors.ink); ctx.fillText('Entrance', L.entrance.x - 52, L.entrance.y);
    drawIcon('sign-out', L.exit.x - 66, L.exit.y - 12, 24, colors.ink); ctx.textAlign = 'right'; ctx.fillText('Exit', L.exit.x - 70, L.exit.y); ctx.textAlign = 'left';
    const bb = L.bin, maxKg = Math.max(4, Math.ceil((run.totals.wasteG / 1000) * 1.15)), fillF = Math.min(1, live.binG / 1000 / maxKg);
    ctx.fillStyle = colors.surface; ctx.strokeStyle = colors.ink; ctx.lineWidth = 2; rr(bb.x, bb.y, bb.w, bb.h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.warn; ctx.globalAlpha = 0.85; rr(bb.x + 4, bb.y + 4 + (bb.h - 8) * (1 - fillF), bb.w - 8, (bb.h - 8) * fillF, 7); ctx.fill(); ctx.globalAlpha = 1;
    drawIcon('trash', bb.x + bb.w / 2 - 14, bb.y - 40, 28, colors.ink);
    ctx.fillStyle = colors.ink; ctx.font = `700 ${L.nameFont + 3}px Geist, system-ui, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(kg(live.binG), bb.x + bb.w / 2, bb.y + bb.h + 20);
    ctx.fillStyle = colors.muted; ctx.font = `520 ${L.infoFont}px Geist, system-ui, sans-serif`; ctx.fillText('food waste bin', bb.x + bb.w / 2, bb.y + bb.h + 42);
    ctx.textAlign = 'left';
    // queue overflow labels
    G.byStall.forEach((list, k) => { const q = list.filter(o => o.tAt <= T && o.tStart > T).length; if (q > 10) { const c = queueSpot(k, 9); ctx.fillStyle = colors.ink; ctx.font = `620 ${L.infoFont - 1}px Geist, system-ui, sans-serif`; ctx.textBaseline = 'middle'; ctx.fillText(`+${q - 10}`, c.x + (L.tall ? 12 : 24), c.y + (L.tall ? 0 : 0)); } });
    // students
    const col = { walk: colors.muted, food: colors.accent, right: colors.accent, hungry: colors.warn, stuffed: colors.bad };
    for (const s of run.students) {
      const p = posOf(s, T); if (!p) continue;
      const st = stateOf(s, T);
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = col[st]; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = colors.surface; ctx.stroke();
      if (st === 'food') { ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fillStyle = colors.surface; ctx.fill(); }   // ring = still has food
      if (st === 'food' && T >= s.tSeat) {                       // a plate in front of them, emptying as they eat
        const seat = seatPos(s.seat), f = seg(T, s.tSeat, s.tDone), g = s.served - (s.eaten * f);
        const px = seat.x + (seat.cx - seat.x) * 0.55, py = seat.y + (seat.cy - seat.y) * 0.55;
        ctx.beginPath(); ctx.arc(px, py, 2 + 4 * Math.sqrt(g / 280), 0, Math.PI * 2); ctx.fillStyle = colors.ink; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
      }
      if (st !== 'walk' && st !== 'food' && T < s.tBin && s.leftover > 0) { ctx.beginPath(); ctx.arc(p.x + 7, p.y - 6, 3, 0, Math.PI * 2); ctx.fillStyle = colors.ink; ctx.fill(); }
      if (G.pick === s) { ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.strokeStyle = colors.ink; ctx.lineWidth = 2; ctx.stroke(); }
    }
    // scrape floats at the bin
    run.students.forEach(s => { if (s.tBin <= T && !s._f && s.leftover > 0.5 && G.speed <= 8 && !G.skipping) { s._f = 1; G.floats.push({ t: performance.now(), g: s.leftover }); } });
    const now = performance.now();
    G.floats = G.floats.filter(f => now - f.t < 1400);
    ctx.textAlign = 'center';
    G.floats.slice(-2).forEach((f, i, arr) => { const a = (now - f.t) / 1400; ctx.globalAlpha = 1 - a; ctx.fillStyle = colors.ink; ctx.font = `700 ${L.infoFont}px Geist, system-ui, sans-serif`;
      ctx.fillText(`+${Math.round(f.g)} g`, bb.x + bb.w / 2, bb.y - 50 - a * 24 - (arr.length - 1 - i) * (L.infoFont + 4)); ctx.globalAlpha = 1; });
    ctx.textAlign = 'left';
    // record the bin for the chart (one point per canteen minute)
    const minute = Math.floor(T);
    if (!G.binSeries.length || G.binSeries[G.binSeries.length - 1][0] < minute) G.binSeries.push([minute, live.binG]);
    $('#god-clock').textContent = clock(T);
    const nowMs = performance.now();
    if (!G.playing || nowMs - (G.dashAt || 0) > 220) { G.dashAt = nowMs; renderDash(live); }
    if (G.pick) showPick();
  }
  function fit(text, w) { let t = text; while (ctx.measureText(t).width > w && t.length > 3) t = t.slice(0, -2) + '…'; return t; }

  // ---------------------------------------------------------------- the live dashboard
  function liveStats(T) {
    const run = G.run, sts = G.stallsUsed;
    const out = { kcalBin: 0, kcalServed: 0, arrived: 0, inside: 0, served: 0, eating: 0, finished: 0, binG: 0, leftFood: 0, right: 0, hungry: 0, stuffed: 0, revenue: 0, profit: 0, small: 0, less: 0, more: 0,
      queue: 0, stalls: sts.map(() => ({ plates: 0, profit: 0, wasteG: 0, small: 0, less: 0, queue: 0 })) };
    for (const s of run.students) {
      if (s.t0 > T) continue;
      out.arrived++; if (T < s.tExit) out.inside++;
      const S = out.stalls[s.stall];
      if (s.tAt <= T && s.tStart > T) { out.queue++; S.queue++; }
      if (s.tServed <= T) {
        out.served++; out.revenue += s.price; out.profit += s.profit; S.plates++; S.profit += s.profit;
        if (s.size === 'small') { out.small++; S.small++; } if (s.size === 'less') { out.less++; S.less++; } if (s.size === 'more') out.more++;
      }
      if (s.tSeat <= T && s.tDone > T) out.eating++;
      if (s.tDone <= T) { out.finished++; out[s.fullness]++; if (s.leftover > cfg().params.leftThresholdG.value) out.leftFood++; }
      if (s.tBin <= T) { out.binG += s.leftover; S.wasteG += s.leftover; out.kcalBin += s.kcalWasted; }
      if (s.tServed <= T) out.kcalServed += s.kcal;
    }
    return out;
  }
  function renderDash(x) {
    const other = G.setting === 'today' ? 'justright' : 'today', prev = G.runs[other];
    const tot = G.run.totals.students;
    $('#god-dash').innerHTML = `
      <div class="card">
        <div class="god-kpis">
          <div class="kpi"><div class="v">${x.inside}</div><div class="l">in the canteen now (${x.arrived} of ${tot} arrived)</div></div>
          <div class="kpi"><div class="v">${x.queue}</div><div class="l">queuing</div></div>
          <div class="kpi"><div class="v">${x.eating}</div><div class="l">eating</div></div>
          <div class="kpi kbig"><div class="v">${kg(x.binG)}</div><div class="l">food in the waste bin${prev ? ` (${G.setting === 'today' ? 'Just Right' : 'Today'}: ${kg(prev.totals.wasteG)} all lunch)` : ''}</div></div>
          <div class="kpi"><div class="v">${x.finished ? pct(x.leftFood / x.finished) : 'none yet'}</div><div class="l">of finished meals left food</div></div>
          <div class="kpi"><div class="v">${Math.round(x.kcalBin).toLocaleString()}</div><div class="l">kcal of rice and noodles binned${x.served ? ` (${Math.round(x.kcalServed / x.served)} kcal a plate)` : ''}</div></div>
          <div class="kpi"><div class="v">${money(x.profit)}</div><div class="l">profit so far, all stalls (${money(x.revenue)} sales)</div></div>
        </div>
        <div class="god-full" aria-label="How full students felt">
          <span class="st right">${I('check')}${x.right} just right</span><span class="st hungry">${I('minus')}${x.hungry} still hungry</span><span class="st stuffed">${I('plus')}${x.stuffed} stuffed</span>
        </div>
        ${G.setting === 'justright' ? `<p class="small" style="margin:8px 0 0">${x.small} Small plates sold of ${x.served}.</p>` : `<p class="small" style="margin:8px 0 0">${x.less} asked for less rice; ${x.more} asked for more.</p>`}
      </div>
      <div class="card">
        <h3 style="margin-top:0">Each stall</h3>
        <div class="tscroll"><table class="small"><tr><th>Stall</th><th class="num">Queue</th><th class="num">Plates</th><th class="num">${G.setting === 'justright' ? 'Small' : 'Less rice'}</th><th class="num">In bin</th><th class="num">Profit</th></tr>
        ${G.stallsUsed.map((st, k) => { const S = x.stalls[k]; return `<tr><td>${esc(st.name)}</td><td class="num">${S.queue}</td><td class="num">${S.plates}</td><td class="num">${G.setting === 'justright' ? S.small : S.less}</td><td class="num">${(S.wasteG / 1000).toFixed(2)}</td><td class="num">${money(S.profit)}</td></tr>`; }).join('')}
        </table></div>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Waste bin over lunch</h3>
        ${binChart(prev)}
      </div>`;
  }
  function binChart(prev) {
    const w = 320, h = 140, padL = 34, padB = 22, endM = Math.max(G.run.totals.endMin, prev ? prev.totals.endMin : 0);
    const maxG = Math.max(1000, G.run.totals.wasteG, prev ? prev.totals.wasteG : 0) * 1.08;
    const X = m => padL + (m / endM) * (w - padL - 8), Y = g => (h - padB) - (g / maxG) * (h - padB - 8);
    const line = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    const ticks = [0, 30, 60, 90].filter(m => m <= endM);
    const kgTicks = [0, maxG / 2].map(g => Math.round(g / 500) * 500);
    const cur = G.binSeries, curName = G.setting === 'today' ? 'Today' : 'Just Right', prevName = curName === 'Today' ? 'Just Right' : 'Today';
    const prevPts = prev ? prev.binSeries : null;
    const last = cur[cur.length - 1];
    return `<svg viewBox="0 0 ${w} ${h}" class="god-chart" role="img" aria-label="Kilograms of food in the waste bin over lunch">
      ${kgTicks.map(g => `<line x1="${padL}" x2="${w - 8}" y1="${Y(g)}" y2="${Y(g)}" class="grid"/><text x="${padL - 6}" y="${Y(g) + 4}" text-anchor="end" class="ax">${(g / 1000).toFixed(1)}</text>`).join('')}
      ${ticks.map(m => `<text x="${X(m)}" y="${h - 6}" text-anchor="middle" class="ax">${clock(m)}</text>`).join('')}
      ${prevPts ? `<path d="${line(prevPts)}" class="ln prev ${prevName === 'Today' ? 'today' : 'jr'}"/>` : ''}
      ${cur.length > 1 ? `<path d="${line(cur)}" class="ln ${curName === 'Today' ? 'today' : 'jr'}"/>` : ''}
      ${last ? `<circle cx="${X(last[0])}" cy="${Y(last[1])}" r="4" class="pt ${curName === 'Today' ? 'today' : 'jr'}"/>` : ''}
    </svg>
    <div class="legend small"><span><i class="today"></i>Today</span><span><i class="jr"></i>Just Right</span><span class="muted">kg in bin</span></div>`;
  }
  function showPick() {
    const s = G.pick; if (!s) { $('#god-pick').innerHTML = ''; return; }
    const st = G.stallsUsed[s.stall], T = G.T;
    const where = T < s.tAt ? 'walking to a stall' : T < s.tStart ? `queuing at ${st.name}` : T < s.tServed ? 'ordering' : T < s.tSeat ? 'looking for a seat' : T < s.tDone ? 'eating' : T < s.tBin ? 'taking the plate to the bin' : T < s.tExit ? 'leaving' : 'gone';
    const sizeName = { regular: 'Regular', small: 'Small', less: 'less rice', more: 'add rice' }[s.size];
    const feel = { right: 'just right', hungry: 'still hungry', stuffed: 'stuffed' }[s.fullness];
    const why = { portion: 'too much on the plate', taste: 'did not like the taste', time: 'ran out of time' }[s.why];
    $('#god-pick').innerHTML = `<b>${esc(s.first || '')}</b>, ${esc(s.name)}${s.rusher ? ', in a rush' : ''}${s.budget ? ', budget-minded' : ''}: now ${where}.
      Wants about ${Math.round(s.need)} g. ${T >= s.tServed ? `Ordered ${sizeName} at ${esc(st.name)} (${Math.round(s.served)} g, ${money(s.price)}).` : ''}
      ${T >= s.tDone ? `Ate ${Math.round(s.eaten)} g, felt ${feel}${s.leftover > 0.5 ? `, left ${Math.round(s.leftover)} g${why ? ` (${why})` : ''}` : ', cleared the plate'}.` : ''}
      <button class="link small" id="god-unpick">Stop following</button>`;
    $('#god-unpick').onclick = () => { G.pick = null; showPick(); frame(); };
  }

  // ---------------------------------------------------------------- after lunch: compare
  function finish() {
    if (G.done) return;
    G.done = true; stop(); G.floats = [];
    G.T = G.run.totals.endMin + 0.01; G.skipping = true; frame(); G.skipping = false;
    // complete the chart series to the end
    const pts = []; for (let m = 0; m <= Math.ceil(G.run.totals.endMin); m++) pts.push([m, G.run.students.filter(s => s.tBin <= m).reduce((a, s) => a + s.leftover, 0)]);
    G.binSeries = pts; G.run.binSeries = pts;
    G.runs[G.setting] = G.run;
    $('#god-pause').innerHTML = I('arrow-counter-clockwise') + 'Run again';
    SND.play('fanfare');
    renderDash(liveStats(G.T));
    renderAfter();
  }
  function renderAfter() {
    const a = G.runs.today, b = G.runs.justright, other = G.setting === 'today' ? 'justright' : 'today';
    const btns = `<div class="actionsbar" style="margin-top:12px">
        ${!G.runs[other] ? `<button class="primary btn-ic" id="god-other">${I('arrow-counter-clockwise')}Same students, ${other === 'justright' ? 'with Just Right' : 'as Today'}</button>` : ''}
        <button class="btn-ic" id="god-back-setup">${I('storefront')}Change the stalls</button>
        <button class="btn-ic" id="god-new">${I('users')}New set of students</button>
      </div>`;
    if (!(a && b)) {
      $('#god-after').innerHTML = `<div class="card" style="margin-top:12px"><h2>Lunch is over</h2>
        <p>${kg(G.run.totals.wasteG)} of food went into the bin from ${G.run.totals.plates} plates. Now run the same ${G.run.totals.students} students ${other === 'justright' ? 'with Just Right' : 'as Today'} to compare.</p>${btns}</div>`;
    } else {
      const A = a.totals, B = b.totals;
      const row = (label, x, y, fmt, betterLow, dfmt) => { const d = y - x, f = dfmt || fmt, same = f(Math.abs(d)) === f(0);
        const good = !same && (betterLow ? d < 0 : d > 0), bad = !same && (betterLow ? d > 0 : d < 0);
        return `<tr><td>${label}</td><td class="num">${fmt(x)}</td><td class="num">${fmt(y)}</td><td class="num ${good ? 'better' : bad ? 'worse' : ''}">${same ? 'same' : (d > 0 ? '+' : '−') + f(Math.abs(d))}</td></tr>`; };
      const pts = x => Math.round(x * 100) + (Math.round(x * 100) === 1 ? ' point' : ' points');
      const g1 = x => kg(x), p1 = x => pct(x), n0 = x => String(Math.round(x)), m2 = x => money(x).replace('−', ''), s2 = x => x.toFixed(2);
      const why = k => [A.wasteWhy[k], B.wasteWhy[k]];
      const maxWhy = Math.max(...['portion', 'taste', 'time'].flatMap(why), 1);
      $('#god-after').innerHTML = `<div class="card" style="margin-top:12px">
        <h2>Today against Just Right, same ${A.students} students</h2>
        <div class="tscroll"><table><tr><th></th><th class="num">Today</th><th class="num">Just Right</th><th class="num">Change</th></tr>
          ${row('Food in the waste bin', A.wasteG, B.wasteG, g1, true)}
          ${row('Meals with food left', A.leftFood / A.plates, B.leftFood / B.plates, p1, true, pts)}
          ${row('Rice cooked', A.cookedG, B.cookedG, g1, true)}
          ${row('Rice cooked but not sold', A.unsoldG, B.unsoldG, g1, true)}
          ${row('Calories binned (rice and noodles)', A.kcalWasted, B.kcalWasted, x => Math.round(x).toLocaleString() + ' kcal', true)}
          ${row('Calories per plate', A.kcalServed / A.plates, B.kcalServed / B.plates, x => Math.round(x) + ' kcal', true)}
          ${row('Students just right', A.right, B.right, n0, false)}
          ${row('Students still hungry', A.hungry, B.hungry, n0, true)}
          ${row('Sales, all stalls', A.revenue, B.revenue, m2, false)}
          ${row('Rice bought, all stalls', A.riceCost, B.riceCost, m2, true)}
          ${row('Profit, all stalls', A.profit, B.profit, m2, false)}
          ${row('Profit margin', A.profit / A.revenue, B.profit / B.revenue, p1, false, x => (x * 100).toFixed(1) + ' points')}
          ${row('Average rating', A.rating, B.rating, s2, false)}
        </table></div>
        <h3>Each stall</h3>
        <div class="tscroll"><table class="small god-cmp"><tr><th>Stall</th><th class="num">Plates</th><th class="num">In bin (kg)</th><th class="num">Profit</th><th class="num">Margin</th></tr>
          ${G.stallsUsed.map((st, k) => { const x = a.stalls[k], y = b.stalls[k];
            const cell = (u, w, f, low) => { const d = w - u, good = low ? d < -1e-9 : d > 1e-9, bad = low ? d > 1e-9 : d < -1e-9; return `<td class="num">${f(u)} → <span class="${good ? 'better' : bad ? 'worse' : ''}">${f(w)}</span></td>`; };
            return `<tr><td>${esc(st.name)}</td>${cell(x.plates, y.plates, n0, false)}${cell(x.wasteG, y.wasteG, v => (v / 1000).toFixed(2), true)}${cell(x.profit, y.profit, money, false)}${cell(x.revenue ? x.profit / x.revenue : 0, y.revenue ? y.profit / y.revenue : 0, pct, false)}</tr>`; }).join('')}
        </table></div>
        <p class="muted small">Each cell reads Today → Just Right.</p>
        <h3>Why food went in the bin</h3>
        <div class="god-why">${[['portion', 'Too much on the plate'], ['taste', 'Did not like the taste'], ['time', 'Ran out of time']].map(([k, lab]) => `
          <div class="wrow"><span class="small">${lab}</span>
            <span class="wbar"><i class="today" style="width:${(why(k)[0] / maxWhy) * 100}%"></i></span><span class="num small">${kg(why(k)[0])}</span>
            <span></span><span class="wbar"><i class="jr" style="width:${(why(k)[1] / maxWhy) * 100}%"></i></span><span class="num small">${kg(why(k)[1])}</span></div>`).join('')}
          <div class="legend small"><span><i class="today"></i>Today</span><span><i class="jr"></i>Just Right</span></div>
        </div>
        <p class="small">Just Right mostly cuts the waste from plates that were too big. Waste from taste and from rushing changes little: a smaller plate does not fix those.</p>
        ${B.profit < A.profit ? (() => { const over = G.stallsUsed.filter(st => C.effectiveDiscount(st) > C.smallBreakEven(cfg(), st) + 1e-9);
          return `<div class="note warn">Profit fell by ${money(A.profit - B.profit)}. ${over.length ? `At ${over.map(st => esc(st.name)).join(', ')} the Small discount is bigger than the rice a Small saves. Try a smaller discount there and run it again.` : 'Every discount is within the rice saved, so this is students moving between stalls (and the luck of one lunch). Try another set of students, or other prices.'}</div>`; })()
          : `<div class="note good">Profit rose by ${money(B.profit - A.profit)} while ${kg(A.wasteG - B.wasteG)} less food went in the bin.</div>`}
        <p class="muted small">A simulation under stated assumptions (stall prices, portions, how students choose, eating speed), not real sales data. Our survey suggests about 28% of meals leave food; this canteen has two huge-plate stalls, so it leaves more.</p>
        ${btns}</div>`;
    }
    if ($('#god-other')) $('#god-other').onclick = () => start(other);
    $('#god-back-setup').onclick = () => { stop(); showSetup(); window.scrollTo(0, 0); };
    $('#god-new').onclick = () => { G.seed = U.newSeed(); G.runs = {}; checkSig(); start('today'); };
  }
})();
