/* Life Ledger HUD. Decorative layer only: it reads the rendered page and never
   touches Ledger records. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.atlasApp !== 'life-ledger' || window.LedgerHUD) return;
  window.LedgerHUD = {replayBoot: () => boot(true)};

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
    const raw = getComputedStyle(root).getPropertyValue('--neo-accent').trim();
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
    left.innerHTML = '<b>LIFE LEDGER</b><span>OS 5.0 // VALUE MATRIX ONLINE</span>';
    frameClock = node('span', 'hud-frame-clock', left);
    const right = node('div', 'hud-frame-tele r', frame);
    right.innerHTML = '<b><i class="hud-live"></i>UPLINK STABLE</b><span>TELEMETRY // LOCAL</span>';
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
  function mountReactor(host, arcs, label) {
    const canvas = host.querySelector('.ledger-projector');
    if (!canvas) return;
    let svg = host.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(host, label); host.append(svg); }
    host.classList.add('hud-reactor-host');
    const place = () => {
      if (!canvas.isConnected) return;
      Object.assign(svg.style, {left: canvas.offsetLeft + 'px', top: canvas.offsetTop + 'px', width: canvas.offsetWidth + 'px', height: canvas.offsetHeight + 'px'});
    };
    place(); requestAnimationFrame(place);
    paintArcs(svg, arcs);
  }
  function todayArcs() {
    return [...document.querySelectorAll('#ledger-view-today .ledger-value-jump')].map(b => ({
      color: b.style.getPropertyValue('--ledger-value').trim() || 'var(--neo-accent)',
      pct: Math.max(0, Math.min(100, parseFloat(b.style.getPropertyValue('--value-done')) || 0)),
      letter: (b.querySelector('span')?.textContent || '').trim().charAt(0).toUpperCase(),
    }));
  }

  /* ── Live readouts inside the check-in card ──────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const title = document.querySelector('#ledger-view-today .ledger-day-title');
    if (!title || title.querySelector('.hud-telemetry')) { heroClock = title?.querySelector('.hud-telemetry b') || heroClock; return; }
    const tele = node('div', 'hud-telemetry', title);
    node('i', 'hud-live', tele);
    tele.append('LIVE ');
    heroClock = node('b', '', tele);
    tele.append(' // SYNC OK');
    tick();
  }
  function tick() {
    const now = new Date();
    const clock = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    if (heroClock?.isConnected) heroClock.textContent = clock;
    if (frameClock) frameClock.textContent = now.getFullYear() + '.' + pad(now.getMonth() + 1) + '.' + pad(now.getDate()) + ' // ' + clock;
    if (frameUptime) { const s = Math.floor((Date.now() - started) / 1000); frameUptime.textContent = 'SESSION ' + pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }
  }

  /* ── Holographic stage under each activity's art ─────────────────────────── */
  function mountHolo() {
    for (const art of document.querySelectorAll('#ledger-log .ledger-card-art')) {
      if (art.querySelector(':scope>.hud-holo')) continue;
      const holo = node('span', 'hud-holo', art);
      node('i', 'hud-holo-beam', holo); node('i', 'hud-holo-pad', holo); node('i', 'hud-holo-pad b', holo);
    }
  }

  /* ── Re-attach after every Ledger render ─────────────────────────────────── */
  let pending = 0, mutating = false;
  function decorate() {
    pending = 0; mutating = true;
    try {
      const today = document.getElementById('ledger-today-readout');
      if (today && !today.closest('[hidden]')) mountReactor(today, todayArcs());
      const award = document.getElementById('ledger-achievement-readout');
      if (award && !award.closest('[hidden]')) {
        const frac = Math.max(0, Math.min(1, Number(award.dataset.fraction) || 0));
        mountReactor(award, [{color: 'var(--hud-amber)', pct: frac * 100, letter: ''}], '');
      }
      mountTelemetry();
      mountHolo();
    } finally { mutating = false; }
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };

  function watchApp(app) {
    new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.type === 'attributes') {
          const card = r.target;
          if (card.classList?.contains('ledger-habit-card') && card.getAttribute('aria-hidden') === 'false' && !still()) {
            card.classList.remove('hud-materialize'); void card.offsetWidth; card.classList.add('hud-materialize');
            setTimeout(() => card.classList.remove('hud-materialize'), 520);
          }
          continue;
        }
        if ([...r.addedNodes].some(n => n.nodeType === 1 && !n.matches?.('.hud-reactor,.hud-telemetry,.hud-holo'))) { schedule(); break; }
        if (r.target.nodeType === 1 && !r.target.closest?.('.hud-telemetry,.hud-reactor,.hud-holo') && r.addedNodes.length) { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden', 'hidden']});
    // Switching tabs only toggles hidden; reactors need measuring once visible.
    app.addEventListener('click', e => { if (e.target.closest('.ledger-nav button,.ledger-value-jump,[data-view]')) schedule(); });
    window.addEventListener('resize', schedule);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  function burstAt(control) {
    if (still()) return;
    const box = control.getBoundingClientRect();
    if (!box.width) return;
    const card = control.closest('.ledger-habit-card,.row');
    const accent = card ? getComputedStyle(card).getPropertyValue('--ledger-card-accent').trim() || getComputedStyle(card).getPropertyValue('--ledger-list-accent').trim() : '';
    const xp = (card?.querySelector('.ledger-card-xp strong')?.textContent || '').trim();
    const burst = node('div', 'hud-burst', document.body);
    burst.style.left = box.left + box.width / 2 + 'px';
    burst.style.top = box.top + box.height / 2 + 'px';
    if (accent) burst.style.setProperty('--burst', accent);
    node('i', 'hud-burst-ring', burst); node('i', 'hud-burst-ring b', burst); node('i', 'hud-burst-flash', burst);
    const tag = node('span', 'hud-burst-tag', burst);
    tag.textContent = 'LOGGED' + (xp ? '  ' + xp : '');
    setTimeout(() => burst.remove(), 1100);
  }
  document.addEventListener('click', e => {
    const control = e.target.closest?.('#ledger-log [data-act="toggle"]');
    if (control && control.getAttribute('aria-pressed') !== 'true') burstAt(control);
  }, true);

  /* ── Boot sequence: once per session, skipped for reduced motion ─────────── */
  function boot(force) {
    if (!force) {
      if (still() || automated) return;
      try { if (sessionStorage.getItem('lifeledger:hud-boot')) return; sessionStorage.setItem('lifeledger:hud-boot', '1'); } catch { return; }
    }
    const shell = node('div', 'hud-boot', document.body);
    shell.innerHTML =
      '<svg viewBox="0 0 200 200" class="hud-boot-core">' +
      '<circle cx="100" cy="100" r="92" class="b1"/><circle cx="100" cy="100" r="78" class="b2"/>' +
      '<circle cx="100" cy="100" r="62" class="b3"/><circle cx="100" cy="100" r="44" class="b4"/>' +
      '<circle cx="100" cy="100" r="18" class="b5"/></svg>' +
      '<div class="hud-boot-copy"><b>LIFE LEDGER</b><ol></ol></div>';
    const list = shell.querySelector('ol');
    const lines = ['Calibrating value matrix', 'Restoring check-in state', 'Projecting hologram', 'All systems nominal'];
    // Time the sequence from the first frame the screen can actually show.
    requestAnimationFrame(() => lines.forEach((text, i) => setTimeout(() => {
      const li = document.createElement('li');
      li.innerHTML = '<span></span><em>' + (i === lines.length - 1 ? 'ONLINE' : 'OK') + '</em>';
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
    const app = document.getElementById('app');
    if (app) { watchApp(app); schedule(); }
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
