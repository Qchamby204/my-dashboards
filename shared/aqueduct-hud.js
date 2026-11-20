/* The Aqueduct HUD. Decorative layer only: it reads the rendered page and the
   plan totals and never touches records, the tax engine or statements. Text keeps sentence case (no forced caps). Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'the-aqueduct' || !window.AtlasHUDCore || window.AqueductHUD) return;
  window.AqueductHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'The Aqueduct', tagline: 'OS 5.0 // Waterworks', caps: false, bootKey: 'aqueduct:hud-boot', bootLines: ['Reading the book', 'Running the cascade', 'Balancing the plan', 'All systems nominal'], tilt: '#app .aqueduct-opening'});
  const {node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot} = hud;

  /* ── Cascade rings: where each take-home dollar goes, one arc per bucket ── */
  const BUCKETS = [['expensesMo', '#4ea3e0', 'Bills'], ['debtMo', '#f0628a', 'Debt'], ['savingsMo', '#2fd180', 'Saving'], ['spendMo', '#f0b73e', 'Spending']];
  const money = v => '$' + Math.round(v).toLocaleString('en-CA');
  function cascadeArcs() {
    let take = 0, parts = [];
    try {
      take = Number(window.takeHomeMo?.()) || 0;
      parts = BUCKETS.map(([fn, color, label]) => ({color, label, v: Math.max(0, Number(window[fn]?.()) || 0)}));
    } catch { parts = []; }
    if (!take || !parts.length) return BUCKETS.map(([, color, label]) => ({color, pct: 0, letter: '', label, value: 'No income set'}));
    return parts.map(p => { const pct = Math.min(100, 100 * p.v / take); return {color: p.color, pct, letter: '', label: p.label, value: Math.round(pct) + '% · ' + money(p.v) + '/mo'}; });
  }
  function mountRing(hero) {
    const face = hero.querySelector('.aqueduct-opening-face');
    const art = face?.querySelector('.aqueduct-title-art');
    if (!face || !art) return;
    let svg = face.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(face, ''); face.append(svg); }
    face.classList.add('hud-reactor-host');
    const a = art.getBoundingClientRect(), f = face.getBoundingClientRect();
    if (!a.width) return;
    const size = Math.min(Math.max(a.width, a.height) * 1.0, f.width * 1.02, 360);
    Object.assign(svg.style, {width: size + 'px', height: size + 'px', left: (a.left - f.left + (a.width - size) / 2) + 'px', top: (a.top - f.top + (a.height - size) / 2) + 'px'});
    paintArcs(svg, cascadeArcs());
  }

  /* ── Live clock in the opening rail ──────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('#app .aqueduct-opening .aqueduct-opening-rail');
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
      const hero = document.querySelector('#app .aqueduct-opening');
      if (hero) mountRing(hero);
      mountTelemetry();
      const view = hero?.dataset.opening || '';
      const main = document.getElementById('app');
      if (lastView && view !== lastView && main && !still()) {
        main.classList.remove('hud-scan-in'); void main.offsetWidth; main.classList.add('hud-scan-in');
        setTimeout(() => main.classList.remove('hud-scan-in'), 620);
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
        if (r.type === 'attributes' || r.addedNodes.length || r.type === 'characterData') { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-opening']});
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  document.addEventListener('click', e => {
    const control = e.target.closest?.('#app .btn, #app button');
    if (!control) return;
    const text = control.textContent.trim().toLowerCase();
    if (/^(add|save|log|record|run|apply|use entered)/.test(text)) burstAt(control, /^run/.test(text) ? 'Reconciled' : /^(add|log|record)/.test(text) ? 'Logged' : 'Saved');
  }, true);

  function init() {
    root.classList.add('hud-on');
    startField();
    startExtras();
    startFrame();
    boot();
    node('div', 'hud-scan', document.body);
    watchApp(); schedule();
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
