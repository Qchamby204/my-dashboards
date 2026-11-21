/* Life Map HUD. Decorative layer only: it reads the rendered board and never
   touches Life Map records. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'life-map' || typeof window === 'undefined' || !window.AtlasHUDCore || window.LifeMapHUD) return;
  window.LifeMapHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'Life Map', tagline: 'OS 5.0 // Area grid online', bootKey: 'lifemap:hud-boot', bootLines: ['Mapping life areas', 'Loading projects and tasks', 'Syncing calendar', 'All systems nominal'], accentVars: ['--neo-accent'], tilt: '#lm-day-view-home .lm-now-card'});
  const {node, svgNode, still, pad, started, automated, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, boot} = hud;

  /* ── Reactor rings around the hologram ───────────────────────────────────── */
  function routineArcs() {
    const label = document.querySelector('#lm-day-view-home .lm-instrument')?.getAttribute('aria-label') || '';
    const m = label.match(/(\d+) of (\d+)/);
    const pct = m && Number(m[2]) ? Math.min(100, 100 * Number(m[1]) / Number(m[2])) : 0;
    return [{color: 'var(--neo-accent)', pct, letter: '', label: 'Daily routines', value: m ? m[1] + ' of ' + m[2] + ' done' : 'None yet', done: 'Day complete', scene: true, sceneDetail: m ? 'All ' + m[2] + ' routines done' : ''}];
  }

  /* ── Live clock on the "Right now" card ──────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('#lm-day-view-home .lm-now-card .lm-feature-rail');
    if (!rail) return;
    let tele = rail.querySelector('.hud-telemetry');
    if (!tele) {
      tele = node('span', 'hud-telemetry', rail);
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
    frameTick(now);
  }

  /* ── Re-attach after every Life Map render ───────────────────────────────── */
  let pending = 0, mutating = false;
  function decorate() {
    pending = 0; mutating = true;
    try {
      const face = document.querySelector('#lm-day-view-home .lm-instrument .lm-dial-face');
      if (face && !face.closest('[hidden]')) mountRing(face, routineArcs());
      mountTelemetry();
      const view = document.querySelector('#app .lm-day-view:not([hidden])');
      if (view) arriveView(view);
    } finally { mutating = false; }
  }
  function mountRing(face, arcs) {
    let svg = face.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(face, ''); face.append(svg); }
    face.classList.add('hud-reactor-host');
    paintArcs(svg, arcs);
    mountSatellites(svg);
  }

  /* ── Routine satellites: each daily routine is a satellite orbiting the terrain;
     finished ones dock in a ring round the day dial, and finishing one sends its
     satellite diving into the dial. Reads the dial's "done of total" label only. */
  let satDone = null, satTouched = 0;
  addEventListener('pointerdown', () => { satTouched = Date.now(); }, {capture: true, passive: true});
  addEventListener('keydown', () => { satTouched = Date.now(); }, {capture: true, passive: true});
  const ORBIT = 'M40 112a235 64 0 1 0 470 0a235 64 0 1 0-470 0';
  function mountSatellites(svg) {
    const plate = document.querySelector('#lm-day-view-home .lm-route-plate');
    const relief = plate?.querySelector('.lm-relief');
    const m = (document.querySelector('#lm-day-view-home .lm-instrument')?.getAttribute('aria-label') || '').match(/(\d+) of (\d+)/);
    if (!plate || !relief) return;
    const done = m ? Number(m[1]) : 0, total = m ? Math.min(Number(m[2]), 24) : 0;
    let sky = plate.querySelector(':scope>.hud-orbit');
    if (!sky) {
      sky = svgNode('svg', {class: 'hud-orbit', viewBox: '0 0 550 208', 'aria-hidden': 'true', focusable: 'false'});
      svgNode('path', {d: ORBIT, class: 'hud-orbit-path'}, sky);
      svgNode('g', {class: 'hud-orbit-sats'}, sky);
      plate.append(sky);
    }
    // Sit exactly over the terrain drawing.
    const pr = plate.getBoundingClientRect(), rr = relief.getBoundingClientRect();
    Object.assign(sky.style, {left: (rr.left - pr.left) + 'px', top: (rr.top - pr.top) + 'px', width: rr.width + 'px', height: rr.height + 'px'});
    let dock = svg.querySelector(':scope>.hud-dock');
    if (!dock) dock = svgNode('g', {class: 'hud-dock'}, svg);
    const sig = done + '/' + total;
    if (sky.dataset.sig === sig) return;
    const rise = satDone != null && done > satDone && Date.now() - satTouched < 6000;
    const leaving = rise ? sky.querySelector('.hud-orbit-sats .hud-sat:last-child') : null;
    const from = leaving?.getBoundingClientRect();
    sky.dataset.sig = sig;
    const group = sky.querySelector('.hud-orbit-sats');
    group.textContent = '';
    const pending = Math.max(0, total - done), period = 26;
    for (let i = 0; i < pending; i++) {
      const g = svgNode('g', {class: 'hud-sat'}, group);
      svgNode('circle', {r: 9, class: 'hud-sat-halo'}, g);
      svgNode('circle', {r: 4, class: 'hud-sat-body'}, g);
      if (still()) {
        // Hold them evenly round the orbit.
        const a = i / Math.max(pending, 1) * Math.PI * 2;
        g.setAttribute('transform', 'translate(' + (275 + 235 * Math.cos(a)).toFixed(1) + ' ' + (112 + 64 * Math.sin(a)).toFixed(1) + ')');
      } else {
        svgNode('animateMotion', {dur: period + 's', repeatCount: 'indefinite', begin: (-i * period / Math.max(pending, 1)).toFixed(2) + 's', path: ORBIT}, g);
      }
    }
    dock.textContent = '';
    for (let i = 0; i < done; i++) {
      const a = (i / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
      svgNode('circle', {cx: (100 + 30 * Math.cos(a)).toFixed(2), cy: (100 + 30 * Math.sin(a)).toFixed(2), r: 3, class: 'hud-docked'}, dock);
    }
    if (rise && from && !still()) diveIn(sky, svg, from);
    satDone = done;
  }
  function diveIn(sky, reactor, from) {
    const box = sky.getBoundingClientRect(), dial = reactor.getBoundingClientRect();
    const toUnits = (x, y) => [(x - box.left) / box.width * 550, (y - box.top) / box.height * 208];
    const [x1, y1] = toUnits(from.left + from.width / 2, from.top + from.height / 2);
    const [x2, y2] = toUnits(dial.left + dial.width / 2, dial.top + dial.height / 2);
    const fly = svgNode('g', {class: 'hud-sat hud-sat-fly'}, sky);
    svgNode('circle', {r: 11, class: 'hud-sat-halo'}, fly);
    svgNode('circle', {r: 5, class: 'hud-sat-body'}, fly);
    const trail = svgNode('path', {class: 'hud-sat-trail', d: 'M' + x1 + ' ' + y1}, sky);
    const cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - 70, t0 = performance.now(), D = 1000, pts = [];
    const step = now => {
      const k = Math.min(1, (now - t0) / D), e = k * k * (3 - 2 * k);
      const x = (1 - e) * (1 - e) * x1 + 2 * (1 - e) * e * cx + e * e * x2, y = (1 - e) * (1 - e) * y1 + 2 * (1 - e) * e * cy + e * e * y2;
      fly.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + (1.2 - .7 * e).toFixed(2) + ')');
      pts.push(x.toFixed(1) + ' ' + y.toFixed(1)); trail.setAttribute('d', 'M' + pts.slice(-14).join(' L'));
      if (k < 1) requestAnimationFrame(step);
      else {
        fly.remove(); trail.remove();
        reactor.classList.remove('hud-docking'); void reactor.getBBox?.(); reactor.classList.add('hud-docking');
        setTimeout(() => reactor.classList.remove('hud-docking'), 900);
      }
    };
    requestAnimationFrame(step);
  }


  /* ── HUD-native Life Map. Motion that makes the app itself feel like the display:
     - views warp in from the side of the tab you chose;
     - panels and task rows rise in the first time they scroll into view;
     - the calendar grid ripples outward from the selected day;
     - a task you finish dissolves upward like a hologram once the app has saved it.
     Entrance motion uses only opacity, clipping and light (nothing moves layout),
     is off under reduced motion, and is left out for automated browsers, like the
     boot sequence, so layout checks never measure a half-drawn view. */
  const VIEWS = ['home', 'projects', 'calendar'];
  const motionOK = () => !still() && !automated;
  const afterRender = fn => requestAnimationFrame(() => requestAnimationFrame(fn));
  let lastView = 0;
  function arriveView(view) {
    const i = VIEWS.indexOf(view.id.replace('lm-day-view-', ''));
    if (i < 0 || i === lastView) return;
    const from = lastView; lastView = i;
    if (!motionOK()) return;
    view.classList.remove('hud-warp-left', 'hud-warp-right'); void view.offsetWidth;
    view.classList.add(i > from ? 'hud-warp-right' : 'hud-warp-left');
    setTimeout(() => view.classList.remove('hud-warp-left', 'hud-warp-right'), 650);
    afterRender(() => { stackIn(view); if (VIEWS[i] === 'calendar') ripple(); });
  }

  // Panels and rows materialise the first time they scroll in.
  const seen = new WeakSet();
  let stackObserver = null;
  const STACK = '.panel, .lm-task-row, .lm-area-option';
  function stackIn(scope) {
    if (!motionOK() || !window.IntersectionObserver) return;
    stackObserver ||= new IntersectionObserver(entries => {
      let n = 0;
      for (const e of entries) {
        if (!e.isIntersecting || seen.has(e.target)) continue;
        seen.add(e.target); stackObserver.unobserve(e.target);
        const t = e.target, d = Math.min(n++, 10) * 55;
        t.style.setProperty('--hud-d', d + 'ms');
        t.classList.add('hud-rise');
        setTimeout(() => t.classList.remove('hud-rise'), 900 + d);
      }
    }, {rootMargin: '0px 0px -6% 0px'});
    for (const n of (scope || document).querySelectorAll(STACK)) if (!seen.has(n) && !n.closest('[hidden]')) stackObserver.observe(n);
  }

  // Calendar: day cells light up in a wave spreading out from the selected day.
  function ripple() {
    const grid = document.querySelector('#lm-day-view-calendar .lm-month-grid');
    if (!grid || !motionOK()) return;
    const cells = [...grid.children];
    const origin = Math.max(0, cells.findIndex(c => c.getAttribute?.('aria-pressed') === 'true'));
    const ox = origin % 7, oy = Math.floor(origin / 7);
    cells.forEach((c, i) => {
      if (!c.classList.contains('lm-month-day')) return;
      const d = Math.hypot(i % 7 - ox, Math.floor(i / 7) - oy);
      c.style.setProperty('--hud-d', Math.round(d * 60) + 'ms');
      c.classList.remove('hud-ripple'); void c.offsetWidth; c.classList.add('hud-ripple');
    });
    setTimeout(() => cells.forEach(c => c.classList?.remove('hud-ripple')), 1300);
  }

  // A finished task leaves as a hologram: a copy of its row, pinned where it was,
  // dissolves upward. It plays only once the app has re-rendered the task as done.
  function ghostOut(title, rect) {
    const host = document.getElementById('app') || document.body;
    const ghost = node('div', 'hud-ghost', host);
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, {left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px'});
    node('i', 'hud-ghost-tick', ghost);
    const words = node('span', 'hud-ghost-words', ghost);
    node('b', '', words).textContent = title;
    node('small', '', words).textContent = 'Task complete';
    node('i', 'hud-ghost-scan', ghost);
    setTimeout(() => ghost.remove(), 1500);
  }
  function watchCompletion() {
    document.addEventListener('click', e => {
      const control = e.target.closest?.('#app .lm-task-row [data-lm="complete"]');
      if (!control || control.getAttribute('aria-pressed') === 'true' || !motionOK()) return;
      const row = control.closest('.lm-task-row'), rect = row.getBoundingClientRect(), id = control.dataset.id;
      if (!rect.width) return;
      const title = row.querySelector('.lm-task-title')?.textContent.trim() || '';
      let tries = 0;
      const check = () => afterRender(() => {
        const now = [...document.querySelectorAll('#app [data-lm="complete"][data-id="' + CSS.escape(id) + '"]')].filter(b => b.offsetParent);
        if (!row.isConnected && (!now.length || now.every(b => b.getAttribute('aria-pressed') === 'true'))) ghostOut(title, rect);
        else if (++tries < 10) setTimeout(check, 120);
      });
      setTimeout(check, 60);
    }, true);
    // Month changes and area filters rebuild what is on screen; let it arrive again.
    document.addEventListener('click', e => {
      if (!motionOK()) return;
      if (e.target.closest?.('#lm-day-view-calendar .lm-month-header button')) afterRender(() => setTimeout(ripple, 40));
      else if (e.target.closest?.('.lm-area-option')) setTimeout(() => afterRender(() => stackIn(document.getElementById('lm-day-view-projects'))), 120);
    }, true);
  }

  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp(app) {
    new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.type === 'attributes') {
          schedule();
          continue;
        }
        if (r.target.closest?.('.hud-telemetry,.hud-reactor')) continue;
        if (r.addedNodes.length) { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-label']});
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  function burstAt(control, label) {
    if (still()) return;
    const box = control.getBoundingClientRect();
    if (!box.width) return;
    const card = control.closest('.lm-task-row,.lm-feature');
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
    const control = e.target.closest?.('#app :is(.lm-check,[data-day="mandatory-toggle"])');
    if (control && control.getAttribute('aria-pressed') !== 'true') burstAt(control, 'Complete');
  }, true);

  function init() {
    root.classList.add('hud-on');
    startField();
    startExtras();
    startFrame();
    boot();
    const app = document.getElementById('app');
    if (app) { watchApp(app); schedule(); }
    watchCompletion();
    afterRender(() => stackIn(document.querySelector('.lm-day-view:not([hidden])')));
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
