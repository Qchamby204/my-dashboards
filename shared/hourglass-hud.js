/* The Hourglass HUD. Decorative layer only: it reads the rendered page and never
   touches dates, milestones, bonds or settings. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'the-hourglass' || !window.AtlasHUDCore || window.HourglassHUD) return;
  window.HourglassHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'THE HOURGLASS', tagline: 'OS 5.0 // CHRONOMETER', caps: true, bootKey: 'hourglass:hud-boot', bootLines: ['Calibrating the chronometer', 'Counting your weeks', 'Marking what matters', 'All systems nominal']});
  const {node, svgNode, still, pad, started, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot} = hud;

  /* ── Life-clock rings: this year lived, and life against the planning horizon ── */
  function clockArcs() {
    const label = document.querySelector('#app .hg-progress-label')?.textContent || '';
    const note = document.querySelector('#app .hg-note')?.textContent || '';
    const year = Number((label.match(/(\d+)%/) || [])[1]);
    const age = Number((label.match(/Age\s+(\d+)/i) || [])[1]);
    const horizon = Number((note.match(/age\s+(\d+)/i) || [])[1]);
    const arcs = [];
    if (age && horizon) arcs.push({color: 'var(--hud-hue)', pct: Math.min(100, 100 * (age + (year || 0) / 100) / horizon), letter: ''});
    if (!Number.isNaN(year) && label) arcs.push({color: '#8cc8ff', pct: year, letter: ''});
    return arcs.length ? arcs : [{color: 'var(--hud-hue)', pct: 100, letter: ''}];
  }
  function mountRing(hero) {
    const face = hero.querySelector('.hourglass-opening-face');
    const art = face?.querySelector('.hourglass-title-art');
    if (!face || !art) return;
    let svg = face.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(face, ''); face.append(svg); }
    face.classList.add('hud-reactor-host');
    const a = art.getBoundingClientRect(), f = face.getBoundingClientRect();
    if (!a.width) return;
    const size = Math.min(Math.hypot(a.width, a.height) * 1.18, f.width * 1.02, 340);
    Object.assign(svg.style, {width: size + 'px', height: size + 'px', left: (a.left - f.left + (a.width - size) / 2) + 'px', top: (a.top - f.top + (a.height - size) / 2) + 'px'});
    paintArcs(svg, clockArcs());
  }

  /* ── Live clock in the opening rail ──────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('#app .hourglass-opening .hourglass-opening-rail');
    if (!rail) return;
    let tele = rail.querySelector('.hud-telemetry');
    if (!tele) {
      tele = node('span', 'hud-telemetry', rail);
      node('i', 'hud-live', tele);
      tele.append('T ');
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

  /* ── Re-attach after every render ────────────────────────────────────────── */
  let pending = 0, mutating = false, lastView = '';
  function decorate() {
    pending = 0; mutating = true;
    try {
      const hero = document.querySelector('#app .hourglass-opening');
      if (hero) mountRing(hero);
      mountTelemetry();
      const view = hero?.dataset.opening || '';
      const app = document.getElementById('app');
      if (lastView && view !== lastView && app && !still()) {
        app.classList.remove('hud-scan-in'); void app.offsetWidth; app.classList.add('hud-scan-in');
        setTimeout(() => app.classList.remove('hud-scan-in'), 620);
      }
      lastView = view;
    } finally { mutating = false; }
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp() {
    const app = document.getElementById('app');
    if (!app) return;
    new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.target.closest?.('.hud-telemetry,.hud-reactor')) continue;
        if (r.type === 'attributes' || r.addedNodes.length) { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-opening']});
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  document.addEventListener('click', e => {
    const control = e.target.closest?.('#app :is(.btn,button)');
    if (!control || control.closest('.atlas-page-dock,.atlas-header-actions')) return;
    const text = control.textContent.trim().toLowerCase();
    if (/^(save|add|done)\b/.test(text) && control.closest('form,dialog,.modal,[role=dialog]')) burstAt(control, 'LOGGED');
    else if (control.id === 'makeWall') burstAt(control, 'RENDERING');
  }, true);

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
