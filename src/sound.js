/* Just Right: sound effects and background music.
   Everything is synthesised live with the Web Audio API, so there are no audio files and nothing to license.
   Browsers only allow sound after the player taps or clicks, so the first tap "unlocks" audio. */
(function (root) {
  'use strict';
  const STORE = 'jr-sound-v1';
  let prefs = { sfx: true, music: false };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { /* storage blocked */ }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

  let ctx = null, sfxBus = null, musicBus = null;
  function ensure() {
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(comp);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.0; musicBus.connect(comp);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ---------- building blocks
  function tone(f, t0, dur, o = {}) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
    const peak = o.gain == null ? 0.25 : o.gain, a = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(t0, dur, o = {}) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = o.filter || 'bandpass'; f.frequency.value = o.freq || 1800; f.Q.value = o.q || 1.2;
    g.gain.setValueAtTime(o.gain || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
  const N = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5, E3: 164.81, G3: 196.0, A3: 220.0, C3: 130.81, F3: 174.61, F4: 349.23 };

  // ---------- the effects
  const SFX = {
    click(t) { tone(1400, t, 0.05, { type: 'triangle', gain: 0.16 }); },
    serve(t) { noise(t, 0.06, { freq: 3200, q: 3, gain: 0.12 }); tone(N.E5, t, 0.18, { type: 'triangle', gain: 0.12 }); tone(N.A5 * 1.5, t + 0.01, 0.25, { gain: 0.05 }); },
    coin(t) { tone(N.E5 * 2, t, 0.09, { type: 'square', gain: 0.05 }); tone(N.A5 * 2, t + 0.07, 0.22, { type: 'square', gain: 0.05 }); },
    good(t) { [N.C5, N.E5, N.G5].forEach((f, i) => tone(f, t + i * 0.07, 0.22, { type: 'triangle', gain: 0.14 })); },
    ok(t) { tone(N.G4, t, 0.16, { type: 'triangle', gain: 0.12 }); tone(N.C5, t + 0.09, 0.2, { type: 'triangle', gain: 0.12 }); },
    bad(t) { tone(N.E4, t, 0.18, { type: 'sawtooth', gain: 0.06, slide: N.C4 }); tone(N.C4, t + 0.16, 0.3, { type: 'sawtooth', gain: 0.06, slide: 196 }); },
    walk(t) { tone(600, t, 0.4, { type: 'sine', gain: 0.1, slide: 160 }); noise(t, 0.3, { filter: 'lowpass', freq: 900, gain: 0.05 }); },
    bite(t) { noise(t, 0.05, { freq: 2400, q: 2, gain: 0.16 }); noise(t + 0.06, 0.05, { freq: 1700, q: 2, gain: 0.12 }); },
    full(t) { tone(N.G4, t, 0.12, { type: 'triangle', gain: 0.1 }); tone(N.G5, t + 0.08, 0.2, { type: 'triangle', gain: 0.1 }); },
    tick(t) { tone(2000, t, 0.03, { type: 'square', gain: 0.03 }); },
    fanfare(t) { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, t + i * 0.09, i === 3 ? 0.6 : 0.16, { type: 'triangle', gain: 0.14 })); tone(N.C4, t + 0.27, 0.6, { type: 'sine', gain: 0.1 }); },
    sad(t) { [N.G4, N.E4, N.C4].forEach((f, i) => tone(f, t + i * 0.12, 0.25, { type: 'triangle', gain: 0.1 })); },
  };
  function play(name) {
    if (!prefs.sfx || !SFX[name] || !ensure()) return;
    SFX[name](ctx.currentTime + 0.005);
  }

  // ---------- background music: a quiet, looping canteen tune (pentatonic, so it never clashes)
  const BPM = 96, STEP = 60 / BPM / 2;           // eighth notes
  const MELODY = [N.E5, 0, N.G5, N.E5, N.D5, 0, N.C5, 0, N.D5, N.E5, 0, N.G5, N.A5, 0, N.G5, 0,
                  N.E5, 0, N.D5, N.C5, N.D5, 0, N.E5, 0, N.C5, 0, N.A4, 0, N.C5, 0, 0, 0];
  const BASS = [N.C3, N.G3, N.A3, N.E3, N.F3, N.C3, N.G3, N.G3];   // one note per four steps
  let step = 0, nextTime = 0, timer = null;
  function scheduler() {
    while (nextTime < ctx.currentTime + 0.25) {
      const m = MELODY[step % MELODY.length];
      if (m) tone(m, nextTime, STEP * 1.6, { type: 'triangle', gain: 0.07, bus: musicBus });
      if (step % 4 === 0) tone(BASS[(step / 4) % BASS.length], nextTime, STEP * 3.6, { type: 'sine', gain: 0.12, bus: musicBus });
      if (step % 2 === 1) noise(nextTime, 0.03, { freq: 7000, q: 1, gain: 0.025, bus: musicBus });
      nextTime += STEP; step++;
    }
  }
  function startMusic() {
    if (!ensure() || timer) return;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(0.5, ctx.currentTime, 0.4);
    nextTime = ctx.currentTime + 0.1; timer = setInterval(scheduler, 60);
  }
  function stopMusic() {
    if (!timer) return;
    clearInterval(timer); timer = null;
    if (ctx) musicBus.gain.setTargetAtTime(0.0, ctx.currentTime, 0.15);
  }
  // pause music while the tab is hidden
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); else if (prefs.music && ctx) startMusic(); });

  // first tap anywhere unlocks audio and starts music if it is switched on
  function unlock() { if (ensure() && prefs.music) startMusic(); }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { once: false, passive: true }));

  root.JR_SOUND = {
    play,
    sfxOn: () => prefs.sfx, musicOn: () => prefs.music,
    setSfx(on) { prefs.sfx = !!on; save(); if (on) play('click'); },
    setMusic(on) { prefs.music = !!on; save(); if (on) startMusic(); else stopMusic(); },
  };
})(window);
