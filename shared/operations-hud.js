/* Operations Cadence HUD. Decorative layer only: it reads the rendered page and
   checklist progress and never touches tasks, the log or schedules. Text keeps sentence case (no forced caps). Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'operations-cadence' || !window.AtlasHUDCore || window.OperationsHUD) return;
  window.OperationsHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'Operations Cadence', tagline: 'OS 5.0 // Practice ops', caps: false, bootKey: 'operations:hud-boot', bootLines: ['Loading the checklists', 'Checking what is due', 'Opening the log', 'All systems nominal'], tilt: 'main .operations-opening'});
  const {node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot} = hud;

  /* ── Cadence rings: one arc per checklist, the share of it ticked off ───── */
  const CADENCES = [['daily', '#b6f06a', 'D'], ['weekly', '#6ff2c8', 'W'], ['monthly', '#8cc8ff', 'M'], ['quarterly', '#b591ff', 'Q'], ['annually', '#ffb347', 'A'], ['adhoc', '#f0628a', '']];
  function cadenceArcs() {
    try {
      // eslint-disable-next-line no-undef
      const data = typeof DATA !== 'undefined' ? DATA : [];
      // eslint-disable-next-line no-undef
      const stats = typeof sectionStats === 'function' ? sectionStats : null;
      if (!data.length || !stats) throw 0;
      return CADENCES.map(([id, color, letter]) => {
        const sec = data.find(s => s.id === id);
        const s = sec ? stats(sec) : {done: 0, total: 0};
        const name = {daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annual', adhoc: 'As needed'}[id];
        return {color, pct: s.total ? 100 * s.done / s.total : 0, letter, label: name, value: s.done + ' of ' + s.total + ' done', done: name + ' checklist complete', scene: true, sceneDetail: s.total + ' of ' + s.total + ' done'};
      });
    } catch { return [{color: 'var(--hud-tab)', pct: 100, letter: ''}]; }
  }
  function mountRing(hero) {
    const face = hero.querySelector('.operations-opening-face');
    const art = face?.querySelector('.operations-title-art');
    if (!face || !art) return;
    let svg = face.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(face, ''); face.append(svg); }
    face.classList.add('hud-reactor-host');
    const a = art.getBoundingClientRect(), f = face.getBoundingClientRect();
    if (!a.width) return;
    const size = Math.min(Math.max(a.width, a.height) * 1.0, f.width * 1.02, 360);
    Object.assign(svg.style, {width: size + 'px', height: size + 'px', left: (a.left - f.left + (a.width - size) / 2) + 'px', top: (a.top - f.top + (a.height - size) / 2) + 'px'});
    paintArcs(svg, cadenceArcs());
  }

  /* ── Live clock in the opening rail ──────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('main .operations-opening .operations-opening-rail');
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

  /* ── Re-attach after every render ────────────────────────────────────────── */
  let pending = 0, mutating = false, lastView = '';
  function decorate() {
    pending = 0; mutating = true;
    try {
      const hero = document.querySelector('main .operations-opening');
      if (hero) mountRing(hero);
      mountTelemetry();
      const view = hero?.dataset.opening || '';
      const main = document.querySelector('main');
      if (lastView && view !== lastView && main && !still() && !document.documentElement.classList.contains('hud-native')) {
        main.classList.remove('hud-scan-in'); void main.offsetWidth; main.classList.add('hud-scan-in');
        setTimeout(() => main.classList.remove('hud-scan-in'), 620);
      }
      lastView = view;
    } finally { mutating = false; }
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp() {
    const app = document.querySelector('.shell') || document.body;
    if (!app) return;
    new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.target.closest?.('.hud-telemetry,.hud-reactor')) continue;
        if (r.type === 'attributes' || r.addedNodes.length || r.type === 'characterData') { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-opening']});
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  document.addEventListener('click', e => {
    const control = e.target.closest?.('.shell button');
    if (!control) return;
    const text = control.textContent.trim().toLowerCase();
    if (/^(add|save|log|capture)/.test(text)) burstAt(control, 'Logged');
  }, true);

  function init() {
    root.classList.add('hud-on');
    startField();
    startExtras();
    // Pages sweep in, cards build in, figures decode, bars fill (shared/hud-core.js).
    hud.native({scope: 'main', blocks: 'main>section'});
    startFrame();
    boot();
    node('div', 'hud-scan', document.body);
    watchApp(); schedule();
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
