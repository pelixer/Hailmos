# Builds the deployable Hailmos web app (public/) from the design sources.
# The app runs on its own: plain HTML/CSS/JS, no canvas runtime. Engines are the same code the design boards use.
#   python3 tools/build_app.py            (HM_SRC points at the design workspace; default below)
import json, os, sys, re, struct, zlib
SRC = os.environ.get('HM_SRC', '/tmp/claude-0/-home-user-Hailmos/e315cb8a-dfb8-5cbb-9f5b-0084c4cd69ad/scratchpad')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, SRC + '/lab')

# ---- design pieces: icon buttons + base CSS, home UI, timer logic (routes engine, planet painter, list values)
g = open(SRC + '/lab/gen_icons.py').read(); G = {}; exec(g[:g.index('lab=')], G)
CSS, cbtn, D = G['CSS'], G['cbtn'], G['D']
home = open(SRC + '/canvas/project/Home-C.dc.html').read()
HCSS = home[home.index('<style>') + 7:home.index('</style>')]
hb = home[home.index('<div aria-hidden="true" style="position: absolute; inset: 0; background: linear-gradient'):home.index('</x-dc>')]
HOMEUI = hb[:hb.rstrip().rindex('</div>')]
HOMEUI = (HOMEUI.replace('margin-right: -0.42em; color: #fff1e0;', 'margin-right: -0.42em; max-width: 300px; margin-left: auto; line-height: 1.9; text-wrap: balance; color: #fff1e0;')
          .replace('>EARTH → MARS<', ' id="h-rt">FROM EARTH<').replace('>2.25E8 km · 25:00<', ' id="h-rs">SET A COURSE<'))
assert 'id="h-rt"' in HOMEUI and 'id="h-rs"' in HOMEUI
# one clear action on home: the centre button opens time & course; the log moves to a small top-right button
for lab in ('목적지', '항해 기록'):
    i0 = HOMEUI.index('<button aria-label="' + lab + '"'); i1 = HOMEUI.index('</button>', i0) + len('</button>'); HOMEUI = HOMEUI[:i0] + HOMEUI[i1:]
assert '<button aria-label="출항"' in HOMEUI and '목적지' not in HOMEUI
RB = {}; exec(open(SRC + '/lab/gen_routes_b2.py').read(), RB)          # PAINT (planet painter + launchGo), VALS, SLIDER_CSS …
from routes_engine import ENGINE, REGION_COL
SCR = open(SRC + '/lab/scramble.js').read()
ENG_STREAK = open(SRC + '/lab/streaks_method.js').read().rstrip()
ENG_VOY = open(SRC + '/lab/voyage3.js').read().rstrip()
ENG_TIMER = open(SRC + '/lab/timer.js').read().replace('__GLYPHS__', open(SRC + '/font/glyphs_s.json').read()).rstrip()
PAINT = RB['PAINT'].replace('  componentDidMount() { this._raf = requestAnimationFrame((t) => this.plTick(t)); }', '').replace('  componentWillUnmount() { this._dead = true; cancelAnimationFrame(this._raf); }', '')
assert PAINT.count('this.fly(o, j);') == 1
PAINT = PAINT.replace('this.fly(o, j);', 'this._pending = [o, j];')   # the flight is recorded when the ship lands, not at launch
VALS = RB['VALS']

# ---- engine.js: the three renderers as one object
open(OUT + '/engine.js', 'w').write('/* Hailmos render engines: home streaks · 3D voyage (opening, route, planets, ship) · filament timer */\nconst HM = {\n' + ENG_STREAK + ',\n' + ENG_VOY + ',\n' + ENG_TIMER + '\n};\n')

# ---- routes.js: "our distance" table, route list, planet looks, painter
TC = 'class TimerCore {\n  constructor(saved, props) { this.props = props || {}; this.state = Object.assign({ visited: ["Earth"], edges: {}, t: 40, q: "", reg: -1, sel: null, flash: "" }, saved || {}); this.onChange = null; }\n' \
     '  setState(p, cb) { Object.assign(this.state, typeof p === "function" ? p(this.state) : p); if (this.onChange) this.onChange(p); if (cb) cb(); }\n' \
     + ENGINE.replace('  fly(o, j) {', '  commitFly(o, j) {') + VALS + PAINT + SCR + '}\n'
open(OUT + '/routes.js', 'w').write('/* Hailmos routes: region-based focus distance, route list, planet looks */\n' + TC)

# ---- index.html
ic = lambda k, label, size=52, primary=False: cbtn(label, D[k][1], size, primary)
SHEET_CSS = '''
.rt-s::-webkit-scrollbar{display:none}.rt-s{scrollbar-width:none}
.rt-b{transition:background .25s ease,color .25s ease,border-color .25s ease,opacity .25s ease;-webkit-tap-highlight-color:transparent}
input.rt-q{background:transparent;border:0;outline:none;color:#fff3e2;font-family:'Michroma',sans-serif;font-size:10px;letter-spacing:.14em;width:100%}
input.rt-q::placeholder{color:rgba(255,234,210,0.35)}
@keyframes rt-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.rt-toast{animation:rt-in .5s cubic-bezier(.16,1,.3,1) both}
''' + RB['SLIDER_CSS']
TICKS = ''.join(f'<span style="position:absolute;left:calc(11px + (100% - 22px) * {k / 17:.4f});top:0;width:1px;height:{7 if (k + 1) % 6 == 0 else 4}px;background:rgba(255,226,190,{0.5 if (k + 1) % 6 == 0 else 0.2})"></span>' for k in range(18))
LABELS = ''.join(f'<span style="position:absolute;left:calc(11px + (100% - 22px) * {k / 17:.4f});transform:translateX(-50%);top:12px">{l}</span>' for k, l in [(0, '10m'), (5, '1h'), (11, '2h'), (17, '3h')])
SEARCH_IC = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,234,210,0.55)" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path></svg>'

html = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Hailmos">
<meta name="theme-color" content="#000000">
<meta name="description" content="Hailmos — 집중하는 동안 행성 사이를 항해하는 타이머">
<title>Hailmos</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Michroma&family=Geist+Mono:wght@300;400&family=Noto+Sans+KR:wght@300;400&display=swap" rel="stylesheet">
<style>
{CSS}
{HCSS}
{SHEET_CSS}
html,body{{margin:0;height:100%;background:#000;overflow:hidden;overscroll-behavior:none;touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}}
#stage{{position:fixed;inset:0;width:100%;height:100%;overflow:hidden;background:#000;color:#fff7ee;font-family:'Geist Mono','Noto Sans KR',monospace;-webkit-font-smoothing:antialiased}}
.layer{{position:absolute;inset:0}}
.fill{{position:absolute;left:0;top:0;width:100%;height:100%}}
#home .hui{{top:env(safe-area-inset-top)!important;bottom:env(safe-area-inset-bottom)!important}}
#voy{{display:none}}
#voy .vui{{transition:opacity 1.4s ease}}
#voy.introing .vui{{opacity:0!important;pointer-events:none!important}}
#voy.calm .vtext{{opacity:0}}
#home{{background:#000}}
#home .hui{{transition:opacity .45s ease,filter .45s ease}}
#home.leaving .hui{{opacity:0;filter:blur(6px);pointer-events:none}}
#sheet{{transform:translateY(102%);transition:transform .6s cubic-bezier(.2,.8,.2,1);background:#000;z-index:5}}
#sheet.open{{transform:translateY(0)}}
#log{{transform:translateY(102%);transition:transform .6s cubic-bezier(.2,.8,.2,1);background:#000;z-index:6}}
#log.open{{transform:translateY(0)}}
#landed{{opacity:0;pointer-events:none;transition:opacity .8s ease;z-index:4}}
#landed.on{{opacity:1;pointer-events:auto}}
.handle{{position:absolute;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 6px);width:72px;height:30px;border:0;background:transparent;cursor:pointer;padding:0;z-index:2}}
.handle span{{display:block;width:36px;height:4px;border-radius:2px;margin:0 auto;background:rgba(255,226,190,0.35)}}
</style>
</head>
<body>
<div id="stage">
  <!-- focus voyage (3D): sits under home so the opening can take over the very same pixels -->
  <div id="voy" class="layer introing">
    <canvas class="jh-gl fill" aria-label="항해 장면 — 우주선을 끌어 떼면 집중이 멈춥니다"></canvas>
    <div class="jh-tag vui" aria-live="polite" style="position:absolute;left:0;top:0;width:0;height:0;opacity:0;pointer-events:none">
      <svg class="jh-ld" width="176" height="64" viewBox="0 0 176 64" aria-hidden="true" style="position:absolute;left:0;top:0;overflow:visible;transform-origin:0 0">
        <path class="jh-lp" d="M 0 0 L 34 44 L 168 44" fill="none" stroke="rgba(255,226,190,0.62)" stroke-width="1" pathLength="100" stroke-dasharray="100" style="stroke-dashoffset:100;transition:stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)"></path>
        <rect class="jh-dm" x="30.5" y="40.5" width="7" height="7" transform="rotate(45 34 44)" fill="none" stroke="#ffd9b0" stroke-width="1" style="opacity:0;transition:opacity .5s ease .5s"></rect>
      </svg>
      <div class="jh-tx" style="position:absolute;left:46px;top:20px;white-space:nowrap">
        <div class="jh-tn" style="font-family:'Michroma',sans-serif;color:#fff3e2;text-shadow:0 0 14px rgba(234,138,72,0.75),0 0 2px rgba(255,236,210,0.9)"></div>
        <div class="jh-td" style="margin-top:15px;font-size:9.5px;letter-spacing:0.12em;color:rgba(255,234,210,0.68)"></div>
      </div>
    </div>
    <div class="vui vtext" style="position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 48px);display:flex;flex-direction:column;align-items:center;pointer-events:none;transition:opacity 1s ease">
      <div class="jh-lb" style="font-family:'Michroma',sans-serif;color:#ece4ff;text-shadow:0 0 12px rgba(140,115,225,0.75);max-width:326px;margin:0 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px;letter-spacing:.42em;text-indent:.42em"></div>
      <div class="jh-tw" role="timer" style="position:relative;width:390px;height:92px;margin-top:2px">
        <canvas class="jh-tm" aria-hidden="true" style="position:absolute;left:0;top:0;width:390px;height:92px;transition:opacity .8s"></canvas>
      </div>
      <div class="jh-km" style="margin-top:2px;font-size:11px;letter-spacing:0.08em;color:rgba(232,224,255,0.55)"></div>
    </div>
    <div class="vui" style="position:absolute;left:18px;top:calc(env(safe-area-inset-top) + 10px)" id="v-home">{ic('home', '홈으로', 40)}</div>
    <div class="vui" style="position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + 28px);display:flex;justify-content:center" id="v-calm">{ic('sound', '화면 비우기', 52)}</div>
  </div>

  <!-- home: the light streak -->
  <div id="home" class="layer">
    <canvas class="lg-streak hb-cv fill" aria-hidden="true"></canvas>
    <div class="hui" style="position:absolute;inset:0">
{HOMEUI}
      <div style="position:absolute;right:18px;top:10px" id="h-log">{ic('log', '항해 기록', 40)}</div>
    </div>
  </div>

  <div id="landed" class="layer" aria-live="polite" style="background:linear-gradient(180deg,rgba(0,0,0,0) 62%,rgba(0,0,0,0.85) 82%);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:calc(env(safe-area-inset-bottom) + 40px);box-sizing:border-box">
    <div style="font-family:'Michroma',sans-serif;font-size:10px;letter-spacing:.42em;margin-right:-.42em;color:#ece4ff;text-shadow:0 0 12px rgba(140,115,225,.75)">LANDED</div>
    <div id="l-rt" style="margin-top:12px;max-width:330px;padding:0 30px;text-align:center;line-height:1.7;text-wrap:balance;font-family:'Michroma',sans-serif;font-size:13px;letter-spacing:.1em;color:#fff3e2"></div>
    <div id="l-home" style="margin-top:26px">{ic('home', '홈으로', 52, True)}</div>
  </div>

  <!-- timer sheet -->
  <div id="sheet" class="layer" aria-label="집중 시간과 항로 선택">
    <button class="handle" id="s-close" aria-label="닫기"><span></span></button>
    <div style="position:absolute;left:0;right:0;top:0;padding-top:calc(env(safe-area-inset-top) + 44px)">
      <div style="padding:0 20px;display:flex;justify-content:space-between;align-items:baseline"><span style="font-family:'Michroma',sans-serif;font-size:10px;letter-spacing:.42em;color:#f3c48a">TIMER</span><span id="s-flown" style="font-size:10px;color:rgba(255,234,210,.5)"></span></div>
      <div style="margin-top:20px;text-align:center"><div id="s-time" style="font-family:'Michroma',sans-serif;font-size:40px;color:#fff3e2;text-shadow:0 0 24px rgba(234,138,72,.45)"></div><div id="s-total" style="margin-top:8px;font-size:10px;letter-spacing:.2em;color:rgba(255,234,210,.5)"></div></div>
      <div style="margin:22px 20px 0"><label for="rt-min" style="position:absolute;left:-9999px">집중 시간 (10분 단위)</label><input id="rt-min" class="rt-range" type="range" min="1" max="18" step="1" value="4"></div>
      <div aria-hidden="true" style="position:relative;margin:8px 20px 0;height:26px;font-size:9px;letter-spacing:.1em;color:rgba(255,234,210,.42)">{TICKS}{LABELS}</div>
      <div style="margin-top:14px"><label style="margin:0 20px;height:38px;border-radius:19px;border:1px solid rgba(255,226,190,0.18);display:flex;align-items:center;gap:10px;padding:0 14px">{SEARCH_IC}<span style="position:absolute;left:-9999px">행성 검색</span><input class="rt-q" id="rt-q" type="search" placeholder="SEARCH PLANET" autocomplete="off" autocapitalize="off" spellcheck="false"></label></div>
    </div>
    <div class="rt-s" id="s-list" style="position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 300px);bottom:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:120px"></div>
    <div id="s-sel"></div>
  </div>

  <!-- flight log -->
  <div id="log" class="layer" aria-label="항해 기록">
    <button class="handle" id="g-close" aria-label="닫기"><span></span></button>
    <div style="position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 44px);padding:0 20px;display:flex;justify-content:space-between;align-items:baseline"><span style="font-family:'Michroma',sans-serif;font-size:10px;letter-spacing:.42em;color:#f3c48a">LOG</span><span id="g-count" style="font-size:10px;color:rgba(255,234,210,.5)"></span></div>
    <div class="rt-s" id="g-list" style="position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 86px);bottom:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 0 60px"></div>
  </div>
</div>
<script>const LAUNCH_BTN = {json.dumps(ic('launch', '출항', 52, True))};</script>
<script src="/engine.js"></script>
<script src="/routes.js"></script>
<script src="/app.js"></script>
</body>
</html>
'''
open(OUT + '/index.html', 'w').write(html)

# ---- PWA bits: manifest, icons (streak motif), headers
open(OUT + '/manifest.webmanifest', 'w').write(json.dumps({
    'name': 'Hailmos', 'short_name': 'Hailmos', 'description': '집중하는 동안 행성 사이를 항해하는 타이머', 'lang': 'ko',
    'start_url': '/', 'scope': '/', 'display': 'standalone', 'orientation': 'portrait', 'background_color': '#000000', 'theme_color': '#000000',
    'icons': [{'src': '/icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': '/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}]}, ensure_ascii=False, indent=2))
try:
    from PIL import Image, ImageDraw, ImageFilter
    def icon(n, path):
        im = Image.new('RGB', (n * 2, n * 2), (0, 0, 0)); dr = ImageDraw.Draw(im)
        cols = [(255, 217, 176), (243, 196, 138), (234, 155, 94), (224, 120, 90), (185, 160, 216), (210, 115, 74), (255, 236, 218)]
        import random; rnd = random.Random(7)
        for i in range(140):
            off = rnd.gauss(0, 0.28) * n * 2; c = cols[i % len(cols)]; a = 0.25 + 0.75 * rnd.random(); w = max(1, int(n * 2 * (0.002 + 0.006 * rnd.random())))
            cc = tuple(int(v * a) for v in c); x0 = off - n; dr.line([(x0, 0), (x0 + n * 2, n * 2)], fill=cc, width=w)   # 45° streaks across the tile
        im = im.filter(ImageFilter.GaussianBlur(n * 0.004)).resize((n, n), Image.LANCZOS); im.save(path)
    icon(192, OUT + '/icon-192.png'); icon(512, OUT + '/icon-512.png'); icon(180, OUT + '/apple-touch-icon.png')
except Exception as e:
    print('icons skipped:', e)
open(OUT + '/_headers', 'w').write('''/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/index.html
  Cache-Control: no-cache

/
  Cache-Control: no-cache

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.png
  Cache-Control: public, max-age=604800
''')
# cache-busting: every script URL carries a content hash, so a new deploy never runs against an older cached script
import hashlib
idx = open(OUT + '/index.html').read()
for f in ('engine.js', 'routes.js', 'app.js'):
    v = hashlib.sha1(open(OUT + '/' + f, 'rb').read()).hexdigest()[:10]
    idx = re.sub(r'src="/' + re.escape(f) + r'(\?v=[0-9a-f]+)?"', 'src="/' + f + '?v=' + v + '"', idx)
open(OUT + '/index.html', 'w').write(idx)
print('built', sorted(os.listdir(OUT)))
