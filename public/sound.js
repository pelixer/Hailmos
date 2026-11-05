/* Hailmos ambient: synthesised live, no audio files, no melody.
   a humming low drone · a dark brown-noise bed · sparse music-box tines picked at random from a dark set (never stepwise)
   reacts to the voyage: swells in on launch, muffles when the ship is pulled off, a low triad on landing, fades out at home */
'use strict';
const HMSound = (() => {
  const KEY = 'hailmos.sound';
  let on = true; try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) {}
  let ac = null, out = null, mlp = null, droneLP = null, tineBus = null, revIn = null, playing = false, state = 'orbit', timer = 0, lastNote = -1, stopT = 0;
  const now = () => ac.currentTime;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const DARK = [57, 60, 62, 65, 67, 69, 72, 74];   // A3 C4 D4 F4 G4 A4 C5 D5 — D minor pentatonic, kept low and mid

  function noise(sec, brown) { const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
      const f = Math.min(n >> 1, Math.floor(ac.sampleRate * 0.05)); for (let i = 0; i < f; i++) { const k = i / f; d[i] *= k; d[n - 1 - i] *= k; } }   // seamless loop ends
    return b; }
  function impulse(sec) { const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    return b; }

  function build() {
    out = ac.createGain(); out.gain.value = 0;
    mlp = ac.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 7000; mlp.Q.value = 0.5;   // master tone: closes when the ship is adrift
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
    out.connect(mlp); mlp.connect(comp); comp.connect(ac.destination);
    // dark reverb
    const rev = ac.createConvolver(); rev.buffer = impulse(5.5); const rlp = ac.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 2200;
    const rg = ac.createGain(); rg.gain.value = 0.55; revIn = ac.createGain(); revIn.connect(rev); rev.connect(rlp); rlp.connect(rg); rg.connect(out);
    // humming drone: D2 saw pair (slow beating) + A2 triangle, through a breathing low-pass; a sine sub for headphones
    droneLP = ac.createBiquadFilter(); droneLP.type = 'lowpass'; droneLP.frequency.value = 380; droneLP.Q.value = 1.2;
    const dg = ac.createGain(); dg.gain.value = 0.2; droneLP.connect(dg); dg.connect(out); const ds = ac.createGain(); ds.gain.value = 0.08; dg.connect(ds); ds.connect(revIn);
    // D3 layer: the hum stays audible on a phone speaker
    [[73.42, 'sawtooth', 0.38], [73.42 * 1.0035, 'sawtooth', 0.34], [110.0, 'triangle', 0.35], [146.83, 'triangle', 0.9], [146.83 * 0.997, 'sawtooth', 0.22]].forEach(([f, t, g]) => { const o = ac.createOscillator(); o.type = t; o.frequency.value = f; const gg = ac.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(droneLP); o.start(); });
    const sub = ac.createOscillator(); sub.frequency.value = 36.71; const sg = ac.createGain(); sg.gain.value = 0.09; sub.connect(sg); sg.connect(out); sub.start();
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07; const lg = ac.createGain(); lg.gain.value = 170; lfo.connect(lg); lg.connect(droneLP.frequency); lfo.start();   // the "woom… woom"
    const alfo = ac.createOscillator(); alfo.frequency.value = 0.11; const ag = ac.createGain(); ag.gain.value = 0.05; alfo.connect(ag); ag.connect(dg.gain); alfo.start();
    // brown-noise bed: two loops of different length so it never audibly repeats
    [7.3, 11.1].forEach((sec, i) => { const s = ac.createBufferSource(); s.buffer = noise(sec, true); s.loop = true; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = i ? 520 : 760;
      const g = ac.createGain(); g.gain.value = 0.045; s.connect(lp); lp.connect(g); g.connect(out); s.start(); });
    // music-box tines bus: softened top, mostly into the reverb
    tineBus = ac.createGain(); const tlp = ac.createBiquadFilter(); tlp.type = 'lowpass'; tlp.frequency.value = 2600; const dry = ac.createGain(); dry.gain.value = 0.32; const wet = ac.createGain(); wet.gain.value = 0.85;
    tineBus.connect(tlp); tlp.connect(dry); dry.connect(out); tlp.connect(wet); wet.connect(revIn);
  }

  // one comb tine: fundamental + two inharmonic partials, instant attack, long dark decay
  function tine(m, vel, at) { const t = at || now(), f = mtof(m);
    [[1, 1, 2.8], [2.76, 0.22, 0.9], [5.4, 0.06, 0.35]].forEach(([r, a, dec]) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f * r; const g = ac.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * a * 0.18, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); o.connect(g); g.connect(tineBus); o.start(t); o.stop(t + dec + 0.05); }); }
  // random, never stepwise: skip the last note and its neighbours, so no line forms
  function pick() { let i, tries = 0; do { i = Math.floor(Math.random() * DARK.length); tries++; } while (tries < 20 && lastNote >= 0 && Math.abs(i - lastNote) <= 1); lastNote = i; return DARK[i]; }
  function loop() { clearTimeout(timer); if (!playing) return;
    if (state !== 'adrift') { const m = pick(), v = 0.45 + 0.45 * Math.random(); tine(m, v); if (Math.random() < 0.18) tine(m - 12, v * 0.5, now() + 0.02); }
    const gap = state === 'leg' ? 2.4 + Math.random() * 3.4 : 4 + Math.random() * 5; timer = setTimeout(loop, gap * 1000); }

  function level() { return on ? 0.85 : 0; }
  return {
    // call inside a user gesture (the launch tap): iOS only lets audio start from one
    start() { const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}   // play even with the silent switch on
      if (!ac) { ac = new C(); build(); } clearTimeout(stopT); ac.resume(); playing = true; state = 'orbit';
      const t = now(); out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(level(), t + 6);   // swells in with the opening
      mlp.frequency.cancelScheduledValues(t); mlp.frequency.setValueAtTime(7000, t); clearTimeout(timer); timer = setTimeout(loop, 3500); },
    phase(kind) { if (playing && state !== 'adrift') state = kind === 'leg' ? 'leg' : 'orbit'; },
    adrift(a) { if (!playing || !ac) return; state = a ? 'adrift' : 'leg'; const t = now();
      mlp.frequency.cancelScheduledValues(t); mlp.frequency.setValueAtTime(mlp.frequency.value, t); mlp.frequency.exponentialRampToValueAtTime(a ? 380 : 7000, t + (a ? 1.2 : 1.8));
      out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(a ? level() * 0.6 : level(), t + 1.4); },
    land() { if (!playing || !ac) return; state = 'orbit'; const t = now() + 0.1; [50, 57, 62].forEach((m, i) => tine(m, 0.8 - i * 0.12, t + i * 0.16)); },
    stop() { if (!ac || !playing) return; playing = false; clearTimeout(timer); const t = now(); out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + 1.6);
      stopT = setTimeout(() => { if (!playing) ac.suspend(); }, 1800); },
    toggle() { on = !on; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
      if (ac && playing) { const t = now(); out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(state === 'adrift' ? level() * 0.6 : level(), t + 0.8); }
      return on; },
    get on() { return on; },
  };
})();
