/* Hailmos app: home (light streak) → timer sheet (time · route) → one-shot opening → focus voyage → landing → home */
'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const stage = $('#stage');
  // the app fills the real screen (no letterboxing); the 3D and streak canvases render at its true size
  let W = Math.max(320, stage.clientWidth || innerWidth), H = Math.max(480, stage.clientHeight || innerHeight);
  const measure = () => { const w = Math.max(320, stage.clientWidth || innerWidth), h = Math.max(480, stage.clientHeight || innerHeight); const ch = Math.abs(w - W) > 1 || Math.abs(h - H) > 1; W = w; H = h; return ch; };
  addEventListener('resize', () => { if (measure() && app.mode === 'home') startStreak(); });
  const DEMO = /[?&]demo\b/.test(location.search);   // ?demo → the leg lasts 24 s instead of the chosen minutes (for review)

  // ---------- persistence (on this device only) ----------
  const KEY = 'hailmos.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
  const saved = load();
  const app = { mode: 'home', last: saved.last || null, voy: null, lock: null, flying: null };
  const core = new TimerCore({ visited: saved.visited && saved.visited.length ? saved.visited : ['Earth'], edges: saved.edges || {}, t: saved.t || 40 }, { onLaunch: (m) => launch(m) });
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ visited: core.state.visited, edges: core.state.edges, t: core.state.t, last: app.last })); } catch (e) {} };

  // ---------- home ----------
  const home = $('#home'), streakCv = $('canvas.lg-streak', home);
  let cl = null, stopStreak = null;
  const startStreak = () => { if (stopStreak) stopStreak(); measure(); cl = { on: false, px: 169 * W / 390, py: 476 * H / 844, k: 1, rot: 0, sx: 1, z: 1, soft: 0, spd: 1 }; stopStreak = HM.streaks(streakCv, W, H, { dpr: 2, speeds: [14, 30, 55], hairAlpha: 0.42, collapse: cl }); };
  const fx = (v) => (v < 10 ? v.toFixed(2) : v < 1000 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US'));
  const clock = (t) => (t < 60 ? t + ':00' : Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0') + ':00');
  const setHomeRoute = () => { const m = app.last;
    $('#h-rt').textContent = m ? m.o.name.toUpperCase() + ' → ' + m.d.name.toUpperCase() : 'FROM ' + (core.state.visited[core.state.visited.length - 1] || 'Earth').toUpperCase();
    $('#h-rs').textContent = m ? fx(m.dv) + ' ' + m.du + ' · ' + clock(m.t) : 'SET A COURSE'; };
  const hbtn = (label) => $('#home button[aria-label="' + label + '"]');
  hbtn('목적지').addEventListener('click', () => openSheet());
  hbtn('출항').addEventListener('click', () => { if (app.last && app.mode === 'home') launch(app.last, true); else openSheet(); });
  hbtn('항해 기록').addEventListener('click', () => openLog());

  // ---------- timer sheet ----------
  const sheet = $('#sheet'), list = $('#s-list'), slider = $('#rt-min'), search = $('#rt-q');
  const REG = ['태양계', '이웃 별', '태양 근방', '근거리 탐사', '케플러 영역', '먼 원반', '은하 중심'];
  let sheetV = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const streakSvg = (lines) => '<svg width="54" height="10" viewBox="0 0 54 10" aria-hidden="true" style="display:block;overflow:visible">' + lines.map((l) => '<line x1="' + l.x1 + '" y1="' + l.y + '" x2="' + l.x2 + '" y2="' + l.y + '" stroke="' + l.c + '" stroke-opacity="' + l.o + '" stroke-width="' + l.sw + '" stroke-linecap="round"></line>').join('') + '</svg>';
  let selKey = '';
  const renderSel = () => {
    const v = sheetV, box = $('#s-sel'); if (!v || !v.sel) { box.innerHTML = ''; selKey = ''; return; }
    const tx = $('#s-seltx', box);
    if (tx && selKey === v.sel.text) { tx.textContent = core.scr('sel', v.sel.text); return; }   // same route: only the scrambling name changes, the bar stays put
    selKey = v.sel.text;
    box.innerHTML = '<div class="rt-toast" style="position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 14px);height:76px;border-radius:38px;background:rgba(18,12,9,0.92);box-shadow:inset 0 0 0 1px rgba(255,217,176,0.28),0 18px 40px rgba(0,0,0,0.7);display:flex;align-items:center;padding:0 12px 0 24px;gap:12px;z-index:3">'
      + '<div style="flex:1;min-width:0"><div id="s-seltx" style="font-family:\'Michroma\',sans-serif;font-size:10px;letter-spacing:0.16em;color:#fff3e2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(core.scr('sel', v.sel.text)) + '</div><div style="margin-top:6px;font-size:10px;color:rgba(255,234,210,0.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(v.sel.sub) + '</div></div>'
      + '<div id="s-go">' + LAUNCH_BTN + '</div></div>';
    $('#s-go button').addEventListener('click', () => core.launchGo());
  };
  const renderSheet = () => {
    const st = core.state, v = sheetV = core.vals(40), R = core.D().rows, tot = v.total.toLocaleString('en-US'), p = ((st.t / 10 - 1) / 17 * 100).toFixed(1);
    $('#s-time').textContent = core.tt(st.t); $('#s-total').textContent = tot + ' ROUTES'; $('#s-flown').textContent = v.done + ' / ' + tot + ' FLOWN';
    if (+slider.value !== st.t / 10) slider.value = st.t / 10;
    slider.style.background = 'linear-gradient(90deg, #f3c48a 0%, #ea8a48 ' + p + '%, rgba(255,226,190,0.16) ' + p + '%)';
    let h = '';
    v.groups.forEach((g, gi) => { const oi = core._ix[g.o], oSub = [R[oi][7], REG[R[oi][1]]].filter(Boolean).join(' · ');
      h += '<div style="position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:14px;padding:12px 20px 12px 14px;background:linear-gradient(180deg,#000 82%,rgba(0,0,0,0))">'
        + '<canvas data-pl="' + esc(g.o) + '" data-spin="1" width="128" height="128" aria-label="' + esc(g.o) + '" style="width:64px;height:64px;flex:0 0 64px;mix-blend-mode:screen"></canvas>'
        + '<div style="flex:1;min-width:0"><div style="font-size:9px;letter-spacing:0.32em;color:rgba(255,234,210,0.5)">FROM</div><div style="margin-top:5px;font-family:\'Michroma\',sans-serif;font-size:17px;letter-spacing:0.06em;color:#fff3e2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(g.oUp) + '</div><div style="margin-top:5px;font-size:9.5px;color:rgba(255,234,210,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(oSub) + '</div></div>'
        + '<div style="text-align:right"><div style="font-family:\'Michroma\',sans-serif;font-size:15px;color:#ffd9b0">' + g.count + '</div><div style="margin-top:5px;font-size:8.5px;letter-spacing:0.24em;color:rgba(255,234,210,0.42)">ROUTES</div></div></div>';
      g.rows.forEach((r, ri) => { h += '<button class="rt-b" data-g="' + gi + '" data-r="' + ri + '" style="' + r.style + ';width:calc(100% - 24px);margin:0 12px;min-height:54px;border:0;border-radius:12px;padding:8px 10px 8px 6px;display:grid;grid-template-columns:30px minmax(0,1fr) 62px;gap:0 12px;align-items:center;text-align:left;cursor:pointer;font-family:\'Geist Mono\',\'Noto Sans KR\',monospace">'
        + '<canvas data-pl="' + esc(r.name) + '" width="60" height="60" aria-hidden="true" style="width:30px;height:30px;mix-blend-mode:screen"></canvas>'
        + '<span style="min-width:0"><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:\'Michroma\',sans-serif;font-size:10.5px;letter-spacing:0.08em;' + r.nameStyle + '">' + esc(r.name) + '</span><span style="display:block;margin-top:3px;font-size:9.5px;color:rgba(255,234,210,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.sub) + '</span></span>'
        + '<span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' + streakSvg(r.lines) + '<span style="font-size:9.5px;color:#ffd9b0">' + esc(r.mark) + '</span></span></button>'; });
      if (g.hasMore) h += '<div style="padding:6px 22px 16px;font-size:9.5px;letter-spacing:0.2em;color:rgba(255,234,210,0.38)">' + esc(g.more) + '</div>'; });
    if (!v.groups.length) h = '<div style="padding:40px 20px;text-align:center;font-size:11px;color:rgba(255,234,210,0.45)">' + (st.q ? '이 이름의 행성이 이 시간 거리에 없습니다' : '이 시간 거리에 갈 수 있는 곳이 없습니다') + '</div>';
    list.innerHTML = h; renderSel();
  };
  core.onChange = (patch) => { if (patch && '_scT' in patch) { if (app.mode === 'sheet') renderSel(); return; } if (patch && 't' in patch) save(); if (app.mode === 'sheet') renderSheet(); };
  list.addEventListener('click', (e) => { const b = e.target.closest('button[data-g]'); if (!b || !sheetV) return; const r = sheetV.groups[+b.dataset.g].rows[+b.dataset.r]; if (r) r.pick(); });
  slider.addEventListener('input', () => core.setState({ t: +slider.value * 10, sel: null }));
  search.addEventListener('input', () => core.setState({ q: search.value, sel: null }));
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') search.blur(); });
  const openSheet = () => { if (app.mode !== 'home') return; app.mode = 'sheet'; core.state.sel = null; core.state.q = ''; search.value = ''; renderSheet(); list.scrollTop = 0; sheet.classList.add('open');
    core._dead = false; cancelAnimationFrame(core._raf); core._raf = requestAnimationFrame((t) => core.plTick(t)); };
  const closeSheet = () => { sheet.classList.remove('open'); if (app.mode === 'sheet') app.mode = 'home'; setTimeout(() => { if (!sheet.classList.contains('open')) { core._dead = true; cancelAnimationFrame(core._raf); } }, 700); };
  $('#s-close').addEventListener('click', closeSheet);

  // ---------- flight log ----------
  const logEl = $('#log');
  const openLog = () => { if (app.mode !== 'home') return; app.mode = 'log'; const E = Object.entries(core.state.edges).sort((a, b) => b[1] - a[1]);
    $('#g-count').textContent = E.length + ' ROUTES · ' + core.state.visited.length + ' PLANETS';
    $('#g-list').innerHTML = E.length ? E.map(([k, n]) => { const [a, b] = k.split('|'); return '<div style="display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid rgba(255,226,190,0.08)"><div style="flex:1;min-width:0;font-family:\'Michroma\',sans-serif;font-size:10.5px;letter-spacing:0.08em;color:#ffd9b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(a.toUpperCase()) + ' ↔ ' + esc(b.toUpperCase()) + '</div>' + streakSvg(core.streak(n, 54)) + '<div style="width:28px;text-align:right;font-size:10px;color:#ffd9b0">×' + n + '</div></div>'; }).join('')
      : '<div style="padding:40px 20px;text-align:center;font-size:11px;color:rgba(255,234,210,0.45)">아직 다녀온 항로가 없습니다</div>';
    logEl.classList.add('open'); };
  const closeLog = () => { logEl.classList.remove('open'); if (app.mode === 'log') app.mode = 'home'; };
  $('#g-close').addEventListener('click', closeLog);

  // ---------- focus voyage ----------
  const voyEl = $('#voy');
  class Voyage {
    constructor(m) {
      this.m = m; this.st = { kind: 'orbit', k: 0, p: 0, final: false, on: true }; this.frames = 0; this.side = null; this.hd = null;
      this.meta = [m.o, m.d].map((x) => ({ name: x.name.toUpperCase(), data: x.data }));
      voyEl.classList.add('introing'); voyEl.classList.remove('calm'); voyEl.style.display = 'block';
      const tag = $('.jh-tag', voyEl); tag.style.opacity = 0; $('.jh-lp', tag).style.strokeDashoffset = 100; $('.jh-dm', tag).style.opacity = 0;
      const leg = DEMO ? 24 : m.t * 60, size = (v) => Object.assign({}, v, { orbitK: (v.orbitK || 2.32) * 1.125 });   // planet 20 % smaller against an orbit 10 % smaller on screen
      measure(); this.W = W; this.H = H;
      this.eng = HM.multiJourney($('canvas.jh-gl', voyEl), W, H, { glDpr: Math.min(3, window.devicePixelRatio || 2), routeStyle: 'bundle', shipScale: 0.021, vantFit: 1.325 / 0.9, reattachPx: 44,
        cruise: Math.max(16, Math.min(700, 0.6 * leg)), planetsData: { list: [size(m.o.v), size(m.d.v)] }, legDur: leg,
        intro: { dur: 8.8 }, introSrc: () => streakCv, introGo: false, onIntroEnd: () => voyEl.classList.remove('introing'),
        onState: (v) => { this.st.on = v; this.sync(); this.render(); }, onPhase: (ph) => this.phase(ph), onFrame: (f) => this.frame(f) });
      this.fire = HM.fireTimer($('canvas.jh-tm', voyEl), 390, 92, { size: 50 }); this.sync(); this.render();
    }
    go() { this.eng.set('introGo', true); }
    total() { return this.m.t * 60; }
    remain() { const s = this.st; if (s.kind === 'leg') return Math.max(0, Math.ceil((1 - s.p) * this.total())); return s.k === 0 ? this.total() : 0; }
    text() { const r = this.remain(), h = Math.floor(r / 3600), mm = Math.floor((r % 3600) / 60), pad = (n) => String(n).padStart(2, '0'); return (h ? h + ':' + pad(mm) : pad(Math.floor(r / 60))) + ':' + pad(r % 60); }
    sync() { this.fire.set(this.text()); this.fire.calm(!this.st.on || this.st.kind === 'orbit'); $('.jh-tw', voyEl).setAttribute('aria-label', this.text()); }
    render() {
      const s = this.st, M = this.meta, here = M[s.k], next = M[Math.min(1, s.k + 1)], lb = $('.jh-lb', voyEl);
      const label = !s.on ? 'ADRIFT' : s.kind === 'orbit' ? (s.final ? 'LANDED · ' : 'ORBIT · ') + here.name : s.p < 0.05 ? 'DEPART · ' + here.name : s.p > 0.93 ? 'APPROACH · ' + next.name : 'EN ROUTE · ' + next.name;
      const ls = label.length > 24 ? 0.16 : label.length > 18 ? 0.26 : 0.42; lb.textContent = label; lb.style.fontSize = (label.length > 24 ? 9 : 10) + 'px'; lb.style.letterSpacing = ls + 'em'; lb.style.textIndent = ls + 'em';
      $('.jh-km', voyEl).textContent = s.kind === 'leg' ? fx(this.m.dv * Math.min(1, s.p)) + ' / ' + fx(this.m.dv) + ' ' + this.m.du : (s.final ? 'LANDED' : 'PARKING ORBIT') + ' · ' + here.data;
      $('canvas.jh-tm', voyEl).style.opacity = s.on ? 1 : 0.4;
    }
    phase(ph) {
      clearTimeout(this.tt); this.side = null; this.hd = null; const tag = $('.jh-tag', voyEl);
      Object.assign(this.st, { kind: ph.kind, k: ph.k, p: 0, final: !!ph.final }); this.sync(); this.render();
      tag.style.opacity = 0; $('.jh-lp', tag).style.strokeDashoffset = 100; $('.jh-dm', tag).style.opacity = 0;
      if (ph.final) landed();
      if (ph.kind !== 'orbit') return;
      const MM = this.meta[ph.k];
      this.tt = setTimeout(() => { const n = $('.jh-tn', tag), nl = MM.name.length, ns = nl > 14 ? 0.16 : nl > 9 ? 0.24 : 0.36; n.textContent = MM.name; n.style.fontSize = (nl > 14 ? 10.5 : 12) + 'px'; n.style.letterSpacing = ns + 'em';
        $('.jh-td', tag).textContent = MM.data; tag.style.opacity = 1; $('.jh-lp', tag).style.strokeDashoffset = 0; $('.jh-dm', tag).style.opacity = 1; }, ph.k ? 700 : 400);
    }
    frame(f) {
      this.frames++;
      const tag = $('.jh-tag', voyEl), P = f.planets[this.st.k];
      if (P && this.st.kind === 'orbit') { const NEED = 182, cx = P[0], rr = (P[2] * ((this.st.k ? this.m.d.v : this.m.o.v).ring ? 1.25 : 1)) + 12, VW = this.W, VH = this.H; let sideL = this.side != null ? this.side : cx > VW / 2, th = 0.75;
        const room = (t, L) => (L ? cx - rr * Math.cos(t) - 8 : VW - 8 - cx - rr * Math.cos(t)); if (this.side == null) { if (room(th, sideL) < NEED && room(th, !sideL) >= NEED) sideL = !sideL; this.side = sideL; } while (th < 1.57 && room(th, sideL) < NEED) th += 0.05;
        const ax = cx + (sideL ? -1 : 1) * rr * Math.cos(th), ay = P[1] + rr * Math.sin(th), svg = $('.jh-ld', tag), tx = $('.jh-tx', tag);
        tag.style.transform = 'translate(' + Math.round(ax) + 'px,' + Math.round(Math.min(VH - 104, ay)) + 'px)'; svg.style.transform = sideL ? 'scaleX(-1)' : 'none';
        const x0 = sideL ? ax - 178 : ax + 30, x1 = sideL ? ax - 30 : ax + 178; let my = -1e9; for (const q of (f.orb || [])) if (q[0] >= x0 && q[0] <= x1) my = Math.max(my, q[1]);
        let Hd = Math.round(Math.max(44, my + 34 - ay)); Hd = Math.max(44, Math.min(Hd, VH - 112 - Math.min(VH - 104, ay)));
        if (this.hd == null || Math.abs(Hd - this.hd) > 1) { this.hd = Hd; $('.jh-lp', tag).setAttribute('d', 'M 0 0 L 34 ' + Hd + ' L 168 ' + Hd); const dm = $('.jh-dm', tag); dm.setAttribute('y', Hd - 3.5); dm.setAttribute('transform', 'rotate(45 34 ' + Hd + ')'); tx.style.top = (Hd - 24) + 'px'; }
        tx.style.left = sideL ? 'auto' : '46px'; tx.style.right = sideL ? '46px' : 'auto'; tx.style.textAlign = sideL ? 'right' : 'left'; }
      if (f.kind === 'leg' && Math.abs(f.p - this.st.p) * this.total() >= 1) { this.st.p = f.p; this.sync(); this.render(); }
    }
    stop() { clearTimeout(this.tt); try { this.eng.stop(); } catch (e) {} try { this.fire.stop(); } catch (e) {} voyEl.style.display = 'none'; }
  }

  // ---------- launch: the home streak hands its very pixels to the 3D opening ----------
  async function launch(m, fromHome) {
    if (app.mode !== 'sheet' && !(fromHome && app.mode === 'home')) return;
    app.last = m; app.flying = core._pending || [m.o.name, core._ix[m.d.name]]; save(); setHomeRoute();
    if (app.mode === 'sheet') { closeSheet(); app.mode = 'launching'; await wait(620); } else app.mode = 'launching';
    try { app.voy = new Voyage(m); } catch (e) { console.error(e); app.mode = 'home'; voyEl.style.display = 'none'; return; }
    const t0 = performance.now(); while (app.voy.frames < 3 && performance.now() - t0 < 4000) await wait(30);   // the 3D view is up, holding the home image
    home.classList.add('leaving'); app.voy.go(); cl.on = true;
    streakCv.style.animation = 'none'; streakCv.style.opacity = '0'; home.style.background = 'transparent';
    const d0 = performance.now(), ramp = () => { if (!cl.on) return; const x = Math.min(1, (performance.now() - d0) / 1300); cl.spd = 1 + 16 * x * x * x; if (x < 1) requestAnimationFrame(ramp); }; requestAnimationFrame(ramp);
    app.mode = 'focus'; try { if (navigator.wakeLock) app.lock = await navigator.wakeLock.request('screen'); } catch (e) {}
    setTimeout(() => { if (app.mode === 'focus' || app.mode === 'landed') { home.style.visibility = 'hidden'; if (stopStreak) { stopStreak(); stopStreak = null; } } }, 3000);
  }
  function landed() {
    if (app.flying) { const [o, j] = app.flying; app.flying = null; try { core.commitFly(o, j); } catch (e) {} core.state.sel = null; core.state.flash = ''; save(); }
    setTimeout(() => { if (app.mode !== 'focus') return; app.mode = 'landed'; $('#l-rt').textContent = app.last.o.name.toUpperCase() + '  →  ' + app.last.d.name.toUpperCase(); $('#landed').classList.add('on'); }, 2600);
  }
  function goHome() {
    $('#landed').classList.remove('on'); app.flying = null;
    if (app.voy) { app.voy.stop(); app.voy = null; }
    try { if (app.lock) app.lock.release(); } catch (e) {} app.lock = null;
    home.style.visibility = 'visible'; home.style.background = '#000'; streakCv.style.opacity = '1'; startStreak(); setHomeRoute();
    requestAnimationFrame(() => home.classList.remove('leaving')); app.mode = 'home';
  }
  $('#l-home button').addEventListener('click', goHome);
  $('#v-home button').addEventListener('click', goHome);
  $('#v-calm button').addEventListener('click', () => voyEl.classList.toggle('calm'));
  document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && app.mode === 'focus' && !app.lock && navigator.wakeLock) { try { app.lock = await navigator.wakeLock.request('screen'); } catch (e) {} } });

  if (/[?&]debug\b/.test(location.search)) window.__hm = { app, core, landed, goHome };   // review hook only
  startStreak(); setHomeRoute();
})();
