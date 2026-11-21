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
  const {node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, boot} = hud;

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

  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp(app) {
    new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.type === 'attributes') {
          const view = r.target;
          if (view.classList?.contains('lm-day-view') && !view.hidden && !still()) {
            view.classList.remove('hud-scan-in'); void view.offsetWidth; view.classList.add('hud-scan-in');
            setTimeout(() => view.classList.remove('hud-scan-in'), 620);
          }
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
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
