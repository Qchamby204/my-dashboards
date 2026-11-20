/* Reminders HUD. Decorative layer only: it reads the rendered schedule and never
   touches saved reminders, push delivery or the pairing. Text keeps sentence case (no forced caps). Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/ledger-hud.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'reminders' || window.RemindersHUD) return;
  window.RemindersHUD = {replayBoot: () => boot(true)};

  const NS = 'http://www.w3.org/2000/svg';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const automated = navigator.webdriver === true;
  const still = () => reduce.matches;
  const pad = n => String(n).padStart(2, '0');
  const started = Date.now();

  function node(tag, cls, parent) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    if (parent) parent.append(el);
    return el;
  }
  function svgNode(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (parent) parent.append(el);
    return el;
  }
  function accentRGB() {
    const raw = getComputedStyle(root).getPropertyValue('--hud-hue').trim() || getComputedStyle(root).getPropertyValue('--neo-accent').trim();
    const hex = raw.match(/^#([0-9a-f]{6})$/i);
    if (hex) { const n = parseInt(hex[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(','); }
    return root.dataset.atlasTheme === 'light' ? '0,101,119' : '95,244,255';
  }

  /* ── Ambient field: reactor rings, drifting motes and a scan pass ─────────── */
  function startField() {
    const canvas = node('canvas', 'hud-field');
    document.body.prepend(canvas);
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    const tau = Math.PI * 2;
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, rgb = accentRGB();
    let px = 0, py = 0, tx = 0, ty = 0;
    const motes = Array.from({length: 46}, () => ({x: Math.random(), y: Math.random(), s: .3 + Math.random() * .9, r: .6 + Math.random() * 1.4}));
    const rings = [
      {r: 1.00, dash: [1.5, 5], width: 1, speed: .010, a: .30},
      {r: .93, arcs: [[0, .19], [.27, .46], [.58, .9]], width: 2.4, speed: -.035, a: .34},
      {r: .84, ticks: 144, width: 1, speed: .006, a: .28},
      {r: .72, arcs: [[0, .06], [.25, .31], [.5, .56], [.75, .81]], width: 9, speed: .05, a: .12},
      {r: .61, dash: [18, 10], width: 1.2, speed: -.022, a: .22},
      {r: .47, arcs: [[.05, .62]], width: 1.6, speed: .09, a: .30},
      {r: .36, ticks: 48, width: 1, speed: -.04, a: .22},
    ];
    const ink = a => 'rgba(' + rgb + ',' + a + ')';
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    function draw(time) {
      raf = 0;
      if (document.hidden) return;
      const motion = !still();
      if (motion && time - last < 33) { raf = requestAnimationFrame(draw); return; }
      const dt = last ? Math.min((time - last) / 1000, .1) : 0; last = time;
      const t = motion ? time / 1000 : 0;
      const light = root.dataset.atlasTheme === 'light';
      const fade = light ? .45 : 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      px += (tx - px) * Math.min(1, dt * 3); py += (ty - py) * Math.min(1, dt * 3);
      const wide = w > 900;
      const cx = w * (wide ? .8 : .5) + px * 24, cy = h * (wide ? .3 : .17) + py * 18;
      const R = Math.min(Math.max(w, h) * (wide ? .36 : .62), 720);
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.05);
      bloom.addColorStop(0, ink(.10 * fade)); bloom.addColorStop(.55, ink(.035 * fade)); bloom.addColorStop(1, ink(0));
      ctx.fillStyle = bloom; ctx.fillRect(0, 0, w, h);
      for (const ring of rings) {
        const r = R * ring.r, rot = t * ring.speed * tau;
        ctx.lineWidth = ring.width; ctx.strokeStyle = ink(ring.a * fade * .55);
        if (ring.ticks) {
          ctx.beginPath();
          for (let i = 0; i < ring.ticks; i++) {
            const a = rot + tau * i / ring.ticks, len = i % 6 ? 4 : 10;
            ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
            ctx.lineTo(cx + (r + len) * Math.cos(a), cy + (r + len) * Math.sin(a));
          }
          ctx.stroke();
        } else if (ring.arcs) {
          for (const [s, e] of ring.arcs) { ctx.beginPath(); ctx.arc(cx, cy, r, rot + s * tau, rot + e * tau); ctx.stroke(); }
        } else {
          ctx.setLineDash(ring.dash); ctx.lineDashOffset = -rot * r;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, tau); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      // A travelling blip on the outer ring.
      const blip = t * .35;
      ctx.fillStyle = ink(.7 * fade);
      ctx.beginPath(); ctx.arc(cx + R * Math.cos(blip), cy + R * Math.sin(blip), 2.4, 0, tau); ctx.fill();
      // Motes drift upward and link when they pass close.
      const pts = motes.map(m => {
        if (motion) { m.y -= m.s * dt * .018; if (m.y < -.05) { m.y = 1.05; m.x = Math.random(); } }
        return [m.x * w + px * 10 * m.s, m.y * h + py * 8 * m.s, m.r];
      });
      ctx.lineWidth = .6;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], d = dx * dx + dy * dy;
        if (d < 11000) { ctx.strokeStyle = ink((1 - d / 11000) * .16 * fade); ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke(); }
      }
      for (const [x, y, r] of pts) { ctx.fillStyle = ink(.5 * fade); ctx.beginPath(); ctx.arc(x, y, r, 0, tau); ctx.fill(); }
      // Scan pass every nine seconds.
      if (motion) {
        const sy = ((t / 9) % 1) * (h + 240) - 120;
        const band = ctx.createLinearGradient(0, sy - 90, 0, sy + 2);
        band.addColorStop(0, ink(0)); band.addColorStop(.9, ink(.05 * fade)); band.addColorStop(1, ink(.32 * fade));
        ctx.fillStyle = band; ctx.fillRect(0, sy - 90, w, 92);
        raf = requestAnimationFrame(draw);
      }
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
    size(); kick();
    window.addEventListener('resize', () => { size(); last = 0; kick(); });
    document.addEventListener('visibilitychange', () => { last = 0; kick(); });
    reduce.addEventListener?.('change', kick);
    new MutationObserver(() => { rgb = accentRGB(); kick(); }).observe(root, {attributes: true, attributeFilter: ['data-atlas-theme']});
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX / w - .5; ty = e.clientY / h - .5;
    }, {passive: true});
  }

  /* ── Screen frame and edge telemetry (wide screens) ──────────────────────── */
  let frameClock = null, frameUptime = null;
  function startFrame() {
    const frame = node('div', 'hud-frame', document.body);
    for (const c of ['tl', 'tr', 'bl', 'br']) node('i', 'hud-frame-corner ' + c, frame);
    node('i', 'hud-frame-rail l', frame); node('i', 'hud-frame-rail r', frame);
    const left = node('div', 'hud-frame-tele l', frame);
    left.innerHTML = '<b>Reminders</b><span>OS 5.0 // Signal timing</span>';
    frameClock = node('span', 'hud-frame-clock', left);
    const right = node('div', 'hud-frame-tele r', frame);
    right.innerHTML = '<b><i class="hud-live"></i>Uplink stable</b><span>Telemetry // local</span>';
    frameUptime = node('span', 'hud-frame-uptime', right);
  }

  /* ── Reactor rings around the hologram ───────────────────────────────────── */
  const ARC = {start: 82, step: 5.2};
  function buildReactor(host, label) {
    const svg = svgNode('svg', {viewBox: '0 0 200 200', class: 'hud-reactor', 'aria-hidden': 'true', focusable: 'false'});
    const outer = svgNode('g', {class: 'hud-rot hud-rot-slow'}, svg);
    svgNode('circle', {cx: 100, cy: 100, r: 97, class: 'hud-ring-dots'}, outer);
    for (const a of [0, 90, 180, 270]) svgNode('path', {d: 'M100 1.5a98.5 98.5 0 0 1 22 2.5', class: 'hud-ring-bracket', transform: 'rotate(' + a + ' 100 100)'}, outer);
    svgNode('circle', {cx: 100, cy: 100, r: 97, class: 'hud-ring-blip-track'}, outer);
    svgNode('circle', {cx: 100, cy: 3, r: 1.8, class: 'hud-ring-blip'}, outer);
    let ticks = '';
    for (let i = 0; i < 90; i++) {
      const a = Math.PI * 2 * i / 90, r1 = 90, r2 = i % 5 ? 92 : 94.5;
      ticks += 'M' + (100 + r1 * Math.sin(a)).toFixed(2) + ' ' + (100 - r1 * Math.cos(a)).toFixed(2) + 'L' + (100 + r2 * Math.sin(a)).toFixed(2) + ' ' + (100 - r2 * Math.cos(a)).toFixed(2);
    }
    const tickRing = svgNode('g', {class: 'hud-rot hud-rot-rev'}, svg);
    svgNode('path', {d: ticks, class: 'hud-ring-ticks'}, tickRing);
    svgNode('g', {class: 'hud-arcs'}, svg);
    const inner = svgNode('g', {class: 'hud-rot hud-rot-fast'}, svg);
    svgNode('circle', {cx: 100, cy: 100, r: 54, class: 'hud-ring-dash'}, inner);
    const sweep = svgNode('g', {class: 'hud-rot hud-rot-sweep'}, svg);
    svgNode('path', {d: 'M100 100 L100 12 A88 88 0 0 1 131 17.6 Z', class: 'hud-sweep'}, sweep);
    if (label) { const tag = svgNode('text', {x: 100, y: 197, class: 'hud-reactor-tag', 'text-anchor': 'middle'}, svg); tag.textContent = label; }
    return svg;
  }
  function paintArcs(svg, arcs) {
    const group = svg.querySelector('.hud-arcs');
    const sig = JSON.stringify(arcs);
    if (group.dataset.sig === sig) return;
    const first = !group.dataset.sig;
    group.dataset.sig = sig;
    group.textContent = '';
    arcs.forEach((arc, i) => {
      const r = ARC.start - i * ARC.step;
      const g = svgNode('g', {style: '--arc:' + arc.color}, group);
      svgNode('circle', {cx: 100, cy: 100, r, class: 'hud-arc-track'}, g);
      const fill = svgNode('circle', {cx: 100, cy: 100, r, class: 'hud-arc-fill', pathLength: 100, transform: 'rotate(-90 100 100)', 'stroke-dasharray': (first && !still() ? 0 : arc.pct) + ' 100'}, g);
      if (first && !still()) requestAnimationFrame(() => requestAnimationFrame(() => fill.setAttribute('stroke-dasharray', arc.pct + ' 100')));
      if (arc.letter) { const t = svgNode('text', {x: 96, y: 100 - r + 1.6, class: 'hud-arc-letter', 'text-anchor': 'end'}, g); t.textContent = arc.letter; }
    });
  }
  /* ── Day dial: a 24-hour face with each reminder at its time ───────────── */
  const DIAL_HUES = ['#ffd08b', '#8cc8ff', '#6ff2c8', '#ffa6d1', '#b6f06a', '#ffb347'];
  function toMinutes(text) {
    const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i.exec(String(text || '').trim());
    if (!m) return null;
    let h = Number(m[1]) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + Number(m[2] || 0);
  }
  function fieldMinutes(field) {
    const f = document.querySelector('[data-time-field="' + field + '"]');
    if (!f) return null;
    const v = p => f.querySelector('[data-time-part="' + p + '"]')?.value || '';
    return toMinutes(v('hour') + ':' + (v('minute') || '00').padStart(2, '0') + ' ' + v('period'));
  }
  const polar = (min, r) => { const a = (min / 1440) * Math.PI * 2 - Math.PI / 2; return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]; };
  function arcPath(from, to, r) {
    const span = ((to - from) + 1440) % 1440;
    const [x1, y1] = polar(from, r), [x2, y2] = polar(from + span, r);
    return 'M' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (span > 720 ? 1 : 0) + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2);
  }
  let dialHand = null;
  function mountDial() {
    const head = document.querySelector('main>header');
    if (!head) return;
    let svg = head.querySelector(':scope>.hud-dial');
    if (!svg) {
      svg = svgNode('svg', {class: 'hud-dial', viewBox: '0 0 200 200', 'aria-hidden': 'true', focusable: 'false'}, head);
      head.classList.add('hud-dial-host');
    }
    svg.replaceChildren();
    svgNode('circle', {cx: 100, cy: 100, r: 92, class: 'hud-dial-rim'}, svg);
    svgNode('circle', {cx: 100, cy: 100, r: 70, class: 'hud-dial-inner'}, svg);
    const ticks = svgNode('g', {class: 'hud-dial-ticks'}, svg);
    for (let h = 0; h < 24; h++) {
      const [x1, y1] = polar(h * 60, h % 6 ? 84 : 78), [x2, y2] = polar(h * 60, 90);
      svgNode('line', {x1, y1, x2, y2, class: h % 6 ? '' : 'major'}, ticks);
    }
    [['0', 0], ['6', 360], ['12', 720], ['18', 1080]].forEach(([t, m]) => { const [x, y] = polar(m, 62); const n = svgNode('text', {x, y: y + 3.5, 'text-anchor': 'middle', class: 'hud-dial-num'}, svg); n.textContent = t; });
    const qs = fieldMinutes('quiet-start'), qe = fieldMinutes('quiet-end');
    if (qs != null && qe != null && qs !== qe) svgNode('path', {d: arcPath(qs, qe, 76), class: 'hud-dial-quiet'}, svg);
    const paused = document.getElementById('paused')?.checked;
    [...document.querySelectorAll('#list .reminder')].forEach((r, i) => {
      const min = toMinutes(r.querySelector('.reminder-time')?.textContent);
      if (min == null) return;
      const on = r.querySelector('[data-field="enabled"]')?.checked !== false && !paused;
      const color = DIAL_HUES[i % DIAL_HUES.length];
      const [x1, y1] = polar(min, 70), [x2, y2] = polar(min, 92);
      svgNode('line', {x1, y1, x2, y2, class: 'hud-dial-mark' + (on ? '' : ' off'), stroke: color}, svg);
      const [cx, cy] = polar(min, 92);
      svgNode('circle', {cx, cy, r: on ? 4 : 3, class: 'hud-dial-pin' + (on ? '' : ' off'), fill: on ? color : 'none', stroke: color}, svg);
    });
    dialHand = svgNode('line', {x1: 100, y1: 100, x2: 100, y2: 30, class: 'hud-dial-hand'}, svg);
    svgNode('circle', {cx: 100, cy: 100, r: 3.5, class: 'hud-dial-hub'}, svg);
    paintHand();
  }
  function paintHand() {
    if (!dialHand?.isConnected) return;
    const now = new Date(), [x, y] = polar(now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60, 66);
    dialHand.setAttribute('x2', x.toFixed(2)); dialHand.setAttribute('y2', y.toFixed(2));
  }

  /* ── Live clock under the title ──────────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const head = document.querySelector('main>header');
    if (!head) return;
    let tele = head.querySelector('.hud-telemetry');
    if (!tele) {
      tele = node('p', 'hud-telemetry', head);
      node('i', 'hud-live', tele);
      tele.append('Live ');
      node('b', '', tele);
    }
    heroClock = tele.querySelector('b');
    tick();
  }
  function tick() {
    const now = new Date();
    const clock = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    if (heroClock?.isConnected) heroClock.textContent = clock;
    if (frameClock) frameClock.textContent = now.getFullYear() + '.' + pad(now.getMonth() + 1) + '.' + pad(now.getDate()) + ' // ' + clock;
    if (frameUptime) { const s = Math.floor((Date.now() - started) / 1000); frameUptime.textContent = 'Session ' + pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }
    if (now.getSeconds() === 0) paintHand();
  }

  /* ── Re-attach after every render ────────────────────────────────────────── */
  let pending = 0, mutating = false;
  function decorate() {
    pending = 0; mutating = true;
    try { mountDial(); mountTelemetry(); } finally { mutating = false; }
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp() {
    const app = document.querySelector('main');
    if (!app) return;
    new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.target.closest?.('.hud-telemetry,.hud-dial,#feedback,#status,#history')) continue;
        if (r.addedNodes.length || r.type === 'characterData') { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true, characterData: true});
    app.addEventListener('change', schedule);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  function burstAt(control, label) {
    if (still()) return;
    const box = control.getBoundingClientRect();
    if (!box.width) return;
    const card = null;
    const accent = '';
    const xp = '';
    const burst = node('div', 'hud-burst', document.body);
    burst.style.left = box.left + box.width / 2 + 'px';
    burst.style.top = box.top + box.height / 2 + 'px';
    if (accent) burst.style.setProperty('--burst', accent);
    node('i', 'hud-burst-ring', burst); node('i', 'hud-burst-ring b', burst); node('i', 'hud-burst-flash', burst);
    const tag = node('span', 'hud-burst-tag', burst);
    tag.textContent = label;
    setTimeout(() => burst.remove(), 1100);
  }
  document.addEventListener('click', e => {
    const control = e.target.closest?.('main button');
    if (!control) return;
    const text = control.textContent.trim().toLowerCase();
    if (/^(add reminder|save)/.test(text)) burstAt(control, /^add/.test(text) ? 'Added' : 'Saved');
  }, true);

  /* ── Boot sequence: once per session, skipped for reduced motion ─────────── */
  function boot(force) {
    if (!force) {
      if (still() || automated) return;
      try { if (sessionStorage.getItem('reminders:hud-boot')) return; sessionStorage.setItem('reminders:hud-boot', '1'); } catch { return; }
    }
    const shell = node('div', 'hud-boot', document.body);
    shell.innerHTML =
      '<svg viewBox="0 0 200 200" class="hud-boot-core">' +
      '<circle cx="100" cy="100" r="92" class="b1"/><circle cx="100" cy="100" r="78" class="b2"/>' +
      '<circle cx="100" cy="100" r="62" class="b3"/><circle cx="100" cy="100" r="44" class="b4"/>' +
      '<circle cx="100" cy="100" r="18" class="b5"/></svg>' +
      '<div class="hud-boot-copy"><b>Reminders</b><ol></ol></div>';
    const list = shell.querySelector('ol');
    const lines = ['Reading your rhythm', 'Setting the quiet hours', 'Checking delivery', 'All systems nominal'];
    // Time the sequence from the first frame the screen can actually show.
    requestAnimationFrame(() => lines.forEach((text, i) => setTimeout(() => {
      const li = document.createElement('li');
      li.innerHTML = '<span></span><em>' + (i === lines.length - 1 ? 'Online' : 'OK') + '</em>';
      li.firstChild.textContent = text;
      list.append(li);
    }, 120 + i * 220)));
    const finish = () => { if (shell.classList.contains('out')) return; shell.classList.add('out'); setTimeout(() => shell.remove(), 520); };
    shell.addEventListener('pointerdown', finish);
    requestAnimationFrame(() => setTimeout(finish, 1450));
  }

  function init() {
    root.classList.add('hud-on');
    startField();
    startFrame();
    boot();
    node('div', 'hud-scan', document.body);
    watchApp(); schedule();
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
