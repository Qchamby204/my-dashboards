/* Life Map HUD. Decorative layer only: it reads the rendered board and never
   touches Life Map records. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'life-map' || typeof window === 'undefined' || !window.AtlasHUDCore || window.LifeMapHUD) return;
  window.LifeMapHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'LIFE MAP', tagline: 'OS 5.0 // AREA GRID ONLINE', caps: true, bootKey: 'lifemap:hud-boot', bootLines: ['Mapping life areas', 'Loading projects and tasks', 'Syncing calendar', 'All systems nominal'], accentVars: ['--neo-accent']});
  const {node, svgNode, still, pad, started, startField, startFrame, frameTick, buildReactor, paintArcs, boot} = hud;

  /* ── Reactor rings around the hologram ───────────────────────────────────── */
  function routineArcs() {
    const label = document.querySelector('#lm-day-view-home .lm-instrument')?.getAttribute('aria-label') || '';
    const m = label.match(/(\d+) of (\d+)/);
    const pct = m && Number(m[2]) ? Math.min(100, 100 * Number(m[1]) / Number(m[2])) : 0;
    return [{color: 'var(--neo-accent)', pct, letter: ''}];
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
      tele.append('LIVE ');
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
    if (control && control.getAttribute('aria-pressed') !== 'true') burstAt(control, 'COMPLETE');
  }, true);

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
