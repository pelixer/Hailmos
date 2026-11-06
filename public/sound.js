/* Hailmos ambient: synthesised live, no audio files, no melody, no events.
   Built for focus: only steady-state sound (a changing, event-like sound pulls attention; a steady one fades from notice),
   nothing below ~140 Hz (no rumble), nothing struck (no bells, no plucks).
   · a far "solar wind": soft pink noise through a slowly drifting band, wide and decorrelated left/right
   · a glass pad: an open fifth stack (A3 E4 B4 E5 B5, weighted to the middle, no third: neither bright nor sad) of pure tones that breathe in and out
     on long, unrelated cycles, like tape loops drifting out of phase, so it never repeats and never forms a line
   · a long dark hall reverb that turns both into one distant space
   reacts to the voyage: fades in on launch, muffles when the ship is pulled off, opens a touch on landing, fades out at home */
'use strict';
const HMSound = (() => {
  const KEY = 'hailmos.sound';
  let on = true; try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) {}
  let ac = null, out = null, mlp = null, playing = false, state = 'orbit', stopT = 0;
  const now = () => ac.currentTime;

  // pink noise (Kellet's filter), its two ends faded together so the loop has no seam
  function pink(sec) { const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
      const f = Math.floor(ac.sampleRate * 0.08); for (let i = 0; i < f; i++) { const k = i / f; d[i] *= k; d[n - 1 - i] *= k; } }
    return b; }
  function impulse(sec) { const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b; }
  // a very slow sine wobble on an AudioParam: centre ± depth, one cycle every `per` seconds
  function drift(param, per, depth, phase) { const l = ac.createOscillator(); l.frequency.value = 1 / per; const g = ac.createGain(); g.gain.value = depth;
    l.connect(g); g.connect(param); l.start(now() + (phase || 0) * per); return l; }

  function build() {
    out = ac.createGain(); out.gain.value = 0;
    // master tone: closes when the ship is adrift; a high-pass keeps every rumble out
    mlp = ac.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 6000; mlp.Q.value = 0.4;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140; hp.Q.value = 0.5;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 2.5; comp.attack.value = 0.05; comp.release.value = 0.8;
    out.connect(hp); hp.connect(mlp); mlp.connect(comp); comp.connect(ac.destination);
    // long dark hall
    const rev = ac.createConvolver(); rev.buffer = impulse(7); const rlp = ac.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 3200;
    const rg = ac.createGain(); rg.gain.value = 0.7; const revIn = ac.createGain(); revIn.connect(rev); rev.connect(rlp); rlp.connect(rg); rg.connect(out);

    // solar wind: two pink loops of unrelated length, each through its own drifting band
    [[9.7, 520, 0.6, 31, 0], [13.3, 1300, 0.9, 43, 0.5]].forEach(([sec, fc, q, per, ph], i) => {
      const s = ac.createBufferSource(); s.buffer = pink(sec); s.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = q; drift(bp.frequency, per, fc * 0.35, ph);
      const g = ac.createGain(); g.gain.value = i ? 0.09 : 0.14; drift(g.gain, per * 1.37, i ? 0.025 : 0.04, ph + 0.25);
      s.connect(bp); bp.connect(g); g.connect(out); const ws = ac.createGain(); ws.gain.value = 0.25; g.connect(ws); ws.connect(revIn); s.start(); });

    // glass pad: pure tones, each a slightly detuned pair (slow, gentle chorus), breathing on its own long cycle
    const pad = ac.createGain(); pad.gain.value = 1; const plp = ac.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 1800; plp.Q.value = 0.3;
    pad.connect(plp); const dry = ac.createGain(); dry.gain.value = 0.35; const wet = ac.createGain(); wet.gain.value = 0.9; plp.connect(dry); dry.connect(out); plp.connect(wet); wet.connect(revIn);
    [[220.0, 0.014, 37, 0.0], [329.63, 0.03, 29, 0.35], [493.88, 0.026, 47, 0.6], [659.26, 0.016, 53, 0.15], [987.77, 0.006, 61, 0.8]].forEach(([f, a, per, ph]) => {
      const g = ac.createGain(); g.gain.value = a * 0.55; drift(g.gain, per, a * 0.45, ph);
      [[f, -0.25], [f * 1.0018, 0.25]].forEach(([fr, pan]) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
        const p = ac.createStereoPanner ? ac.createStereoPanner() : null; if (p) { p.pan.value = pan; o.connect(p); p.connect(g); } else o.connect(g); o.start(); });
      g.connect(pad); });
  }

  function level() { return on ? 1.3 : 0; }
  function to(param, v, sec) { const t = now(); param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(v, t + sec); }
  return {
    // call inside a user gesture (the launch tap): iOS only lets audio start from one
    start() { const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      // play even with the silent switch on
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      if (!ac) { ac = new C(); build(); } clearTimeout(stopT); ac.resume(); playing = true; state = 'orbit';
      // a slow fade in with the opening
      to(out.gain, level(), 8); to(mlp.frequency, 6000, 0.1); },
    phase(kind) { if (playing && state !== 'adrift') state = kind === 'leg' ? 'leg' : 'orbit'; },
    adrift(a) { if (!playing || !ac) return; state = a ? 'adrift' : 'leg'; const t = now();
      mlp.frequency.cancelScheduledValues(t); mlp.frequency.setValueAtTime(mlp.frequency.value, t); mlp.frequency.exponentialRampToValueAtTime(a ? 700 : 6000, t + (a ? 1.4 : 2.0));
      to(out.gain, a ? level() * 0.6 : level(), 1.6); },
    // landing: the space opens a little and settles back, nothing struck
    land() { if (!playing || !ac) return; state = 'orbit'; const t = now();
      mlp.frequency.cancelScheduledValues(t); mlp.frequency.setValueAtTime(mlp.frequency.value, t); mlp.frequency.linearRampToValueAtTime(9000, t + 2.5); mlp.frequency.linearRampToValueAtTime(6000, t + 9); },
    stop() { if (!ac || !playing) return; playing = false; to(out.gain, 0, 2.2);
      stopT = setTimeout(() => { if (!playing) ac.suspend(); }, 2500); },
    toggle() { on = !on; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
      if (ac && playing) to(out.gain, state === 'adrift' ? level() * 0.6 : level(), 0.8);
      return on; },
    get on() { return on; },
  };
})();
